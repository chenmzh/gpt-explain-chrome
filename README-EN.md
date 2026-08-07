# GPT Explain in Page

> **English** · [简体中文](README.md)

Select text in Chrome or Microsoft Edge and ask GPT to explain it in an independent popup window. Choose Codex with a ChatGPT subscription, the direct DeepSeek V4 Flash API, or DeepSeek through Reasonix CLI.

> 在 Chrome 或 Microsoft Edge 中选中文字，右键选择"用 GPT 解释"，可通过本机 Codex CLI、DeepSeek V4 Flash 直连 API，或 Reasonix CLI 生成解释。

![Independent explain window: Markdown, math and language switching](popup-preview-v0.3.1.png)

This is a personal-use macOS / Windows Chrome or Edge extension. A browser extension cannot launch native programs by itself, so the project has two parts:

- `extension/`: a Manifest V3 browser extension responsible for the context menu, independent result windows, and settings.
- `native-host/`: a Native Messaging Host that securely invokes the signed-in Codex CLI, the DeepSeek API, or the isolated Reasonix CLI.

## Features

- Explain selected text from the right-click context menu
- Show source, generation status, and the answer in a movable, resizable independent Chrome window
- Select text again inside an explain window to open an independent child window that inherits the context
- Every explanation and follow-up is automatically saved to a local library that can be revisited after closing windows or restarting the browser
- Child windows keep precise source pointers so you can return to the parent window or list all downstream explanations
- The library supports full-text search, record details, JSON export, and a window relationship graph
- Multiple explain windows auto-tile across monitor workspaces to avoid overlapping when possible
- Each window keeps its own multi-turn follow-up conversation; dialogs do not pollute each other
- Safe local Markdown rendering with Marked + DOMPurify, and local math rendering with KaTeX
- Reuses a persistent Codex app-server and streams answers piece by piece
- Supports the official DeepSeek V4 Flash Chat Completions streaming API with optional thinking off, High, or Max
- Supports DeepSeek V4 Flash via the Reasonix CLI; Reasonix runs in a separate temporary config directory and does not load your MCP configuration
- Copy, stop, and re-explain
- Defaults to Luna / XHigh, switchable to Luna / Max, Sol / Medium, Sol / High, or a custom model like GPT-5.6 Sol, Terra, Luna, and others
- Dynamically reads the available models from your current ChatGPT account; falls back to the account default when an old config is unavailable
- The performance policy only fills in recommended combinations; your explicit model or reasoning choice always wins in the UI
- Choose Low, Medium, High, Extra High, Max, or Ultra reasoning
- Switch the answer language directly in the explain window between English (default for new installs), Simplified Chinese, Deutsch, Français, Italiano, or follow the original; effective from the next explanation or follow-up
- The settings page follows the browser language automatically or can be switched manually between English, Simplified Chinese, Deutsch, Français, Italiano; UI language and answer language are independent
- Checks the Codex sign-in, DeepSeek API Key, or Reasonix CLI status for the current provider
- Handles up to 50,000 characters per request

## System Requirements

- macOS, 64-bit Windows 10 / Windows 11, or Linux (Chrome, Chromium, or Edge)
- Google Chrome 116 or later (or Chromium / Microsoft Edge)
- Node.js 18 or later
- At least one of the following providers:
  - Codex CLI 0.144.0 or later, plus a ChatGPT account that can use Codex
  - A DeepSeek API Key (for the DeepSeek V4 Flash direct API)
  - Reasonix CLI plus a DeepSeek API Key (install with `npm install -g reasonix`)

When using Codex, first confirm that you are signed in:

```bash
codex --version
codex login
codex login status
```

If your version is too old, update Codex using your install method, for example `npm install -g @openai/codex@latest`. When using DeepSeek, select the provider in the extension settings page and save the API Key to the local Host; the Key never enters Chrome storage.

## Installation

### 1. Load the browser extension

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Microsoft Edge.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select this project's `extension` folder.
5. Note the 32-character "extension ID" shown on the extension card.

### 2. Install the Native Host

#### macOS

In a terminal inside the project directory, run:

```bash
chmod +x native-host/install-macos.sh native-host/uninstall-macos.sh
./native-host/install-macos.sh YOUR_EXTENSION_ID
```

The installer will:

- Automatically find the `node` used by the current terminal and detect `codex` and `reasonix` as needed
- Install the Host to `~/Library/Application Support/GPTExplainBridge`
- Create the `com.codex.gpt_explainer` Native Messaging manifest for Chrome
- Only allow the extension ID you pass in to connect to the Host

After installation, open the extension's "Details" → "Extension options" and click "Check connection".

#### Linux

In a terminal inside the project directory, run:

```bash
chmod +x native-host/install-linux.sh native-host/uninstall-linux.sh
./native-host/install-linux.sh YOUR_EXTENSION_ID
```

The installer will:

- Automatically find the `node` used by the current terminal and detect `codex` and `reasonix` as needed
- Install the Host to `~/.local/share/GPTExplainBridge`
- Create the `com.codex.gpt_explainer` Native Messaging manifest for Chrome at `~/.config/google-chrome/NativeMessagingHosts/`
- Only allow the extension ID you pass in to connect to the Host

To also register Chromium or Edge, pass a comma-separated browser list as the second argument:

```bash
./native-host/install-linux.sh YOUR_EXTENSION_ID chrome,chromium,edge
```

- Chromium uses `~/.config/chromium/NativeMessagingHosts/` and Edge uses `~/.config/microsoft-edge/NativeMessagingHosts/`
- The same `extension` folder gets the same extension ID in Chrome, Chromium, and Edge

After installation, open the extension's "Details" → "Extension options" and click "Check connection".

#### Windows

In PowerShell inside the project directory, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\install-windows.ps1 -ExtensionId YOUR_EXTENSION_ID
```

You can also use the Windows share package and double-click `Install-Windows.cmd`. The installer will:

- Automatically find the `node.exe` used by the current Windows user and detect Codex and Reasonix CLI as needed; supports both native `.exe` and npm `.cmd` launchers
- Install the Host to `%LOCALAPPDATA%\GPTExplainBridge`
- Register the Native Messaging manifest at `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.codex.gpt_explainer` without needing administrator rights
- Also support Microsoft Edge: by default the installer additionally registers at `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.codex.gpt_explainer`; open `edge://extensions` in Edge and load the same `extension` folder (the same folder gets the same extension ID in Chrome and Edge)
- Only allow the extension ID you pass in to connect to the Host

To register only Chrome or only Edge, pass `-Browsers chrome` or `-Browsers edge`.

After installation, reload the extension, open "Extension options", and click "Check connection".

### Installing for other people

The three systems use clearly named share packages: `GPT-Explain-Chrome-macOS-v0.4.3.zip`, `GPT-Explain-Chrome-Windows-v0.4.3.zip`, and `GPT-Explain-Chrome-Linux-v0.4.3.zip`. They contain only the extension, the matching Native Host installer, and instructions — no locally generated `config.json`, no Codex sign-in, and no API Key. On macOS double-click `Install.command`; on Windows double-click `Install-Windows.cmd`; on Linux run `native-host/install-linux.sh`. Then configure with your own extension ID and account or API Key.

Regular Chrome usually blocks CRX installs from outside the Chrome Web Store, so this project's self-use share version uses "load the `extension` folder unpacked + a local Host installer". For a public one-click install and auto-update, you would still need to publish to the Chrome Web Store and distribute the Native Host installer separately.

### 3. Usage

1. Open any regular web page.
2. Select a piece of text and right-click.
3. Click "Explain with GPT…".
4. The answer appears in an independent Chrome window.
5. Select text again inside the answer to open a new child window that inherits the current context.
6. Type a question at the bottom of the window to continue the current conversation; press Enter to send, Shift+Enter for a newline.

On the extension settings page you can choose the AI provider, DeepSeek thinking mode, Codex model and reasoning strength, answer language, answer length, and prompt template.

## Prompt Template Variables

Custom prompts support:

- `{{text}}`: the selected text
- `{{title}}`: the page title
- `{{url}}`: the page URL
- `{{language}}`: the language setting value

If the template does not contain `{{text}}`, the Host automatically appends the selected text at the end.

## Security & Privacy

- The extension never reads, copies, or saves `~/.codex/auth.json`.
- ChatGPT sign-in is managed by the official `codex login`.
- The DeepSeek API Key is stored only in the local Native Host's `config.json`, never in Chrome storage, and never in the share package; on macOS the file permission is `600`, on Windows the file lives in the current user's `%LOCALAPPDATA%`.
- Selected text goes straight from Chrome Native Messaging to the local Host and then to your chosen provider; the project has no servers of its own.
- The Host launches Codex with a Node `spawn` argument array, with `shell` explicitly disabled.
- Reasonix uses a one-shot `reasonix run`, with `shell` explicitly disabled; the child process uses a blank temporary user config directory, so it does not load your MCP servers, `.env`, or project configuration.
- Model names, reasoning values, message sizes, and text lengths are all validated.
- The Native Host keeps one local `codex app-server` process; each explanation creates an ephemeral thread and runs as a turn with a `read-only` sandbox, `never` approval, and network disabled.
- The prompt explicitly treats the selected page text as untrusted data and requires the model to run no tools.
- Answers are parsed by the bundled Marked, sanitized by the bundled DOMPurify allowlist, and math is rendered by KaTeX with `trust: false`; model output is never treated as trusted HTML.

Please note: content is sent to the OpenAI/Codex or DeepSeek service you choose, subject to that service's data control, subscription, or billing rules. Do not ask it to explain passwords, keys, or other sensitive information that should not be sent to a model.

## Troubleshooting

### "Specified native messaging host not found"

This is usually a mismatched extension ID. Re-copy the ID from `chrome://extensions` and run the installer again.

### `env: node: No such file or directory`

Older Host versions did not add the Homebrew path for Chrome. Re-run the installer from the current project, then check the connection again from the extension settings page.

### "Codex is not signed in"

Run, as the same macOS user:

```bash
codex login
codex login status
```

### Model unavailable

The models available differ by ChatGPT plan, workspace policy, and Codex version. First choose "Codex recommended (auto)"; you can also update Codex and try specifying a model again.

### Changes to the code do not take effect

Click the refresh button on the extension card in `chrome://extensions`. If the Native Host changed, re-run the installer.

## Uninstall

macOS:

```bash
./native-host/uninstall-macos.sh
```

Linux:

```bash
./native-host/uninstall-linux.sh
```

Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-host\uninstall-windows.ps1
```

Then remove the extension from `chrome://extensions` (or `edge://extensions`).

## Development & Verification

The project does not require `npm install`; KaTeX, Marked, and DOMPurify are bundled as browser-side static assets:

```bash
npm test
npm run check
```

Build the shareable macOS install directory and ZIP:

```bash
bash scripts/build-distribution.sh
```

Build the separately named Linux install directory and ZIP:

```bash
bash scripts/build-distribution-linux.sh
```

Build the separately named Windows install directory and ZIP:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-distribution-windows.ps1
```

Artifacts go to the Git-ignored `dist/` directory. GitHub Actions runs the same tests and checks on every push and pull request.

`npm test` verifies message validation, prompt isolation, app-server arguments, streaming events, and the Native Messaging protocol; `npm run check` verifies the Manifest, page dependencies, and JavaScript and shell script syntax.

## Current Limitations

- The Windows installer depends on the built-in Windows PowerShell and .NET Framework to generate the per-user Native Host launcher.
- The Native Host must be installed on each machine individually; the Chrome Web Store cannot install it by itself.
- The independent window is a regular Chrome popup; Chrome does not provide a forced "always on top" setting for extensions.
- Tiling is limited by the available screen area; when too many windows are open, Chrome cannot guarantee a fully non-overlapping visible position.
- Model availability and quotas are determined by the ChatGPT plan, workspace settings, and the current Codex version.
- Reasonix mode passes the task through standard input and uses a separate `REASONIX_HOME` with an explicitly empty tools directory; like other providers it supports selected text up to 50,000 characters.
