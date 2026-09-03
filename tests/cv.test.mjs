/*
 * SmartFill AI - tests/cv.test.mjs
 * Kiểm thử phần trích văn bản từ CV.
 *
 * Chạy: node tests/cv.test.mjs
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractPdfText, looksReadable, buildCvPrompt } from "../shared/cv.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "[PASS]" : "[FAIL]"} ${name}${cond || !extra ? "" : " -> " + extra}`);
  if (!cond) failed++;
}

// --- Trích chữ từ PDF đơn giản (font chuẩn, không nén) ---
const buf = fs.readFileSync(path.join(here, "fixtures/cv-sample.pdf"));
const text = await extractPdfText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

check("trích được chữ từ PDF đơn giản", text.length > 100, `chỉ được ${text.length} ký tự`);
check("giữ được xuống dòng giữa các mục", text.split("\n").length >= 8);
check("đọc đúng họ tên", text.includes("Pham Van Huynh"));
check("đọc đúng mã sinh viên", text.includes("DTC245200357"));
check("đọc đúng email", text.includes("huynhpham13790@gmail.com"));
check("đọc đúng số điện thoại", text.includes("0359260290"));
check("PDF này được coi là đọc được", looksReadable(text));

// --- Bộ lọc rác: PDF font nhúng cho ra chuỗi vô nghĩa ---
const garbage = "J¬Rí\"‚ÖâQ+x€T´¼Ùˆ­GÕZ´õÖþÄ«J‹–Z-ýçÝƒµýØÛŸŸþÿûÌ>óÌ<Ï33Ï<s¼3o";
check("nhận ra chuỗi rác là không đọc được", !looksReadable(garbage));
check("chuỗi quá ngắn cũng bị loại", !looksReadable("abc"));
check("văn bản tiếng Việt bình thường được chấp nhận",
  looksReadable("Họ và tên: Phạm Văn Huynh. Email: a@b.com. Điện thoại: 0359260290. Khoa: Công nghệ thông tin."));

// --- Prompt trích hồ sơ ---
const prompt = buildCvPrompt(text, ["Họ và tên", "Email"]);
check("prompt chứa nội dung CV", prompt.includes("DTC245200357"));
check("prompt liệt kê trường cần trích", prompt.includes("- Họ và tên") && prompt.includes("- Email"));
check("prompt cấm bịa", /KHÔNG bịa/.test(prompt));
check("prompt cắt bớt CV quá dài", buildCvPrompt("x".repeat(9000), ["A"]).includes("[...]"));

console.log(failed === 0 ? "\nTất cả kiểm thử CV đều đạt." : `\n${failed} kiểm thử thất bại.`);
process.exitCode = failed === 0 ? 0 : 1;
