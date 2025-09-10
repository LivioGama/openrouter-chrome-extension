/**
 * HTML module for generating web pages
 */

class HTML {
  /**
   * Generate success page with refresh token
   * @param {Object} tokens - Token response from OAuth
   * @returns {string} HTML page
   */
  static generateSuccessPage(tokens) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success!</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .success {
            color: #28a745;
            font-size: 28px;
            margin-bottom: 20px;
            font-weight: bold;
          }
          .description {
            color: #666;
            font-size: 16px;
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .token-container {
            position: relative;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
            color: #495057;
            text-align: left;
          }
          .copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .copy-btn:hover {
            background: #0056b3;
          }
          .copy-btn.copied {
            background: #28a745;
          }
          .instructions {
            background: #e7f3ff;
            border: 1px solid #b3d7ff;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            text-align: left;
          }
          .instructions h3 {
            color: #007bff;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .instructions ol {
            margin: 0;
            padding-left: 20px;
          }
          .instructions li {
            margin-bottom: 8px;
            color: #495057;
          }
          .terminal-note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓ Authorization Successful!</div>
          <p class="description">Your refresh token has been generated automatically. Copy it and add to GitHub Secrets.</p>

          <div class="token-container">
            <button class="copy-btn" onclick="copyToken()">Copy Token</button>
            <div id="token">${tokens.refresh_token}</div>
          </div>

          <div class="terminal-note">
            <strong>Terminal Output:</strong> The token has also been displayed in your terminal for backup.
          </div>

          <div class="instructions">
            <h3>Next Steps:</h3>
            <ol>
              <li>Click "Copy Token" above to copy your refresh token</li>
              <li>Go to your GitHub repository</li>
              <li>Navigate to Settings → Secrets and variables → Actions</li>
              <li>Click "New repository secret"</li>
              <li>Name: <code>CHROME_REFRESH_TOKEN</code></li>
              <li>Value: Paste the token you just copied</li>
              <li>Click "Add secret"</li>
            </ol>
          </div>
        </div>

        <script>
          function copyToken() {
            const tokenText = document.getElementById('token').textContent;
            navigator.clipboard.writeText(tokenText).then(function() {
              const btn = document.querySelector('.copy-btn');
              const originalText = btn.textContent;
              btn.textContent = 'Copied!';
              btn.classList.add('copied');

              setTimeout(function() {
                btn.textContent = originalText;
                btn.classList.remove('copied');
              }, 2000);
            }).catch(function(err) {
              console.error('Failed to copy: ', err);
              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              textArea.value = tokenText;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);

              const btn = document.querySelector('.copy-btn');
              btn.textContent = 'Copied!';
              btn.classList.add('copied');
              setTimeout(function() {
                btn.textContent = 'Copy Token';
                btn.classList.remove('copied');
              }, 2000);
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate error page
   * @param {string} error - Error message
   * @returns {string} HTML error page
   */
  static generateErrorPage(error) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            min-height: 100vh;
            margin: 0;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .error {
            color: #dc3545;
            font-size: 28px;
            margin-bottom: 20px;
            font-weight: bold;
          }
          .description {
            color: #666;
            font-size: 16px;
            margin-bottom: 20px;
            line-height: 1.5;
          }
          .error-details {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            text-align: left;
            font-family: monospace;
            font-size: 14px;
            color: #721c24;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗ Token Exchange Failed</div>
          <p class="description">Something went wrong while exchanging your authorization code for tokens.</p>
          <p>Check your terminal for detailed error information.</p>

          <div class="error-details">
            <strong>Error:</strong> ${error}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate OAuth error page
   * @param {string} error - OAuth error message
   * @returns {string} HTML OAuth error page
   */
  static generateOAuthErrorPage(error) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            min-height: 100vh;
            margin: 0;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .error {
            color: #dc3545;
            font-size: 28px;
            margin-bottom: 20px;
            font-weight: bold;
          }
          .description {
            color: #666;
            font-size: 16px;
            margin-bottom: 20px;
            line-height: 1.5;
          }
          .error-details {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            text-align: left;
            font-family: monospace;
            font-size: 14px;
            color: #721c24;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗ Authorization Failed</div>
          <p class="description">There was an error during the OAuth authorization process.</p>

          <div class="error-details">
            <strong>Error:</strong> ${error}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate waiting page
   * @returns {string} HTML waiting page
   */
  static generateWaitingPage() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Callback Server</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            color: white;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 40px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          h1 {
            font-size: 28px;
            margin-bottom: 20px;
            font-weight: bold;
          }
          .description {
            font-size: 16px;
            margin-bottom: 30px;
            line-height: 1.5;
            opacity: 0.9;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .steps {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
            text-align: left;
          }
          .steps h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: white;
          }
          .steps ol {
            margin: 0;
            padding-left: 20px;
          }
          .steps li {
            margin-bottom: 8px;
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 OAuth Server Running</h1>
          <p class="description">Waiting for you to complete the Google OAuth authorization...</p>

          <div class="spinner"></div>

          <div class="steps">
            <h3>Current Status:</h3>
            <ol>
              <li>✓ Local server started successfully</li>
              <li>✓ Browser opened with OAuth URL</li>
              <li>🔄 Waiting for authorization...</li>
              <li>⏳ Processing tokens...</li>
              <li>🎉 Success! Token generated</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = HTML;
