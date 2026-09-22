import { NavLink } from "react-router-dom";
import { Home, Store, ScanLine, Wallet, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/stall", label: "Stall", icon: Store, end: false },
  { to: "/redeem", label: "Redeem", icon: ScanLine, end: false },
  { to: "/payments", label: "Payments", icon: Wallet, end: false },
  { to: "/profile", label: "Profile", icon: User, end: false }
];

export function BottomNav() {
  return (
    <nav aria-label="Primary" className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pt-2">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-1 flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-lg"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-14 items-center justify-center rounded-full ${
                    isActive ? "bg-accent-bg text-primary" : "text-muted"
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className={isActive ? "text-primary" : "text-muted"}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
