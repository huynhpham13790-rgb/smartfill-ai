/*
 * SmartFill AI - tests/benchmark.mjs
 * Đo độ chính xác của việc ánh xạ hồ sơ vào form trên bộ fixture cố định.
 *
 * Chạy:
 *   node tests/benchmark.mjs              -> chỉ đo bộ luật dự phòng (không cần AI)
 *   node tests/benchmark.mjs --ai         -> đo thêm đường AI qua Ollama
 *   node tests/benchmark.mjs --ai --model qwen2.5:7b
 *
 * Cách tính điểm cho mỗi form:
 *   - đúng   : ô có trong đáp án và giá trị khớp
 *   - sai    : ô có trong đáp án nhưng giá trị khác
 *   - thiếu  : ô có trong đáp án mà không được điền
 *   - bịa    : ô có thật trên form, không có trong đáp án, nhưng vẫn bị điền
 *   - fid lạ : model trả về fid không tồn tại trên form (vô hại vì
 *              applyMapping bỏ qua, nhưng là dấu hiệu model không bám đề)
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildFallbackMapping } from "../shared/fallback.js";
import { buildPrompt } from "../shared/prompt.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(fs.readFileSync(path.join(here, "fixtures/profile.json"), "utf8"));
const forms = JSON.parse(fs.readFileSync(path.join(here, "fixtures/forms.json"), "utf8"));

const args = process.argv.slice(2);
const useAi = args.includes("--ai");
const mi = args.indexOf("--model");
const model = (mi >= 0 && args[mi + 1]) || "qwen2.5:7b";
const ollamaUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");

/** Gọi Ollama lấy mapping, dùng đúng prompt mà extension dùng. */
async function aiMapping(fields) {
  const resp = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: buildPrompt(profile, fields) }],
      stream: false,
      format: "json",
      options: { temperature: 0 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
  const data = await resp.json();
  const parsed = JSON.parse(data.message.content);
  return Array.isArray(parsed.mapping) ? parsed.mapping : [];
}

function score(mapping, expected, fields) {
  const got = new Map(mapping.map((m) => [m.fid, String(m.value)]));
  const real = new Set(fields.map((f) => f.fid));
  const r = { correct: 0, wrong: 0, missing: 0, hallucinated: 0, unknownFid: 0, details: [] };

  for (const [fid, want] of Object.entries(expected)) {
    if (!got.has(fid)) {
      r.missing++;
      r.details.push(`  thiếu  ${fid}: mong đợi "${want}"`);
    } else if (got.get(fid) === want) {
      r.correct++;
    } else {
      r.wrong++;
      r.details.push(`  sai    ${fid}: "${got.get(fid)}" != "${want}"`);
    }
  }
  for (const fid of got.keys()) {
    if (fid in expected) continue;
    if (!real.has(fid)) {
      r.unknownFid++;
      r.details.push(`  fid lạ ${fid}: "${got.get(fid)}" (ô này không tồn tại trên form)`);
    } else {
      r.hallucinated++;
      r.details.push(`  bịa    ${fid}: "${got.get(fid)}" (ô này lẽ ra phải bỏ trống)`);
    }
  }
  return r;
}

async function run(label, mapper) {
  console.log(`\n=== ${label} ===`);
  const total = { correct: 0, wrong: 0, missing: 0, hallucinated: 0, unknownFid: 0, expected: 0 };

  for (const form of forms) {
    let mapping;
    try {
      mapping = await mapper(form.fields);
    } catch (e) {
      console.log(`${form.name}: LỖI - ${e.message}`);
      return null;
    }
    const r = score(mapping, form.expected, form.fields);
    const n = Object.keys(form.expected).length;
    total.correct += r.correct;
    total.wrong += r.wrong;
    total.missing += r.missing;
    total.hallucinated += r.hallucinated;
    total.unknownFid += r.unknownFid;
    total.expected += n;

    const flag = r.correct === n && r.hallucinated === 0 ? "PASS" : "FAIL";
    console.log(`[${flag}] ${form.name}: ${r.correct}/${n} đúng` +
      (r.hallucinated ? `, ${r.hallucinated} bịa` : "") +
      (r.unknownFid ? `, ${r.unknownFid} fid lạ` : ""));
    r.details.forEach((d) => console.log(d));
  }

  const acc = ((total.correct / total.expected) * 100).toFixed(1);
  console.log(`--- Tổng: ${total.correct}/${total.expected} đúng (${acc}%), ` +
    `${total.wrong} sai, ${total.missing} thiếu, ${total.hallucinated} bịa, ` +
    `${total.unknownFid} fid lạ`);
  return total;
}

const fb = await run("Bộ luật dự phòng (shared/fallback.js, không dùng AI)", async (f) =>
  buildFallbackMapping(profile, f)
);

if (useAi) {
  await run(`AI qua Ollama (model: ${model})`, aiMapping);
} else {
  console.log("\n(Thêm --ai để đo cả đường AI. Cần Ollama đang chạy.)");
}

// Bộ luật dự phòng phải luôn đạt 100% trên fixture, nếu không là hồi quy.
const ok = fb && fb.correct === fb.expected && fb.hallucinated === 0 && fb.unknownFid === 0;
// Dùng exitCode thay vì process.exit() để Node đóng socket của fetch gọn gàng.
process.exitCode = ok ? 0 : 1;
