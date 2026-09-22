import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { ChevronLeft, WifiOff, AlertTriangle, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl2 border border-border bg-card p-5 shadow-card ${className}`}>{children}</div>
  );
}

export function PageHeader({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <button
        type="button"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-bg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-[22px] font-bold text-ink">{title}</h1>
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-full max-w-md bg-bg pb-28">{children}</div>;
}

export function PrimaryButton({
  children,
  className = "",
  icon: Icon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon }) {
  return (
    <button
      {...props}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-bold text-white transition active:translate-y-px disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-5 text-[15px] font-semibold text-ink transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`text-[13px] font-bold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</label>}
      {children}
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[48px] w-full rounded-xl border border-border bg-bg px-4 text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${props.className ?? ""}`}
    />
  );
}

export function Select({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-[48px] w-full appearance-none rounded-xl border border-border bg-bg px-4 text-[15px] font-semibold text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
    >
      {children}
    </select>
  );
}

const badgeKinds = {
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  neutral: "bg-accent-bg text-primary"
} as const;

export function Badge({ children, kind = "neutral" }: { children: ReactNode; kind?: keyof typeof badgeKinds }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold ${badgeKinds[kind]}`}>
      {children}
    </span>
  );
}

export function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-primary">
      <Icon size={20} />
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">{children}</p>;
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 mt-4 rounded-xl border border-warn/20 bg-warn-bg px-4 py-3 text-[13px] leading-snug text-warn">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function ErrorState({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-4 mt-2 flex flex-col items-center gap-3 rounded-xl2 border border-bad/20 bg-bad-bg px-4 py-6 text-center">
      <AlertTriangle size={20} className="text-bad" aria-hidden="true" />
      <p className="text-[13px] font-semibold text-bad">{children}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[13px] font-bold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-border bg-accent-bg px-4 py-3 text-[13px] font-semibold text-ink"
    >
      <WifiOff size={16} className="shrink-0 text-muted" aria-hidden="true" />
      You&rsquo;re offline. Reconnect to load the latest information.
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-accent-bg ${className}`} />;
}
