import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { BottomNav } from "./BottomNav";
import { PendingApprovalScreen, SuspendedScreen } from "./StatusScreens";

// Routes a pending or suspended vendor may still reach (profile management + support).
const ALLOWED_WHILE_RESTRICTED = ["/profile", "/help"];

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { loading, session, vendor } = useAuth();
  const location = useLocation();

  // Never flash protected content while we don't yet know the auth state.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Session exists but the vendor row hasn't loaded yet (or registration didn't finish) —
  // keep showing a loading state rather than a half-built screen.
  if (!vendor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading your account…</p>
      </div>
    );
  }

  const restricted = vendor.status !== "approved";
  const allowedRoute = ALLOWED_WHILE_RESTRICTED.includes(location.pathname);

  if (restricted && !allowedRoute) {
    return (
      <div className="app-shell min-h-screen bg-bg">
        {vendor.status === "pending_approval" ? <PendingApprovalScreen /> : <SuspendedScreen />}
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-bg">
      {children}
      <BottomNav />
    </div>
  );
}

export function AdminOnly({ children }: { children: ReactNode }) {
  const { vendor } = useAuth();
  if (!vendor?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
