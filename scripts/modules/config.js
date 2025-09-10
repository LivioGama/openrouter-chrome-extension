const fs = require('fs');
const path = require('path');

/**
 * Configuration module for OAuth token generator
 * Handles credential loading and validation
 */

class Config {
  constructor() {
    this.clientId = null;
    this.clientSecret = null;
    this.jsonFilePath = path.join(__dirname, '..', '..', 'oauth_client.json');
  }

  /**
   * Load OAuth credentials from oauth_client.json
   * @returns {boolean} True if credentials loaded successfully
   */
  loadCredentials() {
    try {
      if (!fs.existsSync(this.jsonFilePath)) {
        console.log('[ERROR] oauth_client.json not found!');
        console.log('Please download your OAuth client credentials from Google Cloud Console:');
        console.log('https://console.cloud.google.com/apis/credentials\n');
        console.log('Make sure to save the file as oauth_client.json in your project root.\n');
        return false;
      }

      const jsonContent = fs.readFileSync(this.jsonFilePath, 'utf8');
      const credentials = JSON.parse(jsonContent);

      this.clientId = credentials.installed?.client_id;
      this.clientSecret = credentials.installed?.client_secret;

      if (!this.clientId || !this.clientSecret) {
        console.log('[ERROR] Invalid oauth_client.json format!');
        console.log('Expected format:');
        console.log(`{
  "installed": {
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    ...
  }
}\n`);
        console.log('Please check your oauth_client.json file.\n');
        return false;
      }

      console.log('[OK] Credentials loaded from oauth_client.json!');
      console.log(`[INFO] Client ID: ${this.clientId.substring(0, 20)}...`);
      return true;

    } catch (error) {
      console.log('[ERROR] Error reading oauth_client.json:');
      console.log(error.message);
      console.log('\nMake sure the file contains valid JSON with your OAuth credentials.\n');
      return false;
    }
  }

  /**
   * Get the OAuth authorization URL
   * @param {number} port - Server port for redirect URI
   * @returns {string} Complete authorization URL
   */
  getAuthUrl(port = 3000) {
    return `https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&redirect_uri=http://localhost:${port}&client_id=${this.clientId}`;
  }

  /**
   * Get client credentials for token exchange
   * @returns {Object} Client credentials
   */
  getCredentials() {
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret
    };
  }
}

module.exports = new Config();
