# SmartFill AI — AI-powered form filler that runs locally

> 🌐 **Language / Ngôn ngữ:** **English** · [Tiếng Việt](README.vi.md)

> A browser extension that auto-fills web forms (sign-up forms, registration, account creation...) using an AI model that runs **locally** through [Ollama]. Save your profile once, and the AI understands each field's label and fills it for you — including dropdowns, radio buttons, checkboxes, and dates.

**Entry for the "Open-Source AI-Integrated Software Development 2026" competition — Faculty of IT, University of Information and Communication Technology, Thai Nguyen University.**

---

## Why this project?

Students constantly re-type the same set of information (full name, student ID, class, faculty, email...) into dozens of different forms. SmartFill AI solves that: declare your profile once, then fill any form with a single click.

Unlike the browser's built-in autofill (which only matches field names rigidly), SmartFill AI uses a **language model** to *understand the meaning* of each label. For example, a field labeled "MSV", "Student ID", or "mã sinh viên" is all recognized as the student ID; a hometown dropdown showing "Tỉnh Thái Nguyên" still matches a profile that says "Thái Nguyên".

## Features

- ✅ Fills forms on **any website** open in your browser (registration, profiles, account creation).
- ✅ Supports many field types: text, email, phone number, **dropdown (select)**, **radio**, **checkbox**, **date of birth**.
- ✅ Works with **Google Forms** too (its special choice widgets `role="listbox"`/`role="radio"`).
- ✅ The AI understands labels semantically — no exact name match required.
- ✅ Manage **multiple profiles** (e.g. personal profile, academic profile).
- ✅ **Fully private**: your data stays on your machine and the AI runs locally — nothing is sent to the cloud.
- ✅ Highlights the fields it just filled so you can **review before submitting**.

## Requirements

- A Chromium-based browser: **Google Chrome** or **Microsoft Edge** (Manifest V3 support).
- [Ollama] installed and running on your machine.

## Installation

### Step 1 — Install and run Ollama (local AI)

1. Download Ollama from https://ollama.com and install it.
2. Pull an AI model. **Minimum recommended: `qwen2.5:7b`** (a good balance of Vietnamese accuracy and speed):

   ```bash
   ollama pull qwen2.5:7b
   ```

   Depending on your hardware, you can choose a different model — see [Choosing the right model for your machine](#choosing-the-right-model-for-your-machine).

3. Allow the extension to call Ollama. By default Ollama only accepts requests from `localhost`; grant access to the extension with the `OLLAMA_ORIGINS` environment variable:

   - **Windows (PowerShell):**
     ```powershell
     setx OLLAMA_ORIGINS "chrome-extension://*"
     ```
     Then restart Ollama.
   - **macOS / Linux:**
     ```bash
     export OLLAMA_ORIGINS="chrome-extension://*"
     ollama serve
     ```

### Choosing the right model for your machine

SmartFill AI works with **any model Ollama supports**. Form-filling accuracy (copying values verbatim, not filling the wrong field, picking the correct dropdown option) depends heavily on model size: bigger means more accurate, but needs more RAM/VRAM and runs slower.

| Model (`ollama pull ...`) | RAM/VRAM needed | Best for | Accuracy |
|---|---|---|---|
| `qwen2.5:3b` | ~3–4 GB | Low-end machines, 8 GB RAM, no dedicated GPU | OK (occasional typos / wrong field) |
| `qwen2.5:7b` ⭐ | ~6–8 GB | 16 GB RAM or GPU ≥ 6 GB VRAM | Good — **minimum recommended** |
| `llama3.1:8b` | ~7–9 GB | 16 GB RAM, 8 GB GPU | Good |
| `qwen2.5:14b` | ~10–12 GB | ≥ 16–32 GB RAM, GPU ≥ 10 GB VRAM | Very good |
| `qwen2.5:32b` | ~20 GB and up | GPU ≥ 16–24 GB VRAM | Highest |

Quick guidance by machine:

- **Office laptop, no dedicated GPU (8 GB RAM):** `qwen2.5:3b` — works, but review carefully before submitting.
- **Mainstream machine (16 GB RAM) or a 6–8 GB GPU:** `qwen2.5:7b` ⭐ — the best balance, recommended.
- **Powerful machine (GPU ≥ 10 GB VRAM):** `qwen2.5:14b` or higher for top accuracy.

> **Why the Qwen2.5 family?** It understands Vietnamese and produces stable JSON output far better than other models of the same size — ideal for reading Vietnamese form labels. You can still try other models (Gemma, Llama, Mistral...) under **AI Settings → Model**.

After the `pull` finishes, open the popup **⚙️ AI Settings (Ollama) → Model**, enter the exact name of the model you downloaded (e.g. `qwen2.5:7b`), and click **Test connection**.

### Step 2 — Load the extension into your browser

1. Download this source code (Code → Download ZIP, or `git clone`) and unzip it.
2. Open Chrome/Edge and go to `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** → select the `smartfill-ai` folder.
5. The SmartFill AI icon will appear in your toolbar.

> This is a pure-JavaScript extension with **no build/compile step**. The source runs directly as it is in the repository.

## Usage

1. Click the SmartFill AI icon to open the popup.
2. Enter your information into a profile (suggested fields are pre-filled; add/remove as needed) → **Save profile**.
3. Open **AI Settings** → click **Test connection** to make sure Ollama is ready.
4. Open a page with a form and click **✨ Fill the form on this page**.
5. The AI reads the form, fills the matching fields, and outlines them in green. **Review, then submit.**

## Project structure

```
smartfill-ai/
├── manifest.json        # Extension manifest (Manifest V3)
├── popup/               # Profile management UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── src/
│   ├── content.js       # Scans & fills forms on the page
│   └── background.js    # Service worker: calls Ollama, maps data
├── icons/               # Extension icons
├── demo/                # Sample form page for testing
│   └── demo-form.html
├── LICENSE              # MIT License
├── CHANGELOG.md
└── README.md
```

## Tech & libraries

- **Chrome Extension Manifest V3** — no external framework dependency.
- **Plain JavaScript (ES2020)** — no bundler, no bundled third-party packages.
- **[Ollama]** — local language-model server; called via its REST API (`/api/chat`).
- **Default model:** `qwen2.5:7b` (minimum recommended; switch to any model you've `ollama pull`ed in AI Settings).

All AI functionality uses an open-source model running locally — no paid API keys, no data sent anywhere.

## Troubleshooting

| Symptom | What to do |
|---|---|
| "Cannot connect to Ollama" | Check that Ollama is running (`ollama serve`) and that `OLLAMA_ORIGINS` is set. |
| Connects but reports a missing model | Run `ollama pull qwen2.5:7b` (or the exact model name set in AI Settings). |
| Typos / wrong field filled | The model is too small. Move up to `qwen2.5:7b` or higher (see [Choosing the right model](#choosing-the-right-model-for-your-machine)). |
| Google Forms dropdown/choice won't get selected | Reload the page and retry; make sure you reloaded the extension after updating. |
| A few fields left empty | Some forms use special JS; review and fill the remaining fields manually. |
| Button does nothing | Reload the page and retry; some system pages (chrome://) are not allowed. |

## Issues & contributing

Report bugs or request features via the project's **GitHub Issues**. See the change history in [CHANGELOG.md](CHANGELOG.md).

## License

Released under the [MIT License](LICENSE) — you are free to use, modify, and redistribute it.

[Ollama]: https://ollama.com
