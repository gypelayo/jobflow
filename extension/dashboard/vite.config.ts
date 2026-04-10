import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';

const extensionRoot = resolve(__dirname, '..');
const outDir = resolve(extensionRoot, 'dist');

/**
 * Copies background.js, content.js, updated manifests, icons, and sql-wasm.wasm
 * into dist/ so that dist/ is a self-contained, loadable browser extension.
 */
function copyExtensionFiles(): Plugin {
  return {
    name: 'copy-extension-files',
    writeBundle() {
      // Copy scripts that stay as plain JS
      copyFileSync(
        resolve(extensionRoot, 'background.js'),
        resolve(outDir, 'background.js'),
      );
      copyFileSync(
        resolve(extensionRoot, 'content.js'),
        resolve(outDir, 'content.js'),
      );

      // Copy options.html
      const optionsSource = resolve(extensionRoot, 'options.html');
      if (existsSync(optionsSource)) {
        copyFileSync(optionsSource, resolve(outDir, 'options.html'));
      }

      // Copy icons directory recursively
      const iconsSource = resolve(extensionRoot, 'icons');
      const iconsTarget = resolve(outDir, 'icons');
      if (existsSync(iconsSource)) {
        if (!existsSync(iconsTarget)) {
          mkdirSync(iconsTarget, { recursive: true });
        }
        
        // Copy icon directories and files
        const iconSizes = ['16', '48', '128'];
        iconSizes.forEach(size => {
          const sizeDirSource = resolve(iconsSource, size);
          const sizeDirTarget = resolve(iconsTarget, size);
          if (existsSync(sizeDirSource)) {
            if (!existsSync(sizeDirTarget)) {
              mkdirSync(sizeDirTarget, { recursive: true });
            }
            const iconSource = resolve(sizeDirSource, 'icon.png');
            if (existsSync(iconSource)) {
              copyFileSync(iconSource, resolve(sizeDirTarget, 'icon.png'));
            }
          }
        });
        
        // Copy main icon files
        const mainIcons = ['jobflow-icon.svg', 'README.md'];
        mainIcons.forEach(file => {
          const fileSource = resolve(iconsSource, file);
          if (existsSync(fileSource)) {
            copyFileSync(fileSource, resolve(iconsTarget, file));
          }
        });
      } else {
        console.warn('WARNING: Icons directory not found at', iconsSource);
      }

      // Copy sql-wasm.wasm into assets/
      const assetsDir = resolve(outDir, 'assets');
      if (!existsSync(assetsDir)) {
        mkdirSync(assetsDir, { recursive: true });
      }
      const wasmSource = resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
      if (existsSync(wasmSource)) {
        copyFileSync(wasmSource, resolve(assetsDir, 'sql-wasm.wasm'));
      } else {
        console.warn('WARNING: sql-wasm.wasm not found at', wasmSource);
      }

      // Firefox MV2 manifest
      const firefoxManifest = JSON.parse(
        readFileSync(resolve(extensionRoot, 'manifest.json'), 'utf-8'),
      );
      // popup.html is already at dist root — no path change needed
      delete firefoxManifest.options_ui;
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        JSON.stringify(firefoxManifest, null, 2),
      );

      // Chrome MV3 manifest
      const chromeManifest = JSON.parse(
        readFileSync(resolve(extensionRoot, 'manifest_chrome.json'), 'utf-8'),
      );
      delete chromeManifest.options_ui;
      writeFileSync(
        resolve(outDir, 'manifest_chrome.json'),
        JSON.stringify(chromeManifest, null, 2),
      );
    },
  };
}

/**
 * Strip the `crossorigin` attribute from <script> and <link> tags in
 * emitted HTML. Extension pages are not served over HTTP so CORS
 * attributes are unnecessary and can prevent Firefox from loading
 * the resources.
 */
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig({
  plugins: [preact(), copyExtensionFiles(), stripCrossorigin()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks: {
          'chart': ['chart.js'],
          'pdf': ['jspdf'],
          'sql': ['sql.js'],
        },
      },
    },
  },
});
