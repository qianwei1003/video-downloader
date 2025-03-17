@echo on
chcp 65001

echo Starting initialization...

:: 显示当前目录和环境信息
echo Current directory: %CD%
echo Node version:
call node -v
echo TypeScript version:
call npx tsc -v

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

:: 创建下载目录
if not exist "downloads" (
    echo Creating downloads directory...
    mkdir downloads
)

:: 启动 MCP 服务器
echo Starting MCP server...
echo Command: npx ts-node --esm -r tsconfig-paths/register src/mcp/index.ts
set NODE_OPTIONS=--loader ts-node/esm
call npx ts-node --esm -r tsconfig-paths/register src/mcp/index.ts
