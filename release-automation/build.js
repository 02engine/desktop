require('./patch-electron-builder');
const fs = require('fs');
const pathUtil = require('path');
const childProcess = require('child_process');
const builder = require('electron-builder');
const electronFuses = require('@electron/fuses');
const {Platform, Arch} = builder;

const isProduction = process.argv.includes('--production');

// Electron 22 是最後支援 Windows 7/8/8.1 的版本
const ELECTRON_22_FINAL = '22.3.27';
// Electron 26 是最後支援 macOS 10.13、10.14 的版本
const ELECTRON_26_FINAL = '26.6.10';
// Electron 32 是最後支援 macOS 10.15 的版本
const ELECTRON_32_FINAL = '32.3.3';
// Electron 37 是目前最後支援 macOS 11 的版本（仍可能繼續更新）
const ELECTRON_37_FINAL = '37.8.0';

/**
 * @returns {Date}
 */
const getSourceDateEpoch = () => {
  // 備用日期，來自 commit 35045e7c0fa4e4e14b2747e967adb4029cedb945
  const ARBITRARY_FALLBACK = 1609809111000;

  if (process.env.SOURCE_DATE_EPOCH) {
    return new Date((+process.env.SOURCE_DATE_EPOCH) * 1000);
  }

  const gitProcess = childProcess.spawnSync('git', ['log', '-1', '--pretty=%ct']);
  if (gitProcess.error) {
    if (gitProcess.error.code === 'ENOENT') {
      console.warn('Could not get source date epoch: git is not installed');
      return new Date(ARBITRARY_FALLBACK);
    }
    throw gitProcess.error;
  }
  if (gitProcess.status !== 0) {
    console.warn(`Could not get source date epoch: git returned status ${gitProcess.status}`);
    return new Date(ARBITRARY_FALLBACK);
  }

  const gitStdout = gitProcess.stdout.toString().trim();
  if (/^\d+$/.test(gitStdout)) {
    return new Date((+gitStdout) * 1000);
  }

  console.warn(`Could not get source date epoch: git did not return a date`);
  return new Date(ARBITRARY_FALLBACK);
};

const sourceDateEpoch = getSourceDateEpoch();
process.env.SOURCE_DATE_EPOCH = Math.round(sourceDateEpoch.getTime() / 1000).toString();
console.log(`Source date epoch: ${sourceDateEpoch.toISOString()} (${process.env.SOURCE_DATE_EPOCH})`);

const getDefaultArch = (platformName) => {
  if (platformName === 'WINDOWS') return 'x64';
  if (platformName === 'MAC') return 'universal';
  if (platformName === 'LINUX') return 'x64';
  throw new Error(`Unknown platform: ${platformName}`);
};

const getArchesToBuild = (platformName) => {
  const arches = [];
  for (const arg of process.argv) {
    if (arg === '--x64') arches.push('x64');
    if (arg === '--ia32') arches.push('ia32');
    if (arg === '--armv7l') arches.push('armv7l');
    if (arg === '--arm64') arches.push('arm64');
    if (arg === '--universal') arches.push('universal');
  }
  if (arches.length === 0) {
    arches.push(getDefaultArch(platformName));
  }
  return arches;
};

const flipFuses = async (context) => {
  const electronMajorVersion = +context.packager.info.framework.version.split('.')[0];
  /** @type {import('@electron/fuses').FuseV1Config} */
  const newFuses = {
    version: electronFuses.FuseVersion.V1,
    strictlyRequireAllFuses: true,
  };

  newFuses[electronFuses.FuseV1Options.LoadBrowserProcessSpecificV8Snapshot] = false;
  newFuses[electronFuses.FuseV1Options.RunAsNode] = false;
  newFuses[electronFuses.FuseV1Options.EnableNodeOptionsEnvironmentVariable] = false;
  newFuses[electronFuses.FuseV1Options.EnableNodeCliInspectArguments] = false;
  newFuses[electronFuses.FuseV1Options.OnlyLoadAppFromAsar] = false;
  newFuses[electronFuses.FuseV1Options.EnableEmbeddedAsarIntegrityValidation] = false;
  newFuses[electronFuses.FuseV1Options.EnableCookieEncryption] = false;

  if (electronMajorVersion >= 29) {
    // 目前仍需開啟，否則 migrate.html 會出問題，未來可嘗試關閉
    newFuses[electronFuses.FuseV1Options.GrantFileProtocolExtraPrivileges] = true;
  }

  await context.packager.addElectronFuses(context, newFuses);
};

const recursivelySetFileTimes = (directory, date) => {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = pathUtil.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      recursivelySetFileTimes(filePath, date);
    } else {
      fs.utimesSync(filePath, date, date);
    }
  }
  fs.utimesSync(directory, date, date);
};

const afterPack = async (context) => {
  await flipFuses(context);
  recursivelySetFileTimes(context.appOutDir, sourceDateEpoch);
};

const afterPackForUniversalMac = async (context) => {
  // universal 模式只在最終合併階段套用 fuses
  if (context.arch === Arch.universal) {
    await flipFuses(context);
  }
  recursivelySetFileTimes(context.appOutDir, sourceDateEpoch);
};

const afterSign = async (context) => {
  recursivelySetFileTimes(context.appOutDir, sourceDateEpoch);
};

const build = async ({
  platformName,
  platformType,
  manageUpdates = false,
  legacy = false,
  extraConfig = {},
  prepare = (archName) => Promise.resolve({})
}) => {
  const buildForArch = async (archName) => {
    if (!Object.prototype.hasOwnProperty.call(Arch, archName)) {
      throw new Error(`Unknown arch: ${archName}`);
    }
    const arch = Arch[archName];

    if (!Object.prototype.hasOwnProperty.call(Platform, platformName)) {
      throw new Error(`Unknown platform: ${platformName}`);
    }
    const platform = Platform[platformName];
    const target = platform.createTarget(platformType, arch);

    let distributionName = `${platformName}-${platformType}-${archName}`.toLowerCase();
    if (isProduction) {
      distributionName = `release-${distributionName}`;
    }
    if (legacy) {
      distributionName = `${distributionName}-legacy`;
    }
    console.log(`Building distribution: ${distributionName}`);

    const config = {
      extraMetadata: {
        tw_dist: distributionName,
        tw_warn_legacy: isProduction,
        tw_update: isProduction && manageUpdates
      },
      afterPack: arch === Arch.universal ? afterPackForUniversalMac : afterPack,
      afterSign,
      ...extraConfig,
      ...await prepare(archName)
    };

    return builder.build({
      targets: target,
      config,
      publish: null
    });
  };

  for (const archName of getArchesToBuild(platformName)) {
    await buildForArch(archName);
  }
};

const buildWindows = () => build({
  platformName: 'WINDOWS',
  platformType: 'nsis',
  manageUpdates: true
});

const buildWindowsLegacy = () => build({
  platformName: 'WINDOWS',
  platformType: 'nsis',
  manageUpdates: true,
  legacy: true,
  extraConfig: {
    nsis: {
      artifactName: '${productName}-Legacy-Setup-${version}-${arch}.${ext}'
    },
    electronVersion: ELECTRON_22_FINAL
  }
});

const buildWindowsPortable = () => build({
  platformName: 'WINDOWS',
  platformType: 'portable',
  manageUpdates: true
});

const buildWindowsDir = () => build({
  platformName: 'WINDOWS',
  platformType: 'dir',
  manageUpdates: true
});

const buildMicrosoftStore = () => build({
  platformName: 'WINDOWS',
  platformType: 'appx',
  manageUpdates: false
});

const buildMac = () => build({
  platformName: 'MAC',
  platformType: 'dmg',
  manageUpdates: true
});

const buildMacLegacy10131014 = () => build({
  platformName: 'MAC',
  platformType: 'dmg',
  manageUpdates: true,
  legacy: true,
  extraConfig: {
    mac: {
      artifactName: '${productName}-Legacy-10.13-10.14-Setup-${version}.${ext}'
    },
    electronVersion: ELECTRON_26_FINAL
  }
});

const buildMacLegacy1015 = () => build({
  platformName: 'MAC',
  platformType: 'dmg',
  manageUpdates: true,
  legacy: true,
  extraConfig: {
    mac: {
      artifactName: '${productName}-Legacy-10.15-Setup-${version}.${ext}'
    },
    electronVersion: ELECTRON_32_FINAL
  }
});

const buildMacLegacy11 = () => build({
  platformName: 'MAC',
  platformType: 'dmg',
  manageUpdates: true,
  legacy: true,
  extraConfig: {
    mac: {
      artifactName: '${productName}-Legacy-11-Setup-${version}.${ext}'
    },
    electronVersion: ELECTRON_37_FINAL
  }
});

const buildMacDir = () => build({
  platformName: 'MAC',
  platformType: 'dir',
  manageUpdates: true
});

const buildDebian = () => build({
  platformName: 'LINUX',
  platformType: 'deb',
  manageUpdates: true
});

const buildTarball = () => build({
  platformName: 'LINUX',
  platformType: 'tar.gz',
  manageUpdates: true,
  extraConfig: {
    artifactBuildCompleted: async (artifact) => new Promise((resolve, reject) => {
      console.log(`Running strip-nondeterminism on ${artifact.file}`);
      const stripNondeterminism = childProcess.spawn('strip-nondeterminism', [artifact.file]);
      stripNondeterminism.on('error', (e) => {
        if (e.code === 'ENOENT') {
          console.error('strip-nondeterminism is not installed; tarball may not be reproducible.');
          resolve();
        } else {
          reject(e);
        }
      });
      stripNondeterminism.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`strip-nondeterminism exited with status code ${code}`));
        }
      });
    })
  }
});

const buildAppImage = () => build({
  platformName: 'LINUX',
  platformType: 'appimage',
  manageUpdates: true
});

const buildLinuxDir = () => build({
  platformName: 'LINUX',
  platformType: 'dir',
  manageUpdates: true
});

const run = async () => {
  const options = {
    '--windows': buildWindows,
    '--windows-legacy': buildWindowsLegacy,
    '--windows-portable': buildWindowsPortable,
    '--windows-dir': buildWindowsDir,
    '--microsoft-store': buildMicrosoftStore,
    '--mac': buildMac,
    '--mac-legacy-10.13-10.14': buildMacLegacy10131014,
    '--mac-legacy-10.15': buildMacLegacy1015,
    '--mac-legacy-11': buildMacLegacy11,
    '--mac-dir': buildMacDir,
    '--debian': buildDebian,
    '--tarball': buildTarball,
    '--appimage': buildAppImage,
    '--linux-dir': buildLinuxDir
  };

  let built = 0;
  for (const arg of process.argv) {
    if (Object.prototype.hasOwnProperty.call(options, arg)) {
      built++;
      await options[arg]();
    }
  }

  if (built === 0) {
    console.log('Need to specify platforms; see release-automation/README.md');
    process.exit(1);
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });