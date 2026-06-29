import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import CDP from "chrome-remote-interface";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the MCP server
const server = new Server(
  {
    name: "smartfill-ai-mcp",
    version: "1.0.0",
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
      `Make sure you launched your browser with remote debugging enabled, for example: ` +
      `'zen-browser --remote-debugging-port=9222' or 'google-chrome --remote-debugging-port=9222'`
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

/** Prompts helper for local AI query */
function buildPrompt(profile, fields) {
  const profileLines = Object.entries(profile)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const fieldLines = fields
    .map((f) => {
      let line = `{"fid": "${f.fid}", "nhãn": "${f.label}", "loại": "${f.kind}"`;
      if (f.kind === "text" && f.inputType) line += `, "kiểu_text": "${f.inputType}"`;
      if (f.options && f.options.length) {
        line += `, "lựa_chọn_có_sẵn": ${JSON.stringify(f.options)}`;
      }
      line += "}";
      return line;
    })
    .join("\n");

  return `Bạn là trợ lý điền form. Dưới đây là HỒ SƠ của người dùng và DANH SÁCH Ô trên một biểu mẫu web.

HỒ SƠ NGƯỜI DÙNG:
${profileLines || "(trống)"}

DANH SÁCH Ô CẦN ĐIỀN:
${fieldLines}

QUY TẮC BẮT BUỘC:
1. COPY NGUYÊN VĂN giá trị từ HỒ SƠ. TUYỆT ĐỐI KHÔNG sửa, viết lại, dịch, rút gọn hay thêm bớt ký tự. Ví dụ hồ sơ ghi "Phạm Văn Huynh" thì phải trả đúng "Phạm Văn Huynh", không được thành "Hynh".
2. Mỗi ô chỉ trả về MỘT giá trị duy nhất tương ứng. KHÔNG ghép nhiều thông tin, KHÔNG thêm tiền tố như "Địa chỉ:", "SĐT:".
3. Nếu ô có "lựa_chọn_có_sẵn" (select/radio/listbox): giá trị PHẢI là một mục copy nguyên văn từ danh sách đó. Không tự chế giá trị ngoài danh sách.
4. Loại "checkbox": chỉ trả "true" hoặc "false".
5. "kiểu_text" = "date": trả về dạng yyyy-mm-dd.
6. Nếu KHÔNG có thông tin phù hợp trong hồ sơ cho một ô, BỎ QUA ô đó (không thêm vào kết quả). KHÔNG bịa, KHÔNG đoán bừa.
7. KHÔNG dùng một thông tin cho sai ô. Ví dụ "giới tính" KHÔNG được điền vào ô "số điện thoại"/"sdt"; "ngành" KHÔNG được điền vào ô "lớp".
8. Với ô CÓ "lựa_chọn_có_sẵn" mà nhãn ghép nhiều ý (vd "Khoa/Ngành", "Khoa/Viện"): chọn ĐÚNG MỘT mục trong danh sách khớp nhất với BẤT KỲ thông tin nào trong hồ sơ (Khoa HOẶC Ngành). Giá trị BẤT KỲ là một mục copy nguyên văn từ danh sách. Ví dụ danh sách là các khoa và hồ sơ có "Khoa: Công nghệ thông tin" thì trả về đúng "Công nghệ Thông tin" (mục có trong danh sách), KHÔNG trả "Kỹ thuật máy tính" nếu mục đó không có trong danh sách.

GỢI Ý NGỮ NGHĨA (nhãn có thể viết tắt/khác ngôn ngữ):
- "MSV", "MSSV", "Student ID", "mã sinh viên" = Mã số sinh viên.
- "SĐT", "sdt", "phone", "điện thoại" = Số điện thoại.
- "DOB", "ngày sinh", "birth" = Ngày sinh.
- "giới tính", "gender", "sex" = Giới tính.
- "lớp", "class" = Lớp (KHÁC với Ngành/Khoa).
- "địa chỉ", "địa chỉ thường trú", "nơi ở", "thường trú", "address" = Địa chỉ (KHÁC với Quê quán; nếu hồ sơ có cả hai thì ô địa chỉ lấy giá trị "Địa chỉ", ô quê quán lấy "Quê quán").

Trả về DUY NHẤT một JSON đúng định dạng sau, không thêm giải thích:
{"mapping": [{"fid": "sf-0", "value": "giá trị"}, ...]}`;
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
