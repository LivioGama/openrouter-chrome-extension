#!/usr/bin/env node

/**
 * Chrome Web Store OAuth Refresh Token Generator (JSON Version)
 *
 * This script reads OAuth credentials from oauth_client.json and generates the refresh token.
 * It automatically launches a local server to capture the OAuth callback.
 * Make sure your oauth_client.json file is in the project root.
 */

const Config = require('./modules/config')
const Server = require('./modules/server')
const Browser = require('./modules/browser')

console.log('[LOCK] Chrome Web Store Refresh Token Generator (JSON)')
console.log('======================================================\n')

// Load credentials from oauth_client.json
if (!Config.loadCredentials()) {
  process.exit(1)
}

console.log('[START] Starting automated OAuth flow...\n')

// Success callback
function onTokenSuccess(tokens) {
  console.log('[SUCCESS] Your refresh token has been generated:\n')
  console.log('='.repeat(60))
  console.log(tokens.refresh_token)
  console.log('='.repeat(60))
  console.log('\n[INFO] Copy this refresh token and add it to GitHub Secrets:')
  console.log('   • Repository Settings → Secrets and variables → Actions')
  console.log('   • New repository secret: CHROME_REFRESH_TOKEN')
  console.log('   • Value: [paste the token above]\n')

  console.log('[WARNING] Important:')
  console.log('• Keep your refresh token secure - never commit it to code')
  console.log('• The refresh token is long-lived and doesn\'t expire')
  console.log('• Test with a development extension first\n')

  console.log('[SUCCESS] OAuth flow completed successfully!')
  console.log('You can now close this terminal and your browser.')
}

// Error callback
function onTokenError(error) {
  console.error('[ERROR] OAuth flow failed:', error.message)
  process.exit(1)
}

Server.setConfig(Config)

// Start the OAuth flow
async function startOAuthFlow() {
  try {
    console.log('1. [WEB] Opening OAuth authorization URL in your browser...')

    // Start the server
    await Server.start(onTokenSuccess, onTokenError)

    // Open browser with OAuth URL
    const authUrl = Config.getAuthUrl()
    await Browser.openUrl(authUrl)

  } catch (error) {
    console.error('[ERROR] Failed to start OAuth flow:', error.message)
    process.exit(1)
  }
}

// Handle graceful shutdown
Server.handleShutdown()

// Start the OAuth flow
startOAuthFlow()
