const { tools } = require('./dist/index.js');

async function testDownload() {
  try {
    // 测试B站视频下载
    const result = await tools.download_video({
      url: 'https://www.bilibili.com/video/BV1Jz421B7jQ',  // 人气视频
      options: {
        quality: 'medium',
        downloadSubtitle: true
      }
    });
    
    console.log('下载结果:', result);
  } catch (error) {
    console.error('下载失败:', error);
  }
}

testDownload();
