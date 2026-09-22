import { defineConfig, devices } from "@playwright/test";

// Smoke-test scope only (see Phase 6 report): this sandbox — and CI generally, without live
// Supabase test credentials — has no way to complete a real sign-in, so these tests are limited
// to what's reachable unauthenticated: public routes render, and protected/admin routes redirect
// to /login rather than flashing protected content. Deeper authenticated journeys are covered by
// the manual browser-journey checklist in the Phase 6 report, not automated here.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    // This sandbox ships a pinned Chromium build (see /opt/pw-browsers) that predates the
    // revision @playwright/test would otherwise try to download — point at it directly rather
    // than running `playwright install` (blocked/unnecessary here; see environment notes).
    launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 800 }, userAgent: devices["Pixel 7"].userAgent } }
  ],
  webServer: {
    // Built + previewed, not `vite dev` — the PWA manifest link and service worker are only
    // injected by vite-plugin-pwa into a production build (devOptions.enabled is off by
    // default), and a production build is what real users actually get.
    command: "npm run build && npm run preview -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
