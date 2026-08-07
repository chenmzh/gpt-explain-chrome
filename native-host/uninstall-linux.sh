#!/bin/bash
set -euo pipefail

HOST_NAME="com.codex.gpt_explainer"
USER_HOME="${HOME:?无法确定用户目录}"
SUPPORT_DIR="$USER_HOME/.local/share/GPTExplainBridge"

for manifest_dir in \
  "$USER_HOME/.config/google-chrome/NativeMessagingHosts" \
  "$USER_HOME/.config/chromium/NativeMessagingHosts" \
  "$USER_HOME/.config/microsoft-edge/NativeMessagingHosts"; do
  rm -f "$manifest_dir/$HOST_NAME.json"
done

rm -f "$SUPPORT_DIR/config.json" "$SUPPORT_DIR/host.cjs" "$SUPPORT_DIR/run-host.sh"
rmdir "$SUPPORT_DIR" 2>/dev/null || true

echo "GPT 划词解释 Native Host 已卸载。扩展需要在 chrome://extensions 或 edge://extensions 中单独移除。"
