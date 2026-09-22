import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store, ScanLine, FileText, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { supabase, setRememberPreference } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setRememberPreference(remember);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError("That email and password don't match a vendor account. Please try again.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="app-shell relative overflow-hidden bg-gradient-to-br from-[#5B1640] to-[#7A2154] px-6 pb-16 pt-8 text-white">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-16 top-24 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#5B1640]">
            <span className="text-sm font-black">MN</span>
          </div>
          <div>
            <p className="text-[15px] font-extrabold leading-tight">MN EVENTS</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Vendor Portal</p>
          </div>
        </div>

        <h1 className="relative mt-8 text-[34px] font-extrabold leading-[1.15]">
          Your stalls, payments and redemptions&mdash;all in one place.
        </h1>
        <p className="relative mt-4 text-[14px] leading-relaxed text-white/85">
          Manage every confirmed event without entering your details again.
        </p>

        <div className="relative mt-6 flex flex-wrap gap-2">
          <Chip icon={Store} label="Stalls" />
          <Chip icon={ScanLine} label="Redemptions" />
          <Chip icon={FileText} label="Payments" />
        </div>
      </div>

      <form onSubmit={submit} className="relative -mt-8 rounded-t-[28px] bg-bg px-6 pb-10 pt-7">
        <h2 className="text-[24px] font-extrabold text-ink">Welcome back</h2>
        <p className="mt-1 text-[14px] text-muted">Sign in with your registered email or mobile number.</p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Email or mobile number</label>
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Password</label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
              <Lock size={18} className="shrink-0 text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <label className="flex items-center gap-2 font-semibold text-ink">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-[18px] w-[18px] accent-primary"
              />
              Keep me signed in on this trusted device
            </label>
            <Link to="/forgot-password" className="font-bold text-primary underline underline-offset-2">
              Forgot password?
            </Link>
          </div>

          {error && <p role="alert" className="text-[13px] font-semibold text-bad">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-white disabled:opacity-60"
          >
            <ArrowRight size={18} />
            {busy ? "Signing in…" : "Sign in to portal"}
          </button>

          <p className="mt-2 text-center text-[13px] text-muted">
            New to MN Events?{" "}
            <Link to="/register" className="font-bold text-primary underline underline-offset-2">
              Register your business
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

function Chip({ icon: Icon, label }: { icon: typeof Store; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold">
      <Icon size={14} />
      {label}
    </span>
  );
}
