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
            if (
              id.includes('/node_modules/@codemirror/lang-') ||
              id.includes('/node_modules/@codemirror/language-data') ||
              id.includes('/node_modules/@codemirror/legacy-modes') ||
              id.includes('/node_modules/@lezer/')
            ) {
              // 언어 파서는 language-data가 dynamic import로 lazy-load하므로 기본 분할에 맡긴다
              return undefined;
            }
            // 이 목록은 pixi.js 의존성 트리를 추적한다 — pixi 업그레이드 시 재점검 필요
            if (
              id.includes('/node_modules/pixi.js/') ||
              id.includes('/node_modules/@pixi/') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/earcut/') ||
              id.includes('/node_modules/eventemitter3/') ||
              id.includes('/node_modules/tiny-lru/') ||
              id.includes('/node_modules/ismobilejs/') ||
              id.includes('/node_modules/gifuct-js/') ||
              id.includes('/node_modules/parse-svg-path/') ||
              id.includes('/node_modules/js-binary-schema-parser/') ||
              id.includes('/node_modules/@xmldom/')
            ) {
              // pixi/d3는 GraphView가 dynamic import로만 참조하므로 기본 분할에 맡겨 그래프 청크로 lazy 분리
              return undefined;
            }
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
