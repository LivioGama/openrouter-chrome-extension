import path from 'node:path'
import copy from 'rollup-plugin-copy'
import {defineConfig} from 'vite'
import {
  extensionReloaderBuildStep,
  extensionReloaderWatchExternal,
  extensionReloaderWebSocket,
} from 'vite-plugin-extension-reloader'

export default defineConfig(({mode}) => ({
  plugins: [
    copy({
      targets: [{src: 'src/extension/icons/*', dest: 'dist'}],
      hook: 'writeBundle',
    }),
    extensionReloaderBuildStep('src/extension/manifest.json'),
    extensionReloaderWatchExternal('src/extension/**/*'),
    ...(mode === 'development' ? [extensionReloaderWebSocket({port: 3001})] : []),
  ],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        contentScript: path.resolve(__dirname, './src/extension/contentScript.ts'),
        serviceWorker: path.resolve(__dirname, './src/extension/serviceWorker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return '[name].[ext]'
          }
          return '[name].[ext]'
        },
      },
    },
  },
}))
