/*
 * SmartFill AI - background.js (service worker)
 * Nhận danh sách field từ content script, gọi Ollama (AI chạy local)
 * để map dữ liệu hồ sơ vào từng ô, trả về mapping.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

import { buildPrompt } from "../shared/prompt.js";
import { buildFallbackMapping } from "../shared/fallback.js";
import { buildCvPrompt } from "../shared/cv.js";

const DEFAULTS = {
  ollamaUrl: "http://localhost:11434",
  model: "qwen2.5:7b",
};

/** Đọc cấu hình Ollama từ storage, dùng mặc định nếu chưa đặt. */
async function getConfig() {
  const data = await chrome.storage.local.get(["ollamaUrl", "model"]);
  return {
    ollamaUrl: (data.ollamaUrl || DEFAULTS.ollamaUrl).replace(/\/$/, ""),
    model: data.model || DEFAULTS.model,
  };
}

/** Gọi Ollama và lấy mapping. */
async function callOllama(profile, fields) {
  const parsed = await callOllamaJson(buildPrompt(profile, fields));
  return Array.isArray(parsed.mapping) ? parsed.mapping : [];
}

/** Gửi một prompt tới Ollama và trả về JSON đã phân tích. */
async function callOllamaJson(prompt) {
  const { ollamaUrl, model } = await getConfig();

  let resp;
  try {
    resp = await fetch(`${ollamaUrl}/api/chat`, {
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
      "Không kết nối được Ollama tại " + ollamaUrl + ". Kiểm tra Ollama đã chạy chưa? (" + e.message + ")"
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 403) {
      throw new Error(
        "Ollama chặn yêu cầu (403). Cần cho phép extension gọi Ollama: đặt biến môi trường " +
          'OLLAMA_ORIGINS = "*" (PowerShell: setx OLLAMA_ORIGINS "*"), THOÁT hẳn Ollama ở khay hệ thống rồi mở lại.'
      );
    }
    throw new Error(`Ollama trả lỗi ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data && data.message && data.message.content;
  if (!content) throw new Error("Ollama không trả về nội dung.");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    // Thử trích đoạn JSON nếu model lỡ thêm chữ thừa.
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error("Không phân tích được JSON từ AI: " + content.slice(0, 200));
  }

  return parsed;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "mapFields") {
    callOllama(msg.profile, msg.fields)
      .then((mapping) => sendResponse({ ok: true, mapping, source: "ai" }))
      .catch((e) => {
        // Ollama hỏng (chưa chạy / sai model / máy khác) thì vẫn phải điền được:
        // chuyển sang bộ luật trong shared/fallback.js thay vì bỏ cuộc.
        const mapping = buildFallbackMapping(msg.profile, msg.fields);
        if (mapping.length === 0) {
          sendResponse({ ok: false, error: e.message });
        } else {
          sendResponse({ ok: true, mapping, source: "fallback", aiError: e.message });
        }
      });
    return true; // bất đồng bộ
  }

  if (msg.action === "parseCv") {
    // Trích hồ sơ từ CV bắt buộc cần AI: không có bộ luật nào đọc nổi văn xuôi.
    callOllamaJson(buildCvPrompt(msg.text, msg.keys))
      .then((parsed) => {
        const profile = parsed && typeof parsed.profile === "object" ? parsed.profile : {};
        const clean = {};
        for (const [k, v] of Object.entries(profile)) {
          if (v !== null && v !== undefined && String(v).trim() !== "") clean[k] = String(v).trim();
        }
        sendResponse({ ok: true, profile: clean });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === "testOllama") {
    getConfig()
      .then(async ({ ollamaUrl, model }) => {
        const r = await fetch(`${ollamaUrl}/api/tags`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        const models = (d.models || []).map((m) => m.name);
        sendResponse({ ok: true, models, current: model });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
