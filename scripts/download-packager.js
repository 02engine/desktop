const fs = require('fs');
const pathUtil = require('path');
const { persistentFetch } = require('./lib');
const packagerInfo = require('./packager.json');

// 指定文件的路径
const path = pathUtil.join(__dirname, '../src-renderer/packager/standalone.html');

console.log(`Downloading ${packagerInfo.src}`);
console.time('Download packager');

persistentFetch(packagerInfo.src)
  .then((res) => res.arrayBuffer())
  .then((buffer) => {
    // 确保目录存在
    fs.mkdirSync(pathUtil.dirname(path), {
      recursive: true
    });
    // 将下载的内容写入 standalone.html
    fs.writeFileSync(path, new Uint8Array(buffer));
    console.log('Download complete and saved as standalone.html');
  })
  .then(() => {
    process.exit(0);
  })  
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
