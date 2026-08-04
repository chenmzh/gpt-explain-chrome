[CmdletBinding()]
param(
  [string]$ExtensionId = "",
  [string]$NodePath = "",
  [string]$CodexPath = "",
  [string]$InstallRoot = "",
  [switch]$SkipRegistry,
  [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$HostName = "com.codex.gpt_explainer"
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

function Resolve-ApplicationPath {
  param([Parameter(Mandatory = $true)][string]$Name)

  $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($null -eq $command) { return "" }
  return $command.Source
}

function Resolve-CodexCommand {
  if ($CodexPath) {
    return [System.IO.Path]::GetFullPath($CodexPath)
  }

  foreach ($name in @("codex.exe", "codex.cmd", "codex.bat", "codex")) {
    $candidate = Resolve-ApplicationPath $name
    if ($candidate) { return $candidate }
  }
  return ""
}

function Write-Utf8WithoutBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

if (-not $InstallRoot) {
  if (-not $env:LOCALAPPDATA) {
    throw "Cannot determine LOCALAPPDATA / 无法确定 LOCALAPPDATA。"
  }
  $InstallRoot = Join-Path $env:LOCALAPPDATA "GPTExplainBridge"
}
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)

if (-not $ExtensionId -and -not $NonInteractive) {
  Write-Host "1. Open chrome://extensions in Google Chrome."
  Write-Host "2. Turn on Developer mode."
  Write-Host "3. Click Load unpacked and select the extension folder in this package."
  Write-Host "4. Copy the 32-character extension ID shown by Chrome."
  Write-Host ""
  $ExtensionId = Read-Host "Paste extension ID / 粘贴扩展 ID"
}

if ($ExtensionId -notmatch '^[a-p]{32}$') {
  throw "The Chrome extension ID must contain 32 letters from a to p / Chrome 扩展 ID 必须是 32 位 a-p 字符。"
}

if (-not $NodePath) {
  $NodePath = Resolve-ApplicationPath "node.exe"
  if (-not $NodePath) { $NodePath = Resolve-ApplicationPath "node" }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
  throw "Node.js 18+ was not found. Install it from https://nodejs.org and run this installer again / 未找到 Node.js 18+。"
}
$NodePath = [System.IO.Path]::GetFullPath($NodePath)
$NodeMajor = & $NodePath -p 'process.versions.node.split(String.fromCharCode(46))[0]'
if ($LASTEXITCODE -ne 0 -or [int]$NodeMajor -lt 18) {
  throw "Node.js 18+ is required / 需要 Node.js 18 或更高版本。"
}

$CodexCommand = Resolve-CodexCommand
if (-not $CodexCommand -or -not (Test-Path -LiteralPath $CodexCommand -PathType Leaf)) {
  throw "Codex CLI was not found. Install the latest Codex CLI, then run this installer again / 未找到 Codex CLI。"
}
$CodexCommand = [System.IO.Path]::GetFullPath($CodexCommand)

$CodexExecutable = $CodexCommand
$CodexArgsPrefix = @()
$CodexExtension = [System.IO.Path]::GetExtension($CodexCommand).ToLowerInvariant()
if ($CodexExtension -eq ".cmd" -or $CodexExtension -eq ".bat") {
  if (-not $env:ComSpec -or -not (Test-Path -LiteralPath $env:ComSpec -PathType Leaf)) {
    throw "COMSPEC is unavailable, so the Codex command shim cannot be launched."
  }
  $CodexExecutable = [System.IO.Path]::GetFullPath($env:ComSpec)
  $CodexArgsPrefix = @("/d", "/s", "/c", $CodexCommand)
}

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceHost = Join-Path $ScriptDirectory "host.cjs"
if (-not (Test-Path -LiteralPath $SourceHost -PathType Leaf)) {
  throw "host.cjs is missing from the package / 安装包中缺少 host.cjs。"
}

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
$InstalledHost = Join-Path $InstallRoot "host.cjs"
$ConfigPath = Join-Path $InstallRoot "config.json"
$LauncherPath = Join-Path $InstallRoot "GPTExplainNativeHost.exe"
$ManifestPath = Join-Path $InstallRoot "$HostName.json"

Copy-Item -LiteralPath $SourceHost -Destination $InstalledHost -Force

$Config = [ordered]@{
  codexPath = $CodexExecutable
  codexCommandPath = $CodexCommand
}
if ($CodexArgsPrefix.Count -gt 0) {
  $Config.codexArgsPrefix = $CodexArgsPrefix
}
Write-Utf8WithoutBom -Path $ConfigPath -Content (($Config | ConvertTo-Json -Depth 4) + "`n")

function Convert-ToCSharpString {
  param([Parameter(Mandatory = $true)][string]$Value)
  return $Value.Replace("\", "\\").Replace('"', '\"')
}

$NodeLiteral = Convert-ToCSharpString $NodePath
$HostLiteral = Convert-ToCSharpString $InstalledHost
$LauncherSource = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

internal static class GPTExplainNativeHostLauncher
{
    private static void Copy(Stream source, Stream destination, bool closeDestination)
    {
        try
        {
            var buffer = new byte[4096];
            int count;
            while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
            {
                destination.Write(buffer, 0, count);
                destination.Flush();
            }
        }
        catch (IOException) { }
        catch (ObjectDisposedException) { }
        finally
        {
            if (closeDestination)
            {
                try { destination.Close(); } catch { }
            }
        }
    }

    public static int Main()
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "$NodeLiteral",
            Arguments = "\"$HostLiteral\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using (var child = Process.Start(startInfo))
        {
            if (child == null) return 1;
            var input = new Thread(() => Copy(Console.OpenStandardInput(), child.StandardInput.BaseStream, true));
            var output = new Thread(() => Copy(child.StandardOutput.BaseStream, Console.OpenStandardOutput(), false));
            var error = new Thread(() => Copy(child.StandardError.BaseStream, Console.OpenStandardError(), false));
            input.IsBackground = true;
            output.IsBackground = true;
            error.IsBackground = true;
            input.Start();
            output.Start();
            error.Start();
            child.WaitForExit();
            output.Join(5000);
            error.Join(1000);
            return child.ExitCode;
        }
    }
}
"@

if (Test-Path -LiteralPath $LauncherPath) {
  Remove-Item -LiteralPath $LauncherPath -Force
}
Add-Type -TypeDefinition $LauncherSource -Language CSharp -OutputAssembly $LauncherPath -OutputType ConsoleApplication

$Manifest = [ordered]@{
  name = $HostName
  description = "Local Codex bridge for GPT Explain Chrome extension (Windows)"
  path = $LauncherPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
Write-Utf8WithoutBom -Path $ManifestPath -Content (($Manifest | ConvertTo-Json -Depth 4) + "`n")

if (-not $SkipRegistry) {
  New-Item -Path $RegistryPath -Force | Out-Null
  Set-Item -Path $RegistryPath -Value $ManifestPath
}

Write-Host ""
Write-Host "Native Host installed / Native Host 已安装。"
Write-Host "Host:     $LauncherPath"
Write-Host "Manifest: $ManifestPath"
if (-not $SkipRegistry) { Write-Host "Registry: $RegistryPath" }
Write-Host "Reload the extension, open its Options page, and click Check connection."
Write-Host "请刷新扩展，打开扩展选项，然后点击“检测连接”。"

if (-not $NonInteractive) {
  try {
    & $CodexCommand login status *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "Codex is not logged in. Run: codex login / Codex 尚未登录，请运行：codex login"
    }
  } catch {
    Write-Host "Codex login status could not be checked; run 'codex login status' manually."
  }
}
