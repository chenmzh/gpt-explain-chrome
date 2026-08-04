@echo off
setlocal
chcp 65001 >nul
title GPT Explain for Chrome - Windows Installer

echo GPT Explain for Chrome - Windows installer
echo GPT 划词解释 - Windows 安装程序
echo.
echo This package uses your own local Codex login and never includes another person's credentials.
echo 此安装包使用你自己的本机 Codex 登录，不包含其他人的账号信息。
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-host\install-windows.ps1"
set "INSTALL_EXIT=%ERRORLEVEL%"
echo.
if not "%INSTALL_EXIT%"=="0" echo Installation failed with exit code %INSTALL_EXIT% / 安装失败，退出码 %INSTALL_EXIT%。
pause
exit /b %INSTALL_EXIT%
