import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CreditCard, FileText, Download, ShieldCheck, Unlock, RotateCcw, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/useOnline";
import type { ApplicationRow } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { listVendorFiles, signedUrl } from "@/lib/storage";
import { pinStatus, pinSetup, pinReset, pinVerify, createCheckoutOrder, type PinStatus } from "@/lib/payments";
import { PageHeader, Screen, Card, Badge, PrimaryButton, GhostButton, LinkButton, InfoBanner, EmptyState, Skeleton } from "@/components/ui";

type DocLink = { name: string; path: string; url: string | null };
type PinMode = "loading" | "create" | "enter" | "reset";

// Held in memory only for this component's lifetime — never localStorage/sessionStorage, per
// the Phase 5 requirement. Lost on refresh by design; the vendor re-enters their PIN then.
type UnlockState = { token: string; expiresAtMs: number };

function msRemaining(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Payments() {
  const { vendor } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();

  const [pinInfo, setPinInfo] = useState<PinStatus | null>(null);
  const [mode, setMode] = useState<PinMode>("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  const unlockRef = useRef<UnlockState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [docs, setDocs] = useState<DocLink[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  async function loadPinStatus() {
    setMode("loading");
    try {
      const info = await pinStatus();
      setPinInfo(info);
      setLockedUntil(info.locked ? info.lockedUntil : null);
      setMode(info.configured ? "enter" : "create");
    } catch {
      setStatus("Could not reach the payments service. Please try again.");
      setMode("enter");
    }
  }

  useEffect(() => {
    if (!vendor) return;
    loadPinStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  // Tick once a second while locked so the countdown updates, and clear the lock automatically
  // once time is up (a fresh verify attempt will confirm with the server either way).
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil && msRemaining(lockedUntil) === 0) setLockedUntil(null);
  }, [nowTick, lockedUntil]);

  useEffect(() => {
    if (!unlocked || !vendor) return;
    setAppsLoading(true);
    supabase
      .from("applications")
      .select("*, events(*)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setApps((data as unknown as ApplicationRow[]) ?? []);
        setAppsLoading(false);
      });

    setDocsLoading(true);
    listVendorFiles("invoices-receipts", vendor.id).then(async (files) => {
      const withUrls = await Promise.all(
        files.map(async (f) => ({ name: f.name, path: f.path, url: await signedUrl("invoices-receipts", f.path) }))
      );
      setDocs(withUrls);
      setDocsLoading(false);
    });
  }, [unlocked, vendor]);

  function resetFormFields() {
    setPin("");
    setConfirmPin("");
    setPassword("");
  }

  async function submitSetupOrReset() {
    if (!/^\d{6}$/.test(pin)) {
      setStatus("PIN must be exactly 6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setStatus("PINs do not match.");
      return;
    }
    if (!password) {
      setStatus("Enter your account password to confirm this change.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = mode === "reset" ? await pinReset(pin, confirmPin, password) : await pinSetup(pin, confirmPin, password);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    resetFormFields();
    setStatus("PIN saved. Enter it below to continue.");
    setMode("enter");
    await loadPinStatus();
  }

  async function submitVerify() {
    if (!/^\d{6}$/.test(pin)) {
      setStatus("Enter your 6-digit PIN.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = await pinVerify(pin);
    setBusy(false);

    if (result.outcome === "success") {
      unlockRef.current = { token: result.unlockToken, expiresAtMs: Date.now() + result.expiresInSeconds * 1000 };
      setUnlocked(true);
      setPin("");
      setAttemptsRemaining(null);
      return;
    }
    if (result.outcome === "locked") {
      setLockedUntil(result.lockedUntil);
      setStatus(result.error);
      setPin("");
      return;
    }
    if (result.outcome === "incorrect") {
      setAttemptsRemaining(result.attemptsRemaining);
      setStatus(
        result.attemptsRemaining != null ? `${result.error} ${result.attemptsRemaining} attempt(s) remaining.` : result.error
      );
      setPin("");
      return;
    }
    setStatus(result.error);
  }

  function relock(message?: string) {
    unlockRef.current = null;
    setUnlocked(false);
    setMode("enter");
    if (message) setStatus(message);
  }

  async function payNow(app: ApplicationRow) {
    const unlock = unlockRef.current;
    if (!unlock || Date.now() >= unlock.expiresAtMs) {
      relock("Your payment session expired — please verify your PIN again to continue.");
      return;
    }
    if (!online) {
      setPayMessage("You're offline — reconnect to pay.");
      return;
    }
    setPayingId(app.id);
    setPayMessage(null);
    const result = await createCheckoutOrder({
      applicationId: app.id,
      unlockToken: unlock.token,
      idempotencyKey: crypto.randomUUID(),
      online
    });
    setPayingId(null);

    if (result.outcome === "unlock_required") {
      relock(result.error);
      return;
    }
    if (result.outcome === "not_configured") {
      setPayMessage("Online payments are not yet available for this event — contact MN Events to arrange payment.");
      return;
    }
    if (result.outcome === "error") {
      setPayMessage(result.error);
      return;
    }
    if (result.outcome === "existing") {
      setPayMessage("A payment for this booking is already in progress.");
      return;
    }
    // outcome === "created": a real, provider-backed order now exists server-side. The actual
    // charge only becomes final once the provider's signed webhook confirms it — this UI never
    // marks anything paid on its own. Launching the provider's checkout widget here would use
    // result.order.providerOrderId + result.provider.keyId (Razorpay Checkout.js), gated on
    // result.configured, with a visible "TEST MODE" badge when result.testMode is true. Left as
    // a stub until real provider credentials make this path reachable — see the Phase 5 report.
    setPayMessage(
      result.testMode
        ? "TEST MODE — order created. Provider checkout UI is not wired up in test mode."
        : "Order created. Provider checkout should launch here."
    );
  }

  const dueApps = apps.filter((a) => a.payment_status === "unpaid" && a.stall_fee_minor);
  const dueMinor = dueApps.reduce((sum, a) => sum + Number(a.stall_fee_minor ?? 0), 0);
  const hasRefund = apps.some((a) => a.payment_status === "refunded");
  const isLocked = !!lockedUntil && msRemaining(lockedUntil) > 0;

  return (
    <Screen>
      <PageHeader title="Payments" backTo="/" />
      <div className="px-4">
        {!unlocked ? (
          <Card className="mt-2 flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-bg text-primary">
              {isLocked ? <KeyRound size={22} /> : <Lock size={22} />}
            </span>
            <h2 className="text-[19px] font-extrabold text-ink">
              {mode === "create" ? "Set Up Payments PIN" : mode === "reset" ? "Reset Your PIN" : "Unlock Payments"}
            </h2>

            {mode === "loading" ? (
              <Skeleton className="h-[52px] w-[220px]" />
            ) : isLocked ? (
              <>
                <p className="max-w-[260px] text-[13px] text-muted">
                  Too many incorrect attempts. Try again in <span className="font-bold text-ink">{formatCountdown(msRemaining(lockedUntil))}</span>.
                </p>
              </>
            ) : (
              <>
                <p className="max-w-[240px] text-[13px] text-muted">
                  {mode === "create"
                    ? "First time here — set a 6-digit PIN to protect your payment records."
                    : mode === "reset"
                    ? "Enter your account password and choose a new 6-digit PIN."
                    : "Enter your 6-digit payment PIN to view transactions, invoices and receipts."}
                </p>
                <div className="mt-2 w-full max-w-[220px]">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="min-h-[52px] w-full rounded-xl border border-border bg-bg text-center text-[22px] font-bold tracking-[6px] text-ink outline-none focus:border-primary"
                  />
                  {(mode === "create" || mode === "reset") && (
                    <>
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Confirm PIN"
                        className="mt-3 min-h-[52px] w-full rounded-xl border border-border bg-bg text-center text-[22px] font-bold tracking-[6px] text-ink outline-none focus:border-primary"
                      />
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Account password"
                        className="mt-3 min-h-[48px] w-full rounded-xl border border-border bg-bg px-4 text-[14px] text-ink outline-none focus:border-primary"
                      />
                    </>
                  )}
                </div>
                {status && <p role="alert" className="max-w-[260px] text-[13px] font-semibold text-bad">{status}</p>}
                <PrimaryButton
                  className="mt-2 max-w-[220px]"
                  icon={busy ? Loader2 : Unlock}
                  disabled={busy || !online}
                  onClick={mode === "enter" ? submitVerify : submitSetupOrReset}
                >
                  {busy
                    ? "Please wait…"
                    : mode === "create"
                    ? "Set PIN"
                    : mode === "reset"
                    ? "Save new PIN"
                    : "Unlock payments"}
                </PrimaryButton>
                {mode === "enter" && (
                  <LinkButton
                    type="button"
                    onClick={() => {
                      resetFormFields();
                      setStatus(null);
                      setAttemptsRemaining(null);
                      setMode("reset");
                    }}
                  >
                    Forgot your PIN?
                  </LinkButton>
                )}
                {mode === "reset" && (
                  <LinkButton
                    type="button"
                    onClick={() => {
                      resetFormFields();
                      setStatus(null);
                      setMode("enter");
                    }}
                  >
                    Back to unlock
                  </LinkButton>
                )}
                <GhostButton type="button" className="mt-1 max-w-[220px]" onClick={() => navigate("/")}>
                  Cancel
                </GhostButton>
              </>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck size={13} /> Your PIN is never stored on this device — only a short-lived unlock is kept in memory.
            </p>
          </Card>
        ) : appsLoading ? (
          <div className="mt-2 flex flex-col gap-3">
            <Skeleton className="h-[110px] w-full" />
            <Skeleton className="h-[70px] w-full" />
            <Skeleton className="h-[70px] w-full" />
          </div>
        ) : (
          <>
            <div className="mt-2 rounded-xl2 bg-gradient-to-br from-[#5B1640] to-[#7A2154] p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">Current balance</span>
                <Badge kind="neutral">Protected</Badge>
              </div>
              <p className="mt-2 text-[30px] font-extrabold">{formatMoney(dueMinor)} due</p>
              <p className="text-[13px] text-white/80">
                {dueMinor === 0 ? "No pending payments" : "Pay a specific booking below, or contact MN Events for help"}
              </p>
            </div>

            {hasRefund && (
              <div className="mt-3 flex items-center gap-2 rounded-xl2 border border-good/20 bg-good-bg px-4 py-3 text-[13px] font-semibold text-good">
                <RotateCcw size={15} /> A refund has been recorded on one of your applications — see history below.
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">Recent transactions</h2>
            </div>

            {apps.length === 0 ? (
              <EmptyState>No events opted into yet — join one from Browse Events.</EmptyState>
            ) : (
              <div className="mt-2 flex flex-col gap-3">
                {apps.map((a) => (
                  <Card key={a.id} className="flex flex-col gap-2 !p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-bold text-ink">{a.events?.title}</p>
                        <p className="text-[12px] text-muted">
                          {a.events?.starts_at &&
                            new Date(a.events.starts_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-extrabold text-ink">{formatMoney(a.stall_fee_minor, a.currency)}</span>
                        <Badge kind={a.payment_status === "paid" ? "good" : a.payment_status === "refunded" ? "neutral" : "warn"}>
                          {a.payment_status === "paid" ? "Paid" : a.payment_status === "refunded" ? "Refunded" : "Unpaid"}
                        </Badge>
                      </div>
                    </div>
                    {a.payment_status === "unpaid" && a.stall_fee_minor && a.stage === "approved" && (
                      <PrimaryButton
                        className="!min-h-[38px] self-end !px-4 !text-[12px]"
                        icon={payingId === a.id ? Loader2 : CreditCard}
                        disabled={payingId !== null || !online}
                        onClick={() => payNow(a)}
                      >
                        {payingId === a.id ? "Starting…" : "Pay now"}
                      </PrimaryButton>
                    )}
                  </Card>
                ))}
              </div>
            )}
            {payMessage && <p role="status" aria-live="polite" className="mt-2 text-center text-[12px] text-muted">{payMessage}</p>}
            {!online && <p className="mt-2 text-center text-[12px] font-semibold text-bad">You're offline — payment is disabled until you reconnect.</p>}

            <p className="pb-2 pt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Documents</p>
            {docsLoading ? (
              <Skeleton className="h-[52px] w-full" />
            ) : docs.length === 0 ? (
              <GhostButton disabled>
                <FileText size={16} /> No invoices or receipts yet
              </GhostButton>
            ) : (
              <div className="flex flex-col gap-2">
                {docs.map((d) => (
                  <a
                    key={d.path}
                    href={d.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-border px-4 text-[14px] font-semibold text-ink ${
                      d.url ? "" : "pointer-events-none opacity-50"
                    }`}
                  >
                    <FileText size={16} className="text-primary" />
                    <span className="flex-1 truncate">{d.name}</span>
                    <Download size={15} />
                  </a>
                ))}
              </div>
            )}

            <InfoBanner>Payment records stay PIN protected — this unlock only applies to this device and clears automatically.</InfoBanner>
          </>
        )}
      </div>
    </Screen>
  );
}
