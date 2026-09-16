/*
 * SmartFill AI - shared/models.js
 * Xử lý danh sách model Ollama phát hiện được trên máy: sắp xếp, đặt nhãn dễ
 * đọc, và chọn model mặc định hợp lý.
 *
 * Tách riêng khỏi popup để kiểm thử được bằng Node - phần chọn mặc định có
 * nhiều nhánh (model đã lưu còn/không còn cài, máy trống, máy có sẵn model ưa
 * thích) và đó đúng là chỗ dễ sai.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

/** Model dùng khi không biết chọn gì: cân bằng giữa chất lượng và máy phổ thông. */
export const PREFERRED_MODEL = "qwen2.5:7b";

/** Đổi số byte thành chuỗi ngắn gọn (4.7 GB). */
export function formatSize(bytes) {
  if (!bytes || bytes < 0) return "";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}

/**
 * Chuẩn hóa một mục trả về từ /api/tags thành dạng dùng trong giao diện.
 * Ollama đổi cấu trúc JSON theo phiên bản, nên mọi trường phụ đều phải chịu được thiếu.
 */
export function normalizeModel(raw) {
  const details = (raw && raw.details) || {};
  return {
    name: raw && raw.name ? raw.name : "",
    size: raw && typeof raw.size === "number" ? raw.size : 0,
    parameters: details.parameter_size || "",
    quantization: details.quantization_level || "",
    family: details.family || "",
  };
}

/** Nhãn hiển thị: "qwen2.5:7b - 7.6B, 4.7 GB" */
export function formatModelLabel(model) {
  const bits = [];
  if (model.parameters) bits.push(model.parameters);
  const size = formatSize(model.size);
  if (size) bits.push(size);
  return bits.length ? `${model.name} - ${bits.join(", ")}` : model.name;
}

/**
 * Sắp xếp danh sách model theo tên, nhưng đưa model ưa thích lên đầu để người
 * dùng mới không phải tự đoán nên chọn cái nào.
 */
export function sortModels(models) {
  return [...models].sort((a, b) => {
    if (a.name === PREFERRED_MODEL) return -1;
    if (b.name === PREFERRED_MODEL) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Chọn model nên dùng sau khi đã dò được máy.
 * Ưu tiên: model người dùng đã chọn (nếu còn cài) > model ưa thích > model đầu
 * danh sách. Máy chưa có model nào thì giữ nguyên lựa chọn cũ để thông báo lỗi
 * của Ollama còn nói đúng tên model bị thiếu.
 */
export function pickDefaultModel(models, saved) {
  const names = models.map((m) => m.name);
  if (saved && names.includes(saved)) return saved;
  if (names.includes(PREFERRED_MODEL)) return PREFERRED_MODEL;
  if (names.length) return sortModels(models)[0].name;
  return saved || PREFERRED_MODEL;
}
