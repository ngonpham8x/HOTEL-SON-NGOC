import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function offlineApp(): Plugin {
  return {
    name: 'hotel-offline-app', apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter(name => !name.endsWith('.map')).map(name => `/${name}`);
      const cache = `son-ngoc-${Date.now()}`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(['/', '/index.html', '/manifest.json', '/icon.svg', '/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-152.png', '/apple-touch-icon-167.png', '/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png', ...assets])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('son-ngoc-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});` });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), offlineApp()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.review/**'] },
    },
  };
});
