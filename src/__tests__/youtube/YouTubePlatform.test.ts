import { YouTubePlatform } from '@adapters/youtube/YouTubePlatform';
import { YouTubeAuthProvider } from '@adapters/youtube/YouTubeAuthProvider';
import { DownloadOptions } from '@core/platform/IPlatform';
import { Logger } from '@lib/logger';
import ytdl from 'ytdl-core';
import { createWriteStream } from 'fs';

// Mock ytdl-core
jest.mock('ytdl-core');

// Mock fs
jest.mock('fs', () => ({
  createWriteStream: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnThis()
  }))
}));

describe('YouTubePlatform', () => {
  let platform: YouTubePlatform;
  let authProvider: YouTubeAuthProvider;

  // Mock Logger
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  jest.mock('@lib/logger', () => ({
    Logger: jest.fn().mockImplementation(() => mockLogger)
  }));

  // Mock AuthManager
  jest.mock('@core/auth/AuthManager', () => {
    const mockInstance = {
      hasAuthProvider: jest.fn().mockReturnValue(false),
      registerAuthProvider: jest.fn(),
      getInstance: jest.fn().mockReturnThis()
    };
    return {
      AuthManager: {
        getInstance: jest.fn().mockReturnValue(mockInstance)
      }
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      authProvider = new YouTubeAuthProvider();
      platform = new YouTubePlatform();
    });
  });

  describe('downloadVideo', () => {
    const mockUrl = 'https://www.youtube.com/watch?v=pYCf_LTBuXQ&list=PPSV&t=95s';
    const mockOptions: DownloadOptions = {
      outputPath: './downloads',
      onProgress: jest.fn()
    };

    it('应该成功下载视频', async () => {
      // Mock video info
      const mockInfo = {
        formats: [{ itag: '22', container: 'mp4' }],
        videoDetails: { title: 'Test Video' }
      };

      // Setup mocks
      (ytdl.getInfo as jest.Mock).mockResolvedValue(mockInfo);
      (ytdl as unknown as jest.Mock).mockReturnValue({
        on: jest.fn().mockImplementation((event, cb) => {
          if (event === 'progress') {
            cb(null, 50, 100);
          }
          return { pipe: jest.fn().mockReturnThis() };
        }),
        pipe: jest.fn().mockReturnThis()
      });

      // Execute
      const result = await platform.downloadVideo(mockUrl, mockOptions);

      // Verify
      expect(ytdl.getInfo).toHaveBeenCalledWith(mockUrl, expect.any(Object));
      expect(ytdl).toHaveBeenCalledWith(mockUrl, expect.any(Object));
      expect(mockOptions.onProgress).toHaveBeenCalledWith(50);
      expect(result).toContain('Test Video.mp4');
    });

    it('应该处理认证要求', async () => {
      // Mock auth requirement
      jest.spyOn(authProvider, 'isAuthRequired').mockResolvedValue(true);
      jest.spyOn(authProvider, 'getCredentials').mockReturnValue(null);
      
      const mockInfo = {
        formats: [{ itag: '22', container: 'mp4' }],
        videoDetails: { title: 'Test Video' }
      };
      (ytdl.getInfo as jest.Mock).mockResolvedValue(mockInfo);

      // Execute and verify
      await expect(platform.downloadVideo(mockUrl, mockOptions))
        .rejects
        .toThrow('需要认证才能下载此视频');
    });

    it('应该处理无效的视频格式', async () => {
      const mockInfo = {
        formats: [],
        videoDetails: { title: 'Test Video' }
      };

      (ytdl.getInfo as jest.Mock).mockResolvedValue(mockInfo);

      // Execute and verify
      await expect(platform.downloadVideo(mockUrl, { ...mockOptions, format: '999' }))
        .rejects
        .toThrow('找不到指定的格式');
    });

    it('应该处理下载错误', async () => {
      (ytdl.getInfo as jest.Mock).mockRejectedValue(new Error('This video is unavailable'));

      // Execute and verify
      await expect(platform.downloadVideo(mockUrl, mockOptions))
        .rejects
        .toThrow('This video is unavailable');

      expect(mockLogger.error).toHaveBeenCalledWith('视频不可用，可能是地区限制或已被删除');
    });

    it('应该处理文件系统错误', async () => {
      const mockInfo = {
        formats: [{ itag: '22', container: 'mp4' }],
        videoDetails: { title: 'Test Video' }
      };

      (ytdl.getInfo as jest.Mock).mockResolvedValue(mockInfo);
      const mockStream = {
        on: jest.fn().mockImplementation((event, cb) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('文件系统错误')), 0);
          }
          return mockStream;
        }),
        pipe: jest.fn().mockReturnThis()
      };
      (ytdl as unknown as jest.Mock).mockReturnValue(mockStream);

      // 模拟文件系统错误
      const mockWriteStream = {
        on: jest.fn().mockImplementation((event, cb) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('文件系统错误')), 0);
          }
          return mockWriteStream;
        }),
        pipe: jest.fn().mockReturnThis()
      };
      (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

      // 执行并验证
      await expect(platform.downloadVideo(mockUrl, mockOptions))
        .rejects
        .toThrow('文件系统错误');
    });

    it('应该处理不同视频格式的下载', async () => {
      const mockInfo = {
        formats: [
          { itag: '18', container: 'mp4', qualityLabel: '360p' },
          { itag: '22', container: 'mp4', qualityLabel: '720p' },
          { itag: '137', container: 'mp4', qualityLabel: '1080p' }
        ],
        videoDetails: { title: 'Test Video' }
      };

      (ytdl.getInfo as jest.Mock).mockResolvedValue(mockInfo);
      (ytdl as unknown as jest.Mock).mockReturnValue({
        on: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis()
      });

      // 测试指定格式下载
      const result = await platform.downloadVideo(mockUrl, { ...mockOptions, format: '22' });
      expect(ytdl).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
        format: expect.objectContaining({ itag: '22' })
      }));
      expect(result).toContain('Test Video.mp4');
    });
  });
});
