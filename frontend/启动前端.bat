@echo off
title TANGram前端服务
echo ========================================
echo          TANGram前端服务启动
echo ========================================
echo.
echo 正在启动前端开发服务器...
echo 服务地址: http://localhost:5173
echo.
echo 按 Ctrl+C 可停止服务
echo ========================================
echo.

cd /d "%~dp0"
npm run dev

pause
