import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, ScanLine, Store, Lock, CheckCircle2, CalendarPlus, FileDown, BookOpen, Headphones, ChevronRight, RotateCcw
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { ApplicationRow, ApplicationStatusHistoryRow, VendorStatusHistoryRow } from "@/lib/types";
import { Badge, InfoBanner, Skeleton } from "@/components/ui";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const stageLabel: Record<string, string> = {
  applied: "Application sent",
  reviewed: "Under review",
  approved: "Approved",
  stall_paid: "Paid",
  confirmed: "Confirmed",
  rejected: "Not selected",
  cancelled: "Cancelled"
};

const vendorStatusLabel: Record<string, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  suspended: "Suspended"
};

type ActivityItem = { id: string; text: string; at: string };

export default function Home() {
  const { vendor } = useAuth();
  const [nextApp, setNextApp] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    setLoading(true);

    supabase
      .from("applications")
      .select("*, events(*)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setNextApp((data as unknown as ApplicationRow) ?? null);
        setLoading(false);
      });

    Promise.all([
      supabase
        .from("vendor_status_history")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("changed_at", { ascending: false })
        .limit(5),
      supabase
        .from("application_status_history")
        .select("*, applications(events(title))")
        .order("changed_at", { ascending: false })
        .limit(5)
    ]).then(([vendorHist, appHist]) => {
      const items: ActivityItem[] = [];
      ((vendorHist.data as VendorStatusHistoryRow[]) ?? []).forEach((h) => {
        if (!h.old_status) return; // skip the initial insert row — not a meaningful "change"
        items.push({
          id: `v-${h.id}`,
          text: `Your account status changed to ${vendorStatusLabel[h.new_status] ?? h.new_status}`,
          at: h.changed_at
        });
      });
      ((appHist.data as (ApplicationStatusHistoryRow & { applications?: { events?: { title?: string } } })[]) ?? []).forEach((h) => {
        if (!h.old_stage) return;
        const title = h.applications?.events?.title ?? "your booking";
        items.push({
          id: `a-${h.id}`,
          text: `${title}: ${stageLabel[h.new_stage] ?? h.new_stage}`,
          at: h.changed_at
        });
      });
      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivity(items.slice(0, 4));
    });
  }, [vendor]);

  const initials = (vendor?.stall_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const paymentsBadge = !nextApp
    ? "No booking yet"
    : nextApp.payment_status === "paid"
      ? "Paid"
      : nextApp.payment_status === "refunded"
        ? "Refunded"
        : nextApp.stall_fee_minor != null
          ? "Payment due"
          : "PIN protected";

  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[13px] font-black text-white">
            MN
          </div>
          <div>
            <p className="text-[17px] font-extrabold leading-tight text-ink">
              {greeting()}, {vendor?.contact_person || vendor?.stall_name}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{vendor?.stall_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg text-ink">
            <Bell size={18} />
            {activity.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bad" />}
          </span>
          <Link
            to="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white"
          >
            {initials}
          </Link>
        </div>
      </div>

      <p className="px-4 pt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Your next event</p>

      {loading ? (
        <div className="mx-4 mt-2">
          <Skeleton className="h-[140px] w-full" />
        </div>
      ) : nextApp ? (
        <Link
          to="/stall"
          className="mx-4 mt-2 block rounded-xl2 bg-gradient-to-br from-[#5B1640] to-[#7A2154] p-5 text-white"
        >
          <Badge kind="neutral">
            {stageLabel[nextApp.stage] ?? nextApp.stage}
          </Badge>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-extrabold leading-tight">{nextApp.events?.title ?? "Event"}</h2>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/85">{nextApp.events?.venue}</p>
              <p className="mt-1 text-[13px] text-white/85">
                {nextApp.events?.starts_at &&
                  new Date(nextApp.events.starts_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                {nextApp.events?.timing ? ` · ${nextApp.events.timing}` : ""}
              </p>
            </div>
            <ChevronRight size={22} className="mt-1 shrink-0" />
          </div>
        </Link>
      ) : (
        <div className="mx-4 mt-2">
          <Link
            to="/events"
            className="flex items-center justify-between rounded-xl2 border border-border bg-card p-5"
          >
            <div>
              <p className="text-[15px] font-bold text-ink">No upcoming event yet</p>
              <p className="mt-1 text-[13px] text-muted">Browse events and apply for a stall.</p>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </Link>
        </div>
      )}

      <p className="px-4 pb-2 pt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Quick actions</p>
      <Link
        to="/redeem"
        className="mx-4 flex items-center justify-between rounded-xl2 border border-border bg-card p-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-bg text-primary">
            <ScanLine size={20} />
          </span>
          <div>
            <p className="text-[15px] font-bold text-ink">Log a Redemption</p>
            <p className="mt-0.5 max-w-[220px] text-[13px] leading-snug text-muted">
              Scan a QR code or enter a redemption code for the selected event.
            </p>
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-muted" />
      </Link>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        <Link to="/stall" className="rounded-xl2 border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-bg text-primary">
              <Store size={18} />
            </span>
            <ChevronRight size={16} className="mt-1 text-muted" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-ink">My Stall</p>
          <p className="text-[13px] text-muted">{nextApp ? stageLabel[nextApp.stage] ?? nextApp.stage : "No booking yet"}</p>
        </Link>
        <Link to="/payments" className="rounded-xl2 border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                paymentsBadge === "Payment due" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"
              }`}
            >
              <Lock size={18} />
            </span>
            <ChevronRight size={16} className="mt-1 text-muted" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-ink">Payments</p>
          <p className="text-[13px] text-muted">{paymentsBadge}</p>
        </Link>
      </div>

      {activity.length > 0 && (
        <>
          <p className="px-4 pb-2 pt-6 text-[13px] font-bold uppercase tracking-wide text-muted">Recent activity</p>
          <div className="mx-4 flex flex-col gap-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl2 border border-border bg-card px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-bg text-primary">
                  {item.text.includes("Refunded") ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{item.text}</p>
                  <p className="text-[11px] text-muted">
                    {new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 pb-2 pt-6">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">More for you</p>
        <Link to="/events" className="text-[13px] font-bold text-primary">
          View all
        </Link>
      </div>
      <div className="mx-4 grid grid-cols-2 gap-3">
        <ListLink to="/events" icon={CalendarPlus} label="Browse events" />
        <ListLink to="/stall" icon={FileDown} label="Entry pass" />
        <ListLink to="/help" icon={BookOpen} label="Vendor rules" />
        <ListLink to="/help" icon={Headphones} label="Contact support" />
      </div>

      <InfoBanner>Your stall number will appear here once the event layout and category allocation are confirmed.</InfoBanner>
    </div>
  );
}

function ListLink({ to, icon: Icon, label }: { to: string; icon: typeof CalendarPlus; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl2 border border-border bg-card p-4">
      <span className="flex items-center gap-2 text-[14px] font-bold text-ink">
        <Icon size={17} className="text-primary" />
        {label}
      </span>
      <ChevronRight size={16} className="text-muted" />
    </Link>
  );
}
