const { exec } = require('child_process');

/**
 * Browser module for opening URLs in default browser
 */

class Browser {
  /**
   * Open URL in default browser
   * @param {string} url - URL to open
   * @returns {Promise<void>}
   */
  static async openUrl(url) {
    return new Promise((resolve, reject) => {
      // Determine the command based on platform
      const command = this.getBrowserCommand();

      exec(`${command} "${url}"`, (error) => {
        if (error) {
          console.log('[LINK] If browser didn\'t open automatically, visit:');
          console.log('   ' + url + '\n');
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the appropriate browser command for the current platform
   * @returns {string} Browser command
   */
  static getBrowserCommand() {
    switch (process.platform) {
      case 'darwin':  // macOS
        return 'open';
      case 'win32':   // Windows
        return 'start';
      case 'linux':   // Linux
      default:
        return 'xdg-open';
    }
  }

  /**
   * Check if running in headless environment
   * @returns {boolean} True if headless
   */
  static isHeadless() {
    return !process.stdout.isTTY || process.env.CI === 'true';
  }
}

module.exports = Browser;
