import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, Users, ClipboardList, CreditCard, Grid3x3, FolderOpen,
  ScanLine, LifeBuoy, ScrollText, LogOut
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/vendors", label: "Vendors", icon: Users },
  { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/allocation", label: "Allocation", icon: Grid3x3 },
  { to: "/admin/documents", label: "Documents", icon: FolderOpen },
  { to: "/admin/redemptions", label: "Redemptions", icon: ScanLine },
  { to: "/admin/tickets", label: "Support", icon: LifeBuoy },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { vendor, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg md:flex">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
            MN
          </div>
          <span className="text-[14px] font-extrabold text-ink">Admin</span>
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
          className="flex items-center gap-1.5 text-[12px] font-bold text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <LogOut size={14} aria-hidden="true" /> Sign out
        </button>
      </header>

      <nav aria-label="Admin" className="border-b border-border bg-card px-2 md:hidden">
        <div className="flex gap-1 overflow-x-auto py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? "bg-primary text-white" : "text-muted"
                }`
              }
            >
              <item.icon size={14} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[12px] font-black text-white">
            MN
          </div>
          <div>
            <p className="text-[14px] font-extrabold leading-tight text-ink">MN Events</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Admin Portal</p>
          </div>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? "bg-accent-bg text-primary" : "text-ink hover:bg-accent-bg/60"
                }`
              }
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <p className="truncate text-[12px] font-bold text-ink">{vendor?.email}</p>
          <button
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function AdminPageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-extrabold text-ink md:text-[26px]">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
