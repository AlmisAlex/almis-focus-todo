import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineShell } from './build/offlineShell.ts';
import { PREVIEW_HEADERS } from './build/securityHeaders.ts';

export default defineConfig({
  plugins: [react(), offlineShell()],
  build: {
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: { strictPort: true },
  preview: { strictPort: true, headers: PREVIEW_HEADERS },
});
