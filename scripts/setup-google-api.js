#!/usr/bin/env node

require('https')


console.log('🚀 Chrome Web Store API Setup Helper')
console.log('=====================================\n')

console.log('📋 Step-by-Step Setup Instructions:')
console.log('=====================================\n')

console.log('1. 🔐 Create Google Cloud Project:')
console.log('   • Go to https://console.cloud.google.com/')
console.log('   • Create a new project or select existing one')
console.log('   • Enable the Chrome Web Store API\n')

console.log('2. 🗝️ Create OAuth 2.0 Credentials:')
console.log('   • Go to "APIs & Services" → "Credentials"')
console.log('   • Click "Create Credentials" → "OAuth 2.0 Client IDs"')
console.log('   • Application type: "Desktop Application"')
console.log('   • Copy the Client ID and Client Secret\n')

console.log('3. 🔄 Get Refresh Token:')
console.log('   • Visit this URL in your browser:')
console.log('   • https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=YOUR_CLIENT_ID_HERE')
console.log('   • Replace YOUR_CLIENT_ID_HERE with your actual Client ID')
console.log('   • Authorize the application')
console.log('   • Copy the authorization code\n')

console.log('4. 🔑 Exchange Code for Refresh Token:')
console.log('   • Run this curl command (replace placeholders):')
console.log('   curl -X POST https://oauth2.googleapis.com/token \\')
console.log('     -H "Content-Type: application/x-www-form-urlencoded" \\')
console.log('     -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&code=AUTHORIZATION_CODE&grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob"\n')

console.log('5. 📦 Get Extension ID:')
console.log('   • Go to https://chrome.google.com/webstore/developer/dashboard')
console.log('   • Find your extension and copy the Item ID\n')

console.log('6. 🔒 Add GitHub Secrets:')
console.log('   • Go to your GitHub repo Settings → Secrets and variables → Actions')
console.log('   • Add these repository secrets:')
console.log('     - CHROME_EXTENSION_ID: Your extension Item ID')
console.log('     - CHROME_CLIENT_ID: Your OAuth Client ID')
console.log('     - CHROME_CLIENT_SECRET: Your OAuth Client Secret')
console.log('     - CHROME_REFRESH_TOKEN: Your refresh token\n')

console.log('7. 🌍 Create Production Environment:')
console.log('   • Go to Settings → Environments → New environment')
console.log('   • Name: production\n')

console.log('8. 🚀 Test the Workflow:')
console.log('   • Make any code change')
console.log('   • Push to main: git push origin main')
console.log('   • Check GitHub Actions tab for workflow execution\n')

console.log('📚 Resources:')
console.log('• Chrome Web Store API: https://developer.chrome.com/docs/webstore/using_webstore_api/')
console.log('• GitHub Actions Guide: https://docs.github.com/en/actions')
console.log('• Automated Publishing Blog: https://jam.dev/blog/automating-chrome-extension-publishing/\n')

console.log('✅ Once you have all the credentials, your extension will auto-publish on every push to main!')
console.log('💡 Tip: Test with a development extension first before using production credentials.\n')

process.exit(0)
