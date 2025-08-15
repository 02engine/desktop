const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 定义 tar 文件路径和解压目标路径
const tarFile = path.join(__dirname, 'modules.tar');
const extractPath = './';

// 检查 tar 文件是否存在
if (!fs.existsSync(tarFile)) {
  console.error('错误：当前目录下未找到 modules.tar 文件');
  process.exit(1);
}

// 设置环境变量以支持 UTF-8 编码，防止中文乱码
const env = { ...process.env, LC_ALL: 'en_US.UTF-8' };

try {
  // 使用 tar 命令解压文件到根目录
  execSync(`tar -xf "${tarFile}" -C "${extractPath}"`, { stdio: 'inherit', env });
  console.log('成功将 modules.tar 解压到 /');
} catch (err) {
  console.error('解压 tar 文件时出错：', err.message);
  process.exit(1);
}