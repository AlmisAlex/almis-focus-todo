import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Generate a reproducible shell cache. The allowlist excludes all user data. */
export function offlineShell(): Plugin {
  return {
    name: 'focus-offline-shell',
    apply: 'build',
    closeBundle() {
      mkdirSync('dist/pdf/wasm', { recursive: true });
      for (const directory of ['cmaps', 'standard_fonts', 'iccs'])
        cpSync(`node_modules/pdfjs-dist/${directory}`, `dist/pdf/${directory}`, {
          recursive: true,
        });
      cpSync(
        'node_modules/pdfjs-dist/wasm/openjpeg_nowasm_fallback.js',
        'dist/pdf/wasm/openjpeg_nowasm_fallback.js',
      );
      cpSync('node_modules/pdfjs-dist/LICENSE', 'dist/pdf/LICENSE');
      cpSync('node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG', 'dist/pdf/wasm/LICENSE_OPENJPEG');
      const paths = readdirSync('dist', { recursive: true })
        .filter(
          (path): path is string =>
            typeof path === 'string' &&
            /\.(html|css|m?js|woff2?|ttf|pfb|bcmap|icc|png|svg|webp|webmanifest)$/.test(path) &&
            path !== 'sw.js',
        )
        .sort();
      const revision = createHash('sha256')
        .update(
          paths
            .map(
              (path) =>
                `${path}:${createHash('sha256')
                  .update(readFileSync('dist/' + path))
                  .digest('hex')}`,
            )
            .join('\n'),
        )
        .digest('hex')
        .slice(0, 16);
      const urls = paths.map((path) => '/' + path);
      writeFileSync(
        'dist/sw.js',
        `
const CACHE = 'focus-shell-${revision}';
const URLS = ${JSON.stringify(urls)};
const IMMUTABLE_ASSET = new RegExp('^/assets/[a-zA-Z0-9_.-]+[.](?:m?js|css)$');

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter(key => /^focus-shell-[a-f0-9]{16}$/.test(key) && key !== CACHE);
    // Retain two previous shells for old open pages. Never touch other caches.
    await Promise.all(previous.slice(0, Math.max(0, previous.length - 2)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_FOCUS_UPDATE') self.skipWaiting();
});
async function retainedAsset(path) {
  const keys = (await caches.keys()).filter(key => /^focus-shell-[a-f0-9]{16}$/.test(key));
  for (const key of [CACHE, ...keys.filter(key => key !== CACHE).reverse()]) {
    const response = await (await caches.open(key)).match(path);
    if (response) return response;
  }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
    return;
  }
  if (URLS.includes(url.pathname) || IMMUTABLE_ASSET.test(url.pathname)) {
    event.respondWith(retainedAsset(url.pathname).then(response => response || fetch(event.request)));
  }
});
`,
      );
    },
  };
}
