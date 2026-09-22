import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { StallVendor } from "./types";
import { takePendingRegistration } from "./pendingRegistration";

type AuthState = {
  loading: boolean;
  session: Session | null;
  vendor: StallVendor | null;
  refreshVendor: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [vendor, setVendor] = useState<StallVendor | null>(null);

  async function loadVendor(userId: string, email?: string | null) {
    const { data } = await supabase.from("stall_vendors").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setVendor(data as StallVendor);
      return;
    }

    // No profile row yet. If this is the vendor's first sign-in after confirming their
    // email post-registration, finish creating it now from the details we stashed —
    // this insert is still just the vendor inserting their own row (RLS-enforced), not
    // an admin/back-door path.
    const pending = takePendingRegistration(email);
    if (pending) {
      const { data: inserted } = await supabase
        .from("stall_vendors")
        .insert({
          id: userId,
          stall_name: pending.stall_name,
          contact_person: pending.contact_person,
          phone: pending.phone,
          email: pending.email,
          product_category: pending.product_category,
          products_to_display: pending.products_to_display,
          gstin: pending.gstin,
          pan: pending.pan,
          is_admin: false,
          status: "pending_approval"
        })
        .select()
        .maybeSingle();
      setVendor((inserted as StallVendor) ?? null);
      return;
    }

    setVendor(null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadVendor(data.session.user.id, data.session.user.email);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadVendor(newSession.user.id, newSession.user.email);
      } else {
        setVendor(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshVendor() {
    if (session) await loadVendor(session.user.id, session.user.email);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setVendor(null);
  }

  return (
    <AuthContext.Provider value={{ loading, session, vendor, refreshVendor, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
