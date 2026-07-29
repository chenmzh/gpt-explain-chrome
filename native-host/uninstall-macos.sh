#!/bin/bash
set -euo pipefail

HOST_NAME="com.codex.gpt_explainer"
USER_HOME="${HOME:?无法确定用户目录}"
SUPPORT_DIR="$USER_HOME/Library/Application Support/GPTExplainBridge"
MANIFEST_PATH="$USER_HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$HOST_NAME.json"

rm -f "$MANIFEST_PATH"
rm -f "$SUPPORT_DIR/config.json" "$SUPPORT_DIR/host.cjs" "$SUPPORT_DIR/run-host.sh"
rmdir "$SUPPORT_DIR" 2>/dev/null || true

echo "GPT 划词解释 Native Host 已卸载。Chrome 扩展需要在 chrome://extensions 中单独移除。"
