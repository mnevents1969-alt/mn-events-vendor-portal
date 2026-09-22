import { supabase } from "@/lib/supabase";

const API_BASE = (import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined)?.replace(/\/+$/, "");

export type RefundInitiationResult = { ok: true; configured: boolean; note?: string } | { ok: false; error: string };

/**
 * Admin-only: initiates a provider refund for a paid `payment_orders` row (Phase 5 part B).
 * Safe to call even when no provider is configured — the server still authoritatively
 * transitions the order to `refund_pending`, and reports `configured: false` so the caller can
 * fall back to (or simply continue with) manual confirmation, exactly like the rest of this
 * refund workflow already does. The server independently re-checks that the caller is an admin
 * (via `is_caller_admin`) — this client-side call is not itself a trust boundary.
 */
export async function initiateRefund(orderId: string): Promise<RefundInitiationResult> {
  if (!API_BASE) return { ok: false, error: "Payments backend is not configured." };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "Please sign in again." };
  try {
    const res = await fetch(`${API_BASE}/payment-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "refund", orderId })
    });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok || !data.ok) return { ok: false, error: (data.error as string) ?? "Could not initiate refund." };
    return { ok: true, configured: !!data.configured, note: data.note as string | undefined };
  } catch {
    return { ok: false, error: "Could not reach the payments service." };
  }
}

/** Looks up the most recent `paid` payment_orders row for an application, if any. */
export async function findPaidOrder(applicationId: string): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("payment_orders")
    .select("id")
    .eq("application_id", applicationId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .maybeSingle();
  return data as { id: string } | null;
}
