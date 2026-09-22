import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasRecentReauth, verifyPassword } from "./reauth";

type ConfirmOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Requires the admin to re-enter their password if they haven't in the last 5 minutes. */
  requireReauth?: boolean;
  /** If set, the admin must type this exact text to confirm (for the most destructive actions). */
  typeToConfirm?: string;
};

type PendingState = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Renders a single confirmation dialog (optionally gated behind a password re-check) shared by
 * every admin page. Usage: const { confirm, ConfirmUI } = useConfirm(); render <ConfirmUI/> once,
 * then `if (!(await confirm({...}))) return;` before a destructive/high-impact write.
 */
export function useConfirm() {
  const { session } = useAuth();
  const [pending, setPending] = useState<PendingState | null>(null);
  const [step, setStep] = useState<"confirm" | "reauth">("confirm");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...options, resolve });
      setStep(options.requireReauth && !hasRecentReauth() ? "reauth" : "confirm");
      setTyped("");
      setPassword("");
      setError(null);
    });
  }, []);

  function settle(ok: boolean) {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPending(null);
  }

  async function handleReauthSubmit() {
    if (!session?.user.email) return;
    setBusy(true);
    setError(null);
    const err = await verifyPassword(session.user.email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setStep("confirm");
  }

  const canConfirm = !pending?.typeToConfirm || typed === pending.typeToConfirm;

  const ConfirmUI = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        {step === "reauth" ? (
          <>
            <div className="flex items-center gap-2 text-ink">
              <Lock size={18} className="text-primary" />
              <h3 className="text-[16px] font-bold">Confirm it's you</h3>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              This is a high-impact action. Re-enter your password to continue.
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3 min-h-[44px] w-full rounded-lg border border-border bg-bg px-3 text-[14px] outline-none focus:border-primary"
              placeholder="Password"
            />
            {error && <p className="mt-2 text-[12px] font-semibold text-bad">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => settle(false)}
                className="flex-1 rounded-lg border border-border py-2 text-[13px] font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleReauthSubmit}
                disabled={busy || !password}
                className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {busy ? "Checking…" : "Verify"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-ink">
              <AlertTriangle size={18} className={pending.danger ? "text-bad" : "text-warn"} />
              <h3 className="text-[16px] font-bold">{pending.title}</h3>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{pending.body}</p>
            {pending.typeToConfirm && (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Type "{pending.typeToConfirm}" to confirm
                </p>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-border bg-bg px-3 text-[14px] outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => settle(false)}
                className="flex-1 rounded-lg border border-border py-2 text-[13px] font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => settle(true)}
                disabled={!canConfirm}
                className={`flex-1 rounded-lg py-2 text-[13px] font-bold text-white disabled:opacity-50 ${
                  pending.danger ? "bg-bad" : "bg-primary"
                }`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmUI };
}
