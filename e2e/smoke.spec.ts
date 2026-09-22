import { test, expect } from "@playwright/test";

// Critical-route smoke tests — unauthenticated scope only (see playwright.config.ts). These catch
// build/route/render regressions cheaply on every run; they are not a substitute for the manual
// authenticated journeys in the Phase 6 release report.

test.describe("public routes render", () => {
  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in to portal/i })).toBeVisible();
  });

  test("register page renders the first step of the vendor sign-up form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Set up your vendor profile" })).toBeVisible();
    await expect(page.getByText("Business details")).toBeVisible();
  });

  test("forgot-password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("login page has no horizontal overflow at 360px width", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/login");
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);
  });
});

test.describe("unauthorized access redirects to /login", () => {
  const protectedRoutes = ["/", "/events", "/stall", "/redeem", "/payments", "/profile", "/help"];
  for (const route of protectedRoutes) {
    test(`visiting ${route} without a session redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  const adminRoutes = ["/admin", "/admin/events", "/admin/vendors", "/admin/bookings", "/admin/payments"];
  for (const route of adminRoutes) {
    test(`visiting ${route} without a session redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});

test.describe("PWA manifest", () => {
  test("the app serves a web app manifest with the expected identity", async ({ page, request }) => {
    await page.goto("/login");
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const res = await request.get(new URL(manifestHref!, page.url()).toString());
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBe("MN Events Vendor Portal");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThan(0);
  });
});
