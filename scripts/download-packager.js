const https = require('https');
const fs = require('fs');
const pathUtil = require('path');
const chalk = require('chalk'); // For colored console output

// Configure logging
const log = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  error: (msg) => console.error(chalk.red(`[ERROR] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
};

// Specify file path
const path = pathUtil.join(__dirname, '../src-renderer/packager/standalone.html');

// Ensure directory exists
function ensureDirectoryExists() {
  return new Promise((resolve, reject) => {
    const dir = pathUtil.dirname(path);
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        log.error(`Failed to create directory: ${err.message}`);
        reject(err);
      } else {
        log.info(`Directory ensured: ${dir}`);
        resolve();
      }
    });
  });
}

// Get latest release download URL
function getLatestReleaseDownloadUrl() {
  return new Promise((resolve, reject) => {
    log.info('Fetching latest release information...');
    const req = https.get('https://api.github.com/repos/02engine/packager/releases/latest', {
      headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json',
      },
    }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API request failed with status: ${res.statusCode}`));
        return;
      }

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
          log.info('Successfully parsed GitHub API response');
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${e.message}`));
          return;
        }

        if (!json.assets || !Array.isArray(json.assets)) {
          reject(new Error('No assets found in GitHub API response'));
          return;
        }

        const assetName = 'standalone';
        const asset = json.assets.find(a => a.name.includes(assetName));

        if (!asset) {
          reject(new Error(`No asset found containing "${assetName}"`));
          return;
        }

        log.success(`Found asset: ${asset.name}`);
        resolve(asset.browser_download_url);
      });
    });

    req.on('error', (err) => {
      reject(new Error(`GitHub API request error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });

    req.setTimeout(10000); // 10 second timeout
  });
}

// Download file with progress tracking
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    log.info(`Initiating download from ${url}`);
    console.time('downloadTime');

    let redirectCount = 0;
    const maxRedirects = 5;

    function get(url) {
      if (redirectCount >= maxRedirects) {
        reject(new Error(`Maximum redirects (${maxRedirects}) exceeded`));
        return;
      }

      https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          redirectCount++;
          log.warn(`Redirect (${redirectCount}/${maxRedirects}) to: ${res.headers.location}`);
          get(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10);
        let downloadedSize = 0;

        const file = fs.createWriteStream(path, { flags: 'wx' }); // 'wx' prevents overwriting existing file
        res.pipe(file);

        // Progress tracking
        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 'Unknown';
          log.info(`Download progress: ${progress}% (${downloadedSize}/${totalSize || 'Unknown'} bytes)`);
        });

        file.on('finish', () => {
          file.close();
          log.success('Download completed successfully');
          console.timeEnd('downloadTime');
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(path, () => {}); // Clean up partial file
          reject(new Error(`File write error: ${err.message}`));
        });

        res.on('error', (err) => {
          fs.unlink(path, () => {}); // Clean up partial file
          reject(new Error(`Download stream error: ${err.message}`));
        });
      }).on('error', (err) => {
        reject(new Error(`Download request error: ${err.message}`));
      });
    }

    get(url);
  });
}

// Main execution
async function main() {
  try {
    await ensureDirectoryExists();
    const downloadUrl = await getLatestReleaseDownloadUrl();
    await downloadFile(downloadUrl);
  } catch (err) {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
