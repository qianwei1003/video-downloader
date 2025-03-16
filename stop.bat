@echo off
setlocal

:: 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"

:: 检查PID文件是否存在
if exist "%SCRIPT_DIR%.pid" (
    :: 读取PID并终止进程
    for /f "tokens=*" %%i in ('type "%SCRIPT_DIR%.pid"') do (
        taskkill /pid %%i /f 2>nul
        if errorlevel 1 (
            echo 应用已经停止运行
        ) else (
            echo 已停止应用
        )
    )
    :: 删除PID文件
    del /f "%SCRIPT_DIR%.pid"
) else (
    echo 找不到运行中的应用
)

echo.
echo 按任意键退出...
pause >nul
