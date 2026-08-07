# GPT Explain for Chrome — Linux / GPT 划词解释 — Linux

Select text on a webpage, right-click, and ask GPT to explain it in a separate Chrome window. Choose Codex with your ChatGPT subscription, the direct DeepSeek V4 Flash API, or DeepSeek through Reasonix CLI. This package contains no API key and no developer login.

在网页中选中文字并右键，即可在独立 Chrome 小窗口中调用 GPT 解释。可选择 Codex、DeepSeek V4 Flash 直连 API，或 Reasonix CLI；安装包不含 API Key，也不含制作者的账号信息。

## Requirements / 系统要求

- Linux with Google Chrome 116+, Chromium, or Microsoft Edge
- Node.js 18+: <https://nodejs.org/>
- At least one provider: Codex CLI with ChatGPT access, a DeepSeek API Key, or Reasonix CLI plus a DeepSeek API Key
- Install Reasonix when using its provider: `npm install -g reasonix`

Confirm these commands work in a terminal before installing / 安装前请在终端中确认：

```bash
node --version
codex --version
codex login status
```

## Install / 安装

1. Keep this extracted folder in a permanent location; the browser loads the extension from it.
2. Run `Install-Linux.sh` (or run `bash Install-Linux.sh` from a terminal).
3. Follow the prompt: open `chrome://extensions` (or `chromium://extensions` / `edge://extensions`), turn on **Developer mode**, choose **Load unpacked**, and select the included `extension` folder.
4. Paste the extension ID into the installer. Reload the extension, open its Options page, and click **Check connection / 检测连接**.
5. On the Options page, select a provider. For a DeepSeek provider, save your own API Key locally, then check the connection.

To install the Native Host for Chromium or Edge as well, run the host installer directly with a browser list:

```bash
chmod +x native-host/install-linux.sh
./native-host/install-linux.sh 你的扩展ID chrome,chromium,edge
```

1. 将解压后的目录保存在固定位置，浏览器会从这里加载扩展。
2. 运行 `Install-Linux.sh`（或在终端中运行 `bash Install-Linux.sh`）。
3. 按提示打开 `chrome://extensions`（或 `chromium://extensions` / `edge://extensions`），启用“开发者模式”，点击“加载已解压的扩展程序”，选择包内的 `extension` 文件夹。
4. 将扩展 ID 粘贴到安装程序。刷新扩展，打开扩展选项，点击“检测连接”。
5. 在扩展设置页选择提供方。若使用 DeepSeek，请在本机保存你自己的 API Key，然后检测连接。

如需同时为 Chromium 或 Edge 安装 Native Host，请直接运行 Host 安装程序并传入浏览器列表：

```bash
chmod +x native-host/install-linux.sh
./native-host/install-linux.sh 你的扩展ID chrome,chromium,edge
```

## How the Linux package differs / Linux 版的区别

- The Native Messaging Host is installed under `~/.local/share/GPTExplainBridge`.
- Chrome discovers it through `~/.config/google-chrome/NativeMessagingHosts/com.codex.gpt_explainer.json`; Chromium and Edge use their own config directories.
- The launcher is a small `run-host.sh` that forwards the browser's standard input/output to Node.js. No administrator permission is required.
- The macOS package uses `.command`/shell installers under `~/Library/Application Support`; the Windows package uses PowerShell under `%LOCALAPPDATA%`. Do not mix files from different packages.

## Uninstall / 卸载

Run `Uninstall-Linux.sh`, then remove the extension from `chrome://extensions` (or `edge://extensions`).

运行 `Uninstall-Linux.sh`，然后在 `chrome://extensions`（或 `edge://extensions`）中移除扩展。
