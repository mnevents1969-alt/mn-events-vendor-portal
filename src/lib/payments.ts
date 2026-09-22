// Client for the Phase 5 payment-security backend (PIN setup/verify/reset/status and
// server-created checkout orders). These endpoints are NOT part of this app's own deployment —
// they run as server routes in the shared backend's companion app, since this vendor PWA is a
// static frontend with no server runtime of its own to hold a service-role key or payment-
// provider secrets. See VITE_PAYMENTS_API_BASE below and the Phase 5 configuration checklist.
//
// Redemption does not go through this module — Redeem.tsx calls the `redeem_stall_credit`
// database function directly via supabase.rpc(), since that function is already fully
// server-side (SECURITY DEFINER, atomic, idempotent) and needs no separate HTTP layer.
//
// The PIN "unlock token" returned by pinVerify must be held only in memory by the caller
// (component state) — never written to localStorage or sessionStorage. This module itself never
// persists it either; it only passes it through.

import { supabase } from "./supabase";

const API_BASE = (import.meta.env.VITE_PAYMENTS_API_BASE as string | undefined)?.replace(/\/+$/, "");

export type PinStatus = {
  configured: boolean;
  locked: boolean;
  lockedUntil: string | null;
  lastVerifiedAt?: string | null;
};

export type PaymentOrderPublic = {
  id: string;
  applicationId: string;
  amountMinor: number;
  currency: string;
  status: string;
  providerOrderId: string | null;
};

async function postPayments(path: string, body: Record<string, unknown>): Promise<{ status: number; data: any }> {
  if (!API_BASE) {
    return { status: 500, data: { error: "Payments backend is not configured for this app." } };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  // Status 0 (not 401) — this is a purely local, pre-flight guard, and the server itself uses 401
  // for "incorrect PIN" and "unlock token missing/expired". Reusing 401 here would make callers'
  // status-to-outcome mapping (see pinVerify/createCheckoutOrder below) misclassify "you're not
  // signed in" as one of those server-driven states.
  if (!token) return { status: 0, data: { error: "Please sign in again." } };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch {
    return { status: 0, data: { error: "Could not reach the payments service. Check your connection." } };
  }

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON error body — fall through with an empty object; status code still drives the UI.
  }
  return { status: res.status, data };
}

export async function pinStatus(): Promise<PinStatus> {
  const { data } = await postPayments("payment-pin", { action: "status" });
  return data as PinStatus;
}

export type PinSetupResult = { ok: true } | { ok: false; error: string };

export async function pinSetup(pin: string, confirmPin: string, password: string): Promise<PinSetupResult> {
  const { status, data } = await postPayments("payment-pin", { action: "setup", pin, confirmPin, password });
  return status === 200 ? { ok: true } : { ok: false, error: (data.error as string) ?? "Could not set your PIN." };
}

export async function pinReset(pin: string, confirmPin: string, password: string): Promise<PinSetupResult> {
  const { status, data } = await postPayments("payment-pin", { action: "reset", pin, confirmPin, password });
  return status === 200 ? { ok: true } : { ok: false, error: (data.error as string) ?? "Could not reset your PIN." };
}

export type PinVerifyResult =
  | { outcome: "success"; unlockToken: string; expiresInSeconds: number }
  | { outcome: "incorrect"; error: string; attemptsRemaining: number | null }
  | { outcome: "locked"; error: string; lockedUntil: string | null }
  | { outcome: "error"; error: string };

export async function pinVerify(pin: string): Promise<PinVerifyResult> {
  const { status, data } = await postPayments("payment-pin", { action: "verify", pin });
  if (status === 200) {
    return { outcome: "success", unlockToken: data.unlockToken as string, expiresInSeconds: data.expiresInSeconds as number };
  }
  if (status === 423) {
    return { outcome: "locked", error: (data.error as string) ?? "Too many attempts.", lockedUntil: (data.lockedUntil as string) ?? null };
  }
  if (status === 401) {
    return {
      outcome: "incorrect",
      error: (data.error as string) ?? "Incorrect PIN.",
      attemptsRemaining: (data.attemptsRemaining as number) ?? null
    };
  }
  return { outcome: "error", error: (data.error as string) ?? "Something went wrong. Please try again." };
}

export type CheckoutResult =
  | { outcome: "created"; configured: true; testMode: boolean; order: PaymentOrderPublic; provider: { name: string; keyId: string | null } }
  | { outcome: "existing"; order: PaymentOrderPublic }
  | { outcome: "not_configured"; error: string }
  | { outcome: "unlock_required"; error: string }
  | { outcome: "error"; error: string };

export async function createCheckoutOrder(args: {
  applicationId: string;
  unlockToken: string;
  idempotencyKey: string;
  online: boolean;
}): Promise<CheckoutResult> {
  const { status, data } = await postPayments("payment-checkout", { action: "create_order", ...args });

  if (status === 503) return { outcome: "not_configured", error: (data.error as string) ?? "Online payments are not yet available." };
  if (status === 401) return { outcome: "unlock_required", error: (data.error as string) ?? "Please verify your payment PIN again." };
  if (status !== 200 || !data.ok) return { outcome: "error", error: (data.error as string) ?? "Could not start payment. Please try again." };

  if (data.configured) {
    return {
      outcome: "created",
      configured: true,
      testMode: !!data.testMode,
      order: data.order as PaymentOrderPublic,
      provider: data.provider as { name: string; keyId: string | null }
    };
  }
  return { outcome: "existing", order: data.order as PaymentOrderPublic };
}
