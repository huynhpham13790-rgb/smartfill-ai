/*
 * SmartFill AI - popup.js
 * Quản lý hồ sơ người dùng, cấu hình Ollama, và kích hoạt điền form.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

// Các trường gợi ý sẵn cho một hồ sơ sinh viên mới.
const DEFAULT_KEYS = [
  "Họ và tên",
  "Mã số sinh viên",
  "Lớp",
  "Khoa",
  "Ngành",
  "Ngày sinh",
  "Giới tính",
  "Email",
  "Số điện thoại",
  "Quê quán",
  "Địa chỉ",
];

let state = {
  profiles: [],
  activeProfileId: null,
};

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const profileSelect = $("profileSelect");
const profileName = $("profileName");
const fieldsContainer = $("fieldsContainer");
const statusEl = $("status");

// ===== Lưu trữ =====
async function load() {
  const data = await chrome.storage.local.get(["profiles", "activeProfileId", "ollamaUrl", "model"]);
  state.profiles = data.profiles || [];
  state.activeProfileId = data.activeProfileId || null;

  if (state.profiles.length === 0) {
    const p = newProfileObject("Hồ sơ chính");
    state.profiles.push(p);
    state.activeProfileId = p.id;
    await persist();
  }
  if (!state.profiles.find((p) => p.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0].id;
  }

  $("ollamaUrl").value = data.ollamaUrl || "http://localhost:11434";
  $("model").value = data.model || "qwen2.5:7b";

  renderProfileSelect();
  renderActiveProfile();
}

async function persist() {
  await chrome.storage.local.set({
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
  });
}

function newProfileObject(name) {
  const data = {};
  DEFAULT_KEYS.forEach((k) => (data[k] = ""));
  return { id: "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), name, data };
}

// ===== Render =====
function renderProfileSelect() {
  profileSelect.innerHTML = "";
  state.profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || "(chưa đặt tên)";
    if (p.id === state.activeProfileId) opt.selected = true;
    profileSelect.appendChild(opt);
  });
}

function getActiveProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId);
}

function renderActiveProfile() {
  const p = getActiveProfile();
  if (!p) return;
  profileName.value = p.name || "";
  fieldsContainer.innerHTML = "";
  Object.entries(p.data).forEach(([k, v]) => addFieldRow(k, v));
}

function addFieldRow(key = "", value = "") {
  const row = document.createElement("div");
  row.className = "kv-row";

  const keyInput = document.createElement("input");
  keyInput.className = "input kv-key";
  keyInput.placeholder = "Tên trường";
  keyInput.value = key;

  const valInput = document.createElement("input");
  valInput.className = "input kv-val";
  valInput.placeholder = "Giá trị";
  valInput.value = value;

  const rm = document.createElement("button");
  rm.className = "kv-remove";
  rm.textContent = "×";
  rm.title = "Xóa trường";
  rm.addEventListener("click", () => row.remove());

  row.append(keyInput, valInput, rm);
  fieldsContainer.appendChild(row);
}

// ===== Thu thập từ DOM =====
function collectProfileData() {
  const data = {};
  fieldsContainer.querySelectorAll(".kv-row").forEach((row) => {
    const key = row.querySelector(".kv-key").value.trim();
    const val = row.querySelector(".kv-val").value.trim();
    if (key) data[key] = val;
  });
  return data;
}

// ===== Hành động =====
async function saveProfile() {
  const p = getActiveProfile();
  if (!p) return;
  p.name = profileName.value.trim() || "Hồ sơ";
  p.data = collectProfileData();
  await persist();
  renderProfileSelect();
  setStatus("Đã lưu hồ sơ ✓", "ok");
}

async function createProfile() {
  const p = newProfileObject("Hồ sơ mới");
  state.profiles.push(p);
  state.activeProfileId = p.id;
  await persist();
  renderProfileSelect();
  renderActiveProfile();
  setStatus("Đã tạo hồ sơ mới", "ok");
}

async function deleteProfile() {
  if (state.profiles.length <= 1) {
    setStatus("Không thể xóa hồ sơ cuối cùng.", "err");
    return;
  }
  if (!confirm("Xóa hồ sơ này?")) return;
  state.profiles = state.profiles.filter((p) => p.id !== state.activeProfileId);
  state.activeProfileId = state.profiles[0].id;
  await persist();
  renderProfileSelect();
  renderActiveProfile();
  setStatus("Đã xóa hồ sơ", "ok");
}

async function saveSettings() {
  await chrome.storage.local.set({
    ollamaUrl: $("ollamaUrl").value.trim() || "http://localhost:11434",
    model: $("model").value.trim() || "qwen2.5:7b",
  });
}

async function testConnection() {
  await saveSettings();
  const el = $("testResult");
  el.textContent = "Đang kiểm tra...";
  el.className = "hint";
  const res = await chrome.runtime.sendMessage({ action: "testOllama" });
  if (res && res.ok) {
    const has = res.models.includes(res.current);
    el.textContent = has
      ? `✓ Đã kết nối. Model "${res.current}" sẵn sàng.`
      : `⚠ Kết nối được, nhưng chưa có model "${res.current}". Hãy chạy: ollama pull ${res.current}`;
    el.className = has ? "hint ok" : "hint err";
  } else {
    el.textContent = "✗ " + ((res && res.error) || "Không kết nối được Ollama.");
    el.className = "hint err";
  }
}

async function fillForm() {
  await saveProfile();
  await saveSettings();
  const p = getActiveProfile();
  if (!p || Object.keys(p.data).length === 0) {
    setStatus("Hồ sơ trống. Hãy nhập thông tin trước.", "err");
    return;
  }

  setStatus("⏳ AI đang đọc form và điền...", "loading");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("Không tìm thấy tab đang mở.", "err");
    return;
  }

  let res = await sendToTab(tab.id, { action: "fillForm", profile: p.data });

  // Nếu content script chưa được nạp (trang mở trước khi cài), nạp rồi thử lại.
  if (res === null) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
      res = await sendToTab(tab.id, { action: "fillForm", profile: p.data });
    } catch (e) {
      setStatus("Không chạy được trên trang này (" + e.message + ").", "err");
      return;
    }
  }

  if (!res) {
    setStatus("Không nhận được phản hồi từ trang.", "err");
  } else if (res.ok) {
    let msg = `✓ Đã điền ${res.filled}/${res.total} ô.`;
    if (res.notes && res.notes.length) msg += " Lưu ý: " + res.notes.join("; ");
    setStatus(msg + " Hãy rà lại trước khi gửi!", "ok");
  } else {
    setStatus("✗ " + res.error, "err");
  }
}

/** Gửi message tới tab, trả null nếu content script chưa sẵn sàng. */
function sendToTab(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

function setStatus(text, cls = "") {
  statusEl.textContent = text;
  statusEl.className = "status " + cls;
}

// ===== Sự kiện =====
profileSelect.addEventListener("change", async (e) => {
  state.activeProfileId = e.target.value;
  await persist();
  renderActiveProfile();
});
$("newProfileBtn").addEventListener("click", createProfile);
$("deleteProfileBtn").addEventListener("click", deleteProfile);
$("addFieldBtn").addEventListener("click", () => addFieldRow());
$("saveBtn").addEventListener("click", saveProfile);
$("testBtn").addEventListener("click", testConnection);
$("fillBtn").addEventListener("click", fillForm);
["ollamaUrl", "model"].forEach((id) => $(id).addEventListener("change", saveSettings));

document.addEventListener("DOMContentLoaded", load);
