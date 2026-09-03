/*
 * SmartFill AI - shared/cv.js
 * Trích văn bản từ tệp CV (.pdf/.txt/.md) và dựng prompt để AI rút ra hồ sơ.
 *
 * Phần đọc PDF cố ý viết tay thay vì dùng thư viện: extension không được phép
 * thêm phụ thuộc, và trình duyệt đã có sẵn DecompressionStream để giải nén
 * luồng FlateDecode - thứ chiếm gần như toàn bộ PDF sinh ra từ Word/LaTeX.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

/** Giải nén một luồng zlib/deflate bằng API sẵn có của trình duyệt. */
async function inflate(bytes) {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Đọc chuỗi literal trong PDF: (xin chào\(hi\)) -> "xin chào(hi)" */
function decodePdfLiteral(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[++i];
    if (n === undefined) break;
    if (n === "n") out += "\n";
    else if (n === "r") out += "\r";
    else if (n === "t") out += "\t";
    else if (n === "b" || n === "f") out += " ";
    else if (n >= "0" && n <= "7") {
      // Mã bát phân, tối đa 3 chữ số.
      let oct = n;
      while (oct.length < 3 && raw[i + 1] >= "0" && raw[i + 1] <= "7") oct += raw[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (n === "\n") {
      // Dấu gạch chéo cuối dòng = nối dòng, không sinh ký tự.
    } else out += n;
  }
  return out;
}

/** Chuỗi hex UTF-16BE trong CMap -> ký tự thật. */
function hexToStr(hex) {
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.substr(i, 4), 16);
    if (!isNaN(code)) out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Đọc bảng ToUnicode của PDF: ánh xạ mã glyph -> ký tự thật.
 * PDF nhúng font tiếng Việt lưu chữ dưới dạng mã glyph riêng của font đó, nên
 * không có bảng này thì chuỗi đọc ra chỉ là rác.
 */
function parseCMap(cmapText, map) {
  // bfchar: từng cặp <mã> <ký tự>
  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = charRe.exec(cmapText)) !== null) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(m[1])) !== null) {
      map.set(parseInt(p[1], 16), hexToStr(p[2]));
    }
  }

  // bfrange: <đầu> <cuối> <ký tự đầu>, hoặc <đầu> <cuối> [<a> <b> ...]
  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = rangeRe.exec(cmapText)) !== null) {
    const body = m[1];

    const arrRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    let r;
    const covered = [];
    while ((r = arrRe.exec(body)) !== null) {
      covered.push([r.index, r.index + r[0].length]);
      const lo = parseInt(r[1], 16);
      const items = r[3].match(/<[0-9A-Fa-f]+>/g) || [];
      items.forEach((it, i) => map.set(lo + i, hexToStr(it.slice(1, -1))));
    }

    const simpleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    while ((r = simpleRe.exec(body)) !== null) {
      // Bỏ qua phần đã khớp dạng mảng ở trên.
      if (covered.some(([a, b]) => r.index >= a && r.index < b)) continue;
      const lo = parseInt(r[1], 16);
      const hi = parseInt(r[2], 16);
      const base = parseInt(r[3], 16);
      // Chặn trên để một bảng hỏng không làm treo trình duyệt.
      for (let i = 0; i <= hi - lo && i < 65535; i++) {
        map.set(lo + i, String.fromCodePoint(base + i));
      }
    }
  }
  return map;
}

/** Áp bảng ToUnicode lên chuỗi byte (mã glyph 2 byte). */
function mapGlyphs(s, map) {
  let out = "";
  for (let i = 0; i + 1 < s.length; i += 2) {
    const ch = map.get((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    if (ch !== undefined) out += ch;
  }
  return out;
}

/** Lấy chữ từ nội dung một content stream đã giải nén. */
function textFromContentStream(s, glyphMap) {
  const parts = [];

  // Chuỗi hiển thị: (abc) Tj   hoặc   [(a) -20 (b)] TJ
  // Lưu ý hai chỗ dễ sai: chuỗi literal phải cho phép ký tự thoát "\)" nằm bên
  // trong, và "T*" không dùng \b ở cuối được vì "*" không phải ký tự từ.
  const re = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bTJ\b|\bTj\b|\bTD\b|\bTd\b|\bT\*|\bET\b/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tok = m[0];
    const useMap = glyphMap && glyphMap.size;
    if (tok[0] === "(") {
      const lit = decodePdfLiteral(tok.slice(1, -1));
      parts.push(useMap ? mapGlyphs(lit, glyphMap) : lit);
    } else if (tok[0] === "<") {
      // Chuỗi hex: từng cặp byte một.
      const hex = tok.slice(1, -1).replace(/\s+/g, "");
      let t = "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        t += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      parts.push(useMap ? mapGlyphs(t, glyphMap) : t);
    } else if (tok === "TD" || tok === "Td" || tok === "T*" || tok === "ET") {
      parts.push("\n"); // các toán tử xuống dòng
    }
  }

  return parts.join("");
}

/**
 * Trích toàn bộ văn bản đọc được từ một tệp PDF.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export async function extractPdfText(buffer) {
  const bytes = new Uint8Array(buffer);
  // latin1 giữ nguyên từng byte, cần thiết vì PDF trộn nhị phân với văn bản.
  const raw = new TextDecoder("latin1").decode(bytes);

  // Giải nén mọi luồng một lần, dùng lại cho cả hai lượt bên dưới.
  const streams = [];
  const re = /stream\r?\n?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;

    // Từ điển của luồng nằm ngay trước từ khóa "stream".
    const dict = raw.slice(Math.max(0, m.index - 400), m.index);
    const body = bytes.subarray(start, end);

    if (/\/FlateDecode/.test(dict)) {
      try {
        streams.push(new TextDecoder("latin1").decode(await inflate(body)));
      } catch (e) {
        // luồng ảnh/font hỏng thì bỏ qua
      }
    } else if (!/\/Filter/.test(dict)) {
      streams.push(new TextDecoder("latin1").decode(body));
    }
  }

  // Lượt 1: gom mọi bảng ToUnicode thành một bảng chung. Gộp chung là đơn giản
  // hóa có chủ ý - một CV thường chỉ dùng vài font nên xung đột mã rất hiếm.
  const glyphMap = new Map();
  for (const st of streams) {
    if (st.includes("beginbfchar") || st.includes("beginbfrange")) parseCMap(st, glyphMap);
  }

  // Lượt 2: lấy chữ từ những luồng thực sự là content stream.
  const chunks = [];
  for (const st of streams) {
    if (/\bBT\b/.test(st) && /\bTJ\b|\bTj\b/.test(st)) {
      chunks.push(textFromContentStream(st, glyphMap));
    }
  }

  return chunks.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Đoán xem văn bản trích ra có dùng được không.
 * PDF dùng font nhúng kèm bảng mã riêng sẽ cho ra chuỗi rác; khi đó thà báo
 * người dùng dán tay còn hơn đưa rác cho AI đoán mò.
 */
export function looksReadable(text) {
  if (!text || text.length < 30) return false;
  // Tỉ lệ ký tự chữ/số/dấu câu thông thường trên tổng số ký tự.
  const sane = (text.match(/[\p{L}\p{N}\s.,;:@/()+-]/gu) || []).length;
  return sane / text.length > 0.85;
}

/** Dựng prompt yêu cầu AI rút hồ sơ từ CV thành JSON. */
export function buildCvPrompt(cvText, keys) {
  const wanted = keys.map((k) => `- ${k}`).join("\n");
  // Cắt bớt CV rất dài: thông tin cá nhân gần như luôn nằm ở đầu.
  const body = cvText.length > 6000 ? cvText.slice(0, 6000) + "\n[...]" : cvText;

  return `Bạn là trợ lý trích xuất thông tin. Dưới đây là nội dung một bản CV/sơ yếu lý lịch.

NỘI DUNG CV:
"""
${body}
"""

CÁC TRƯỜNG CẦN TRÍCH:
${wanted}

QUY TẮC BẮT BUỘC:
1. COPY NGUYÊN VĂN từ CV. KHÔNG sửa, viết lại, dịch hay chuẩn hóa chữ hoa/thường của tên riêng.
2. Nếu CV KHÔNG có thông tin cho một trường, BỎ QUA trường đó. KHÔNG bịa, KHÔNG đoán.
3. Ngày sinh trả về dạng yyyy-mm-dd.
4. Số điện thoại giữ nguyên chữ số như trong CV, không thêm mã vùng.
5. Chỉ lấy thông tin của CHÍNH chủ nhân CV, bỏ qua tên người tham chiếu, tên công ty, tên trường.

Trả về DUY NHẤT một JSON, không thêm giải thích:
{"profile": {"Tên trường": "giá trị", ...}}`;
}
