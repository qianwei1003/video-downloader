const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '..', '.pid');

if (fs.existsSync(PID_FILE)) {
  const pid = fs.readFileSync(PID_FILE, 'utf-8');
  try {
    process.kill(parseInt(pid));
    console.log('应用已停止');
  } catch (e) {
    console.log('应用已经不在运行');
  }
  fs.unlinkSync(PID_FILE);
} else {
  console.log('找不到运行中的应用');
}
