# 添加新的视频平台支持

本文档说明如何为视频下载器添加新的平台支持。

## 步骤

1. 创建平台适配器

在 `src/adapters/{platform}` 目录下创建新的平台适配器类：

```typescript
export class NewPlatform implements IPlatform {
  getName(): string {
    return 'Platform Name';
  }

  isSupported(url: string): boolean {
    // 实现URL验证逻辑
    return true;
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    // 实现获取视频信息逻辑
  }

  async downloadVideo(url: string, options: DownloadOptions): Promise<string> {
    // 实现视频下载逻辑
  }
}
```

2. 创建平台工厂

创建对应的工厂类：

```typescript
export class NewPlatformFactory extends PlatformFactory {
  createPlatform(): IPlatform {
    return new NewPlatform();
  }

  getPlatformName(): string {
    return 'Platform Name';
  }

  matchUrl(url: string): boolean {
    // 实现URL匹配逻辑
    return true;
  }
}
```

3. 添加平台配置

在 `src/lib/config/platforms.ts` 中添加新平台的配置：

```typescript
const defaultConfig: PlatformsConfig = {
  platforms: {
    // ...现有平台
    newPlatform: {
      name: 'Platform Name',
      enabled: true,
      options: {
        // 平台特定配置
      }
    }
  }
};
```

4. 注册平台工厂

在 `DownloadManager` 的 `registerPlatforms` 方法中添加新平台：

```typescript
private registerPlatforms(): void {
  const factories = [
    new YouTubePlatformFactory(),
    new NewPlatformFactory()  // 添加新平台
  ];
  // ...
}
```

## 最佳实践

1. 错误处理
- 实现合适的错误检测和重试机制
- 使用统一的错误类型和错误码
- 记录详细的错误日志

2. 配置管理
- 使用配置系统管理平台特定的选项
- 支持运行时启用/禁用平台
- 提供合理的默认配置

3. 测试
- 为新平台添加单元测试
- 测试URL验证逻辑
- 测试视频信息获取和下载功能
- 测试错误处理机制

## 示例

参考 `src/adapters/youtube` 目录下的实现作为示例。
