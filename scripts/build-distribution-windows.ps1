[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory ".."))
$OutputRoot = Join-Path $ProjectRoot "dist"
$PackageJson = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
$Version = $PackageJson.version
$PackageName = "GPT-Explain-Chrome-Windows-v$Version"
$Target = Join-Path $OutputRoot $PackageName
$Archive = Join-Path $OutputRoot "$PackageName.zip"

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
if ((Test-Path -LiteralPath $Target) -or (Test-Path -LiteralPath $Archive)) {
  throw "Refusing to overwrite an existing package: $PackageName"
}

New-Item -ItemType Directory -Path (Join-Path $Target "native-host") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot "extension") -Destination $Target -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot "native-host\host.cjs") -Destination (Join-Path $Target "native-host\host.cjs")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "native-host\install-windows.ps1") -Destination (Join-Path $Target "native-host\install-windows.ps1")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "native-host\uninstall-windows.ps1") -Destination (Join-Path $Target "native-host\uninstall-windows.ps1")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "distribution\Install-Windows.cmd") -Destination (Join-Path $Target "Install-Windows.cmd")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "distribution\Uninstall-Windows.cmd") -Destination (Join-Path $Target "Uninstall-Windows.cmd")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "distribution\README-Windows.md") -Destination (Join-Path $Target "README.md")
[System.IO.File]::WriteAllText((Join-Path $Target "VERSION"), "$Version`n", (New-Object System.Text.UTF8Encoding($false)))

$ForbiddenNames = Get-ChildItem -LiteralPath $Target -Recurse -File | Where-Object {
  $_.Name -eq "auth.json" -or $_.Name -eq "config.json" -or $_.Extension -in @(".pem", ".key")
}
if ($ForbiddenNames) {
  throw "Credential-shaped file found in distribution: $($ForbiddenNames.FullName -join ', ')"
}

$SecretPattern = 'sk-[A-Za-z0-9_-]{20,}|CODEX_ACCESS_TOKEN\s*=|OPENAI_API_KEY\s*='
$SecretMatch = Get-ChildItem -LiteralPath $Target -Recurse -File |
  Select-String -Pattern $SecretPattern -List -ErrorAction SilentlyContinue
if ($SecretMatch) {
  throw "Secret-shaped text found in distribution: $($SecretMatch.Path -join ', ')"
}

Compress-Archive -LiteralPath $Target -DestinationPath $Archive -CompressionLevel Optimal
Write-Host "Built $Target"
Write-Host "Built $Archive"
