@echo off
chcp 65001

echo 正在初始化应用程序...

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
)

:: 编译TypeScript
echo 正在编译项目...
call npm run build

:: 如果编译成功，启动应用
if %errorlevel% == 0 (
    echo 启动应用程序...
    node scripts/run.js
) else (
    echo 编译失败，请检查错误信息
    echo 按任意键继续...
    pause >nul
    exit /b 1
)

if %errorlevel% neq 0 (
    echo 程序异常退出，错误代码：%errorlevel%
    echo 按任意键继续...
    pause >nul
)
