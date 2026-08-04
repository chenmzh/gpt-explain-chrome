@echo off
setlocal
chcp 65001 >nul
title GPT Explain for Chrome - Windows Uninstaller

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-host\uninstall-windows.ps1"
set "UNINSTALL_EXIT=%ERRORLEVEL%"
echo.
if not "%UNINSTALL_EXIT%"=="0" echo Uninstall failed with exit code %UNINSTALL_EXIT% / 卸载失败，退出码 %UNINSTALL_EXIT%。
pause
exit /b %UNINSTALL_EXIT%
