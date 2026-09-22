import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setBusy(false);
    // Don't reveal whether the email exists — same success message either way.
    if (resetError) {
      setError("Something went wrong sending that email. Please try again.");
      return;
    }
    setSent(true);
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
        <h1 className="relative mt-8 text-[28px] font-extrabold leading-[1.2]">Reset your password</h1>
        <p className="relative mt-3 text-[14px] leading-relaxed text-white/85">
          Enter the email on your vendor account and we&rsquo;ll send you a link to set a new password.
        </p>
      </div>

      <div className="relative -mt-8 rounded-t-[28px] bg-bg px-6 pb-10 pt-7">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good-bg text-good">
              <CheckCircle2 size={24} />
            </span>
            <h2 className="text-[19px] font-extrabold text-ink">Check your email</h2>
            <p className="max-w-[280px] text-[14px] text-muted">
              If an account exists for {email.trim()}, a password reset link is on its way.
            </p>
            <Link to="/login" className="mt-3 text-[13px] font-bold text-primary underline underline-offset-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Registered email</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
                <Mail size={18} className="shrink-0 text-muted" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <p className="mt-2 text-center text-[13px] text-muted">
              <Link to="/login" className="font-bold text-primary underline underline-offset-2">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
