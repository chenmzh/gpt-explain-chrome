# GPT Explain for Chrome / GPT 划词解释

Select text on a webpage, right-click, and ask GPT to explain it in a separate Chrome window. Choose Codex with your ChatGPT subscription, the direct DeepSeek V4 Flash API, or DeepSeek through Reasonix CLI. This package contains no API key and no developer login.

在网页中选中文字并右键，即可在独立 Chrome 小窗口中调用 GPT 解释。可选择 Codex、DeepSeek V4 Flash 直连 API，或 Reasonix CLI；安装包不含 API Key，也不含制作者的账号信息。

## Requirements / 系统要求

- macOS and Google Chrome 116+
- Node.js 18+
- At least one provider: Codex CLI with ChatGPT access, a DeepSeek API Key, or Reasonix CLI plus a DeepSeek API Key
- Install Reasonix when using its provider: `npm install -g reasonix`

## Install / 安装

1. Double-click `Install.command`. If macOS blocks it, Control-click the file, choose Open, then confirm Open.
2. Follow the on-screen steps: load the included `extension` folder with Chrome's **Load unpacked** button, paste the extension ID, and sign in with your own ChatGPT account if requested.
3. Reload the extension once. Open its Options page and click **Check connection / 检测连接**.
4. Select a provider. For a DeepSeek provider, save your own API Key locally, then check the connection.

1. 双击 `Install.command`。若 macOS 阻止运行，请按住 Control 点击文件，选择“打开”，再确认“打开”。
2. 按屏幕说明操作：在 Chrome 用“加载已解压的扩展程序”选择随包附带的 `extension` 文件夹，粘贴扩展 ID，并在需要时登录你自己的 ChatGPT 账号。
3. 刷新扩展一次，打开“扩展程序选项”，点击“检测连接”。

## Use / 使用

- Select text on a normal webpage, right-click, and choose **用 GPT 解释…**.
- Change the answer language in each result window: English is the fresh-install default; Chinese, German, French, Italian, and automatic source-language matching are available.
- The Settings page follows the browser language automatically or can be switched among English, Chinese, German, French, and Italian. Interface and answer language are independent.
- Select text inside an answer and use the same context-menu item to open a separate branch window.
- Ask follow-up questions in the composer at the bottom. Language changes apply to the next answer.

## Privacy / 隐私

- Codex users authenticate locally with `codex login`; DeepSeek users save their own API Key only in the local Native Host config.
- Selected text is sent from Chrome to the local Native Host, then to the chosen provider. There is no project-owned relay server.
- Do not select passwords, keys, confidential documents, or other text you should not send to a model.
- Model availability, usage limits, and data controls depend on the signed-in ChatGPT account and workspace.

## Notes / 说明

- This is a developer-mode package. Keep this folder in place after installation; Chrome loads the extension from it.
- A Native Host must be installed separately on every Mac. Chrome extensions cannot silently install local executables.
- For consumer-style one-click distribution and automatic updates, the extension would also need Chrome Web Store publication and a separately distributed Native Host installer.
- Run `Uninstall.command` to remove the Native Host, then remove the extension in `chrome://extensions`.
