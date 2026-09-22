import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ApplicationRow, ApplicationStage, ApplicationStatusHistoryRow, EventRow, StallVendor } from "@/lib/types";
import { legalNextStages, isLegalTransition, STAGE_LABELS } from "../lib/transitions";
import { AdminPageHeader } from "../AdminShell";
import { formatDateTime } from "../lib/adminUi";
import { useConfirm } from "../lib/useConfirm";
import { logAdminAction } from "../lib/audit";
import { formatMoney } from "@/lib/money";
import { Card, Badge, ErrorState, EmptyState, Skeleton, Field, Select } from "@/components/ui";

type Row = ApplicationRow & { events?: EventRow; stall_vendors?: StallVendor };

const DANGEROUS: ApplicationStage[] = ["rejected", "cancelled"];

export default function BookingDetail() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();
  const [app, setApp] = useState<Row | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextStage, setNextStage] = useState<ApplicationStage | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    const [{ data: a, error: aErr }, { data: h }] = await Promise.all([
      supabase.from("applications").select("*, events(*), stall_vendors(*)").eq("id", applicationId).maybeSingle(),
      supabase.from("application_status_history").select("*").eq("application_id", applicationId).order("changed_at", { ascending: false })
    ]);
    if (aErr || !a) {
      setError("Could not load this booking.");
      setLoading(false);
      return;
    }
    const row = a as unknown as Row;
    setApp(row);
    setNotes(row.notes ?? "");
    setHistory((h as ApplicationStatusHistoryRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function submit() {
    if (!app || !nextStage) return;
    if (!isLegalTransition(app.stage, nextStage)) {
      setActionError("That stage change isn't allowed from the current stage.");
      return;
    }
    const danger = DANGEROUS.includes(nextStage);
    const ok = await confirm({
      title: `Move to "${STAGE_LABELS[nextStage]}"?`,
      body: `${app.stall_vendors?.stall_name ?? "This vendor"}'s booking for ${app.events?.title ?? "this event"} will move from ${STAGE_LABELS[app.stage]} to ${STAGE_LABELS[nextStage]}. This is visible to the vendor in their activity feed.`,
      danger,
      requireReauth: danger,
      confirmLabel: "Confirm"
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    const { error: updErr } = await supabase
      .from("applications")
      .update({ stage: nextStage, notes: notes.trim() || null })
      .eq("id", app.id);
    if (updErr) {
      setActionError(updErr.message.includes("stage") ? "That transition was rejected by the server as illegal." : "Could not update this booking.");
      setBusy(false);
      return;
    }
    await logAdminAction({
      actorId: session!.user.id,
      actorEmail: session!.user.email ?? null,
      action: `booking.${nextStage}`,
      entityType: "application",
      entityId: app.id,
      reason: notes.trim() || null,
      metadata: { from: app.stage, to: nextStage, event: app.events?.title }
    });
    setNextStage("");
    setBusy(false);
    await load();
  }

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Booking" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }
  if (error || !app) {
    return (
      <div>
        <AdminPageHeader title="Booking" />
        <ErrorState onRetry={load}>{error ?? "Booking not found."}</ErrorState>
      </div>
    );
  }

  const options = legalNextStages(app.stage);

  return (
    <div>
      {ConfirmUI}
      <AdminPageHeader
        title={`${app.stall_vendors?.stall_name ?? "Vendor"} — ${app.events?.title ?? "Event"}`}
        sub={`Applied ${formatDateTime(app.created_at)}`}
        actions={<Badge kind="neutral">{STAGE_LABELS[app.stage]}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
              <InfoLine label="Stall type" value={app.stall_type} />
              <InfoLine label="Stall number" value={app.stall_number} />
              <InfoLine label="Fee" value={formatMoney(app.stall_fee_minor, app.currency)} />
              <InfoLine label="Payment status" value={app.payment_status} />
              <InfoLine label="Product category" value={app.product_category} />
              <InfoLine label="Reporting time" value={app.reporting_time} />
            </div>
            {app.products_to_display && (
              <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted">
                <span className="font-bold text-ink">Products: </span>
                {app.products_to_display}
              </p>
            )}
            {app.special_requirements && (
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-bold text-ink">Special requirements: </span>
                {app.special_requirements}
              </p>
            )}
            <div className="mt-3 flex gap-3 border-t border-border pt-3 text-[12px]">
              <Link to={`/admin/vendors/${app.vendor_id}`} className="font-bold text-primary underline underline-offset-2">
                View vendor profile
              </Link>
              <Link to={`/admin/allocation?eventId=${app.event_id}`} className="font-bold text-primary underline underline-offset-2">
                Go to stall allocation
              </Link>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Status history</p>
            {history.length === 0 ? (
              <EmptyState>No stage changes recorded yet.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5 text-ink">
                      {h.old_stage ? <>{STAGE_LABELS[h.old_stage]} <ArrowRight size={12} /> </> : ""}
                      <span className="font-bold">{STAGE_LABELS[h.new_stage]}</span>
                    </span>
                    <span className="text-muted">{formatDateTime(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Change status</p>
          {options.length === 0 ? (
            <p className="text-[13px] text-muted">This booking is in a final stage — no further transitions are legal.</p>
          ) : (
            <>
              <Field label="Next stage">
                <Select value={nextStage} onChange={(e) => setNextStage(e.target.value as ApplicationStage)}>
                  <option value="">Select a stage…</option>
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes (visible to admins, stored with this booking)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="min-h-[80px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
                />
              </Field>
              {actionError && <p className="mt-2 text-[13px] font-semibold text-bad">{actionError}</p>}
              <button
                type="button"
                disabled={busy || !nextStage}
                onClick={submit}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Apply status change"}
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-semibold text-ink">{value || "—"}</p>
    </div>
  );
}
