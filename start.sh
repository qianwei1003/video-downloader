#!/bin/bash

# 检查环境
echo "正在检查运行环境..."
node check-env.js

# 如果环境检查成功，构建并启动应用
if [ $? -eq 0 ]; then
  echo "正在构建项目..."
  npm run build

  echo "正在启动视频下载服务..."
  npm start
else
  echo "环境检查失败，请修复上述问题后重试。"
  exit 1
fi
