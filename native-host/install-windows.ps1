[CmdletBinding()]
param(
  [string]$ExtensionId = "",
  [string]$NodePath = "",
  [string]$CodexPath = "",
  [string]$ReasonixPath = "",
  [string]$InstallRoot = "",
  [string]$Browsers = "chrome,edge",
  [switch]$SkipRegistry,
  [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$HostName = "com.codex.gpt_explainer"
$SupportedBrowsers = @("chrome", "edge")
$BrowserNames = @($Browsers -split "," | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
if ($BrowserNames.Count -eq 0) { $BrowserNames = @("chrome", "edge") }
foreach ($Browser in $BrowserNames) {
  if ($SupportedBrowsers -notcontains $Browser) {
    throw "Unsupported browser: $Browser / 不支持的浏览器：$Browser（仅支持 chrome、edge）。"
  }
}
$RegistryPaths = @()
if ($BrowserNames -contains "chrome") {
  $RegistryPaths += "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
}
if ($BrowserNames -contains "edge") {
  $RegistryPaths += "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
}

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

function Resolve-ReasonixCommand {
  if ($ReasonixPath) {
    return [System.IO.Path]::GetFullPath($ReasonixPath)
  }

  foreach ($name in @("reasonix.exe", "reasonix.cmd", "reasonix.bat", "reasonix")) {
    $candidate = Resolve-ApplicationPath $name
    if ($candidate) { return $candidate }
  }
  return ""
}

function Resolve-CommandLaunch {
  param([string]$CommandPath)
  if (-not $CommandPath) { return $null }
  $resolved = [System.IO.Path]::GetFullPath($CommandPath)
  $launch = [ordered]@{ Executable = $resolved; Command = $resolved; ArgsPrefix = @() }
  $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
  if ($extension -eq ".cmd" -or $extension -eq ".bat") {
    if (-not $env:ComSpec -or -not (Test-Path -LiteralPath $env:ComSpec -PathType Leaf)) {
      throw "COMSPEC is unavailable, so the command shim cannot be launched."
    }
    $launch.Executable = [System.IO.Path]::GetFullPath($env:ComSpec)
    $launch.ArgsPrefix = @("/d", "/s", "/c", $resolved)
  }
  return $launch
}

function Resolve-ReasonixLaunch {
  param(
    [string]$CommandPath,
    [string]$NodeExecutable
  )
  if (-not $CommandPath) { return $null }
  $resolved = [System.IO.Path]::GetFullPath($CommandPath)
  $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
  if ($extension -ne ".cmd" -and $extension -ne ".bat") {
    return [ordered]@{ Executable = $resolved; Command = $resolved; ArgsPrefix = @() }
  }

  $npmBin = Split-Path -Parent $resolved
  $entryPoint = @(
    (Join-Path $npmBin "node_modules\reasonix\bin\reasonix.js"),
    (Join-Path $npmBin "node_modules\reasonix\dist\cli\index.js")
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if (-not $entryPoint) {
    throw "Reasonix npm entry point was not found next to the command shim. Reinstall with: npm install -g reasonix"
  }
  return [ordered]@{
    Executable = [System.IO.Path]::GetFullPath($NodeExecutable)
    Command = $resolved
    ArgsPrefix = @([System.IO.Path]::GetFullPath($entryPoint))
  }
}

function Write-Utf8WithoutBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-IsWindowsAppsPath {
  param([string]$Path)
  if (-not $Path -or -not $env:ProgramFiles) { return $false }
  $windowsAppsRoot = [System.IO.Path]::GetFullPath((Join-Path $env:ProgramFiles "WindowsApps")).TrimEnd("\") + "\"
  $resolved = [System.IO.Path]::GetFullPath($Path)
  return $resolved.StartsWith($windowsAppsRoot, [System.StringComparison]::OrdinalIgnoreCase)
}

if (-not $InstallRoot) {
  if (-not $env:LOCALAPPDATA) {
    throw "Cannot determine LOCALAPPDATA / 无法确定 LOCALAPPDATA。"
  }
  $InstallRoot = Join-Path $env:LOCALAPPDATA "GPTExplainBridge"
}
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)

if (-not $ExtensionId -and -not $NonInteractive) {
  Write-Host "1. Open chrome://extensions in Google Chrome or edge://extensions in Microsoft Edge."
  Write-Host "2. Turn on Developer mode."
  Write-Host "3. Click Load unpacked and select the extension folder in this package."
  Write-Host "4. Copy the 32-character extension ID shown by the browser."
  Write-Host ""
  $ExtensionId = Read-Host "Paste extension ID / 粘贴扩展 ID"
}

if ($ExtensionId -notmatch '^[a-p]{32}$') {
  throw "The extension ID must contain 32 letters from a to p / 扩展 ID 必须是 32 位 a-p 字符。"
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
if ($CodexCommand -and -not (Test-Path -LiteralPath $CodexCommand -PathType Leaf)) {
  throw "The supplied Codex CLI path does not exist."
}
$CodexLaunch = Resolve-CommandLaunch $CodexCommand

$ReasonixCommand = Resolve-ReasonixCommand
if ($ReasonixCommand -and -not (Test-Path -LiteralPath $ReasonixCommand -PathType Leaf)) {
  throw "The supplied Reasonix CLI path does not exist."
}
$ReasonixLaunch = Resolve-ReasonixLaunch $ReasonixCommand $NodePath

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

# Windows Store apps inherit WindowsApps ACLs that allow an interactive shell to
# execute Codex but can reject Node child_process with EPERM. Keep a per-user
# executable copy beside the Native Host so Chrome can launch it reliably.
if ($CodexLaunch -and (Test-IsWindowsAppsPath $CodexLaunch.Executable)) {
  $StagedCodexPath = Join-Path $InstallRoot "codex.exe"
  Copy-Item -LiteralPath $CodexLaunch.Command -Destination $StagedCodexPath -Force
  $CodexLaunch = Resolve-CommandLaunch $StagedCodexPath
  Write-Host "Staged the Windows Store Codex CLI at $StagedCodexPath"
}

Copy-Item -LiteralPath $SourceHost -Destination $InstalledHost -Force

$ExistingApiKey = ""
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
  try {
    $ExistingConfig = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($ExistingConfig.deepseekApiKey) { $ExistingApiKey = [string]$ExistingConfig.deepseekApiKey }
  } catch { }
}
$Config = [ordered]@{}
if ($CodexLaunch) {
  $Config.codexPath = $CodexLaunch.Executable
  $Config.codexCommandPath = $CodexLaunch.Command
  if ($CodexLaunch.ArgsPrefix.Count -gt 0) { $Config.codexArgsPrefix = $CodexLaunch.ArgsPrefix }
}
if ($ReasonixLaunch) {
  $Config.reasonixPath = $ReasonixLaunch.Executable
  $Config.reasonixCommandPath = $ReasonixLaunch.Command
  if ($ReasonixLaunch.ArgsPrefix.Count -gt 0) { $Config.reasonixArgsPrefix = $ReasonixLaunch.ArgsPrefix }
}
if ($ExistingApiKey) { $Config.deepseekApiKey = $ExistingApiKey }
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

$LauncherBuildPath = Join-Path $InstallRoot "GPTExplainNativeHost.new.exe"
if (Test-Path -LiteralPath $LauncherBuildPath) {
  Remove-Item -LiteralPath $LauncherBuildPath -Force
}
Add-Type -TypeDefinition $LauncherSource -Language CSharp -OutputAssembly $LauncherBuildPath -OutputType ConsoleApplication

if (Test-Path -LiteralPath $LauncherPath) {
  $ResolvedLauncherPath = [System.IO.Path]::GetFullPath($LauncherPath)
  $RunningLaunchers = Get-CimInstance Win32_Process -Filter "Name = 'GPTExplainNativeHost.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ExecutablePath -and
      [System.IO.Path]::GetFullPath($_.ExecutablePath).Equals($ResolvedLauncherPath, [System.StringComparison]::OrdinalIgnoreCase)
    }
  foreach ($RunningLauncher in $RunningLaunchers) {
    Stop-Process -Id $RunningLauncher.ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $RunningLauncher.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $LauncherPath -Force
}
Move-Item -LiteralPath $LauncherBuildPath -Destination $LauncherPath

$Manifest = [ordered]@{
  name = $HostName
  description = "Local Codex bridge for GPT Explain Chrome/Edge extension (Windows)"
  path = $LauncherPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
Write-Utf8WithoutBom -Path $ManifestPath -Content (($Manifest | ConvertTo-Json -Depth 4) + "`n")

if (-not $SkipRegistry) {
  foreach ($RegistryPath in $RegistryPaths) {
    New-Item -Path $RegistryPath -Force | Out-Null
    Set-Item -Path $RegistryPath -Value $ManifestPath
  }
}

Write-Host ""
Write-Host "Native Host installed / Native Host 已安装。"
Write-Host "Host:     $LauncherPath"
Write-Host "Manifest: $ManifestPath"
if ($CodexLaunch) { Write-Host "Codex:    $($CodexLaunch.Executable)" } else { Write-Host "Codex:    not detected (optional)" }
if ($ReasonixCommand) { Write-Host "Reasonix: $ReasonixCommand" } else { Write-Host "Reasonix: not detected (optional)" }
if (-not $SkipRegistry) {
  Write-Host "Browsers: $($BrowserNames -join ', ')"
  foreach ($RegistryPath in $RegistryPaths) { Write-Host "Registry: $RegistryPath" }
}
Write-Host "Reload the extension, open its Options page, and click Check connection."
Write-Host "请刷新扩展，打开扩展选项，然后点击“检测连接”。"

if (-not $NonInteractive -and $CodexCommand) {
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
