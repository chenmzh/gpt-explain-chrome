#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ROOT="$PROJECT_ROOT/dist"
VERSION="$(cd "$PROJECT_ROOT" && node -p "require('./package.json').version")"
PACKAGE_NAME="GPT-Explain-Chrome-Linux-v$VERSION"
TARGET="$OUTPUT_ROOT/$PACKAGE_NAME"
ARCHIVE="$OUTPUT_ROOT/$PACKAGE_NAME.zip"

mkdir -p "$OUTPUT_ROOT"

if [[ -e "$TARGET" || -e "$ARCHIVE" ]]; then
  echo "Refusing to overwrite an existing package: $PACKAGE_NAME" >&2
  exit 2
fi

mkdir -p "$TARGET/native-host"
cp -R "$PROJECT_ROOT/extension" "$TARGET/extension"
cp "$PROJECT_ROOT/native-host/host.cjs" "$TARGET/native-host/host.cjs"
cp "$PROJECT_ROOT/native-host/install-linux.sh" "$TARGET/native-host/install-linux.sh"
cp "$PROJECT_ROOT/native-host/uninstall-linux.sh" "$TARGET/native-host/uninstall-linux.sh"
cp "$PROJECT_ROOT/distribution/Install-Linux.sh" "$TARGET/Install-Linux.sh"
cp "$PROJECT_ROOT/distribution/Uninstall-Linux.sh" "$TARGET/Uninstall-Linux.sh"
cp "$PROJECT_ROOT/distribution/README-Linux.md" "$TARGET/README.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"

chmod 755 "$TARGET/Install-Linux.sh" "$TARGET/Uninstall-Linux.sh"
chmod 755 "$TARGET/native-host/install-linux.sh" "$TARGET/native-host/uninstall-linux.sh"

if find "$TARGET" -type f \( -name 'auth.json' -o -name 'config.json' -o -name '*.pem' -o -name '*.key' \) | grep -q .; then
  echo "Credential-shaped file found in distribution; aborting." >&2
  exit 3
fi

if grep -ERIl 'sk-[A-Za-z0-9_-]{20,}|CODEX_ACCESS_TOKEN[[:space:]]*=|OPENAI_API_KEY[[:space:]]*=' "$TARGET" >/dev/null; then
  echo "Secret-shaped text found in distribution; aborting." >&2
  exit 4
fi

(cd "$OUTPUT_ROOT" && zip -rq "$ARCHIVE" "$PACKAGE_NAME")
echo "Built $TARGET"
echo "Built $ARCHIVE"
