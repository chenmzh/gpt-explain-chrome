#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/native-host/uninstall-macos.sh"

echo
echo "Also remove the extension from chrome://extensions."
echo "还请在 chrome://extensions 中移除扩展。"
read -r -p "Press Enter to close / 按回车关闭…" _
