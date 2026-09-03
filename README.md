# SmartFill AI — AI-powered form filler that runs locally

> 🌐 **Language / Ngôn ngữ:** **English** · [Tiếng Việt](README.vi.md)

[![Tests](https://github.com/huynhpham13790-rgb/smartfill-ai/actions/workflows/test.yml/badge.svg)](https://github.com/huynhpham13790-rgb/smartfill-ai/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-green.svg)](CHANGELOG.md)

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
- ✅ **Preview** the mapping before anything is written to the form, and **undo** in one click.
- ✅ **Works even without Ollama**: falls back to a rule-based mapper.
- ✅ **Import your profile from a CV** (`.pdf`, `.txt`, `.md`): the AI reads it and fills the profile in.

## Requirements

- A Chromium-based browser: **Google Chrome**, **Microsoft Edge**, **Brave**, or **Opera**.
  > **Firefox / Zen Browser are not supported.** This extension declares `background.service_worker`, which Firefox's MV3 implementation does not accept (it requires `background.scripts`), and the MCP server below speaks the Chrome DevTools Protocol, which Firefox does not expose.
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
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** → select the `smartfill-ai` folder.
5. The SmartFill AI icon will appear in your toolbar.

> This is a pure-JavaScript extension with **no build/compile step**. The source runs directly as it is in the repository.

## Installing and building from source

The extension has **no compile step**: `manifest.json` points straight at the
`.js` files and the browser runs them as they are. No bundler, no transpiler, no
generated code. So "building from source" here means one of two things: loading
the directory into the browser (Step 2 above), or packaging a release `.zip`.

Requirements for packaging and running the tests: **Node.js 18 or newer**.

```bash
git clone https://github.com/huynhpham13790-rgb/smartfill-ai.git
cd smartfill-ai

npm test              # mapping tests, no Ollama needed
npm run test:ai       # also exercises the AI path, needs Ollama running

npm run package       # -> dist/smartfill-ai-<version>.zip
```

`npm run package` collects exactly what the browser needs (`manifest.json`,
`src/`, `popup/`, `shared/`, `icons/`, `LICENSE`) into a `.zip` — an open archive
format every OS can extract with built-in tools. The script uses only Node's
standard library plus PowerShell (Windows) or `zip` (Linux/macOS), and **adds no
dependencies**.

The MCP server does need its dependencies installed first:

```bash
cd mcp-server
npm ci                # installs the exact versions locked in package-lock.json
node index.js
```

## Testing

`npm test` runs `tests/benchmark.mjs` against 4 fixture forms (16 fields with
known answers) and scores four distinct error classes: wrong, missing,
hallucinated, and unknown-fid. It exits non-zero if the fallback mapper drops
below 100%, so it works in CI without a GPU.

There are two fixture sets. On the ordinary one, both the fallback mapper and
`qwen2.5:7b` score **16/16 fields correct**. On the hard one (abbreviated
dropdowns, question-shaped labels, English forms), the rules manage only **1/12**
while the AI gets **7/12** — and the two fail differently: the rules leave fields
blank, the AI always guesses. Full analysis and known limitations:
[docs/AI.md](docs/AI.md).

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
├── shared/
│   ├── prompt.js        # AI instructions shared by the extension & MCP server
│   ├── fallback.js      # Rule-based mapping, used when Ollama is unavailable
│   └── cv.js            # Reads a CV (.pdf/.txt/.md) and extracts a profile
├── mcp-server/          # Node.js MCP server integration
│   ├── package.json
│   └── index.js
├── tests/               # Tests & accuracy measurement
│   ├── benchmark.mjs
│   └── fixtures/        # Sample profile and forms with expected answers
├── tools/
│   └── package.mjs      # Packages the extension into a release .zip
├── docs/
│   └── AI.md            # AI technical documentation + measured results
├── icons/               # Extension icons
├── demo/                # Sample form page for testing
│   └── demo-form.html
├── LICENSE              # MIT License
├── CONTRIBUTING.md      # Contribution guide
├── CHANGELOG.md
└── README.md
```

## Model Context Protocol (MCP) Server

SmartFill AI includes a Node.js-based MCP Server. This lets autonomous AI agents
(Claude Code, Cursor, etc.) drive the form scanner and fill pages on a live browser
tab as ordinary tools — no clicking the popup.

**How it works.** The MCP server does *not* go through the extension. It attaches to a
running browser over the Chrome DevTools Protocol, reads `src/content.js` off disk and
evaluates it in the page to get `scanFields()` / `applyMapping()`, then calls Ollama
directly. Consequences worth knowing:

- The extension does **not** need to be installed for the MCP path to work.
- Your saved popup profile and AI settings are **not** used — `fill_form` takes the
  profile as a tool argument, and the model/URL as optional arguments.
- Only Chromium-based browsers expose CDP, so this path is Chrome/Edge/Brave/Opera only.

Both paths share the same AI instructions from `shared/prompt.js`, so the extension and
the MCP server always resolve fields the same way.

### Running the MCP Server

1. Make sure your browser is launched with remote debugging enabled on port `9222`:
   - **Chrome:** `google-chrome --remote-debugging-port=9222`
   - **Edge:** `msedge --remote-debugging-port=9222`

   > ⚠️ **Security warning.** Port 9222 gives *any* local process full control of that
   > browser — including reading your cookies and logged-in sessions. Launch a
   > throwaway profile with `--user-data-dir=/path/to/temp-profile` instead of your
   > everyday one, and close it when you are done.
2. Install the server dependencies:
   ```bash
   cd mcp-server
   npm install
   ```
3. Register the MCP server in your AI agent config (e.g., `claudecode.json` or Cursor settings):
   ```json
   {
     "mcpServers": {
       "smartfill-ai-mcp": {
         "command": "node",
         "args": ["path/to/smartfill-ai/mcp-server/index.js"]
       }
     }
   }
   ```

### Exposed Tools

- **`scan_form`** — scans a browser tab and returns the detected fields (label, kind,
  and the available options for selects/radios). Arguments:
  - `targetUrl` (string, optional): substring matched against open tab URLs. If omitted,
    the first open tab is used — pass this when you have more than one tab open.
- **`fill_form`** — scans a tab, asks Ollama to map your profile onto the fields, and
  fills them in. Arguments:
  - `profile` (object, required): key-value pairs of user profile data, e.g.
    `{"Họ và tên": "Phạm Văn Huynh", "Mã số sinh viên": "DTC245200357"}`.
  - `model` (string, optional): local Ollama model to use (default: `qwen2.5:7b`).
  - `ollamaUrl` (string, optional): Ollama server URL (default: `http://localhost:11434`).
  - `targetUrl` (string, optional): same as above.

  Returns `detectedFieldsCount`, the resolved `mapping`, and `filledResult` with how many
  fields were actually written.

## Tech & libraries

- **Chrome Extension Manifest V3** — no external framework dependency.
- **Plain JavaScript (ES2020)** — no bundler, no bundled third-party packages.
- **[Ollama]** — local language-model server; called via its REST API (`/api/chat`).
- **Default model:** `qwen2.5:7b` (minimum recommended; switch to any model you've `ollama pull`ed in AI Settings).
- **[Model Context Protocol (MCP)]** — `@modelcontextprotocol/sdk` over StdIO, so external agents can call SmartFill as a tool.
- **`chrome-remote-interface`** — Chrome DevTools Protocol client used by the MCP server to reach a live tab.

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

Report bugs or request features via
[GitHub Issues](https://github.com/huynhpham13790-rgb/smartfill-ai/issues) —
templates are provided for both. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
sending changes. See the change history in [CHANGELOG.md](CHANGELOG.md).

When pasting logs into an issue, please strip the real personal data from your
profile first.

## License

SmartFill AI is released under the [MIT License](LICENSE), an
[OSI-approved](https://opensource.org/licenses/MIT) license.

We chose MIT because this is a learning project: the point is that anyone can
read it, run it, modify it, and lift a piece of the code into their own project —
including a commercial one — without asking permission and without being forced
to open their own source in return. The only condition is keeping the copyright
and license notice.

The full license text lives in [LICENSE](LICENSE) at the repository root. Every
source file carries a short header with `SPDX-License-Identifier: MIT`; JSON
files have no comment syntax, so they declare it via the `"license"` field in
`package.json` instead.

[Ollama]: https://ollama.com
[Model Context Protocol (MCP)]: https://modelcontextprotocol.io
