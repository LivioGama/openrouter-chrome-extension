# OpenRouter CSV Cost Analyzer

[![Bun](https://img.shields.io/badge/built%20with-Bun-orange.svg)](https://bun.sh)

Hey there! 🦾 This handy Chrome extension adds an "Group by Model" button to your OpenRouter Activity page so you can quickly see how much you're spending per AI model on that exported CSV data. Perfect for keeping track of your AI costs!

## ✨ What it does

- **One-click analysis**: Just click "Group by Model" next to your export button
- **Cost breakdown**: Shows you exactly how much each AI model is costing you
- **Developer-friendly**: Built with TypeScript and includes cool dev features like caching
- **Super easy to use**: Works right on the OpenRouter site - no extra steps needed

## 🚀 Quick Setup

1. **Grab the code**
   ```bash
   git clone https://github.com/LivioGama/openrouter-chrome-extension.git
   cd openrouter-chrome-extension
   ```

2. **Install stuff**
   ```bash
   bun install
   ```

3. **Build it**
   ```bash
   bun run build
   ```

4. **Enable in Chrome**
   - Go to `chrome://extensions/`
   - Turn on "Developer mode"
   - Click "Load unpacked"
   - Pick the `dist/` folder

Boom! You're ready. 🎉

## 📖 How to use

1. Head over to [openrouter.ai/activity](https://openrouter.ai/activity)
2. Click "Export" like usual to get your CSV
3. Look for the new "Group by Model" button that appears
4. Click it! You'll see a breakdown of costs by model

That's it! Simple as pie. 🥧

## 🛠️ For Developers

Want to play around with the code?

```bash
bun run dev     # Start dev server with live reloading
bun run build   # Build for production
```

The extension uses Vite for fast building and TypeScript for reliability. Pro tip: Check the console for dev logs with 🚀 DEV prefixes!

### Debug Mode (Official Chrome Extension Approach)

The extension uses the **official Chrome extension pattern** with `chrome.storage` for debug mode management:

**Enable Debug Mode:**
```javascript
// In browser console (after extension loads)
OpenRouterDev.enableDebug()
```

**Disable Debug Mode:**
```javascript
// In browser console
OpenRouterDev.disableDebug()
```

**Debug Mode Features:**
- ✅ API response caching (30 minutes)
- ✅ Development UI buttons (refresh, cache clear)
- ✅ Detailed console logging
- ✅ Cache status indicators

**Production Mode:**
- ❌ Caching disabled (no localStorage usage)
- ❌ Development buttons hidden
- ❌ Minimal console output

**Storage Location:**
Debug mode setting is stored in `chrome.storage.sync` under the key `debugMode`.

**Console Output:**
- `OpenRouter Analyzer: Debug mode ENABLED/DISABLED (from chrome.storage)`
- `OpenRouter Analyzer: Debug mode ENABLED/DISABLED (updated via chrome.storage)`

## 🚀 Automated Publishing

This extension uses GitHub Actions to automatically publish updates to the Chrome Web Store on every push to the `main` branch (excluding documentation-only changes).

### Setup Automated Publishing

1. **Create Google API Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Chrome Web Store API
   - Create OAuth 2.0 credentials (Desktop Application)
   - Download the credentials as `oauth_client.json` and place it in your project root
   - Generate a refresh token using the OAuth flow:

     **Option A: Use the automated JSON helper script (easiest):**
     ```bash
     bun run generate-token:json
     ```
     (Automatically opens browser, captures callback, and generates refresh token)

     **Manual steps (if needed):**
     1. Visit: `https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&redirect_uri=http://localhost&client_id=YOUR_CLIENT_ID`
     2. Sign in and authorize (you'll be redirected to http://localhost)
     3. Copy the authorization code from the URL (it will look like: `http://localhost/?code=YOUR_CODE_HERE`)
     4. Exchange for tokens:
     ```bash
     curl -X POST https://oauth2.googleapis.com/token \
       -H "Content-Type: application/x-www-form-urlencoded" \
       -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&code=AUTH_CODE&grant_type=authorization_code&redirect_uri=http://localhost"
     ```
     5. Copy the `refresh_token` from the response

2. **Get Extension ID:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Find your extension's Item ID

3. **Add GitHub Secrets:**
   Go to your repository Settings → Secrets and variables → Actions → New repository secret

   Add these secrets:
   - `CHROME_EXTENSION_ID`: Your extension's Item ID
   - `CHROME_CLIENT_ID`: OAuth Client ID
   - `CHROME_CLIENT_SECRET`: OAuth Client Secret
   - `CHROME_REFRESH_TOKEN`: OAuth Refresh Token

4. **Create Production Environment:**
   Go to Settings → Environments → New environment (name: `production`)

### Publishing Process

**Automatic Publishing:**
The extension automatically publishes on every push to `main` branch that includes code changes (excluding documentation-only updates).

1. **Make your code changes**
2. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **GitHub Actions will automatically:**
   - Build the extension
   - Create a ZIP archive
   - Upload to Chrome Web Store
   - Store the build artifact for manual download

4. **Submit for Review (when ready):**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Find your extension and click "Submit for Review"

**Note:** Every push to main will create a new draft version. Only submit for review when you're ready to publish.

### Manual Release Commands

```bash
# Build and commit changes
bun run release

# Create and push version tag (triggers auto-publish)
bun run release:tag

# Setup Google API credentials (step-by-step guide)
bun run setup:api

# Generate refresh token from oauth_client.json (automated - easiest)
bun run generate-token
```

### Testing Your Setup

1. **Test locally first:**
   ```bash
   bun run build
   # Check that dist/ folder contains your extension files
   ```

2. **Test the workflow:**
   ```bash
   # Make a small change (add a comment to any file)
   git add .
   git commit -m "Test automated publishing"
   git push origin main
   ```

3. **Check GitHub Actions:**
   - Go to your repository → Actions tab
   - Find the "Publish Chrome Extension" workflow
   - Check the logs for any errors

4. **Verify in Chrome Web Store:**
   - Go to [Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Check that a new draft version was uploaded

### Troubleshooting

**Common Issues:**

- **"Invalid client" error:** Double-check your Client ID and Secret
- **"Invalid scope" error:** Make sure you used the correct scope URL
- **"Access denied" error:** Verify your Google account has access to the extension
- **"Error 400: invalid_request" error:** This means Google has deprecated the old OAuth flow. Make sure you're using `http://localhost` as the redirect URI
- **Workflow fails:** Check the GitHub Actions logs for detailed error messages

**Debug Tips:**

- Test with a development extension first
- Verify all GitHub secrets are set correctly
- Make sure the extension ID matches your Chrome Web Store listing
- Check that your Google Cloud project has the Chrome Web Store API enabled
- Ensure `oauth_client.json` is in the project root and contains valid credentials
- Run `bun run generate-token:json` to verify your JSON file is readable

## 🤝 Want to contribute?

We'd love that! Just fork, make your changes, and open a PR. Let's make this thing even better together.

## ❤ Thanks!

Huge thanks to [OpenRouter](https://openrouter.ai) for the awesome platform, and to the open source community for tools like [Vite](https://vitejs.dev) and [Bun](https://bun.sh) that make development fun.

Have a great day! 🌟
