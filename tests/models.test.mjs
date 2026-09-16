/*
 * SmartFill AI - tests/models.test.mjs
 * Kiểm thử phần phát hiện và chọn model Ollama.
 *
 * Chạy: node tests/models.test.mjs
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import {
  PREFERRED_MODEL,
  formatSize,
  normalizeModel,
  formatModelLabel,
  sortModels,
  pickDefaultModel,
} from "../shared/models.js";

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "[PASS]" : "[FAIL]"} ${name}${cond || !extra ? "" : " -> " + extra}`);
  if (!cond) failed++;
}

// Dữ liệu thật từ /api/tags của Ollama.
const raw = [
  { name: "llama3.2:3b", size: 2019393189, details: { parameter_size: "3.2B", quantization_level: "Q4_K_M", family: "llama" } },
  { name: "qwen2.5:7b", size: 4683087332, details: { parameter_size: "7.6B", quantization_level: "Q4_K_M", family: "qwen2" } },
  { name: "gemma2:2b", size: 1629518495, details: { parameter_size: "2.6B" } },
];
const models = raw.map(normalizeModel);

// --- Chuẩn hóa ---
check("đọc được tên và kích thước", models[1].name === "qwen2.5:7b" && models[1].size === 4683087332);
check("đọc được số tham số", models[1].parameters === "7.6B");
check("chịu được mục thiếu trường details", normalizeModel({ name: "x", size: 1 }).parameters === "");
check("chịu được mục rỗng hoàn toàn", normalizeModel(undefined).name === "");

// --- Kích thước ---
check("đổi byte sang GB", formatSize(4683087332) === "4.7 GB", formatSize(4683087332));
check("đổi byte sang MB khi nhỏ", formatSize(650000000) === "650 MB", formatSize(650000000));
check("không có kích thước thì để trống", formatSize(0) === "");

// --- Nhãn ---
check("nhãn gồm tên, tham số và dung lượng",
  formatModelLabel(models[1]) === "qwen2.5:7b - 7.6B, 4.7 GB", formatModelLabel(models[1]));
check("nhãn chỉ còn tên khi thiếu thông tin",
  formatModelLabel({ name: "abc", size: 0, parameters: "" }) === "abc");

// --- Sắp xếp ---
const sorted = sortModels(models);
check("model ưa thích được đưa lên đầu", sorted[0].name === PREFERRED_MODEL, sorted[0].name);
check("phần còn lại sắp theo tên", sorted[1].name === "gemma2:2b" && sorted[2].name === "llama3.2:3b");
check("không làm thay đổi mảng gốc", models[0].name === "llama3.2:3b");

// --- Chọn mặc định ---
check("giữ lựa chọn cũ nếu model đó còn cài", pickDefaultModel(models, "llama3.2:3b") === "llama3.2:3b");
check("model đã lưu không còn cài thì rơi về model ưa thích",
  pickDefaultModel(models, "mistral:7b") === PREFERRED_MODEL);
check("chưa chọn gì thì lấy model ưa thích", pickDefaultModel(models, "") === PREFERRED_MODEL);
check("máy không có model ưa thích thì lấy model đầu danh sách",
  pickDefaultModel([normalizeModel(raw[0]), normalizeModel(raw[2])], "") === "gemma2:2b");
check("máy trống thì giữ nguyên lựa chọn cũ để báo lỗi đúng tên",
  pickDefaultModel([], "mistral:7b") === "mistral:7b");
check("máy trống và chưa chọn gì thì dùng model ưa thích",
  pickDefaultModel([], "") === PREFERRED_MODEL);

console.log(failed === 0 ? "\nTất cả kiểm thử model đều đạt." : `\n${failed} kiểm thử thất bại.`);
process.exitCode = failed === 0 ? 0 : 1;
