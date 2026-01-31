const settings = require('./settings');
const UpdateWindow = require('./windows/update');
const packageJSON = require('../package.json');
const privilegedFetch = require('./fetch');
const logger = require('./logger');

const currentVersion = packageJSON.version;
const URL = 'https://editor.02engine.org/versions.json';

/**
 * Determines whether the update checker is even allowed to be enabled
 * in this build of the app.
 * @returns {boolean}
 */
const isUpdateCheckerAllowed = () => {
  if (process.env.TW_DISABLE_UPDATE_CHECKER) {
    return false;
  }

  // Must be enabled in package.json
  return !!packageJSON.tw_update;
};

/**
 * Extracts semantic version part from vX.Y.Z-hash format
 * @param {string} fullVersion - Full version string in vX.Y.Z-hash format
 * @returns {string} - Semantic version part (vX.Y.Z)
 */
const extractSemanticVersion = (fullVersion) => {
  if (!fullVersion) return fullVersion;
  const match = fullVersion.match(/^(v\d+\.\d+\.\d+)/);
  return match ? match[1] : fullVersion;
};

const checkForUpdates = async () => {
  logger.debug('UPDATE_CHECKER', 'Starting update check process');
  
  if (!isUpdateCheckerAllowed()) {
    logger.debug('UPDATE_CHECKER', 'Update checker not allowed in this build');
    return;
  }
  
  if (settings.updateChecker === 'never') {
    logger.debug('UPDATE_CHECKER', 'Update checking disabled by user settings');
    return;
  }

  try {
    logger.info('UPDATE_CHECKER', 'Fetching version information', { url: URL });
    const json = await privilegedFetch.json(URL);
    const latestStableFull = json.latest;
    const latestUnstableFull = json.latest_unstable;
    const oldestSafeFull = json.oldest_safe;

    // Extract semantic versions for comparison
    const latestStable = extractSemanticVersion(latestStableFull);
    const latestUnstable = extractSemanticVersion(latestUnstableFull);
    const oldestSafe = extractSemanticVersion(oldestSafeFull);

    logger.info('UPDATE_CHECKER', 'Version information received', {
      current: currentVersion,
      latestStable: latestStableFull,
      latestUnstable: latestUnstableFull,
      oldestSafe: oldestSafeFull,
      comparisonVersions: {
        latestStable,
        latestUnstable,
        oldestSafe
      }
    });

    // Imported lazily as it takes about 10ms to import
    const semverLt = require('semver/functions/lt');

    // Security updates can not be ignored.
    if (semverLt(currentVersion, oldestSafe)) {
      logger.warn('UPDATE_CHECKER', 'Security update available', {
        current: currentVersion,
        minimumSafe: oldestSafe,
        recommended: latestStable
      });
      UpdateWindow.updateAvailable(currentVersion, latestStableFull, true);
      return;
    }

    if (settings.updateChecker === 'security') {
      logger.debug('UPDATE_CHECKER', 'Only checking for security updates, no further action needed');
      return;
    }

    const latestFull = settings.updateChecker === 'unstable' ? latestUnstableFull : latestStableFull;
    const latest = extractSemanticVersion(latestFull);
    const now = Date.now();
    const ignoredUpdate = settings.ignoredUpdate;
    const ignoredUpdateUntil = settings.ignoredUpdateUntil * 1000;
    
    if (ignoredUpdate === latest && now < ignoredUpdateUntil) {
      logger.debug('UPDATE_CHECKER', 'Update was ignored by user', {
        ignoredVersion: ignoredUpdate,
        ignoredUntil: new Date(ignoredUpdateUntil).toISOString()
      });
      return;
    }

    if (semverLt(currentVersion, latest)) {
      logger.info('UPDATE_CHECKER', 'New update available', {
        current: currentVersion,
        available: latestFull,
        isSecurity: false
      });
      UpdateWindow.updateAvailable(currentVersion, latestFull, false);
    } else {
      logger.info('UPDATE_CHECKER', 'Application is up to date', {
        current: currentVersion,
        latest: latestFull
      });
    }
  } catch (error) {
    logger.error('UPDATE_CHECKER', 'Failed to check for updates', {
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * @param {string} version
 * @param {Date} until
 */
const ignoreUpdate = async (version, until) => {
  logger.info('UPDATE_CHECKER', 'User chose to ignore update', {
    ignoredVersion: version,
    ignoredUntil: until.toISOString(),
    duration: Math.floor((until.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + ' days'
  });
  
  settings.ignoredUpdate = version;
  settings.ignoredUpdateUntil = Math.floor(until.getTime() / 1000);
  await settings.save();
};

module.exports = {
  isUpdateCheckerAllowed,
  checkForUpdates,
  ignoreUpdate
};
