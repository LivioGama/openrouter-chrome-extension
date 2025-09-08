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

## 🤝 Want to contribute?

We'd love that! Just fork, make your changes, and open a PR. Let's make this thing even better together.

## ❤ Thanks!

Huge thanks to [OpenRouter](https://openrouter.ai) for the awesome platform, and to the open source community for tools like [Vite](https://vitejs.dev) and [Bun](https://bun.sh) that make development fun.

Have a great day! 🌟
