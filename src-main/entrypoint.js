// It's very important that all error-handling code here be as minimal and
// self contained as possible to ensure that the error handling does not
// itself have errors.

const {app, dialog} = require('electron');

const APP_NAME = '02Engine Desktop';
const stringifyError = (error) => (error && error.stack) ? error.stack : error;

try {
  // Initialize enhanced logging system
  const logger = require('./logger');
  
  process.on('unhandledRejection', (error) => {
    logger.error('PROMISE', 'Unhandled rejection occurred', {
      error: error.message || error,
      stack: error.stack
    });
    app.whenReady().then(() => {
      dialog.showMessageBoxSync({
        type: 'error',
        title: APP_NAME,
        message: `Error in promise: ${stringifyError(error)}`,
        noLink: true
      });
    });
  });

  // Initialize logger first
  logger.initialize();
  
  // Log system startup information
  logger.info('STARTUP', '02Engine Desktop starting...');
  logger.logSystemInfo();
  logger.logDependencies();
  logger.logUpdateCheckerStatus();

  require('./index');
} catch (error) {
  // Fallback to console if logger initialization fails
  console.error('Error starting main process:', error);
  
  // Try to use logger if available
  try {
    const logger = require('./logger');
    logger.error('STARTUP', 'Critical error during startup', {
      error: error.message || error,
      stack: error.stack
    });
  } catch (loggerError) {
    console.error('Logger also failed:', loggerError);
  }
  
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'error',
      title: APP_NAME,
      message: `Error starting main process: ${stringifyError(error)}`,
      noLink: true
    });
    app.exit(1);
  });
}
