#!/bin/bash
set -euo pipefail

HOST_NAME="com.codex.gpt_explainer"
EXTENSION_ID="${1:-}"
BROWSERS="${2:-chrome}"

if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
  echo "用法: ./install-linux.sh <扩展 ID> [浏览器列表]" >&2
  echo "浏览器列表用逗号分隔，可选项: chrome, chromium, edge（默认 chrome）" >&2
  echo "扩展 ID 是 chrome://extensions 中显示的 32 位字符串。" >&2
  exit 2
fi

NODE_BIN="$(command -v node || true)"
CODEX_BIN="$(command -v codex || true)"
REASONIX_BIN="$(command -v reasonix || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 Node.js。请先安装 Node.js 18 或更高版本。" >&2
  exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_HOME="${HOME:?无法确定用户目录}"
SUPPORT_DIR="$USER_HOME/.local/share/GPTExplainBridge"

declare -A BROWSER_MANIFEST_DIRS=(
  [chrome]="$USER_HOME/.config/google-chrome/NativeMessagingHosts"
  [chromium]="$USER_HOME/.config/chromium/NativeMessagingHosts"
  [edge]="$USER_HOME/.config/microsoft-edge/NativeMessagingHosts"
)

SELECTED_BROWSERS=()
IFS=',' read -ra REQUESTED <<< "$BROWSERS"
for browser in "${REQUESTED[@]}"; do
  browser="$(echo "$browser" | xargs | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$browser" ]]; then continue; fi
  if [[ -z "${BROWSER_MANIFEST_DIRS[$browser]+x}" ]]; then
    echo "不支持的浏览器: $browser（可选: chrome, chromium, edge）" >&2
    exit 2
  fi
  SELECTED_BROWSERS+=("$browser")
done
if [[ ${#SELECTED_BROWSERS[@]} -eq 0 ]]; then
  SELECTED_BROWSERS=("chrome")
fi

mkdir -p "$SUPPORT_DIR"
cp "$SCRIPT_DIR/host.cjs" "$SUPPORT_DIR/host.cjs"

"$NODE_BIN" -e '
  const fs = require("node:fs");
  const configPath = process.argv[1];
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch {}
  const config = {};
  if (process.argv[2]) config.codexPath = process.argv[2];
  if (process.argv[3]) config.reasonixPath = process.argv[3];
  if (previous.deepseekApiKey) config.deepseekApiKey = previous.deepseekApiKey;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
' "$SUPPORT_DIR/config.json" "$CODEX_BIN" "$REASONIX_BIN"
chmod 600 "$SUPPORT_DIR/config.json"

"$NODE_BIN" -e '
  const fs = require("node:fs");
  const node = process.argv[2].replace(/(["\\$`])/g, "\\$1");
  const host = process.argv[3].replace(/(["\\$`])/g, "\\$1");
  fs.writeFileSync(process.argv[1], `#!/bin/bash\nexec "${node}" "${host}"\n`);
' "$SUPPORT_DIR/run-host.sh" "$NODE_BIN" "$SUPPORT_DIR/host.cjs"
chmod 700 "$SUPPORT_DIR/run-host.sh"

for browser in "${SELECTED_BROWSERS[@]}"; do
  manifest_dir="${BROWSER_MANIFEST_DIRS[$browser]}"
  manifest_path="$manifest_dir/$HOST_NAME.json"
  mkdir -p "$manifest_dir"
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
  ' "$manifest_path" "$HOST_NAME" "$SUPPORT_DIR/run-host.sh" "$EXTENSION_ID"
done

echo "Native Host 安装完成。"
echo "Codex: ${CODEX_BIN:-未检测到（可选）}"
echo "Reasonix: ${REASONIX_BIN:-未检测到（可选）}"
for browser in "${SELECTED_BROWSERS[@]}"; do
  echo "Manifest: ${BROWSER_MANIFEST_DIRS[$browser]}/$HOST_NAME.json"
done
echo "请回到扩展设置页点击「检测连接」。"
