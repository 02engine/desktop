const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定义下载 URL 和目标路径
const tarUrl = 'https://huggingface.co/datasets/Deep-sea/02engine_modules/resolve/main/modules.tar?download=true';
const tarFile = path.join(__dirname, 'modules.tar');
const extractPath = './'; // 解压到当前目录

// 下载文件，支持重定向
function downloadFile(url, dest, redirects = 0, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (redirects >= maxRedirects) {
      reject(new Error('重定向次数过多，超过最大限制：' + maxRedirects));
      return;
    }

    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('重定向响应缺少 Location 头'));
          return;
        }
        console.log(`检测到 ${response.statusCode} 重定向，正在跟随至：${redirectUrl}`);
        return downloadFile(redirectUrl, dest, redirects + 1, maxRedirects).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err)); // 删除部分下载的文件
    });
  });
}

// 主逻辑
try {
  // 验证运行环境为 macOS
  if (process.platform !== 'darwin') {
    console.error('错误：此脚本仅支持 macOS 系统');
    process.exit(1);
  }

  // 下载 modules.tar
  console.log('正在下载 modules.tar 从 Hugging Face...');
  downloadFile(tarUrl, tarFile)
    .then(() => {
      console.log('下载成功，验证文件...');
      // 检查文件是否存在
      if (!fs.existsSync(tarFile)) {
        console.error('错误：下载的 modules.tar 文件不存在');
        process.exit(1);
      }

      // 设置环境变量以支持 UTF-8 编码，防止中文乱码
      const env = { ...process.env, LC_ALL: 'en_US.UTF-8' };

      // 验证文件格式
      console.log('验证 modules.tar 格式...');
      const fileOutput = execSync(`file "${tarFile}"`, { encoding: 'utf8', env });
      console.log('file 输出：', fileOutput);
      if (!fileOutput.includes('tar archive')) {
        console.error('错误：modules.tar 不是有效的 tar 归档文件');
        process.exit(1);
      }

      // 尝试解压（支持 .tar 或 .tar.gz）
      console.log('正在解压 modules.tar...');
      try {
        execSync(`tar -xzf "${tarFile}" -C "${extractPath}"`, { stdio: 'inherit', env });
        console.log('成功将 modules.tar 解压到 ./');
      } catch (err) {
        console.error('解压 tar.gz 失败，尝试纯 tar 格式...');
        execSync(`tar -xf "${tarFile}" -C "${extractPath}"`, { stdio: 'inherit', env });
        console.log('成功将 modules.tar 解压到 ./');
      }

      // 清理下载的文件（可选）
      fs.unlinkSync(tarFile);
      console.log('已删除临时文件 modules.tar');

      // 安装 dmg-license npm 包
      console.log('正在安装 dmg-license npm 包...');
      try {
        execSync('npm install dmg-license', { stdio: 'inherit', env });
        console.log('成功安装 dmg-license');
      } catch (err) {
        console.error('安装 dmg-license 失败：', err.message);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('下载或验证出错：', err.message);
      process.exit(1);
    });
} catch (err) {
  console.error('执行出错：', err.message);
  process.exit(1);
}
