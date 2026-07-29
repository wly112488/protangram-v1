@echo off
title TANGram项目启动器
color 0A
echo ========================================
echo          TANGram项目启动器
echo ========================================
echo.
echo 正在启动前端和后端服务...
echo.
echo [1] 启动后端服务 (端口: 3001)
start "TANGram后端" cmd /k "cd /d backend && node src/index.js"
timeout /t 3 /nobreak >nul

echo [2] 启动前端服务 (端口: 5173)
start "TANGram前端" cmd /k "cd /d frontend && npm run dev"

echo.
echo ========================================
echo 服务启动完成！
echo.
echo 前端地址: http://localhost:5173
echo 后端地址: http://localhost:3001
echo API文档:   http://localhost:3001/api
echo.
echo 关闭此窗口不会停止服务
echo 要停止服务请关闭对应的命令行窗口
echo ========================================
echo.
pause
