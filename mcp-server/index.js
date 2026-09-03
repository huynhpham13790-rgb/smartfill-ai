/*
 * SmartFill AI - mcp-server/index.js
 * MCP server: quét và điền form qua Chrome DevTools Protocol, không cần extension.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import CDP from "chrome-remote-interface";
import { buildPrompt } from "../shared/prompt.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the MCP server
const server = new Server(
  {
    name: "smartfill-ai-mcp",
    version: "1.4.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/** Helper to connect to the browser remote debugging port 9222 */
async function getActiveTabClient(targetUrl) {
  let targets = [];
  try {
    targets = await CDP.List();
  } catch (err) {
    throw new Error(
      `Cannot connect to browser remote debugging port 9222: ${err.message}. ` +
      `Make sure you launched a Chromium-based browser with remote debugging enabled, ` +
      `for example: 'google-chrome --remote-debugging-port=9222'. ` +
      `Firefox/Zen are not supported: they do not expose the Chrome DevTools Protocol.`
    );
  }

  let target;
  if (targetUrl) {
    target = targets.find((t) => t.type === "page" && t.url.includes(targetUrl));
  }
  if (!target) {
    // Fall back to first open page tab
    target = targets.find((t) => t.type === "page");
  }

  if (!target) {
    throw new Error("No open browser pages/tabs found via remote debugging (port 9222).");
  }

  const client = await CDP({ target });
  return client;
}

/** Prepares the content script to be evaluated on the page */
function getContentScript() {
  const contentJsPath = path.resolve(__dirname, "../src/content.js");
  let script = fs.readFileSync(contentJsPath, "utf8");
  // Safeguard chrome.runtime listener call in direct page context
  script = script.replace(
    "chrome.runtime.onMessage.addListener",
    "if (typeof chrome !== 'undefined' && chrome.runtime) chrome.runtime.onMessage.addListener"
  );
  return script;
}

/** Tool implementation: scan_form */
async function scanActiveTab(targetUrl) {
  const client = await getActiveTabClient(targetUrl);
  const { Runtime } = client;
  try {
    await Runtime.enable();
    await Runtime.evaluate({ expression: getContentScript() });

    const result = await Runtime.evaluate({
      expression: `(() => {
        const fields = scanFields();
        return fields.map(serializeField);
      })()`,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new Error(`Exception during form scanning: ${result.exceptionDetails.exception.description}`);
    }

    return result.result.value;
  } finally {
    await client.close();
  }
}

/** Queries local Ollama model to resolve field values */
async function callLocalOllama(profile, fields, model, ollamaUrl) {
  const prompt = buildPrompt(profile, fields);
  const normalizedOllamaUrl = ollamaUrl.replace(/\/$/, "");

  let resp;
  try {
    resp = await fetch(`${normalizedOllamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });
  } catch (e) {
    throw new Error(
      `Cannot connect to local Ollama at ${normalizedOllamaUrl}. Is Ollama running? (${e.message})`
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Ollama returned error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data && data.message && data.message.content;
  if (!content) throw new Error("Ollama returned empty message content.");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error("Failed to parse JSON from AI: " + content.slice(0, 200));
  }

  const mapping = Array.isArray(parsed.mapping) ? parsed.mapping : [];
  return mapping;
}

/** Tool implementation: fill_form */
async function fillActiveTabForm(profile, model = "qwen2.5:7b", ollamaUrl = "http://localhost:11434", targetUrl) {
  const client = await getActiveTabClient(targetUrl);
  const { Runtime } = client;
  try {
    await Runtime.enable();
    await Runtime.evaluate({ expression: getContentScript() });

    // 1. Scan fields first
    const scanResult = await Runtime.evaluate({
      expression: `(() => {
        const fields = scanFields();
        return fields.map(serializeField);
      })()`,
      returnByValue: true,
    });

    if (scanResult.exceptionDetails) {
      throw new Error(`Exception during form scanning: ${scanResult.exceptionDetails.exception.description}`);
    }

    const fields = scanResult.result.value;
    if (!fields || fields.length === 0) {
      return { success: false, error: "No interactive fields detected on the active tab." };
    }

    // 2. Call local Ollama to resolve mapping
    const mapping = await callLocalOllama(profile, fields, model, ollamaUrl);

    // 3. Inject the resolved values back into the DOM using applyMapping
    const mappingStr = JSON.stringify(mapping);
    const fillExpr = `
      (async () => {
        const fields = scanFields();
        const mapping = ${mappingStr};
        const res = await applyMapping(fields, mapping);
        return res;
      })()
    `;

    const fillResult = await Runtime.evaluate({
      expression: fillExpr,
      awaitPromise: true,
      returnByValue: true,
    });

    if (fillResult.exceptionDetails) {
      throw new Error(`Exception during form filling: ${fillResult.exceptionDetails.exception.description}`);
    }

    return {
      success: true,
      detectedFieldsCount: fields.length,
      filledResult: fillResult.result.value,
      mapping: mapping,
    };
  } finally {
    await client.close();
  }
}

// Set up tool schemas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scan_form",
        description: "Scan the active tab of the running browser to detect and extract form fields.",
        inputSchema: {
          type: "object",
          properties: {
            targetUrl: {
              type: "string",
              description: "Target URL keyword to match. If omitted, the first open browser tab is targeted.",
            },
          },
        },
      },
      {
        name: "fill_form",
        description: "Scan the active tab of the running browser and automatically fill the fields using the provided profile.",
        inputSchema: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              description: "Key-value mapping of user profile data (e.g. {'fullname': 'Phạm Văn Huynh', 'student_id': 'DTC245200357'}).",
            },
            model: {
              type: "string",
              description: "The local Ollama model to use for field resolution (optional, default: qwen2.5:7b).",
            },
            ollamaUrl: {
              type: "string",
              description: "The local Ollama server endpoint (optional, default: http://localhost:11434).",
            },
            targetUrl: {
              type: "string",
              description: "Target URL keyword to match. If omitted, the first open browser tab is targeted.",
            },
          },
          required: ["profile"],
        },
      },
    ],
  };
});

// Route tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "scan_form") {
      const { targetUrl } = args || {};
      const fields = await scanActiveTab(targetUrl);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fields, null, 2),
          },
        ],
      };
    } else if (name === "fill_form") {
      const { profile, model, ollamaUrl, targetUrl } = args;
      const result = await fillActiveTabForm(profile, model, ollamaUrl, targetUrl);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: err.message,
        },
      ],
    };
  }
});

// Launch StdIO server connection
const transport = new StdioServerTransport();
await server.connect(transport);
