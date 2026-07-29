#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "GPT Explain for Chrome · macOS installer"
echo "GPT 划词解释 · macOS 安装程序"
echo
echo "This package never includes another person's login. You will use your own ChatGPT account."
echo "此安装包不包含他人的登录信息，你将使用自己的 ChatGPT 账号。"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ was not found. Install it from https://nodejs.org and run this installer again." >&2
  echo "未找到 Node.js 18+。请从 https://nodejs.org 安装后重新运行。" >&2
  read -r -p "Press Enter to close / 按回车关闭…" _
  exit 3
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node.js 18+ is required; detected $(node --version)." >&2
  read -r -p "Press Enter to close / 按回车关闭…" _
  exit 3
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI was not found." >&2
  echo "Install it with: npm install -g @openai/codex@latest" >&2
  echo "Then run this installer again." >&2
  read -r -p "Press Enter to close / 按回车关闭…" _
  exit 4
fi

echo "1. Open chrome://extensions in Google Chrome."
echo "2. Turn on Developer mode."
echo "3. Click Load unpacked and select:"
echo "   $SCRIPT_DIR/extension"
echo "4. Copy the 32-character extension ID shown by Chrome."
echo
read -r -p "Paste extension ID / 粘贴扩展 ID: " EXTENSION_ID

"$SCRIPT_DIR/native-host/install-macos.sh" "$EXTENSION_ID"

echo
if codex login status >/dev/null 2>&1; then
  echo "Codex has a saved login. In the extension options, click Check connection to confirm it is a ChatGPT login."
  echo "Codex 已有登录。请在扩展设置中点击“检测连接”，确认它是 ChatGPT 登录。"
else
  echo "No Codex login was found. The official browser login will now start."
  echo "尚未发现 Codex 登录，即将启动官方浏览器登录；请选择你自己的 ChatGPT 账号。"
  read -r -p "Press Enter to run 'codex login' / 按回车登录…" _
  codex login
fi

echo
echo "Installation complete. Reload the extension once, then open its Options page and click Check connection."
echo "安装完成。请刷新扩展一次，再打开扩展选项并点击“检测连接”。"
read -r -p "Press Enter to close / 按回车关闭…" _
