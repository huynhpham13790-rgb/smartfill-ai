/*
 * SmartFill AI - tools/package.mjs
 * Đóng gói extension thành .zip để nạp vào Chrome hoặc đính kèm vào release.
 * Chỉ dùng thư viện có sẵn của Node + lệnh zip của hệ điều hành, không thêm phụ thuộc.
 *
 * Chạy: npm run package  ->  dist/smartfill-ai-<version>.zip
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;

// Chỉ những gì Chrome thực sự cần khi chạy extension.
const INCLUDE = ["manifest.json", "LICENSE", "src", "popup", "shared", "icons"];

const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, `smartfill-ai-${version}.zip`);
fs.rmSync(out, { force: true });

for (const entry of INCLUDE) {
  if (!fs.existsSync(path.join(root, entry))) {
    throw new Error(`Thiếu "${entry}" - không đóng gói được.`);
  }
}

// PowerShell có sẵn trên Windows; zip/ditto có sẵn trên Linux/macOS.
try {
  if (process.platform === "win32") {
    const list = INCLUDE.map((e) => `'${path.join(root, e)}'`).join(",");
    execFileSync("powershell", [
      "-NoProfile", "-Command",
      `Compress-Archive -Path ${list} -DestinationPath '${out}' -Force`,
    ], { stdio: "inherit" });
  } else {
    execFileSync("zip", ["-r", "-q", out, ...INCLUDE], { cwd: root, stdio: "inherit" });
  }
} catch (e) {
  console.error("Không đóng gói được. Cần PowerShell (Windows) hoặc lệnh 'zip' (Linux/macOS).");
  throw e;
}

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`Đã tạo ${path.relative(root, out)} (${kb} KB)`);
