import { supabase } from "@/lib/supabase";

// A lightweight step-up check for destructive/high-impact admin actions. Supabase's anon-key
// client has no dedicated "recent auth" API, so this re-verifies the admin's password against
// Supabase Auth (without disturbing the existing session) and remembers, in memory only
// (never persisted), that a check succeeded within the last few minutes. Reloading the page
// or closing the tab clears it — that's intentional, it's meant to be short-lived.
const REAUTH_WINDOW_MS = 5 * 60 * 1000;
let lastReauthAt = 0;

export function hasRecentReauth(): boolean {
  return Date.now() - lastReauthAt < REAUTH_WINDOW_MS;
}

export async function verifyPassword(email: string, password: string): Promise<string | null> {
  // signInWithPassword against an already-authenticated client re-validates credentials and
  // refreshes the session in place — it does not sign out or switch users if it fails.
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "Incorrect password.";
  lastReauthAt = Date.now();
  return null;
}

export function clearReauth() {
  lastReauthAt = 0;
}
