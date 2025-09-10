const http = require('http');
const { URL } = require('url');
const HTML = require('./html');
const OAuth = require('./oauth');

/**
 * Server module for handling OAuth callback HTTP server
 */

class Server {
  constructor() {
    this.server = null;
    this.config = null;
    this.port = 3000;
  }

  /**
   * Set configuration and OAuth references
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    this.config = config;
    OAuth.setConfig(config);
  }

  /**
   * Start the OAuth callback server
   * @param {Function} onSuccess - Callback for successful token exchange
   * @param {Function} onError - Callback for errors
   * @param {number} port - Server port (optional)
   */
  async start(onSuccess, onError, port = 3000) {
    this.port = port;

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res, onSuccess, onError);
      });

      this.server.listen(port, () => {
        console.log(`[SERVER] Local server started on http://localhost:${port}`);
        console.log('[ACTION] Complete the authorization in your browser\n');
        resolve();
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`[ERROR] Port ${port} is already in use. Please close any other servers using this port.\n`);
        } else {
          console.log('[ERROR] Server error:', error.message);
        }
        reject(error);
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback
   */
  async handleRequest(req, res, onSuccess, onError) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    try {
      if (url.pathname === '/' && url.searchParams.has('code')) {
        // Handle successful authorization
        const authCode = url.searchParams.get('code');
        await this.handleAuthCode(authCode, res, onSuccess);

      } else if (url.pathname === '/' && url.searchParams.has('error')) {
        // Handle OAuth error
        const error = url.searchParams.get('error');
        console.log(`\n[ERROR] OAuth Error: ${error}`);
        this.sendResponse(res, HTML.generateOAuthErrorPage(error), 400);
        onError(new Error(`OAuth Error: ${error}`));

      } else {
        // Default waiting page
        this.sendResponse(res, HTML.generateWaitingPage(), 200);
      }
    } catch (error) {
      console.error('[ERROR] Request handling error:', error.message);
      this.sendResponse(res, HTML.generateErrorPage(error.message), 500);
      onError(error);
    }
  }

  /**
   * Handle authorization code exchange
   * @param {string} authCode - Authorization code
   * @param {Object} res - HTTP response
   * @param {Function} onSuccess - Success callback
   */
  async handleAuthCode(authCode, res, onSuccess) {
    console.log('\n[OK] Authorization code received!');
    console.log('[EXCHANGE] Exchanging code for tokens...\n');

    try {
      const tokens = await OAuth.exchangeCodeForTokens(authCode, this.port);

      if (tokens.refresh_token) {
        // Send success page
        this.sendResponse(res, HTML.generateSuccessPage(tokens), 200);

        // Call success callback
        onSuccess(tokens);

        // Close server after successful exchange
        setTimeout(() => {
          this.stop();
        }, 2000);

      } else {
        throw new Error('No refresh_token in response');
      }

    } catch (error) {
      console.error('[ERROR] Token exchange failed:', error.message);
      this.sendResponse(res, HTML.generateErrorPage(error.message), 500);
      throw error;
    }
  }

  /**
   * Send HTTP response
   * @param {Object} res - HTTP response
   * @param {string} html - HTML content
   * @param {number} statusCode - HTTP status code
   */
  sendResponse(res, html, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      console.log('\n[STOP] Server stopped');
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Handle graceful shutdown
   */
  handleShutdown() {
    process.on('SIGINT', () => {
      console.log('\n\n[STOP] Server stopped by user');
      this.stop();
      process.exit(0);
    });
  }
}

module.exports = new Server();
