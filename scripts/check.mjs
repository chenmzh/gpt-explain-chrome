import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "extension/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const projectFiles = [
  "native-host/install-macos.sh",
  "native-host/uninstall-macos.sh",
  "native-host/install-windows.ps1",
  "native-host/uninstall-windows.ps1",
  "distribution/Install.command",
  "distribution/Uninstall.command",
  "distribution/Install-Windows.cmd",
  "distribution/Uninstall-Windows.cmd",
  "distribution/README.md",
  "distribution/README-Windows.md",
  "scripts/build-distribution.sh",
  "scripts/build-distribution-windows.ps1"
];

for (const file of projectFiles) {
  const fullPath = resolve(root, file);
  if (!existsSync(fullPath)) throw new Error(`Project dependency is missing: ${fullPath}`);
}

const requiredFiles = [
  manifest.background.service_worker,
  manifest.options_page,
  "background.js",
  "archive-db.js",
  "archive-model.js",
  "default-settings.js",
  "window-layout.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "library.html",
  "library.css",
  "library.js",
  "options.css",
  "options.js",
  "options-i18n.js",
  "vendor/katex/katex.min.css",
  "vendor/katex/katex.min.js",
  "vendor/katex/contrib/auto-render.min.js",
  "vendor/katex/LICENSE",
  "vendor/marked/marked.umd.js",
  "vendor/marked/LICENSE",
  "vendor/dompurify/purify.min.js",
  "vendor/dompurify/LICENSE"
];

for (const file of new Set(requiredFiles)) {
  const fullPath = resolve(root, "extension", file);
  if (!existsSync(fullPath)) throw new Error(`Manifest or page dependency is missing: ${fullPath}`);
}

const jsFiles = [
  "extension/background.js",
  "extension/archive-db.js",
  "extension/archive-model.js",
  "extension/default-settings.js",
  "extension/window-layout.js",
  "extension/popup.js",
  "extension/library.js",
  "extension/options.js",
  "extension/options-i18n.js",
  "native-host/host.cjs"
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${file}`);
}

const shellFiles = [
  "native-host/install-macos.sh",
  "native-host/uninstall-macos.sh",
  "distribution/Install.command",
  "distribution/Uninstall.command",
  "scripts/build-distribution.sh"
];

const bashProbe = spawnSync("bash", ["--version"], { encoding: "utf8" });
if (!bashProbe.error && bashProbe.status === 0) {
  for (const file of shellFiles) {
    const result = spawnSync("bash", ["-n", resolve(root, file)], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || `Shell syntax check failed: ${file}`);
  }
}

const powershellFiles = [
  "native-host/install-windows.ps1",
  "native-host/uninstall-windows.ps1",
  "scripts/build-distribution-windows.ps1"
];
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const powershellProbe = spawnSync(powershell, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { encoding: "utf8" });
if (!powershellProbe.error && powershellProbe.status === 0) {
  for (const file of powershellFiles) {
    const fullPath = resolve(root, file).replaceAll("'", "''");
    const parseCommand = `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${fullPath}', [ref]$null, [ref]$errors) > $null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }`;
    const result = spawnSync(
      powershell,
      ["-NoProfile", "-NonInteractive", "-Command", parseCommand],
      { encoding: "utf8" }
    );
    if (result.status !== 0) throw new Error(result.stderr || `PowerShell syntax check failed: ${file}`);
  }
}

if (manifest.manifest_version !== 3) throw new Error("Expected Manifest V3");
if (!manifest.permissions.includes("nativeMessaging")) throw new Error("nativeMessaging permission is required");
if (manifest.permissions.includes("sidePanel")) throw new Error("The popup build should not request sidePanel");

process.stdout.write(
  `Checks passed: ${jsFiles.length} JavaScript files, ` +
  `${bashProbe.status === 0 ? shellFiles.length : 0} shell scripts, ` +
  `${powershellProbe.status === 0 ? powershellFiles.length : 0} PowerShell scripts, Manifest V3.\n`
);
