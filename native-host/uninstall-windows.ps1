[CmdletBinding()]
param(
  [string]$InstallRoot = "",
  [switch]$SkipRegistry
)

$ErrorActionPreference = "Stop"
$HostName = "com.codex.gpt_explainer"
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

if (-not $InstallRoot) {
  if (-not $env:LOCALAPPDATA) {
    throw "Cannot determine LOCALAPPDATA / 无法确定 LOCALAPPDATA。"
  }
  $InstallRoot = Join-Path $env:LOCALAPPDATA "GPTExplainBridge"
}
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)

if (-not $SkipRegistry -and (Test-Path -LiteralPath $RegistryPath)) {
  Remove-Item -LiteralPath $RegistryPath -Recurse -Force
}

if (Test-Path -LiteralPath $InstallRoot -PathType Container) {
  Remove-Item -LiteralPath $InstallRoot -Recurse -Force
}

Write-Host "GPT Explain Native Host was uninstalled / GPT 划词解释 Native Host 已卸载。"
Write-Host "Also remove the extension from chrome://extensions / 还请在 chrome://extensions 中移除扩展。"
