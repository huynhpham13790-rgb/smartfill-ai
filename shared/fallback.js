/*
 * SmartFill AI - shared/fallback.js
 * Bộ ánh xạ dự phòng theo luật, dùng khi Ollama không chạy hoặc trả lỗi.
 * Không cần AI: khớp nhãn ô với khóa hồ sơ bằng từ đồng nghĩa + so khớp mềm.
 * Kết quả có cùng định dạng với AI: [{fid, value}].
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

/** Bỏ dấu tiếng Việt + chuẩn hóa để so khớp không phân biệt dấu/hoa thường. */
export function foldText(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Từ đồng nghĩa cho từng khái niệm. Khóa là "khái niệm chuẩn", giá trị là các
 * cách viết có thể gặp trên nhãn ô HOẶC trong tên trường của hồ sơ.
 * Thứ tự trong mảng không quan trọng; độ dài mới quan trọng khi chấm điểm.
 */
const SYNONYMS = {
  fullname: ["ho va ten", "ho ten", "full name", "fullname", "ten day du", "name", "ten"],
  studentid: ["ma so sinh vien", "ma sinh vien", "msv", "mssv", "student id", "studentid", "student code"],
  class: ["lop", "class", "lop hoc"],
  faculty: ["khoa", "faculty", "khoa vien", "vien"],
  major: ["nganh", "chuyen nganh", "major", "nganh hoc"],
  dob: ["ngay sinh", "date of birth", "dob", "birthday", "birth date", "sinh ngay"],
  gender: ["gioi tinh", "gender", "sex"],
  email: ["email", "e mail", "thu dien tu", "dia chi email"],
  phone: ["so dien thoai", "dien thoai", "sdt", "phone", "phone number", "mobile", "di dong"],
  hometown: ["que quan", "nguyen quan", "hometown", "noi sinh"],
  address: ["dia chi", "dia chi thuong tru", "thuong tru", "noi o", "address", "cho o hien nay"],
};

/**
 * Kiểm tra `needle` xuất hiện trong `hay` như một TỪ trọn vẹn.
 * Bắt buộc phải theo ranh giới từ, nếu không "khoa" sẽ khớp vào
 * "số tài khoản ngân hàng" và điền tên khoa vào ô số tài khoản.
 */
function hasWord(hay, needle) {
  const i = hay.indexOf(needle);
  if (i < 0) return false;
  const before = i === 0 ? "" : hay[i - 1];
  const after = hay[i + needle.length] || "";
  const isWordChar = (c) => c !== "" && /[a-z0-9]/.test(c);
  return !isWordChar(before) && !isWordChar(after);
}

/** Với một chuỗi bất kỳ, đoán xem nó nói về khái niệm nào. */
function conceptOf(text) {
  const t = foldText(text);
  if (!t) return null;

  let best = null;
  let bestLen = 0;
  for (const [concept, words] of Object.entries(SYNONYMS)) {
    for (const w of words) {
      // Khớp nguyên chuỗi luôn thắng mọi khớp một phần.
      if (t === w) return concept;
      // Khớp một phần: ưu tiên từ đồng nghĩa DÀI nhất, để "dia chi email"
      // không bị "dia chi" cướp mất, và "ma so sinh vien" thắng "ten".
      if (w.length > bestLen && hasWord(t, w)) {
        best = concept;
        bestLen = w.length;
      }
    }
  }
  return best;
}

/** Đảo hồ sơ thành bảng tra theo khái niệm: {concept: value}. */
function indexProfile(profile) {
  const byConcept = {};
  for (const [key, value] of Object.entries(profile || {})) {
    if (value === "" || value === null || value === undefined) continue;
    const c = conceptOf(key);
    // Khóa xuất hiện trước được giữ; hồ sơ hiếm khi có hai khóa cùng khái niệm.
    if (c && !(c in byConcept)) byConcept[c] = String(value);
  }
  return byConcept;
}

/** Chuẩn hóa ngày về yyyy-mm-dd (giống content.js). */
function normalizeDate(value) {
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return v;
}

/** Chọn mục khớp nhất trong danh sách lựa chọn có sẵn, hoặc null. */
function pickOption(value, options) {
  const t = foldText(value);
  if (!t) return null;
  let hit = options.find((o) => foldText(o) === t);
  if (hit !== undefined) return hit;
  hit = options.find((o) => foldText(o).includes(t) || t.includes(foldText(o)));
  return hit === undefined ? null : hit;
}

/**
 * Dựng mapping mà không cần AI.
 * @param {object} profile - hồ sơ {tên trường: giá trị}
 * @param {Array} fields - danh sách field đã serialize (fid, kind, label, options?)
 * @returns {Array<{fid: string, value: string}>}
 */
export function buildFallbackMapping(profile, fields) {
  const byConcept = indexProfile(profile);
  const mapping = [];

  for (const f of fields || []) {
    // Checkbox không có thông tin tương ứng trong hồ sơ -> để người dùng tự tick.
    if (f.kind === "checkbox") continue;

    const concept = conceptOf(f.label);
    if (!concept) continue;
    let value = byConcept[concept];
    if (value === undefined) continue;

    if (f.kind === "text" && f.inputType === "date") {
      value = normalizeDate(value);
    }

    if (f.options && f.options.length) {
      const picked = pickOption(value, f.options);
      if (picked === null) continue; // thà bỏ trống còn hơn điền bừa
      value = picked;
    }

    mapping.push({ fid: f.fid, value });
  }

  return mapping;
}
