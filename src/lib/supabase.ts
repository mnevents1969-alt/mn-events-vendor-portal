import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.error("Missing Supabase env vars — check .env");
}

const REMEMBER_KEY = "mne_remember_me";

/**
 * Call before signInWithPassword so the auth token lands in the right backing
 * store: localStorage when "Keep me signed in" is checked (survives browser
 * restarts), sessionStorage when it isn't (cleared when the tab/browser closes).
 */
export function setRememberPreference(remember: boolean) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // localStorage unavailable (private mode, etc.) — default to session-only below.
  }
}

function rememberMe(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return false;
  }
}

// GoTrue reads its storage adapter once at construction, so we hand it a proxy
// that picks the real backing store per-call based on the remember preference.
const dynamicStorage = {
  getItem: (key: string) => (rememberMe() ? window.localStorage : window.sessionStorage).getItem(key),
  setItem: (key: string, value: string) => (rememberMe() ? window.localStorage : window.sessionStorage).setItem(key, value),
  removeItem: (key: string) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "mne-vendor-auth",
    storage: dynamicStorage
  }
});
