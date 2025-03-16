@echo off
chcp 65001

echo 正在测试下载功能...

:: 测试视频URL (一个短视频作为测试)
set "TEST_URL=https://www.youtube.com/watch?v=pYCf_LTBuXQ"

:: 编译并运行
call npm run build
if %errorlevel% neq 0 (
    echo 编译失败
    pause
    exit /b 1
)

echo 开始下载测试视频...
node ./scripts/run.js "%TEST_URL%"

echo.
echo 测试完成，按任意键退出...
pause >nul
