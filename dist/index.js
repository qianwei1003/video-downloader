#!/usr/bin/env node
import { exec } from 'yt-dlp-exec';
class VideoDownloaderServer {
    async handleDownloadVideo(args) {
        try {
            const result = await exec(args.url, {
                format: args.format || 'best',
                output: args.output,
            });
            return {
                success: true,
                message: `视频下载成功:\n${result}`,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `下载失败: ${error.message || String(error)}`,
            };
        }
    }
    async handleGetVideoInfo(url) {
        try {
            const result = await exec(url, {
                dumpJson: true,
            });
            return {
                success: true,
                info: result,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `获取信息失败: ${error.message || String(error)}`,
            };
        }
    }
    async processCommand(command, args) {
        switch (command) {
            case 'download':
                return this.handleDownloadVideo(args);
            case 'info':
                return this.handleGetVideoInfo(args.url);
            default:
                return {
                    success: false,
                    message: `未知命令: ${command}`,
                };
        }
    }
    async run() {
        process.stdin.setEncoding('utf8');
        console.error('视频下载服务器正在运行...');
        console.error('使用方法:');
        console.error('下载视频: {"command": "download", "args": {"url": "视频URL", "format": "格式", "output": "输出文件名"}}');
        console.error('获取信息: {"command": "info", "args": {"url": "视频URL"}}');
        process.stdin.on('data', async (data) => {
            try {
                const input = JSON.parse(data.toString());
                const result = await this.processCommand(input.command, input.args);
                console.log(JSON.stringify(result));
            }
            catch (error) {
                console.log(JSON.stringify({
                    success: false,
                    message: `处理命令失败: ${error.message || String(error)}`,
                }));
            }
        });
        process.on('SIGINT', () => {
            console.error('\n正在关闭服务器...');
            process.exit(0);
        });
    }
}
const server = new VideoDownloaderServer();
server.run().catch((error) => {
    console.error('服务器运行失败:', error);
    process.exit(1);
});
