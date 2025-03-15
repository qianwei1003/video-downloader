# 视频下载 MCP 服务器

这是一个基于Node.js开发的视频下载服务器，用于管理和处理视频下载任务。

## 环境要求

- Node.js v16.0.0 或更高版本
- yt-dlp 命令行工具 (https://github.com/yt-dlp/yt-dlp)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

复制 `config.example.json` 到 `config.json` 并根据需要修改配置：

```bash
cp config.example.json config.json
```

### 3. 构建

```bash
npm run build
```

### 4. 运行

```bash
npm start
```

或者使用提供的启动脚本（会自动检查环境并构建）：

- Windows: `start.bat`
- Linux/Mac: `./start.sh` (需要先 `chmod +x start.sh`)

## 故障排除

如果遇到问题，请检查以下几点：

1. 确保 yt-dlp 已正确安装并可在命令行中访问
2. 确保所有依赖项已安装 (`npm install`)
3. 检查 config.json 配置是否正确
4. 确保下载目录有写入权限

## API 使用

### RESTful API

服务器提供以下API端点：

- `POST /api/download` - 提交视频下载任务，需要提供 `url` 参数
- `GET /api/tasks` - 获取所有下载任务列表
- `GET /api/tasks/:id` - 获取指定ID的下载任务状态
- `DELETE /api/tasks/:id` - 取消指定的下载任务

### MCP 工具

服务器还提供以下MCP工具：

- `download_video` - 下载视频
- `get_media_info` - 获取媒体信息
- `list_downloads` - 列出已下载的视频

## 项目结构

```
video-downloader/
├── src/                    # 源代码目录
│   ├── index.ts            # 主入口文件
│   ├── server/             # 服务器相关代码
│   ├── utils/              # 工具函数
│   ├── config/             # 配置文件
│   ├── controllers/        # 控制器（处理请求）
│   ├── services/           # 业务逻辑服务
│   └── types/              # TypeScript类型定义
├── build/                  # 编译后的JavaScript文件
├── downloads/              # 默认下载目录
├── config.json             # 应用配置文件
├── package.json            # 项目配置和依赖管理
└── README.md               # 项目说明文档
```

## 核心模块功能

### 入口文件 (src/index.ts)
程序的主入口点，负责初始化日志系统、加载配置并启动视频下载服务器。

### 服务器 (src/server/VideoDownloaderServer.ts)
实现视频下载服务的核心逻辑，包括HTTP服务器、API路由和请求处理。

### 配置管理 (src/config/index.ts)
负责加载和管理应用程序配置，可能支持从文件、环境变量或命令行参数加载配置。

### 日志系统 (src/utils/logger.ts)
提供应用程序日志记录功能，帮助调试和监控应用程序运行状态。

## 扩展开发

如需添加新的下载源支持或修改现有功能，请参考相应模块的文档。
