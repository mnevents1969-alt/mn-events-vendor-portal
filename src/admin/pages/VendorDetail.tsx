import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, ImageIcon, CheckCircle2, XCircle, Ban, RotateCcw, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { listVendorFiles, signedUrl } from "@/lib/storage";
import type { StallVendor, VendorStatus, VendorStatusHistoryRow } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { formatDateTime } from "../lib/adminUi";
import { useConfirm } from "../lib/useConfirm";
import { logAdminAction } from "../lib/audit";
import { Card, Badge, ErrorState, EmptyState, Skeleton, Field } from "@/components/ui";

type GalleryFile = { name: string; path: string; url: string | null };

const STATUS_TONE: Record<VendorStatus, "good" | "warn" | "bad" | "neutral"> = {
  approved: "good",
  pending_approval: "warn",
  suspended: "bad",
  rejected: "neutral"
};

export default function VendorDetail() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();
  const [vendor, setVendor] = useState<StallVendor | null>(null);
  const [history, setHistory] = useState<VendorStatusHistoryRow[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [products, setProducts] = useState<GalleryFile[]>([]);
  const [docs, setDocs] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!vendorId) return;
    setLoading(true);
    setError(null);
    const [{ data: v, error: vErr }, { data: h }] = await Promise.all([
      supabase.from("stall_vendors").select("*").eq("id", vendorId).maybeSingle(),
      supabase.from("vendor_status_history").select("*").eq("vendor_id", vendorId).order("changed_at", { ascending: false })
    ]);
    if (vErr || !v) {
      setError("Could not load this vendor.");
      setLoading(false);
      return;
    }
    const vendorRow = v as StallVendor;
    setVendor(vendorRow);
    setHistory((h as VendorStatusHistoryRow[]) ?? []);
    setLogoUrl(vendorRow.photo_url ? await signedUrl("vendor-logos", vendorRow.photo_url) : null);
    const [productFiles, docFiles] = await Promise.all([
      listVendorFiles("product-images", vendorRow.id),
      listVendorFiles("vendor-documents", vendorRow.id)
    ]);
    setProducts(await Promise.all(productFiles.map(async (f) => ({ ...f, url: await signedUrl("product-images", f.path) }))));
    setDocs(await Promise.all(docFiles.map(async (f) => ({ ...f, url: await signedUrl("vendor-documents", f.path) }))));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  async function setStatus(next: VendorStatus, opts: { requireReason: boolean; danger: boolean; requireReauth: boolean; label: string }) {
    if (!vendor) return;
    if (opts.requireReason && !reason.trim()) {
      setActionError("A reason is required for this action.");
      return;
    }
    const ok = await confirm({
      title: `${opts.label} ${vendor.stall_name}?`,
      body: opts.requireReason
        ? `This will be recorded with the reason you entered: "${reason.trim()}".`
        : "This will update the vendor's status.",
      danger: opts.danger,
      requireReauth: opts.requireReauth,
      confirmLabel: opts.label
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    const { error: updErr } = await supabase.from("stall_vendors").update({ status: next }).eq("id", vendor.id);
    if (updErr) {
      setActionError("Could not update this vendor. Please try again.");
      setBusy(false);
      return;
    }
    await logAdminAction({
      actorId: session!.user.id,
      actorEmail: session!.user.email ?? null,
      action: `vendor.${next}`,
      entityType: "stall_vendor",
      entityId: vendor.id,
      reason: reason.trim() || null
    });
    setReason("");
    setBusy(false);
    await load();
  }

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Vendor" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }
  if (error || !vendor) {
    return (
      <div>
        <AdminPageHeader title="Vendor" />
        <ErrorState onRetry={load}>{error ?? "Vendor not found."}</ErrorState>
      </div>
    );
  }

  const gstinDoc = docs.find((d) => d.name.startsWith("gstin"));
  const panDoc = docs.find((d) => d.name.startsWith("pan"));

  return (
    <div>
      {ConfirmUI}
      <AdminPageHeader
        title={vendor.stall_name}
        sub={`Registered ${formatDateTime(vendor.created_at)}`}
        actions={
          <>
            <Badge kind={STATUS_TONE[vendor.status]}>{vendor.status.replace("_", " ")}</Badge>
            <Link to={`/admin/bookings?vendorId=${vendor.id}`} className="text-[13px] font-bold text-primary underline underline-offset-2">
              View bookings
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-bg text-[18px] font-extrabold text-primary">
                {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : vendor.stall_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <InfoLine label="Contact" value={vendor.contact_person} />
                <InfoLine label="Phone" value={vendor.phone} />
                <InfoLine label="Email" value={vendor.email} />
                <InfoLine label="Category" value={vendor.product_category} />
                <InfoLine label="City" value={vendor.city} />
                <InfoLine label="Instagram" value={vendor.instagram_handle} />
                <InfoLine label="GSTIN" value={vendor.gstin} />
                <InfoLine label="PAN" value={vendor.pan} />
              </div>
            </div>
            {vendor.products_to_display && (
              <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted">
                <span className="font-bold text-ink">What they sell: </span>
                {vendor.products_to_display}
              </p>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Documents</p>
            <div className="flex flex-col gap-2">
              <DocLink label="GSTIN proof" doc={gstinDoc} />
              <DocLink label="PAN proof" doc={panDoc} />
            </div>
            <p className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-wide text-muted">Product images</p>
            {products.length === 0 ? (
              <EmptyState>No product images uploaded.</EmptyState>
            ) : (
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <a key={p.path} href={p.url ?? undefined} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-border bg-accent-bg">
                    {p.url ? <img src={p.url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} />}
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Status history</p>
            {history.length === 0 ? (
              <EmptyState>No status changes recorded yet.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">
                      {h.old_status ? `${h.old_status.replace("_", " ")} → ` : ""}
                      <span className="font-bold">{h.new_status.replace("_", " ")}</span>
                    </span>
                    <span className="text-muted">{formatDateTime(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Take action</p>
          <Field label="Reason (required for reject/suspend)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="min-h-[80px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
              placeholder="e.g. Documents unclear, GSTIN mismatch…"
            />
          </Field>
          {actionError && <p className="mt-2 text-[13px] font-semibold text-bad">{actionError}</p>}
          <div className="mt-3 flex flex-col gap-2">
            {vendor.status === "pending_approval" && (
              <ActionButton
                icon={CheckCircle2}
                tone="good"
                busy={busy}
                onClick={() => setStatus("approved", { requireReason: false, danger: false, requireReauth: false, label: "Approve vendor" })}
              >
                Approve vendor
              </ActionButton>
            )}
            {vendor.status !== "rejected" && vendor.status === "pending_approval" && (
              <ActionButton
                icon={XCircle}
                tone="bad"
                busy={busy}
                onClick={() => setStatus("rejected", { requireReason: true, danger: true, requireReauth: true, label: "Reject vendor" })}
              >
                Reject vendor
              </ActionButton>
            )}
            {vendor.status === "approved" && (
              <ActionButton
                icon={Ban}
                tone="bad"
                busy={busy}
                onClick={() => setStatus("suspended", { requireReason: true, danger: true, requireReauth: true, label: "Suspend vendor" })}
              >
                Suspend vendor
              </ActionButton>
            )}
            {(vendor.status === "suspended" || vendor.status === "rejected") && (
              <ActionButton
                icon={RotateCcw}
                tone="good"
                busy={busy}
                onClick={() => setStatus("approved", { requireReason: false, danger: false, requireReauth: true, label: "Reinstate vendor" })}
              >
                Reinstate as approved
              </ActionButton>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-semibold text-ink">{value || "—"}</p>
    </div>
  );
}

function DocLink({ label, doc }: { label: string; doc?: GalleryFile }) {
  return (
    <a
      href={doc?.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold ${
        doc?.url ? "text-ink" : "pointer-events-none text-muted opacity-60"
      }`}
    >
      <FileText size={15} className="text-primary" />
      {label} {doc?.url ? "" : "— not uploaded"}
    </a>
  );
}

function ActionButton({
  children,
  icon: Icon,
  tone,
  busy,
  onClick
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  tone: "good" | "bad";
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white disabled:opacity-60 ${
        tone === "good" ? "bg-good" : "bg-bad"
      }`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}
