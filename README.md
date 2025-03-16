# 视频下载器

一个简单的命令行视频下载工具，支持YouTube视频下载。

## 功能特点

- 支持YouTube视频下载
- 支持配置下载目录
- 两种运行模式：
  - 命令行模式：直接下载单个视频
  - 服务器模式：持续运行并等待输入URL
- 实时显示下载进度
- 支持自动重启和优雅关闭

## 使用方法

### 配置

编辑 `config.json` 文件：

```json
{
  "downloadPath": "downloads",  // 下载目录
  "autoStartServer": true,      // 是否自动启动服务器模式
  "defaultQuality": "highest",  // 默认下载质量
  "language": "zh-CN"          // 界面语言
}
```

### 启动方式

运行方式：
1. 启动应用：
   - 双击 `run.bat` 启动应用

2. 使用说明：
   - 程序启动后，直接粘贴YouTube视频链接并按回车
   - 输入 'exit' 退出程序
   - 输入 'clear' 清屏

3. 开发模式：
   ```bash
   # 直接运行TypeScript源码（开发调试用）
   npm run dev
   ```

### 服务器模式使用

1. 启动后等待输入URL
2. 输入视频URL后按回车开始下载
3. 下载完成后可以继续输入新的URL
4. 输入 "exit" 退出程序

## 安装

```bash
# 安装依赖
npm install

# 编译项目
npm run build
```

## 开发模式

```bash
npm run start:dev
```

## 注意事项

- 确保有稳定的网络连接
- 下载的视频将保存在配置文件指定的目录中
- 运行日志保存在 `app.log` 文件中
