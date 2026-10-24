import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'Monster Merge Arena',
        short_name: '머지 아레나',
        description: '3분 동안 몬스터를 합성해 팀을 만들고 몰려오는 적을 막아내는 캐주얼 디펜스',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#0F1729',
        theme_color: '#2B1B5A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // 폰트 서브셋(87개)은 미리 받지 않고 쓰는 것만 캐시
        runtimeCaching: [{ urlPattern: /\.woff2$/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 120 } } }],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/systems/**', 'src/entities/**', 'src/types.ts', 'src/services/SaveService.ts', 'src/services/Analytics.ts', 'src/art/**'],
    },
  },
});
