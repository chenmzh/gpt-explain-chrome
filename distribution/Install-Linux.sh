#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "GPT Explain for Chrome · Linux installer"
echo "GPT 划词解释 · Linux 安装程序"
echo
echo "This package never includes another person's login. You will use your own account."
echo "此安装包不包含他人的登录信息，你将使用自己的账号。"
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

echo "1. Open chrome://extensions in Google Chrome (or chromium://extensions in Chromium,"
echo "   or edge://extensions in Microsoft Edge)."
echo "2. Turn on Developer mode."
echo "3. Click Load unpacked and select:"
echo "   $SCRIPT_DIR/extension"
echo "4. Copy the 32-character extension ID shown by the browser."
echo
read -r -p "Paste extension ID / 粘贴扩展 ID: " EXTENSION_ID

echo
echo "Install the Native Host for Chrome (default), or add chromium/edge as a second argument:"
echo "  $SCRIPT_DIR/native-host/install-linux.sh \"$EXTENSION_ID\""
echo
read -r -p "Press Enter to install for Chrome / 按回车为 Chrome 安装…" _
"$SCRIPT_DIR/native-host/install-linux.sh" "$EXTENSION_ID"

echo
echo "Installation complete. Reload the extension once, then open its Options page and click Check connection."
echo "安装完成。请刷新扩展一次，再打开扩展选项并点击“检测连接”。"
read -r -p "Press Enter to close / 按回车关闭…" _
