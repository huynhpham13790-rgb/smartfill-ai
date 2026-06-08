/*
 * SmartFill AI - content.js
 * Quét các ô nhập trên trang, gửi cho AI map giá trị, rồi điền tự động.
 * Hỗ trợ cả ô chuẩn (input/select) lẫn widget ARIA của Google Forms.
 *
 * Copyright (c) 2026 Phạm Văn Huynh
 * SPDX-License-Identifier: MIT
 * Licensed under the MIT License. See LICENSE file in the project root.
 */

"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== Tiện ích =====

/** Kiểm tra phần tử có đang hiển thị (không bị ẩn) không. */
function isVisible(el) {
  if (!el) return false;
  let node = el;
  while (node && node.nodeType === 1) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    node = node.parentElement;
  }
  if (el.hidden) return false;
  return true;
}

/** Bỏ dấu tiếng Việt + chuẩn hóa để so khớp không phân biệt dấu/hoa thường. */
function foldText(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lấy text từ aria-labelledby (có thể trỏ tới nhiều id). */
function ariaLabelledText(el) {
  const ref = el.getAttribute("aria-labelledby");
  if (!ref) return "";
  return ref
    .split(/\s+/)
    .map((id) => {
      const n = document.getElementById(id);
      return n ? n.textContent.trim() : "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Lấy nhãn mô tả của một widget ARIA (radiogroup/listbox). */
function ariaWidgetLabel(el) {
  const byRef = ariaLabelledText(el);
  if (byRef) return byRef;
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
  const near = findNearbyText(el);
  return near || "";
}

/** Nhãn của một option/radio ARIA. */
function ariaOptionLabel(el) {
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
  if (el.getAttribute("data-value")) return el.getAttribute("data-value").trim();
  const t = (el.textContent || "").replace(/\s+/g, " ").trim();
  return t;
}

/** Lấy nhãn (label) mô tả ý nghĩa của một ô nhập chuẩn, thử nhiều cách. */
function getLabel(el) {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
  }
  const parentLabel = el.closest("label");
  if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
  const byRef = ariaLabelledText(el);
  if (byRef) return byRef;
  if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();
  if (el.title && el.title.trim()) return el.title.trim();
  const near = findNearbyText(el);
  if (near) return near;
  return el.name || "";
}

/** Tìm đoạn text gần ô nhập (cho form không có label chuẩn). */
function findNearbyText(el) {
  let node = el;
  for (let i = 0; i < 5 && node; i++) {
    node = node.parentElement;
    if (!node) break;
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll("input, select, textarea, button, option, [role='radio'], [role='option']")
      .forEach((n) => n.remove());
    const text = clone.textContent.replace(/\s+/g, " ").trim();
    if (text.length > 1 && text.length < 200) return text;
  }
  return "";
}

function getGroupLabel(el) {
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend && legend.textContent.trim()) return legend.textContent.trim();
  }
  const near = findNearbyText(el);
  if (near) return near;
  return el.name || "";
}

// ===== Quét form =====

const SKIP_TYPES = ["hidden", "submit", "button", "reset", "image", "file", "password"];

/** Quét toàn trang, trả về danh sách field kèm tham chiếu phần tử thật. */
function scanFields() {
  const fields = [];
  const counter = { n: 0 };
  const seenRadioGroups = new Set();
  const claimed = new WeakSet(); // phần tử đã được tính, tránh trùng

  // --- 1) Ô chuẩn: input / select / textarea ---
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (!isVisible(el) || el.disabled || el.readOnly) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || tag).toLowerCase();
    if (SKIP_TYPES.includes(type)) continue;

    if (type === "radio") {
      const name = el.name;
      if (name && seenRadioGroups.has(name)) continue;
      if (name) seenRadioGroups.add(name);
      const group = name ? [...document.getElementsByName(name)] : [el];
      const options = group.map((r) => ({ el: r, value: r.value, label: getLabel(r) || r.value }));
      group.forEach((r) => claimed.add(r));
      fields.push({ els: group, fid: "sf-" + counter.n++, kind: "radio", name, label: getGroupLabel(el), options });
    } else if (type === "checkbox") {
      claimed.add(el);
      fields.push({ els: [el], fid: "sf-" + counter.n++, kind: "checkbox", label: getLabel(el) });
    } else if (tag === "select") {
      claimed.add(el);
      const options = [...el.options]
        .map((o) => ({ value: o.value, label: (o.textContent || "").trim() }))
        .filter((o) => o.label && o.value !== "");
      fields.push({ els: [el], fid: "sf-" + counter.n++, kind: "select", label: getLabel(el), options });
    } else {
      claimed.add(el);
      fields.push({
        els: [el],
        fid: "sf-" + counter.n++,
        kind: "text",
        inputType: type,
        label: getLabel(el),
        placeholder: el.placeholder || "",
      });
    }
  }

  // --- 2) Radio dạng ARIA (Google Forms: <div role="radio">) ---
  for (const rg of document.querySelectorAll('[role="radiogroup"]')) {
    if (!isVisible(rg)) continue;
    const radios = [...rg.querySelectorAll('[role="radio"]')].filter((r) => isVisible(r) && !claimed.has(r));
    if (!radios.length) continue;
    radios.forEach((r) => claimed.add(r));
    const options = radios.map((r) => ({ el: r, label: ariaOptionLabel(r) })).filter((o) => o.label);
    if (!options.length) continue;
    fields.push({ fid: "sf-" + counter.n++, kind: "aria-radio", label: ariaWidgetLabel(rg), options });
  }

  // --- 3) Dropdown dạng ARIA (Google Forms: <div role="listbox">) ---
  for (const lb of document.querySelectorAll('[role="listbox"]')) {
    if (!isVisible(lb) || claimed.has(lb)) continue;
    const optEls = [...lb.querySelectorAll('[role="option"]')];
    const options = optEls
      .map((o) => ({ el: o, label: ariaOptionLabel(o) }))
      .filter((o) => o.label && !/^(chọn|select|--|none)/i.test(o.label));
    if (!options.length) continue;
    claimed.add(lb);
    fields.push({ fid: "sf-" + counter.n++, kind: "aria-listbox", el: lb, label: ariaWidgetLabel(lb), options });
  }

  return fields;
}

/** Rút gọn field để gửi qua message (bỏ tham chiếu DOM). */
function serializeField(f) {
  const base = { fid: f.fid, kind: f.kind, label: f.label };
  if (f.kind === "text") {
    base.inputType = f.inputType;
    base.placeholder = f.placeholder;
  }
  if (f.kind === "select" || f.kind === "radio" || f.kind === "aria-radio" || f.kind === "aria-listbox") {
    base.options = f.options.map((o) => o.label);
  }
  return base;
}

// ===== Điền form =====

/** Chuẩn hóa ngày về yyyy-mm-dd cho input[type=date]. */
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

/** Phát sự kiện để framework (React/Vue/Google Forms...) nhận biết thay đổi. */
function fireEvents(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

/** Mô phỏng một cú click "thật" (Google Forms cần pointer/mouse events). */
function simulateClick(el) {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

/** Tìm index option khớp nhất với giá trị mục tiêu (bỏ dấu, khớp mềm). */
function bestMatchIndex(target, labels) {
  const t = foldText(target);
  let i = labels.findIndex((l) => foldText(l) === t);
  if (i >= 0) return i;
  i = labels.findIndex((l) => foldText(l).includes(t) || t.includes(foldText(l)));
  return i;
}

/** So khớp mềm cho <select>/<radio> chuẩn (option có value + label). */
function matchOption(target, options) {
  const t = foldText(target);
  let hit = options.find((o) => foldText(o.label) === t);
  if (hit) return hit;
  hit = options.find((o) => foldText(o.value) === t);
  if (hit) return hit;
  hit = options.find((o) => foldText(o.label).includes(t) || t.includes(foldText(o.label)));
  return hit || null;
}

/**
 * Chọn một mục trong dropdown ARIA của Google Forms.
 * Google Forms cần: click mở -> chờ render -> click đúng option đang hiển thị.
 * Thử lại tối đa 2 lần và xác minh đã chọn (option có aria-selected="true").
 */
async function selectListboxOption(listboxEl, wantFolded, fallbackOptEl) {
  const matchOpt = (o) => {
    const lbl = foldText(ariaOptionLabel(o));
    const dv = foldText(o.getAttribute("data-value") || "");
    return (
      lbl === wantFolded ||
      dv === wantFolded ||
      (lbl && (lbl.includes(wantFolded) || wantFolded.includes(lbl)))
    );
  };

  // Click "thật" qua native .click() là cách Google Forms nhận ra việc chọn.
  // Click cả option lẫn phần tử con bên trong (Forms hay đặt handler ở span con).
  const hardClick = (el) => {
    simulateClick(el);
    try { el.click(); } catch (e) {}
    const inner = el.firstElementChild;
    if (inner) {
      simulateClick(inner);
      try { inner.click(); } catch (e) {}
    }
  };

  const isSelected = (target) => {
    if (target.getAttribute("aria-selected") === "true") return true;
    const activeId = listboxEl.getAttribute("aria-activedescendant");
    if (activeId) {
      const a = document.getElementById(activeId);
      if (a && matchOpt(a)) return true;
    }
    // Đã đóng dropdown và phần hiển thị chứa đúng giá trị => coi như đã chọn.
    if (listboxEl.getAttribute("aria-expanded") === "false" && foldText(listboxEl.textContent).includes(wantFolded)) {
      return true;
    }
    return false;
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      listboxEl.scrollIntoView({ block: "center" });
    } catch (e) {}
    simulateClick(listboxEl); // mở dropdown
    await sleep(320);

    // Gom option cả trong listbox lẫn popup riêng (Forms có thể render ở cuối DOM).
    const pool = [...listboxEl.querySelectorAll('[role="option"]'), ...document.querySelectorAll('[role="option"]')];
    const seen = new Set();
    const cands = [];
    for (const o of pool) {
      if (!seen.has(o)) {
        seen.add(o);
        cands.push(o);
      }
    }
    const target =
      cands.find((o) => isVisible(o) && matchOpt(o)) ||
      cands.find(matchOpt) ||
      (fallbackOptEl || null);

    if (target) {
      try {
        target.scrollIntoView({ block: "center" });
      } catch (e) {}
      await sleep(80);
      hardClick(target);
      await sleep(220);
      if (isSelected(target)) return true;
    }
  }
  return false;
}

const HILITE = "2px solid #16a34a";

/** Áp mapping của AI vào các field, tô màu ô đã điền. */
async function applyMapping(fields, mapping) {
  const byId = new Map(fields.map((f) => [f.fid, f]));
  let filled = 0;
  const notes = [];

  for (const item of mapping) {
    const f = byId.get(item.fid);
    if (!f || item.value === undefined || item.value === null || item.value === "") continue;

    try {
      if (f.kind === "text") {
        const el = f.els[0];
        let val = String(item.value);
        if (f.inputType === "date") val = normalizeDate(val);
        el.focus();
        el.value = val;
        fireEvents(el);
        el.style.outline = HILITE;
        filled++;
      } else if (f.kind === "select") {
        const el = f.els[0];
        const opt = matchOption(item.value, f.options);
        if (opt) {
          el.value = opt.value;
          fireEvents(el);
          el.style.outline = HILITE;
          filled++;
        } else notes.push(`Không khớp lựa chọn cho "${f.label}"`);
      } else if (f.kind === "radio") {
        const opt = matchOption(item.value, f.options);
        if (opt) {
          opt.el.checked = true;
          fireEvents(opt.el);
          if (opt.el.parentElement) opt.el.parentElement.style.outline = HILITE;
          filled++;
        } else notes.push(`Không khớp lựa chọn cho "${f.label}"`);
      } else if (f.kind === "checkbox") {
        const el = f.els[0];
        el.checked = /^(true|yes|1|có|on|checked|đúng)$/i.test(String(item.value).trim());
        fireEvents(el);
        if (el.parentElement) el.parentElement.style.outline = HILITE;
        filled++;
      } else if (f.kind === "aria-radio") {
        const idx = bestMatchIndex(item.value, f.options.map((o) => o.label));
        if (idx >= 0) {
          const r = f.options[idx].el;
          simulateClick(r);
          r.setAttribute("aria-checked", "true");
          r.style.outline = HILITE;
          filled++;
        } else notes.push(`Không khớp lựa chọn cho "${f.label}"`);
      } else if (f.kind === "aria-listbox") {
        const labels = f.options.map((o) => o.label);
        const idx = bestMatchIndex(item.value, labels);
        if (idx >= 0) {
          const want = foldText(labels[idx]);
          const picked = await selectListboxOption(f.el, want, f.options[idx].el);
          if (picked) {
            f.el.style.outline = HILITE;
            filled++;
          } else {
            notes.push(`Mở được nhưng không chọn được "${f.label}"`);
          }
        } else notes.push(`Không khớp lựa chọn cho "${f.label}"`);
      }
    } catch (e) {
      notes.push(`Lỗi khi điền "${f.label}": ${e.message}`);
    }
  }
  return { filled, notes };
}

// ===== Điều phối =====

async function handleFill(profile) {
  const fields = scanFields();
  if (fields.length === 0) {
    return { ok: false, error: "Không tìm thấy ô nhập nào trên trang này." };
  }

  let res;
  try {
    res = await chrome.runtime.sendMessage({
      action: "mapFields",
      fields: fields.map(serializeField),
      profile,
    });
  } catch (e) {
    return { ok: false, error: "Không gọi được nền (service worker): " + e.message };
  }

  if (!res || !res.ok) {
    return { ok: false, error: (res && res.error) || "AI không trả về kết quả." };
  }

  const result = await applyMapping(fields, res.mapping);
  return { ok: true, total: fields.length, filled: result.filled, notes: result.notes };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillForm") {
    handleFill(msg.profile).then(sendResponse);
    return true;
  }
  if (msg.action === "ping") {
    sendResponse({ ok: true });
    return false;
  }
});

// Cho phép kiểm thử bằng Node/jsdom.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { scanFields, serializeField, applyMapping, normalizeDate, matchOption, bestMatchIndex, foldText };
}
