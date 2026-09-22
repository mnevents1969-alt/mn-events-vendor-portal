import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library doesn't auto-clean between tests under Vitest the way it does under
// Jest's globals — do it explicitly so one test's DOM never leaks into the next.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia (used by the app's reduced-motion / theme checks) or
// scrollIntoView (used by some picker/list components) — stub both so components that touch
// them don't throw in tests that never asserted on them in the first place.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
