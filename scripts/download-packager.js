const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI color codes for logging
const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

// Structured logging
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS] ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}[ERROR] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN] ${msg}${colors.reset}`),
};

// Specify file path
const outputPath = path.join(__dirname, '../src-renderer/packager/standalone.html');

// Ensure directory exists
function ensureDirectoryExists() {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        log.error(`Failed to create directory ${dir}: ${err.message}`);
        reject(err);
      } else {
        log.info(`Directory ensured: ${dir}`);
        resolve();
      }
    });
  });
}

// Check and remove existing file
function removeExistingFile() {
  return new Promise((resolve, reject) => {
    fs.access(outputPath, fs.constants.F_OK, (err) => {
      if (err) {
        log.info(`File ${outputPath} does not exist, proceeding with download`);
        resolve();
      } else {
        fs.unlink(outputPath, (err) => {
          if (err) {
            log.error(`Failed to delete existing file ${outputPath}: ${err.message}`);
            reject(err);
          } else {
            log.info(`Deleted existing file ${outputPath}`);
            resolve();
          }
        });
      }
    });
  });
}

// Get latest release download URL with rate limit handling
function getLatestReleaseDownloadUrl(maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let retryCount = 0;

    function attemptRequest() {
      log.info(`Fetching latest release information from GitHub API... (attempt ${retryCount + 1}/${maxRetries})`);
      const headers = {
        'User-Agent': 'PackagerDownloader/1.0',
        'Accept': 'application/vnd.github.v3+json',
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        log.info('Using GitHub token for authentication');
      }

      const req = https.get('https://api.github.com/repos/02engine/packager/releases/latest', {
        headers,
      }, (res) => {
        // Log rate limit info
        const remaining = res.headers['x-ratelimit-remaining'] || 'N/A';
        const resetTime = res.headers['x-ratelimit-reset'] || 'N/A';
        log.info(`Rate limit remaining: ${remaining}`);
        log.info(`Rate limit reset: ${new Date(parseInt(resetTime) * 1000).toISOString() || 'N/A'}`);

        if (res.statusCode === 403) {
          let errorBody = '';
          res.on('data', chunk => { errorBody += chunk; });
          res.on('end', () => {
            log.error(`Error body: ${errorBody}`);
            if (errorBody.includes('API rate limit exceeded') && retryCount < maxRetries - 1) {
              const resetTimestamp = parseInt(res.headers['x-ratelimit-reset'] || '0') * 1000;
              const waitTime = Math.max(resetTimestamp - Date.now() + 1000, 1000); // Wait until reset + buffer
              log.warn(`Rate limit hit. Waiting ${Math.round(waitTime / 1000)} seconds before retry...`);
              setTimeout(attemptRequest, waitTime);
              retryCount++;
              return;
            }
            reject(new Error(`GitHub API request failed with status ${res.statusCode}: ${errorBody}`));
          });
          return;
        }

        if (res.statusCode !== 200) {
          let errorBody = '';
          res.on('data', chunk => { errorBody += chunk; });
          res.on('end', () => {
            reject(new Error(`GitHub API request failed with status ${res.statusCode}: ${errorBody}`));
          });
          return;
        }

        let data = '';
        res.on('data', chunk => { data += chunk; });

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

          log.success(`Found asset: ${asset.name} (${asset.size} bytes)`);
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

      req.setTimeout(15000);
    }

    attemptRequest();
  });
}

// Download file with progress tracking and retry logic
function downloadFile(url, retries = 3) {
  return new Promise((resolve, reject) => {
    log.info(`Initiating download from ${url} (retries left: ${retries})`);
    console.time('downloadTime');

    let redirectCount = 0;
    const maxRedirects = 5;

    function get(url, currentRetry = 0) {
      if (redirectCount >= maxRedirects) {
        reject(new Error(`Maximum redirects (${maxRedirects}) exceeded`));
        return;
      }

      https.get(url, { 
        headers: { 
          'User-Agent': 'PackagerDownloader/1.0'
        } 
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          redirectCount++;
          log.warn(`Redirect (${redirectCount}/${maxRedirects}) to: ${res.headers.location}`);
          get(res.headers.location, currentRetry);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        const file = fs.createWriteStream(outputPath);
        res.pipe(file);

        // Progress tracking
        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 'Unknown';
          if (process.stdout.isTTY) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Download progress: ${progress}% (${downloadedSize}/${totalSize || 'Unknown'} bytes)`);
          } else {
            log.info(`Download progress: ${progress}% (${downloadedSize}/${totalSize || 'Unknown'} bytes)`);
          }
        });

        file.on('finish', () => {
          file.close();
          log.success(`Download completed and saved to ${outputPath}`);
          console.timeEnd('downloadTime');
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Clean up partial file
          if (currentRetry < retries) {
            log.warn(`File write error on retry ${currentRetry + 1}/${retries}: ${err.message}. Retrying...`);
            setTimeout(() => get(url, currentRetry + 1), 1000 * (currentRetry + 1)); // Exponential backoff
          } else {
            reject(new Error(`File write error after ${retries} retries: ${err.message}`));
          }
        });

        res.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Clean up partial file
          if (currentRetry < retries) {
            log.warn(`Download stream error on retry ${currentRetry + 1}/${retries}: ${err.message}. Retrying...`);
            setTimeout(() => get(url, currentRetry + 1), 1000 * (currentRetry + 1));
          } else {
            reject(new Error(`Download stream error after ${retries} retries: ${err.message}`));
          }
        });
      }).on('error', (err) => {
        if (currentRetry < retries) {
          log.warn(`Download request error on retry ${currentRetry + 1}/${retries}: ${err.message}. Retrying...`);
          setTimeout(() => get(url, currentRetry + 1), 1000 * (currentRetry + 1));
        } else {
          reject(new Error(`Download request error after ${retries} retries: ${err.message}`));
        }
      });
    }

    get(url);
  });
}

// Main execution
async function main() {
  try {
    await ensureDirectoryExists();
    await removeExistingFile();
    const downloadUrl = await getLatestReleaseDownloadUrl();
    await downloadFile(downloadUrl);
    log.success('Script completed successfully!');
  } catch (err) {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
