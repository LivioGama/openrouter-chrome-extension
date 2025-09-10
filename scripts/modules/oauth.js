const https = require('https');

/**
 * OAuth module for handling token exchange and OAuth flow
 */

class OAuth {
  constructor() {
    this.config = null;
  }

  /**
   * Set configuration reference
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    this.config = config;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param {string} authCode - Authorization code from OAuth callback
   * @param {number} port - Server port for redirect URI
   * @returns {Promise<Object>} Promise resolving to token response
   */
  async exchangeCodeForTokens(authCode, port = 3000) {
    const { clientId, clientSecret } = this.config.getCredentials();
    const postData = `client_id=${clientId}&client_secret=${clientSecret}&code=${authCode}&grant_type=authorization_code&redirect_uri=http://localhost:${port}`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const tokens = JSON.parse(data);
            resolve(tokens);
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Generate OAuth authorization URL
   * @param {number} port - Server port
   * @returns {string} Authorization URL
   */
  getAuthUrl(port = 3000) {
    return this.config.getAuthUrl(port);
  }
}

module.exports = new OAuth();
