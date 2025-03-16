const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '..', '.pid');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function checkIfRunning() {
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8');
    try {
      // 检查进程是否存在
      process.kill(parseInt(pid), 0);
      return true;
    } catch (e) {
      // 进程不存在，删除PID文件
      fs.unlinkSync(PID_FILE);
      return false;
    }
  }
  return false;
}

function killExistingProcess() {
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8');
    try {
      process.kill(parseInt(pid));
      console.log('已终止旧进程');
    } catch (e) {
      console.log('旧进程已经不存在');
    }
    fs.unlinkSync(PID_FILE);
  }
}

function build() {
  console.log('正在编译项目...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('编译失败:', error);
    process.exit(1);
  }
}

function startApp() {
  // 确保dist目录存在
  if (!fs.existsSync(DIST_DIR)) {
    console.error('找不到编译后的文件，请先运行build');
    process.exit(1);
  }

  console.log('正在启动应用...');
  const proc = spawn('node', ['dist/index.js', ...process.argv.slice(2)], {
    stdio: 'inherit',
    detached: true
  });

  // 保存新进程的PID
  fs.writeFileSync(PID_FILE, proc.pid.toString());

  // 错误处理
  proc.on('error', (err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });

  // 清理PID文件
  process.on('SIGINT', () => {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    process.exit();
  });
}

// 主流程
if (checkIfRunning()) {
  console.log('检测到应用已在运行，正在重启...');
  killExistingProcess();
}

build();
startApp();
