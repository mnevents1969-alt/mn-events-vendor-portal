import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { listVendorFiles, removeVendorFile, signedUrl, uploadVendorFile } from "@/lib/storage";
import type { StallVendor } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { SearchInput } from "../lib/adminUi";
import { useConfirm } from "../lib/useConfirm";
import { logAdminAction } from "../lib/audit";
import { Card, EmptyState, Skeleton } from "@/components/ui";

type GalleryFile = { name: string; path: string; url: string | null };

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StallVendor[]>([]);
  const [vendor, setVendor] = useState<StallVendor | null>(null);
  const [entryPasses, setEntryPasses] = useState<GalleryFile[]>([]);
  const [invoices, setInvoices] = useState<GalleryFile[]>([]);
  const [idDocs, setIdDocs] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const passInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);

  const vendorId = params.get("vendorId") ?? "";

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      supabase
        .from("stall_vendors")
        .select("*")
        .or(`stall_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)
        .then(({ data }) => setResults((data as StallVendor[]) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    supabase
      .from("stall_vendors")
      .select("*")
      .eq("id", vendorId)
      .maybeSingle()
      .then(async ({ data }) => {
        setVendor((data as StallVendor) ?? null);
        await refresh(vendorId);
        setLoading(false);
      });
  }, [vendorId]);

  async function refresh(id: string) {
    const [passes, docs, ids] = await Promise.all([
      listVendorFiles("entry-passes", id),
      listVendorFiles("invoices-receipts", id),
      listVendorFiles("vendor-documents", id)
    ]);
    setEntryPasses(await Promise.all(passes.map(async (f) => ({ ...f, url: await signedUrl("entry-passes", f.path) }))));
    setInvoices(await Promise.all(docs.map(async (f) => ({ ...f, url: await signedUrl("invoices-receipts", f.path) }))));
    setIdDocs(await Promise.all(ids.map(async (f) => ({ ...f, url: await signedUrl("vendor-documents", f.path) }))));
  }

  async function upload(bucket: "entry-passes" | "invoices-receipts", file: File) {
    if (!vendor) return;
    setBusy(bucket);
    const { error } = await uploadVendorFile(bucket, vendor.id, file, `${bucket === "entry-passes" ? "pass" : "doc"}-${Date.now()}`);
    if (!error) {
      await refresh(vendor.id);
      await logAdminAction({
        actorId: session!.user.id,
        actorEmail: session!.user.email ?? null,
        action: `document.upload.${bucket}`,
        entityType: "stall_vendor",
        entityId: vendor.id,
        metadata: { filename: file.name }
      });
    }
    setBusy(null);
  }

  async function remove(bucket: "entry-passes" | "invoices-receipts", path: string) {
    if (!vendor) return;
    const ok = await confirm({ title: "Remove this file?", body: "The vendor will no longer be able to see or download it.", danger: true, confirmLabel: "Remove" });
    if (!ok) return;
    setBusy(path);
    await removeVendorFile(bucket, path);
    await refresh(vendor.id);
    await logAdminAction({
      actorId: session!.user.id,
      actorEmail: session!.user.email ?? null,
      action: `document.remove.${bucket}`,
      entityType: "stall_vendor",
      entityId: vendor.id,
      metadata: { path }
    });
    setBusy(null);
  }

  const gstinDoc = idDocs.find((d) => d.name.startsWith("gstin"));
  const panDoc = idDocs.find((d) => d.name.startsWith("pan"));

  return (
    <div>
      {ConfirmUI}
      <AdminPageHeader title="Documents" sub="Issue entry passes and invoices, and review vendor-uploaded ID documents." />
      <div className="mb-4">
        <SearchInput placeholder="Search vendor by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
            {results.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setParams({ vendorId: v.id });
                  setQ("");
                  setResults([]);
                }}
                className="rounded-md px-3 py-2 text-left text-[13px] font-semibold text-ink hover:bg-accent-bg"
              >
                {v.stall_name} <span className="text-muted">— {v.email ?? v.phone ?? "no contact"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!vendorId ? (
        <EmptyState>Search for a vendor to manage their documents.</EmptyState>
      ) : loading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : !vendor ? (
        <EmptyState>Vendor not found.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="mb-1 text-[15px] font-extrabold text-ink">{vendor.stall_name}</p>
            <p className="mb-3 text-[12px] text-muted">{vendor.email ?? vendor.phone}</p>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">ID documents (vendor-uploaded)</p>
            <div className="flex flex-col gap-2">
              <DocLink label="GSTIN proof" doc={gstinDoc} />
              <DocLink label="PAN proof" doc={panDoc} />
            </div>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-ink">Entry passes</p>
              <button
                onClick={() => passInput.current?.click()}
                disabled={busy === "entry-passes"}
                className="flex items-center gap-1 text-[12px] font-bold text-primary"
              >
                <Upload size={13} /> {busy === "entry-passes" ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={passInput}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) upload("entry-passes", f);
                }}
              />
            </div>
            <FileList files={entryPasses} busy={busy} onRemove={(p) => remove("entry-passes", p)} />
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-ink">Invoices &amp; receipts</p>
              <button
                onClick={() => invoiceInput.current?.click()}
                disabled={busy === "invoices-receipts"}
                className="flex items-center gap-1 text-[12px] font-bold text-primary"
              >
                <Upload size={13} /> {busy === "invoices-receipts" ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={invoiceInput}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) upload("invoices-receipts", f);
                }}
              />
            </div>
            <FileList files={invoices} busy={busy} onRemove={(p) => remove("invoices-receipts", p)} />
          </Card>
        </div>
      )}
    </div>
  );
}

function DocLink({ label, doc }: { label: string; doc?: GalleryFile }) {
  return (
    <a
      href={doc?.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold ${
        doc?.url ? "text-ink" : "pointer-events-none text-muted opacity-60"
      }`}
    >
      <FileText size={14} className="text-primary" />
      {label} {doc?.url ? "" : "— not uploaded"}
    </a>
  );
}

function FileList({ files, busy, onRemove }: { files: GalleryFile[]; busy: string | null; onRemove: (path: string) => void }) {
  if (files.length === 0) return <EmptyState>None yet.</EmptyState>;
  return (
    <div className="flex flex-col gap-1.5">
      {files.map((f) => (
        <div key={f.path} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[12px]">
          <a href={f.url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-semibold text-ink">
            <Download size={13} className="text-primary" /> {f.name}
          </a>
          <button onClick={() => onRemove(f.path)} disabled={busy === f.path} className="text-bad">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
