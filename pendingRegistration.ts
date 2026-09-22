// Supabase Auth may require email confirmation before a session exists, which means we
// can't self-insert the stall_vendors profile row right after signUp() (RLS requires
// auth.uid(), which only exists once a session exists). We stash the collected profile
// fields locally and finish creating the row the first time the vendor actually signs in
// with a live session — see AuthProvider.loadVendor in auth.tsx.
const KEY = "mne_pending_vendor_registration";

export type PendingVendorProfile = {
  email: string;
  stall_name: string;
  contact_person: string | null;
  phone: string | null;
  product_category: string | null;
  products_to_display: string | null;
  gstin: string | null;
  pan: string | null;
};

export function savePendingRegistration(profile: PendingVendorProfile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Private mode / storage unavailable — worst case the vendor re-enters details after
    // confirming their email and finds an empty profile to fill in from Profile.tsx.
  }
}

export function takePendingRegistration(email: string | null | undefined): PendingVendorProfile | null {
  if (!email) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingVendorProfile;
    if (!parsed?.email || parsed.email.toLowerCase() !== email.toLowerCase()) return null;
    window.localStorage.removeItem(KEY);
    return parsed;
  } catch {
    return null;
  }
}
