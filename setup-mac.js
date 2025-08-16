const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定义下载 URL 和目标路径
const tarUrl = 'https://huggingface.co/datasets/02engine/02engine_modules/resolve/main/mac_modules.tar?download=true';
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
      // 处理 302 重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('重定向响应缺少 Location 头'));
          return;
        }
        console.log(`检测到 ${response.statusCode} 重定向，正在跟随至：${redirectUrl}`);
        // 递归调用，处理重定向
        return downloadFile(redirectUrl, dest, redirects + 1, maxRedirects).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }

