import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AdminShell } from "./AdminShell";

/**
 * Gate for every /admin/* route. Mirrors ProtectedLayout's loading/session/vendor-null
 * handling (never flash protected content while auth state is still resolving) but checks
 * vendor.is_admin instead of vendor.status, and renders the AdminShell layout (sidebar/pill
 * nav) instead of the vendor bottom-nav shell. This is a UI convenience only — the real
 * enforcement is `private.has_role(uid, 'admin')` in RLS policies on every admin-touched
 * table/bucket, verified independently (see Phase 4 report). A non-admin who bypasses this
 * component entirely (e.g. by editing client JS) still gets nothing from the database.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, session, vendor } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!vendor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading your account…</p>
      </div>
    );
  }

  if (!vendor.is_admin) return <Navigate to="/" replace />;

  return <AdminShell>{children}</AdminShell>;
}
