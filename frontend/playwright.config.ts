// DEV ONLY: layout check of the main screens (npm run check:ui). Needs the backend (:3200) and
// Vite (:5174) running with demo data (npm run demo:poll). Not part of the production build.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', locale: 'hi-IN', timezoneId: 'Asia/Kolkata' },
  projects: [
    { name: 'phone-360', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1366', use: { viewport: { width: 1366, height: 768 } } },
  ],
});
