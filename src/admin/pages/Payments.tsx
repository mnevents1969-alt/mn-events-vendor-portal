import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, RotateCcw, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ApplicationRow, EventRow, PaymentStatus, RefundRequest, StallVendor } from "@/lib/types";
import { legalNextRefundStatuses } from "../lib/transitions";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, FilterSelect, ExportButton, formatDate, formatDateTime } from "../lib/adminUi";
import { downloadCsv } from "../lib/csv";
import { useConfirm } from "../lib/useConfirm";
import { logAdminAction } from "../lib/audit";
import { formatMoney } from "@/lib/money";
import { Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";
import { findPaidOrder, initiateRefund } from "../lib/payments";

type AppRow = ApplicationRow & { events?: EventRow; stall_vendors?: StallVendor };
type RefundRow = RefundRequest & { applications?: AppRow; stall_vendors?: StallVendor };

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "refunds" ? "refunds" : "reconciliation";

  return (
    <div>
      <AdminPageHeader title="Payments" sub="Authoritative payment status and refund workflow." />
      <div className="mb-4 flex gap-2">
        <TabButton active={tab === "reconciliation"} onClick={() => setParams({ tab: "reconciliation" })}>
          Reconciliation
        </TabButton>
        <TabButton active={tab === "refunds"} onClick={() => setParams({ tab: "refunds" })}>
          Refunds
        </TabButton>
      </div>
      {tab === "reconciliation" ? <Reconciliation /> : <Refunds />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-[13px] font-bold ${active ? "bg-primary text-white" : "bg-accent-bg text-ink"}`}
    >
      {children}
    </button>
  );
}

function Reconciliation() {
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    let query = supabase.from("applications").select("*, events(*), stall_vendors(*)").order("created_at", { ascending: false });
    if (status) query = query.eq("payment_status", status);
    const { data, error: err } = await query;
    if (err) {
      setError("Could not load payment records.");
      setLoading(false);
      return;
    }
    const appRows = (data as unknown as AppRow[]) ?? [];
    setRows(appRows);

    // Phase 5: surface any in-progress server-created order so "unpaid" doesn't look idle when
    // a vendor has actually already started checkout (or it's stuck, which is worth seeing too).
    const unpaidIds = appRows.filter((r) => r.payment_status === "unpaid").map((r) => r.id);
    if (unpaidIds.length > 0) {
      const { data: orders } = await supabase
        .from("payment_orders")
        .select("application_id, status")
        .in("application_id", unpaidIds)
        .in("status", ["created", "pending"]);
      const map: Record<string, string> = {};
      (orders ?? []).forEach((o) => {
        map[o.application_id as string] = o.status as string;
      });
      setActiveOrders(map);
    } else {
      setActiveOrders({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function markPaid(row: AppRow) {
    const ok = await confirm({
      title: "Mark as paid?",
      body: `Records ${row.stall_vendors?.stall_name ?? "this vendor"}'s ${formatMoney(row.stall_fee_minor, row.currency)} fee for ${row.events?.title ?? "this event"} as paid. Only do this once payment is actually confirmed.`,
      confirmLabel: "Mark as paid"
    });
    if (!ok) return;
    setBusyId(row.id);
    const { error: updErr } = await supabase.from("applications").update({ payment_status: "paid" }).eq("id", row.id);
    if (!updErr) {
      await logAdminAction({
        actorId: session!.user.id,
        actorEmail: session!.user.email ?? null,
        action: "payment.mark_paid",
        entityType: "application",
        entityId: row.id,
        metadata: { amount_minor: row.stall_fee_minor, currency: row.currency }
      });
      await load();
    }
    setBusyId(null);
  }

  function exportCsv() {
    downloadCsv(
      "payments-reconciliation.csv",
      ["Event", "Vendor", "Stage", "Fee", "Currency", "Payment status", "Applied"],
      rows.map((r) => [r.events?.title, r.stall_vendors?.stall_name, r.stage, r.stall_fee_minor != null ? r.stall_fee_minor / 100 : "", r.currency, r.payment_status, formatDate(r.created_at)])
    );
  }

  return (
    <div>
      {ConfirmUI}
      <Toolbar>
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}>
          <option value="">All payment statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </FilterSelect>
        <ExportButton onClick={exportCsv} disabled={rows.length === 0} />
      </Toolbar>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[44px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : rows.length === 0 ? (
        <EmptyState>No matching applications.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Vendor</Th>
              <Th>Fee</Th>
              <Th>Status</Th>
              <Th>Applied</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-semibold">{r.events?.title ?? "—"}</Td>
                <Td>{r.stall_vendors?.stall_name ?? "—"}</Td>
                <Td>{formatMoney(r.stall_fee_minor, r.currency)}</Td>
                <Td>
                  <Badge kind={r.payment_status === "paid" ? "good" : r.payment_status === "refunded" ? "neutral" : "warn"}>
                    {r.payment_status}
                  </Badge>
                  {activeOrders[r.id] && (
                    <span className="ml-1 text-[11px] font-semibold text-muted">
                      (checkout {activeOrders[r.id]})
                    </span>
                  )}
                </Td>
                <Td>{formatDate(r.created_at)}</Td>
                <Td>
                  {r.payment_status === "unpaid" ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => markPaid(r)}
                      className="flex items-center gap-1 text-[12px] font-bold text-good disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Mark paid
                    </button>
                  ) : (
                    "—"
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}

function Refunds() {
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refundNotes, setRefundNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("refund_requests")
      .select("*, applications(*, events(*)), stall_vendors(*)")
      .order("created_at", { ascending: false });
    if (err) setError("Could not load refund requests.");
    else setRows((data as unknown as RefundRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function transition(row: RefundRow, next: RefundRow["status"]) {
    const danger = next === "processed" || next === "rejected";
    const ok = await confirm({
      title: `Mark refund as "${next}"?`,
      body:
        next === "processed"
          ? "Confirm only once you have actually completed the refund outside this system (bank transfer, UPI, etc). This does not trigger any payment on its own."
          : next === "approved"
          ? "This approves the refund for processing. It does not move any money."
          : "This rejects the refund request.",
      danger,
      requireReauth: danger,
      confirmLabel: "Confirm"
    });
    if (!ok) return;
    setBusyId(row.id);

    // Phase 5: for "processed", try to actually initiate the refund with the payment provider
    // first (via the authoritative apply_payment_order_status state machine server-side). This
    // is safe to attempt even when no provider is configured yet -- it still transitions any
    // matching payment_orders row to refund_pending and reports configured:false, so the
    // existing manual "processed" confirmation below remains exactly what it always was: the
    // admin's own confirmation that the refund completed, not a claim this system caused it.
    let refundNote: string | null = null;
    if (next === "processed" && row.application_id) {
      const order = await findPaidOrder(row.application_id);
      if (order) {
        const result = await initiateRefund(order.id);
        refundNote = result.ok
          ? result.configured
            ? "Refund initiated with the payment provider."
            : (result.note ?? "Provider not configured yet — recorded as pending; complete manually.")
          : `Could not initiate refund automatically: ${result.error}`;
      }
    }

    const payload: Record<string, unknown> = {
      status: next,
      decided_by: session!.user.id,
      decided_at: new Date().toISOString(),
      admin_notes: notes[row.id]?.trim() || row.admin_notes
    };
    const { error: updErr } = await supabase.from("refund_requests").update(payload).eq("id", row.id);
    if (!updErr) {
      if (next === "processed" && row.application_id) {
        await supabase.from("applications").update({ payment_status: "refunded" }).eq("id", row.application_id);
      }
      if (refundNote) setRefundNotes((n) => ({ ...n, [row.id]: refundNote as string }));
      await logAdminAction({
        actorId: session!.user.id,
        actorEmail: session!.user.email ?? null,
        action: `refund.${next}`,
        entityType: "refund_request",
        entityId: row.id,
        reason: notes[row.id]?.trim() || null,
        metadata: { amount_minor: row.amount_minor, currency: row.currency, refund_note: refundNote }
      });
      await load();
    }
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState onRetry={load}>{error}</ErrorState>;
  if (rows.length === 0) return <EmptyState>No refund requests.</EmptyState>;

  return (
    <div className="flex flex-col gap-3">
      {ConfirmUI}
      {rows.map((r) => {
        const options = legalNextRefundStatuses(r.status);
        return (
          <div key={r.id} className="rounded-xl2 border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-bold text-ink">
                  {r.stall_vendors?.stall_name ?? "Vendor"} — {r.applications?.events?.title ?? "Event"}
                </p>
                <p className="text-[12px] text-muted">
                  Requested {formatDateTime(r.created_at)} · {formatMoney(r.amount_minor, r.currency)}
                </p>
                {r.reason && <p className="mt-1 text-[13px] text-ink">Reason: {r.reason}</p>}
                {r.admin_notes && <p className="mt-1 text-[12px] text-muted">Admin notes: {r.admin_notes}</p>}
                {refundNotes[r.id] && <p className="mt-1 text-[12px] font-semibold text-primary">{refundNotes[r.id]}</p>}
              </div>
              <Badge kind={r.status === "processed" ? "good" : r.status === "rejected" ? "bad" : r.status === "approved" ? "neutral" : "warn"}>
                {r.status}
              </Badge>
            </div>
            {options.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <input
                  placeholder="Admin note (optional)"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  className="min-h-[36px] flex-1 rounded-lg border border-border bg-bg px-3 text-[12px] outline-none focus:border-primary"
                />
                {options.includes("approved") && (
                  <ActionBtn tone="good" icon={CheckCircle2} busy={busyId === r.id} onClick={() => transition(r, "approved")}>
                    Approve
                  </ActionBtn>
                )}
                {options.includes("processed") && (
                  <ActionBtn tone="good" icon={RotateCcw} busy={busyId === r.id} onClick={() => transition(r, "processed")}>
                    Mark processed
                  </ActionBtn>
                )}
                {options.includes("rejected") && (
                  <ActionBtn tone="bad" icon={XCircle} busy={busyId === r.id} onClick={() => transition(r, "rejected")}>
                    Reject
                  </ActionBtn>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({
  children,
  icon: Icon,
  tone,
  busy,
  onClick
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  tone: "good" | "bad";
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-50 ${
        tone === "good" ? "bg-good" : "bg-bad"
      }`}
    >
      <Icon size={13} /> {children}
    </button>
  );
}
