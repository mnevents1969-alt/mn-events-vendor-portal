import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Send, Building2, CheckCircle2, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/useOnline";
import type { EventRow, ApplicationRow } from "@/lib/types";
import { PageHeader, Screen, Card, Field, TextInput, Select, PrimaryButton, GhostButton, Badge, EmptyState, ErrorState, Skeleton, OfflineBanner } from "@/components/ui";

const STALL_TYPES = ["Half Stall", "Full Stall", "Promotional Stall"] as const;
const STEPS = ["Details", "Review", "Done"];

function stallPrice(event: EventRow | null, stallType: string): number | null {
  if (!event) return null;
  if (stallType === "Half Stall") return event.half_stall_price;
  if (stallType === "Full Stall") return event.full_stall_price;
  if (stallType === "Promotional Stall") return event.promotional_stall_price;
  return null;
}

function formatRupees(value: number | null) {
  if (value == null) return "Priced on confirmation";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function BookStall() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const online = useOnline();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [existingApp, setExistingApp] = useState<ApplicationRow | null>(null);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState(0);
  const [stallType, setStallType] = useState<string>(STALL_TYPES[1]);
  const [category, setCategory] = useState(vendor?.product_category ?? "");
  const [products, setProducts] = useState(vendor?.products_to_display ?? "");
  const [special, setSpecial] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!eventId || !vendor) return;
    setChecking(true);
    setLoadError(false);
    Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase
        .from("applications")
        .select("*, events(*)")
        .eq("vendor_id", vendor.id)
        .eq("event_id", eventId)
        .not("stage", "in", "(rejected,cancelled)")
        .maybeSingle()
    ]).then(([eventRes, appRes]) => {
      if (eventRes.error) {
        setLoadError(true);
        setChecking(false);
        return;
      }
      setEvent((eventRes.data as EventRow) ?? null);
      setExistingApp((appRes.data as unknown as ApplicationRow) ?? null);
      setChecking(false);
    });
  }

  useEffect(load, [eventId, vendor]);

  async function submit() {
    if (!vendor || !eventId || !event || busy || submitted) return;
    setBusy(true);
    setError(null);

    // Best-effort re-validation right before writing: the event must still be published and
    // in the future, and there must still be no active application for it. RLS enforces the
    // vendor-scoped, approved-only write itself — this just avoids an obviously stale submit.
    const [{ data: freshEvent }, { data: dupe }] = await Promise.all([
      supabase.from("events").select("status,starts_at").eq("id", eventId).maybeSingle(),
      supabase
        .from("applications")
        .select("id")
        .eq("vendor_id", vendor.id)
        .eq("event_id", eventId)
        .not("stage", "in", "(rejected,cancelled)")
        .maybeSingle()
    ]);

    if (!freshEvent || freshEvent.status !== "published" || new Date(freshEvent.starts_at).getTime() < Date.now()) {
      setBusy(false);
      setError("This event is no longer open for applications.");
      return;
    }
    if (dupe) {
      setBusy(false);
      setError("You already have an application for this event.");
      setExistingApp(dupe as ApplicationRow);
      return;
    }

    const { error: insertError } = await supabase.from("applications").insert({
      vendor_id: vendor.id,
      event_id: eventId,
      stall_type: stallType,
      product_category: category.trim() || null,
      products_to_display: products.trim() || null,
      special_requirements: special.trim() || null
    });
    setBusy(false);
    if (insertError) {
      setError(
        /row-level security|permission/i.test(insertError.message)
          ? "Your account needs to be approved before you can apply for stalls."
          : "Could not submit your booking request. Please try again."
      );
      return;
    }
    setSubmitted(true);
    setStep(2);
  }

  if (checking) {
    return (
      <Screen>
        <PageHeader title="Book a Stall" backTo="/events" />
        <div className="flex flex-col gap-3 px-4">
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <PageHeader title="Book a Stall" backTo="/events" />
        <ErrorState onRetry={load}>Couldn&rsquo;t load this event. Check your connection and try again.</ErrorState>
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen>
        <PageHeader title="Book a Stall" backTo="/events" />
        <EmptyState>This event couldn&rsquo;t be found.</EmptyState>
      </Screen>
    );
  }

  if (existingApp && !submitted) {
    return (
      <Screen>
        <PageHeader title="Book a Stall" backTo="/events" />
        <div className="px-4 pt-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warn-bg text-warn">
            <ShieldAlert size={26} />
          </div>
          <h2 className="mt-5 text-[19px] font-extrabold text-ink">You&rsquo;ve already applied</h2>
          <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">
            You already have a booking request for {event.title}. Track its status from My Stall instead of applying again.
          </p>
          <Link to="/stall" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 text-[14px] font-bold text-white">
            Go to My Stall
          </Link>
        </div>
      </Screen>
    );
  }

  const price = stallPrice(event, stallType);

  return (
    <Screen>
      <PageHeader title="Book a Stall" backTo="/events" />
      <div className="px-4">
        {!online && <div className="-mx-4"><OfflineBanner /></div>}

        <div className="mt-2 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
                  i === step ? "bg-primary text-white" : i < step ? "bg-primary/15 text-primary" : "bg-accent-bg text-muted"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-[10px] font-semibold ${i === step ? "text-primary" : "text-muted"}`}>{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl2 bg-gradient-to-br from-accent-bg to-[#F7DCE6] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary">
              <Building2 size={20} />
            </span>
            <div>
              <Badge kind="neutral">{event.tag ?? event.event_type ?? "Event"}</Badge>
              <h2 className="mt-1 text-[19px] font-extrabold text-ink">{event.title}</h2>
              <p className="mt-1 text-[13px] font-semibold text-muted">{event.venue}</p>
              <p className="text-[13px] font-semibold text-muted">
                {new Date(event.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                {event.timing ? ` · ${event.timing}` : ""}
              </p>
              <div className="mt-2">
                <Badge kind={daysUntil(event.starts_at) <= 5 ? "bad" : "good"}>
                  <Sparkles size={11} aria-hidden="true" /> {daysUntil(event.starts_at) <= 5 ? "Closing soon" : "Applications open"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {step === 0 && (
          <>
            <p className="mt-4 text-[13px] text-muted">Your vendor information is prefilled from your profile — edit anything that&rsquo;s specific to this event.</p>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Stall type">
                <Select value={stallType} onChange={(e) => setStallType(e.target.value)}>
                  {STALL_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <p className="-mt-2 text-[13px] font-bold text-primary">{formatRupees(price)}</p>
              <Field label="Product category">
                <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Apparel & Lifestyle" />
              </Field>
              <Field label="Products to display">
                <TextInput
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="e.g. Women's apparel, festive wear and accessories"
                />
              </Field>
              <Field label="Special requirements (optional)">
                <TextInput value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="Power point, extra space or other request" />
              </Field>
            </div>
            <PrimaryButton className="mt-5" onClick={() => setStep(1)} disabled={!category.trim()}>
              Continue to review
            </PrimaryButton>
          </>
        )}

        {step === 1 && (
          <>
            <Card className="mt-4 flex flex-col gap-3">
              <h3 className="text-[15px] font-bold text-ink">Review your application</h3>
              <Review label="Stall type" value={stallType} />
              <Review label="Estimated fee" value={formatRupees(price)} />
              <Review label="Category" value={category || "—"} />
              <Review label="Products" value={products || "—"} />
              <Review label="Special requirements" value={special || "None"} />
            </Card>

            <Card className="mt-4">
              <h3 className="text-[15px] font-bold text-ink">What happens next?</h3>
              <ol className="mt-3 flex flex-col gap-2.5">
                {["MN Events reviews your category", "Availability is confirmed and a stall fee is set", "Payment is requested, then your exact stall is assigned"].map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[14px] font-semibold text-ink">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-bg text-[12px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                MN Events assigns the exact stall position — a specific spot isn&rsquo;t guaranteed. Transferring, sharing or
                subletting your stall requires prior written approval.
              </p>
            </Card>

            <label className="mt-4 flex items-start gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-primary" />
              I confirm this information is accurate and I accept the Vendor Rules.
            </label>

            {error && <p role="alert" className="mt-2 text-[13px] font-semibold text-bad">{error}</p>}

            <PrimaryButton className="mt-4" icon={Send} disabled={!agree || busy || !online} onClick={submit}>
              {busy ? "Submitting…" : online ? "Submit booking request" : "Offline — reconnect to submit"}
            </PrimaryButton>
            <GhostButton className="mt-3" onClick={() => setStep(0)} disabled={busy}>
              Back to details
            </GhostButton>
          </>
        )}

        {step === 2 && (
          <div className="pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good-bg text-good">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="mt-5 text-[20px] font-extrabold text-ink">Application submitted</h2>
            <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted">
              MN Events will review your application for {event.title}. You can track its status any time from My Stall.
            </p>
            <button
              onClick={() => navigate("/stall", { replace: true })}
              className="mx-auto mt-6 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[14px] font-bold text-white"
            >
              <ArrowRight size={16} /> Go to My Stall
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-[14px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="max-w-[60%] text-right font-semibold text-ink">{value}</span>
    </div>
  );
}
