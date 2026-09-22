import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

/** Small KPI tile used on the dashboard and list pages. */
export function StatCard({
  label,
  value,
  icon: Icon,
  to,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  to?: string;
  tone?: "neutral" | "warn" | "bad" | "good";
}) {
  const toneClass = {
    neutral: "text-primary bg-accent-bg",
    warn: "text-warn bg-warn-bg",
    bad: "text-bad bg-bad-bg",
    good: "text-good bg-good-bg"
  }[tone];
  const body = (
    <div className="flex items-center gap-3 rounded-xl2 border border-border bg-card p-4 shadow-card">
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[20px] font-extrabold leading-tight text-ink">{value}</p>
        <p className="truncate text-[12px] font-semibold text-muted">{label}</p>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition active:translate-y-px">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Horizontally scrollable table shell so wide admin tables behave on tablet width. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl2 border border-border bg-card shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`border-b border-border bg-accent-bg/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-border px-4 py-3 align-middle text-ink ${className}`}>{children}</td>;
}

export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={onClick ? "cursor-pointer hover:bg-accent-bg/30" : ""}>
      {children}
    </tr>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[40px] w-full max-w-xs rounded-lg border border-border bg-bg px-3 text-[13px] text-ink outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-[40px] rounded-lg border border-border bg-bg px-3 text-[13px] font-semibold text-ink outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-auto flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
