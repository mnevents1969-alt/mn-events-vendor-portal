import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, MapPin, Clock, Tag, Store, CheckCircle2, CreditCard, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ApplicationRow, ApplicationStatusHistoryRow } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { listVendorFiles, signedUrl } from "@/lib/storage";
import { PageHeader, Screen, Card, Badge, GhostButton, InfoBanner, EmptyState, ErrorState, Skeleton } from "@/components/ui";

const STEPS: { key: string; label: string; stages: string[] }[] = [
  { key: "applied", label: "Application", stages: ["applied", "reviewed", "approved", "stall_paid", "confirmed"] },
  { key: "approved", label: "Approved", stages: ["approved", "stall_paid", "confirmed"] },
  { key: "stall_paid", label: "Paid", stages: ["stall_paid", "confirmed"] },
  { key: "confirmed", label: "Confirmed", stages: ["confirmed"] },
  { key: "assigned", label: "Assigned", stages: [] }
];

const stageLabel: Record<string, string> = {
  applied: "Application sent",
  reviewed: "Under review",
  approved: "Approved",
  stall_paid: "Paid",
  confirmed: "Confirmed",
  rejected: "Not selected",
  cancelled: "Cancelled"
};

export default function MyStall() {
  const { vendor } = useAuth();
  const [app, setApp] = useState<ApplicationRow | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryRow[]>([]);
  const [passUrl, setPassUrl] = useState<string | null>(null);
  const [passChecked, setPassChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    supabase
      .from("applications")
      .select("*, events(*)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data, error: fetchError }) => {
        if (fetchError) {
          setError(true);
          setLoading(false);
          return;
        }
        const row = (data as unknown as ApplicationRow) ?? null;
        setApp(row);
        setLoading(false);
        if (row) {
          supabase
            .from("application_status_history")
            .select("*")
            .eq("application_id", row.id)
            .order("changed_at", { ascending: false })
            .then(({ data: hist }) => setHistory((hist as ApplicationStatusHistoryRow[]) ?? []));
        }
      });

    listVendorFiles("entry-passes", vendor.id).then(async (files) => {
      if (files.length > 0) {
        const url = await signedUrl("entry-passes", files[0].path);
        setPassUrl(url);
      }
      setPassChecked(true);
    });
  }

  useEffect(load, [vendor]);

  if (loading) {
    return (
      <Screen>
        <PageHeader title="My Stall" backTo="/" />
        <div className="flex flex-col gap-3 px-4">
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[90px] w-full" />
          <Skeleton className="h-[160px] w-full" />
        </div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <PageHeader title="My Stall" backTo="/" />
        <ErrorState onRetry={load}>Couldn&rsquo;t load your stall. Check your connection and try again.</ErrorState>
      </Screen>
    );
  }

  if (!app) {
    return (
      <Screen>
        <PageHeader title="My Stall" backTo="/" />
        <EmptyState>You don&rsquo;t have a stall booking yet.</EmptyState>
        <div className="px-4">
          <Link to="/events" className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary text-[14px] font-bold text-white">
            Browse events
          </Link>
        </div>
      </Screen>
    );
  }

  const assigned = Boolean(app.stall_number);
  const activeIndex = assigned ? STEPS.length - 1 : STEPS.findIndex((s) => s.stages.includes(app.stage));
  const paymentDue = app.payment_status === "unpaid" && app.stall_fee_minor != null && (app.stage === "approved" || app.stage === "stall_paid");
  const confirmedNotAllocated = app.stage === "confirmed" && !assigned;
  const isTerminal = app.stage === "rejected" || app.stage === "cancelled";

  return (
    <Screen>
      <PageHeader title="My Stall" backTo="/" />
      <div className="px-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-primary">
              <Store size={20} />
            </span>
            <div>
              <h2 className="text-[18px] font-extrabold text-ink">{app.events?.title}</h2>
              <p className="text-[13px] font-semibold text-muted">{app.events?.venue}</p>
              <Badge kind={app.stage === "confirmed" ? "good" : isTerminal ? "bad" : "warn"}>{stageLabel[app.stage] ?? app.stage}</Badge>
              {app.events?.starts_at && (
                <p className="mt-2 text-[13px] font-semibold text-muted">
                  {new Date(app.events.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  {app.events.timing ? ` · ${app.events.timing}` : ""}
                </p>
              )}
            </div>
          </div>
        </Card>

        {paymentDue && (
          <Link
            to="/payments"
            className="mt-3 flex items-center justify-between rounded-xl2 border border-bad/20 bg-bad-bg px-4 py-3.5"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-bad">
              <CreditCard size={16} /> Payment due — {formatMoney(app.stall_fee_minor, app.currency)}
            </span>
            <span className="text-[12px] font-bold text-bad underline underline-offset-2">Pay now</span>
          </Link>
        )}

        {confirmedNotAllocated && (
          <div className="mt-3 rounded-xl2 border border-border bg-accent-bg px-4 py-3.5 text-[13px] font-semibold text-ink">
            Your booking is confirmed. MN Events will assign your exact stall number closer to the event date.
          </div>
        )}

        {!isTerminal && (
          <>
            <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Booking progress</p>
            <Card className="!p-4">
              <div className="flex items-center">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5 last:flex-none">
                    <div className="flex items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold ${
                          i <= activeIndex ? "bg-primary text-white" : "border-2 border-border bg-card text-muted"
                        }`}
                      >
                        {i <= activeIndex ? <CheckCircle2 size={16} /> : ""}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`h-[2px] w-full min-w-[16px] flex-1 ${i < activeIndex ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between">
                {STEPS.map((s, i) => (
                  <span key={s.key} className={`text-[10px] font-bold ${i <= activeIndex ? "text-primary" : "text-muted"}`}>
                    {s.label}
                  </span>
                ))}
              </div>
            </Card>
          </>
        )}

        <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Stall details</p>
        <div className="grid grid-cols-2 gap-3">
          <DetailCard icon={Store} label="Stall type" value={app.stall_type ?? "—"} />
          <DetailCard icon={Tag} label="Category" value={app.product_category ?? "—"} />
          <DetailCard icon={MapPin} label="Stall number" value={app.stall_number ?? "To be assigned"} />
          <DetailCard icon={Clock} label="Reporting time" value={app.reporting_time ?? "Details pending"} />
        </div>

        <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Included with your stall</p>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            {(app.events?.inclusions?.length ? app.events.inclusions : ["Canopy", "Tables", "Chairs", "Lights"]).map((item) => (
              <span key={item} className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <CheckCircle2 size={16} className="text-good" /> {item}
              </span>
            ))}
          </div>
        </Card>

        {history.length > 0 && (
          <>
            <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Status history</p>
            <Card className="flex flex-col gap-3 !p-4">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 text-[13px]">
                  <History size={14} className="shrink-0 text-muted" />
                  <span className="font-semibold text-ink">{stageLabel[h.new_stage] ?? h.new_stage}</span>
                  <span className="ml-auto text-[11px] text-muted">
                    {new Date(h.changed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}

        {passChecked && passUrl ? (
          <a
            href={passUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-5 text-[15px] font-semibold text-ink"
          >
            <FileDown size={17} /> Download entry pass
          </a>
        ) : (
          <GhostButton className="mt-4" disabled>
            <FileDown size={17} /> {assigned ? "Entry pass not issued yet" : "Entry pass available once assigned"}
          </GhostButton>
        )}

        <InfoBanner>Stall allocation depends on layout, category and availability.</InfoBanner>
      </div>
    </Screen>
  );
}

function DetailCard({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="rounded-xl2 border border-border bg-card p-4">
      <span className="flex items-center gap-2 text-[12px] font-bold text-muted">
        <Icon size={14} /> {label}
      </span>
      <p className="mt-1 text-[15px] font-extrabold text-ink">{value}</p>
    </div>
  );
}
