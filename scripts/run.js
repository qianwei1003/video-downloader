const { spawn } = require('child_process');
const iconv = require('iconv-lite');

// 设置命令行编码
function setConsoleEncoding() {
    return new Promise((resolve, reject) => {
        const chcp = spawn('chcp', ['65001']);
        chcp.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error('Failed to set console encoding'));
            }
        });
    });
}

async function main() {
    try {
        // 设置UTF-8编码
        await setConsoleEncoding();

        // 启动应用
        const app = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cross-env', 'ts-node', '-r', 'tsconfig-paths/register', 'src/index.ts'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1' // 启用彩色输出
            }
        });

        app.on('error', (err) => {
            console.error('启动失败:', err);
            process.exit(1);
        });

        process.on('SIGINT', () => {
            app.kill();
            process.exit();
        });

    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

main();
