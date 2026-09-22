import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Supabase's password-recovery link signs the browser in via a one-time token in the URL
// (handled automatically by supabase-js) and fires a PASSWORD_RECOVERY auth event. We only
// allow the "set new password" form once we've seen that event or an existing recovery session,
// so this page can't be used to change a password without the emailed link.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // If the recovery link already established a session before this component mounted
    // (e.g. on a hard refresh), fall back to checking for an active session.
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setReady((current) => current || !!data.session);
      if (!data.session) setInvalid(true);
    }, 1200);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("Could not update your password. Please request a new reset link and try again.");
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/", { replace: true }), 1800);
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="app-shell relative overflow-hidden bg-gradient-to-br from-[#5B1640] to-[#7A2154] px-6 pb-16 pt-8 text-white">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#5B1640]">
            <span className="text-sm font-black">MN</span>
          </div>
          <div>
            <p className="text-[15px] font-extrabold leading-tight">MN EVENTS</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Vendor Portal</p>
          </div>
        </div>
        <h1 className="relative mt-8 text-[28px] font-extrabold leading-[1.2]">Set a new password</h1>
      </div>

      <div className="relative -mt-8 rounded-t-[28px] bg-bg px-6 pb-10 pt-7">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good-bg text-good">
              <CheckCircle2 size={24} />
            </span>
            <h2 className="text-[19px] font-extrabold text-ink">Password updated</h2>
            <p className="text-[14px] text-muted">Taking you to your portal…</p>
          </div>
        ) : invalid ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <h2 className="text-[19px] font-extrabold text-ink">This link has expired</h2>
            <p className="max-w-[280px] text-[14px] text-muted">
              Password reset links only work for a short time. Please request a new one.
            </p>
            <Link to="/forgot-password" className="mt-2 text-[13px] font-bold text-primary underline underline-offset-2">
              Request a new link
            </Link>
          </div>
        ) : !ready ? (
          <p className="py-10 text-center text-[14px] text-muted">Verifying your reset link…</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted">New password</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
                <Lock size={18} className="shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Confirm new password</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
                <Lock size={18} className="shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
                />
              </div>
            </div>

            {error && <p role="alert" className="text-[13px] font-semibold text-bad">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-white disabled:opacity-60"
            >
              <ArrowRight size={18} />
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
