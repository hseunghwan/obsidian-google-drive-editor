import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), chromeOAuthManifestPlugin(env.VITE_GOOGLE_OAUTH_CLIENT_ID)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          workspace: resolve(__dirname, 'index.html'),
          background: resolve(__dirname, 'src/extension/background.ts')
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (id.includes('/node_modules/@codemirror/')) {
              return 'codemirror';
            }
            if (id.includes('/node_modules/')) {
              return 'vendor';
            }
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      fileParallelism: false,
      setupFiles: ['src/test/setup.ts'],
      testTimeout: 20000
    }
  };
});

function chromeOAuthManifestPlugin(oauthClientId: string | undefined): Plugin {
  const configuredClientId = oauthClientId?.trim();

  return {
    name: 'chrome-oauth-manifest',
    apply: 'build',
    closeBundle() {
      if (!configuredClientId) {
        this.warn(
          'VITE_GOOGLE_OAUTH_CLIENT_ID is not set; dist/manifest.json will keep the OAuth placeholder.'
        );
        return;
      }

      const manifestPath = resolve(__dirname, 'dist/manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        oauth2?: { client_id?: string };
      };
      manifest.oauth2 ??= {};
      manifest.oauth2.client_id = configuredClientId;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  };
}
