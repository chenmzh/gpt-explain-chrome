# GPT Explain for Chrome — Windows / GPT 划词解释 — Windows

This is the Windows package. Choose Codex with your ChatGPT subscription, the direct DeepSeek V4 Flash API, or DeepSeek through Reasonix CLI. This package contains no API key and no developer login.

这是独立的 Windows 安装包。可选择 ChatGPT 订阅的 Codex、DeepSeek V4 Flash 直连 API，或通过 Reasonix CLI 调用 DeepSeek。安装包不含 API Key，也不含制作者的账号信息。

## Requirements / 系统要求

- Windows 10 or Windows 11 (64-bit) and Google Chrome 116+
- Node.js 18+: <https://nodejs.org/>
- At least one provider: Codex CLI with ChatGPT access, a DeepSeek API Key, or Reasonix CLI plus a DeepSeek API Key
- Install Reasonix when using its provider: `npm install -g reasonix`

Confirm these commands work in PowerShell before installing / 安装前请在 PowerShell 中确认：

```powershell
node --version
codex --version
codex login status
```

## Install / 安装

1. Keep this extracted folder in a permanent location; Chrome loads the extension from it.
2. Double-click `Install-Windows.cmd`.
3. Follow the prompt: open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the included `extension` folder.
4. Paste the extension ID into the installer. Reload the extension, open its Options page, and click **Check connection / 检测连接**.
5. On the Options page, select a provider. For a DeepSeek provider, save your own API Key locally, then check the connection.

1. 将解压后的目录保存在固定位置，Chrome 会从这里加载扩展。
2. 双击 `Install-Windows.cmd`。
3. 按提示打开 `chrome://extensions`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择包内的 `extension` 文件夹。
4. 将扩展 ID 粘贴到安装程序。刷新扩展，打开扩展选项，点击“检测连接”。

If Windows marks the downloaded ZIP as blocked, right-click the ZIP before extracting it, open **Properties**, select **Unblock**, and extract it again.

如果 Windows 阻止从网络下载的 ZIP，请在解压前右键 ZIP，打开“属性”，勾选“解除锁定”，再重新解压。

## How the Windows package differs / Windows 版的区别

- The Native Messaging Host is installed under `%LOCALAPPDATA%\GPTExplainBridge`.
- Chrome discovers it through `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.codex.gpt_explainer`.
- A small per-user launcher forwards Chrome's standard input/output to the shared Node.js host. No administrator permission is required.
- The macOS package uses `.command`/shell installers and the macOS NativeMessagingHosts directory instead; do not mix files from the two packages.

## Uninstall / 卸载

Double-click `Uninstall-Windows.cmd`, then remove the extension from `chrome://extensions`.

双击 `Uninstall-Windows.cmd`，然后在 `chrome://extensions` 中移除扩展。
