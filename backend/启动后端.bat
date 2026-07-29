@echo off
title TANGram后端服务
echo ========================================
echo          TANGram后端服务启动
echo ========================================
echo.
echo 正在启动后端API服务器...
echo 服务地址: http://localhost:3001
echo API文档: http://localhost:3001/api
echo.
echo 按 Ctrl+C 可停止服务
echo ========================================
echo.

cd /d "%~dp0"
node src/index.js

pause
