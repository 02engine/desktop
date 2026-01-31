const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = this.levels.INFO;
    this.logDir = null;
    this.logFile = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    try {
      // Get app path safely
      const { app } = require('electron');
      this.logDir = path.join(app.getPath('userData'), 'logs');
      this.logFile = path.join(this.logDir, `02engine-${new Date().toISOString().split('T')[0]}.log`);
      this.ensureLogDirectory();
      this.initialized = true;
    } catch (error) {
      console.warn('Logger initialization deferred (Electron not ready):', error.message);
    }
  }

  ensureLogDirectory() {
    if (!this.logDir) return;
    
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        this.info('Logger', `Created log directory: ${this.logDir}`);
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  formatMessage(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    let formattedMessage = `[${timestamp}] [${level}] [PID:${pid}] [${component}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  writeToFile(formattedMessage) {
    if (!this.initialized || !this.logFile) {
      return; // Skip file writing until logger is properly initialized
    }
    
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, component, message, data = null) {
    const levelName = Object.keys(this.levels).find(key => this.levels[key] === level);
    
    if (level <= this.currentLevel) {
      const formattedMessage = this.formatMessage(levelName, component, message, data);
      
      // Write to console
      switch (level) {
        case this.levels.ERROR:
          console.error(formattedMessage);
          break;
        case this.levels.WARN:
          console.warn(formattedMessage);
          break;
        case this.levels.INFO:
          console.log(formattedMessage);
          break;
        case this.levels.DEBUG:
          console.debug(formattedMessage);
          break;
      }
      
      // Write to file
      this.writeToFile(formattedMessage);
    }
  }

  error(component, message, data = null) {
    this.log(this.levels.ERROR, component, message, data);
  }

  warn(component, message, data = null) {
    this.log(this.levels.WARN, component, message, data);
  }

  info(component, message, data = null) {
    this.log(this.levels.INFO, component, message, data);
  }

  debug(component, message, data = null) {
    this.log(this.levels.DEBUG, component, message, data);
  }

  setLevel(level) {
    if (typeof level === 'string') {
      this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
    } else {
      this.currentLevel = level;
    }
  }

  logSystemInfo() {
    const os = require('os');
    const packageJson = require('../package.json');
    
    this.info('SYSTEM', '=== 02Engine System Information ===');
    this.info('SYSTEM', `Application: ${packageJson.name} v${packageJson.version}`);
    this.info('SYSTEM', `Platform: ${os.platform()} ${os.arch()}`);
    this.info('SYSTEM', `Node.js: ${process.version}`);
    this.info('SYSTEM', `Electron: ${process.versions.electron}`);
    this.info('SYSTEM', `OS: ${os.type()} ${os.release()}`);
    this.info('SYSTEM', `RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB total, ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}GB free`);
    this.info('SYSTEM', `User Data: ${app.getPath('userData')}`);
    this.info('SYSTEM', '=====================================');
  }

  logDependencies() {
    const packageJson = require('../package.json');
    
    this.info('DEPENDENCIES', '=== Runtime Dependencies ===');
    Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
      this.info('DEPENDENCIES', `${name}: ${version}`);
    });
    
    this.info('DEPENDENCIES', '=== Development Dependencies ===');
    Object.entries(packageJson.devDependencies || {}).forEach(([name, version]) => {
      this.info('DEPENDENCIES', `${name}: ${version}`);
    });
    
    this.info('DEPENDENCIES', '=== External Resources ===');
    this.info('DEPENDENCIES', `Update Check URL: https://editor.02engine.org/versions.json`);
    this.info('DEPENDENCIES', `Download Site: https://download.02engine.02studio.xyz`);
    this.info('DEPENDENCIES', `TurboWarp Extensions: @turbowarp/extensions`);
    this.info('DEPENDENCIES', `Scratch GUI Fork: github:02engine/scratch-gui#main`);
  }

  logUpdateCheckerStatus() {
    const updateChecker = require('./update-checker');
    
    this.info('UPDATE_CHECKER', '=== Update Checker Status ===');
    this.info('UPDATE_CHECKER', `Update Checker Allowed: ${updateChecker.isUpdateCheckerAllowed()}`);
    this.info('UPDATE_CHECKER', `Current Version: ${require('../package.json').version}`);
    
    const settings = require('./settings');
    this.info('UPDATE_CHECKER', `Update Mode: ${settings.updateChecker || 'not configured'}`);
    this.info('UPDATE_CHECKER', `Ignored Update: ${settings.ignoredUpdate || 'none'}`);
    this.info('UPDATE_CHECKER', `Ignored Until: ${settings.ignoredUpdateUntil ? new Date(settings.ignoredUpdateUntil * 1000).toISOString() : 'none'}`);
    this.info('UPDATE_CHECKER', '===============================');
  }
}

module.exports = new Logger();