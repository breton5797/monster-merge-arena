import { defineConfig, devices } from '@playwright/test';

// E2E: 프로덕션 빌드(vite preview)를 모바일 세로 화면에서 검증
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4179', ...devices['Pixel 7'], launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run build && npx vite preview --port 4179 --strictPort', url: 'http://localhost:4179', timeout: 120_000, reuseExistingServer: false },
});
