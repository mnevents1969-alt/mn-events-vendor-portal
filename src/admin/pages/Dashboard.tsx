import { useEffect, useState } from "react";
import { UserCheck, ClipboardList, CreditCard, Grid3x3, RotateCcw, LifeBuoy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminPageHeader } from "../AdminShell";
import { StatCard } from "../lib/adminUi";
import { ErrorState } from "@/components/ui";
import { Skeleton } from "@/components/ui";

type Counts = {
  pendingVendors: number;
  bookingApprovals: number;
  paymentExceptions: number;
  unallocated: number;
  openRefunds: number;
  openTickets: number;
};

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pendingVendors, bookingApprovals, paymentExceptions, unallocated, openRefunds, openTickets] = await Promise.all([
        supabase.from("stall_vendors").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
        supabase.from("applications").select("id", { count: "exact", head: true }).in("stage", ["applied", "reviewed"]),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("stage", ["stall_paid", "confirmed"])
          .neq("payment_status", "paid"),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("stage", ["stall_paid", "confirmed"])
          .is("stall_number", null),
        supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])
      ]);
      const firstErr =
        pendingVendors.error || bookingApprovals.error || paymentExceptions.error || unallocated.error || openRefunds.error || openTickets.error;
      if (firstErr) throw firstErr;
      setCounts({
        pendingVendors: pendingVendors.count ?? 0,
        bookingApprovals: bookingApprovals.count ?? 0,
        paymentExceptions: paymentExceptions.count ?? 0,
        unallocated: unallocated.count ?? 0,
        openRefunds: openRefunds.count ?? 0,
        openTickets: openTickets.count ?? 0
      });
    } catch {
      setError("Could not load the action queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <AdminPageHeader title="Dashboard" sub="What needs your attention right now." />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="Pending vendor approvals" value={counts!.pendingVendors} icon={UserCheck} tone={counts!.pendingVendors ? "warn" : "neutral"} to="/admin/vendors?status=pending_approval" />
          <StatCard label="Bookings awaiting review" value={counts!.bookingApprovals} icon={ClipboardList} tone={counts!.bookingApprovals ? "warn" : "neutral"} to="/admin/bookings?stage=applied,reviewed" />
          <StatCard label="Payment exceptions" value={counts!.paymentExceptions} icon={CreditCard} tone={counts!.paymentExceptions ? "bad" : "neutral"} to="/admin/payments" />
          <StatCard label="Stalls needing allocation" value={counts!.unallocated} icon={Grid3x3} tone={counts!.unallocated ? "warn" : "neutral"} to="/admin/allocation" />
          <StatCard label="Refund requests open" value={counts!.openRefunds} icon={RotateCcw} tone={counts!.openRefunds ? "bad" : "neutral"} to="/admin/payments?tab=refunds" />
          <StatCard label="Support tickets open" value={counts!.openTickets} icon={LifeBuoy} tone={counts!.openTickets ? "warn" : "neutral"} to="/admin/tickets" />
        </div>
      )}

      <div className="mt-8 rounded-xl2 border border-border bg-card p-5 text-[13px] text-muted">
        Use the sections in the nav to manage events, review vendors and bookings, reconcile
        payments and refunds, allocate stalls, handle documents and redemptions, and respond to
        support tickets. Every approval, rejection, suspension and status change is written to
        the audit log automatically.
      </div>
    </div>
  );
}
