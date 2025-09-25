const https = require('https');
const fs = require('fs');
const pathUtil = require('path');

// 指定文件的路径
const path = pathUtil.join(__dirname, '../src-renderer/packager/standalone.html');

// 获取最新 release 的下载链接
function getLatestReleaseDownloadUrl(callback) {
  https.get('https://api.github.com/repos/02engine/packager/releases/latest', {
    headers: {
      'User-Agent': 'Node.js' // GitHub API 需要 User-Agent
    }
  }, (res) => {
    let data = '';

    // 处理数据
    res.on('data', chunk => {
      data += chunk;
    });

    // 响应结束
    res.on('end', () => {
      let json;
      try {
        json = JSON.parse(data);
      } catch (e) {
        return callback(new Error('Failed to parse JSON response.'));
      }

      if (!json.assets || !Array.isArray(json.assets)) {
        return callback(new Error('Assets not found in the response.'));
      }

      const assetName = 'standalone'; // 根据需要更改这个名称
      const asset = json.assets.find(a => a.name.includes(assetName));

      if (!asset) {
        return callback(new Error('No suitable asset found for download.'));
      }

      const downloadUrl = asset.browser_download_url;
      callback(null, downloadUrl);
    });
  }).on('error', (err) => {
    callback(err);
  });
}

// 下载文件并保存为 standalone.html
function downloadFile(url) {
  console.log(`Downloading from ${url}`);
  console.time('Download packager');

  function get(url) {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const location = res.headers.location;
        console.log(`Redirected to: ${location}`);
        return get(location); // 处理重定向
      }

      if (res.statusCode !== 200) {
        return console.error(`Failed to download file: ${res.statusCode}`);
      }

      const file = fs.createWriteStream(path);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('Download complete and saved as standalone.html');
        console.timeEnd('Download packager');
      });
    }).on('error', (err) => {
      console.error(`Error during download: ${err.message}`);
    });
  }

  get(url); // 开始下载
}

// 主程序
getLatestReleaseDownloadUrl((err, downloadUrl) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  downloadFile(downloadUrl);
});
