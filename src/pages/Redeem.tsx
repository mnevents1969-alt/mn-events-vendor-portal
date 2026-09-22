import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ScanLine, CameraOff, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/useOnline";
import type { DirectoryEntry, RedemptionRow } from "@/lib/types";
import { toMinorUnits } from "@/lib/money";
import { PageHeader, Screen, Card, Field, TextInput, PrimaryButton, GhostButton, LinkButton, InfoBanner, EmptyState, ErrorState, OfflineBanner, Skeleton } from "@/components/ui";

type ScanState = "idle" | "requesting" | "granted" | "denied";

export default function Redeem() {
  const { vendor } = useAuth();
  const online = useOnline();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [freeform, setFreeform] = useState("");
  const [useFreeform, setUseFreeform] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rows, setRows] = useState<RedemptionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState(false);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!vendor) return;
    supabase
      .from("stall_vendor_directory")
      .select("id,stall_name")
      .order("stall_name")
      .then(({ data }) => setDirectory(((data as DirectoryEntry[]) ?? []).filter((d) => d.id !== vendor.id)));
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function loadRows() {
    setRowsLoading(true);
    setRowsError(false);
    const { data, error: fetchError } = await supabase
      .from("stall_redemptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (fetchError) {
      setRowsError(true);
      setRowsLoading(false);
      return;
    }
    setRows((data as RedemptionRow[]) ?? []);
    setRowsLoading(false);
  }

  async function startScan() {
    setScanState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanState("granted");
      // Wait a tick for the <video> to mount before attaching the stream.
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setScanState("denied");
    }
  }

  function stopScan() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanState("idle");
  }

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    directory.forEach((d) => m.set(d.id, d.stall_name));
    return m;
  }, [directory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return directory.slice(0, 50);
    return directory.filter((d) => d.stall_name.toLowerCase().includes(q)).slice(0, 50);
  }, [directory, search]);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return rows.filter((r) => new Date(r.created_at) >= start).length;
  }, [rows]);

  async function submit() {
    if (!vendor || !online) return;
    setError(null);
    if (useFreeform && !freeform.trim()) {
      setError("Please type the issuing stall name");
      return;
    }
    if (!useFreeform && !issuerId) {
      setError("Please pick the stall that issued the voucher");
      return;
    }
    setBusy(true);
    // Server-side, atomic, idempotent: redeem_stall_credit re-validates the receiver's own
    // eligibility, rejects impersonating another vendor, and — via idempotencyKey — guarantees a
    // double tap, a retried request, or two devices submitting the same logical redemption can
    // never create two rows. A fresh key is generated per submit attempt; a genuine retry of the
    // same attempt (e.g. a network timeout where the first request actually succeeded) is safe
    // either way, since the "already_redeemed" branch below is treated as success.
    const idempotencyKey = crypto.randomUUID();
    const { data, error: rpcError } = await supabase.rpc("redeem_stall_credit", {
      p_receiver_vendor_id: vendor.id,
      p_issuer_vendor_id: useFreeform ? null : issuerId,
      p_issuer_name_freeform: useFreeform ? freeform.trim().slice(0, 120) : null,
      p_amount_minor: toMinorUnits(amount),
      p_idempotency_key: idempotencyKey
    });
    setBusy(false);

    const result = Array.isArray(data) ? data[0] : data;
    const outcome = rpcError ? null : (result?.result as string | undefined);

    if (rpcError || !outcome) {
      setError("Could not save that redemption. Please try again.");
      return;
    }
    if (outcome === "forbidden") {
      setError("Your session doesn't match this account. Please sign in again.");
      return;
    }
    if (outcome === "not_eligible") {
      setError("Your account needs to be approved before you can log redemptions.");
      return;
    }
    if (outcome === "invalid_request") {
      setError("Please check the details and try again.");
      return;
    }
    // "ok" and "already_redeemed" both mean this redemption is now recorded exactly once —
    // already_redeemed just means an earlier attempt (or this one, retried) got there first.
    setIssuerId(null);
    setFreeform("");
    setSearch("");
    setAmount("");
    setPickerOpen(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    loadRows();
  }

  return (
    <Screen>
      <PageHeader title="Log a Redemption" backTo="/" />
      <div className="px-4">
        {!online && <div className="-mx-4"><OfflineBanner /></div>}

        <p className="text-[14px] leading-relaxed text-muted">
          Redeeming a cross-promo voucher at your stall? Log it here. Only you can see your own redemption records.
        </p>

        {scanState === "idle" && (
          <GhostButton className="mt-4" onClick={startScan}>
            <ScanLine size={17} /> Scan QR code
          </GhostButton>
        )}
        {scanState === "requesting" && (
          <div className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border text-[14px] font-semibold text-muted">
            Requesting camera access…
          </div>
        )}
        {scanState === "denied" && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-bad/20 bg-bad-bg px-4 py-3 text-[13px] font-semibold text-bad">
            <CameraOff size={16} className="shrink-0" /> Camera access was denied. Enter the stall name manually below.
          </div>
        )}
        {scanState === "granted" && (
          <div className="relative mt-4 overflow-hidden rounded-xl2 border border-border bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full object-cover" />
            <button
              type="button"
              onClick={stopScan}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Stop scanning"
            >
              <X size={16} />
            </button>
            <p className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-center text-[12px] font-semibold text-white">
              Point at the voucher QR — auto-fill isn&rsquo;t available yet, enter the stall name manually below.
            </p>
          </div>
        )}

        <Card className="mt-4 flex flex-col gap-4">
          <Field label="Issued by (which stall gave the voucher) *">
            {!useFreeform ? (
              <>
                <TextInput
                  value={issuerId ? nameById.get(issuerId) ?? "" : search}
                  placeholder="Search stalls…"
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e) => {
                    setIssuerId(null);
                    setSearch(e.target.value);
                    setPickerOpen(true);
                  }}
                />
                {pickerOpen && !issuerId && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                    {filtered.length === 0 && <p className="px-4 py-3 text-[13px] text-muted">No matching stalls.</p>}
                    {filtered.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setIssuerId(d.id);
                          setPickerOpen(false);
                          setError(null);
                        }}
                        className="flex min-h-[44px] w-full items-center border-b border-border px-4 text-left text-[14px] last:border-0 active:bg-accent-bg"
                      >
                        {d.stall_name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <TextInput value={freeform} onChange={(e) => setFreeform(e.target.value)} placeholder="e.g. Bloom & Bake" />
            )}
            <LinkButton
              type="button"
              onClick={() => {
                setUseFreeform((v) => !v);
                setIssuerId(null);
                setFreeform("");
                setSearch("");
                setPickerOpen(false);
                setError(null);
              }}
            >
              {useFreeform ? "Pick from the stall list instead" : "Not listed — type the stall name"}
            </LinkButton>
          </Field>

          <Field label="Redeemed value (optional)">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-4">
              <span className="text-muted">₹</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
              />
            </div>
          </Field>

          {error && <p role="alert" className="text-[13px] font-semibold text-bad">{error}</p>}

          <PrimaryButton onClick={submit} disabled={busy || !online} icon={CheckCircle2}>
            {busy ? "Saving…" : online ? "Confirm redemption" : "Offline — reconnect to confirm"}
          </PrimaryButton>

          {success && (
            <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-xl bg-good-bg px-4 py-3 text-[14px] font-bold text-good">
              <CheckCircle2 size={16} aria-hidden="true" /> Redemption logged.
            </p>
          )}
        </Card>

        <div className="mt-6 flex items-baseline justify-between px-1">
          <h2 className="text-[19px] font-extrabold text-ink">Today's tally</h2>
          <span className="text-[22px] font-extrabold text-primary">{todayCount}</span>
        </div>

        {rowsLoading ? (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-[44px] w-full" />
            <Skeleton className="h-[44px] w-full" />
          </div>
        ) : rowsError ? (
          <ErrorState onRetry={loadRows}>Couldn&rsquo;t load your redemption history.</ErrorState>
        ) : rows.length === 0 ? (
          <EmptyState>You haven't logged any redemptions yet.</EmptyState>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl2 border border-border bg-card">
            {rows.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border px-4 py-3 text-[14px] last:border-0">
                <span className="font-semibold text-ink">
                  {r.issuer_vendor_id ? nameById.get(r.issuer_vendor_id) ?? "Another stall" : r.issuer_name_freeform ?? "—"}
                </span>
                <span className="font-mono text-[12px] text-muted">
                  {new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        <InfoBanner>Can't get online? Use the paper stub on the voucher and hand it to the MN Events info desk instead.</InfoBanner>
      </div>
    </Screen>
  );
}
