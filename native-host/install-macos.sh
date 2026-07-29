#!/bin/bash
set -euo pipefail

HOST_NAME="com.codex.gpt_explainer"
EXTENSION_ID="${1:-}"

if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
  echo "用法: ./install-macos.sh <Chrome 扩展 ID>" >&2
  echo "扩展 ID 是 chrome://extensions 中显示的 32 位字符串。" >&2
  exit 2
fi

NODE_BIN="$(command -v node || true)"
CODEX_BIN="$(command -v codex || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 Node.js。请先安装 Node.js 18 或更高版本。" >&2
  exit 3
fi
if [[ -z "$CODEX_BIN" ]]; then
  echo "未找到 Codex CLI。请先安装 Codex，并运行 codex login。" >&2
  exit 4
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_HOME="${HOME:?无法确定用户目录}"
SUPPORT_DIR="$USER_HOME/Library/Application Support/GPTExplainBridge"
MANIFEST_DIR="$USER_HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"

mkdir -p "$SUPPORT_DIR" "$MANIFEST_DIR"
cp "$SCRIPT_DIR/host.cjs" "$SUPPORT_DIR/host.cjs"

"$NODE_BIN" -e '
  const fs = require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({ codexPath: process.argv[2] }, null, 2) + "\n");
' "$SUPPORT_DIR/config.json" "$CODEX_BIN"

"$NODE_BIN" -e '
  const fs = require("node:fs");
  const node = process.argv[2].replace(/(["\\$`])/g, "\\$1");
  const host = process.argv[3].replace(/(["\\$`])/g, "\\$1");
  fs.writeFileSync(process.argv[1], `#!/bin/bash\nexec "${node}" "${host}"\n`);
' "$SUPPORT_DIR/run-host.sh" "$NODE_BIN" "$SUPPORT_DIR/host.cjs"
chmod 700 "$SUPPORT_DIR/run-host.sh"

"$NODE_BIN" -e '
  const fs = require("node:fs");
  const manifest = {
    name: process.argv[2],
    description: "Local Codex bridge for GPT Explain Chrome extension",
    path: process.argv[3],
    type: "stdio",
    allowed_origins: [`chrome-extension://${process.argv[4]}/`]
  };
  fs.writeFileSync(process.argv[1], JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST_PATH" "$HOST_NAME" "$SUPPORT_DIR/run-host.sh" "$EXTENSION_ID"

echo "Native Host 安装完成。"
echo "Codex: $CODEX_BIN"
echo "Manifest: $MANIFEST_PATH"
echo "请回到扩展设置页点击「检测连接」。"
