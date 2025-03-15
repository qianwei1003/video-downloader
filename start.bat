@echo off
echo 正在检查运行环境...
node check-env.js

if %ERRORLEVEL% EQU 0 (
  echo 正在构建项目...
  call npm run build
  
  echo 正在启动视频下载服务...
  call npm start
) else (
  echo 环境检查失败，请修复上述问题后重试。
  exit /b 1
)
