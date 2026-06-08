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

/** Dựng prompt mô tả hồ sơ và các ô cần điền. */
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
8. Với ô CÓ "lựa_chọn_có_sẵn" mà nhãn ghép nhiều ý (vd "Khoa/Ngành", "Khoa/Viện"): chọn ĐÚNG MỘT mục trong danh sách khớp nhất với BẤT KỲ thông tin nào trong hồ sơ (Khoa HOẶC Ngành). Giá trị BẮT BUỘC là một mục copy nguyên văn từ danh sách. Ví dụ danh sách là các khoa và hồ sơ có "Khoa: Công nghệ thông tin" thì trả về đúng "Công nghệ Thông tin" (mục có trong danh sách), KHÔNG trả "Kỹ thuật máy tính" nếu mục đó không có trong danh sách.

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

/** Gọi Ollama và lấy mapping. */
async function callOllama(profile, fields) {
  const { ollamaUrl, model } = await getConfig();
  const prompt = buildPrompt(profile, fields);

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

  const mapping = Array.isArray(parsed.mapping) ? parsed.mapping : [];
  return mapping;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "mapFields") {
    callOllama(msg.profile, msg.fields)
      .then((mapping) => sendResponse({ ok: true, mapping }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // bất đồng bộ
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
