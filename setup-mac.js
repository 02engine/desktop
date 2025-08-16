const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定义下载 URL 和目标路径
const tarUrl = 'https://huggingface.co/datasets/02engine/02engine_modules/resolve/main/mac_modules.tar?download=true';
const tarFile = path.join(__dirname, 'modules.tar');
const extractPath = './';

// 下载文件，支持重定向
function downloadFile(url, dest, redirects = 0, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (redirects >= maxRedirects) {
      return reject(new Error(`重定向次数过多，超过最大限制：${maxRedirects}`));
    }

    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (response) => {
      // 处理 301/302 重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          return reject(new Error('重定向响应缺少 Location 头'));
        }
        console.log(`检测到 ${response.statusCode} 重定向，正在跟随至：${redirectUrl}`);
        return downloadFile(redirectUrl, dest, redirects + 1, maxRedirects)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`下载失败，状态码: ${response.statusCode}`));
      }

      // 保存文件
      const fileStream = fs.createWriteStream(dest);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fileStream.close();
        reject(new Error(`写入文件失败: ${err.message}`));
      });

      response.on('error', (err) => {
        fileStream.close();
        reject(new Error(`响应流错误: ${err.message}`));
      });
    }).on('error', (err) => {
      reject(new Error(`请求错误: ${err.message}`));
    });
  });
}

// 主函数
async function main() {
  try {
    console.log(`开始下载: ${tarUrl}`);
    await downloadFile(tarUrl, tarFile);
    console.log(`开始解压: ${tarFile}`);
    execSync(`tar -xf ${tarFile} -C ${extractPath}`, { stdio: 'inherit' });
    console.log(`文件已解压至: ${extractPath}`);
  } catch (err) {
    console.error(`错误: ${err.message}`);
    process.exit(1);
  }
}

main();
