import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera, Building2, User, Phone, Mail, Tag, Instagram, FileText, ShieldCheck, ChevronRight, LogOut,
  Image as ImageIcon, Plus, X, KeyRound, Smartphone, Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { listVendorFiles, removeVendorFile, signedUrl, uploadVendorFile, type VendorBucket } from "@/lib/storage";
import { pinStatus } from "@/lib/payments";
import { PageHeader, Screen, Card, Field, TextInput, PrimaryButton, SectionLabel, LinkButton, Badge } from "@/components/ui";

type GalleryFile = { name: string; path: string; url: string | null };

export default function Profile() {
  const { vendor, refreshVendor, signOut } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    stall_name: vendor?.stall_name ?? "",
    contact_person: vendor?.contact_person ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    product_category: vendor?.product_category ?? "",
    instagram_handle: vendor?.instagram_handle ?? "",
    city: vendor?.city ?? ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<GalleryFile[]>([]);
  const [productBusy, setProductBusy] = useState(false);
  const productInput = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<GalleryFile[]>([]);
  const [docBusy, setDocBusy] = useState<"gstin" | "pan" | null>(null);
  const gstinInput = useRef<HTMLInputElement>(null);
  const panInput = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState<string | null>(null);
  const [showSecurity, setShowSecurity] = useState(false);
  // PIN status now lives server-side (see the Phase 5 payment-PIN rewrite) — it's no longer
  // reflected by any column on the vendor row, so it's fetched from the same pinStatus() the
  // Payments page uses, lazily, the first time this panel is opened rather than on every load.
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!showSecurity || pinConfigured !== null) return;
    pinStatus()
      .then((info) => setPinConfigured(!!info.configured))
      .catch(() => setPinConfigured(null));
  }, [showSecurity, pinConfigured]);

  useEffect(() => {
    if (!vendor) return;
    if (vendor.photo_url) {
      signedUrl("vendor-logos", vendor.photo_url).then(setLogoUrl);
    } else {
      setLogoUrl(null);
    }
    refreshGallery("product-images", setProducts, vendor.id);
    refreshGallery("vendor-documents", setDocs, vendor.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id, vendor?.photo_url]);

  async function refreshGallery(bucket: VendorBucket, setter: (v: GalleryFile[]) => void, vendorId: string) {
    const files = await listVendorFiles(bucket, vendorId);
    const withUrls = await Promise.all(files.map(async (f) => ({ name: f.name, path: f.path, url: await signedUrl(bucket, f.path) })));
    setter(withUrls);
  }

  const fields = [
    { icon: Building2, label: "Business name", value: vendor?.stall_name },
    { icon: User, label: "Contact person", value: vendor?.contact_person },
    { icon: Phone, label: "Registered mobile", value: vendor?.phone },
    { icon: Mail, label: "Email address", value: vendor?.email },
    { icon: Tag, label: "Product category", value: vendor?.product_category },
    { icon: Instagram, label: "Instagram", value: vendor?.instagram_handle }
  ];
  const filled = fields.filter((f) => f.value).length;
  const complete = Math.round((filled / fields.length) * 100);

  const initials = (vendor?.stall_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase
      .from("stall_vendors")
      .update({
        stall_name: form.stall_name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        product_category: form.product_category.trim() || null,
        instagram_handle: form.instagram_handle.trim() || null,
        city: form.city.trim() || null
      })
      .eq("id", vendor.id);
    setBusy(false);
    if (error) {
      setStatus("Could not save your profile.");
      return;
    }
    await refreshVendor();
    setEditing(false);
  }

  async function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !vendor) return;
    setLogoBusy(true);
    const { path, error } = await uploadVendorFile("vendor-logos", vendor.id, file, "logo");
    if (path) {
      await supabase.from("stall_vendors").update({ photo_url: path }).eq("id", vendor.id);
      await refreshVendor();
    }
    setLogoBusy(false);
    if (error) setStatus("Could not upload your logo. Please try again.");
  }

  async function removeLogo() {
    if (!vendor?.photo_url) return;
    setLogoBusy(true);
    await removeVendorFile("vendor-logos", vendor.photo_url);
    await supabase.from("stall_vendors").update({ photo_url: null }).eq("id", vendor.id);
    await refreshVendor();
    setLogoBusy(false);
  }

  async function onProductChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !vendor) return;
    setProductBusy(true);
    const { error } = await uploadVendorFile("product-images", vendor.id, file, `product-${Date.now()}`);
    if (!error) await refreshGallery("product-images", setProducts, vendor.id);
    setProductBusy(false);
    if (error) setStatus("Could not upload that image. Please try again.");
  }

  async function removeProduct(path: string) {
    if (!vendor) return;
    setProductBusy(true);
    await removeVendorFile("product-images", path);
    await refreshGallery("product-images", setProducts, vendor.id);
    setProductBusy(false);
  }

  async function onDocChange(kind: "gstin" | "pan", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !vendor) return;
    setDocBusy(kind);
    const { error } = await uploadVendorFile("vendor-documents", vendor.id, file, kind);
    if (!error) await refreshGallery("vendor-documents", setDocs, vendor.id);
    setDocBusy(null);
    if (error) setStatus("Could not upload that document. Please try again.");
  }

  const gstinDoc = docs.find((d) => d.name.startsWith("gstin"));
  const panDoc = docs.find((d) => d.name.startsWith("pan"));

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (pwForm.password.length < 8) {
      setPwStatus("Password must be at least 8 characters.");
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      setPwStatus("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.password });
    setPwBusy(false);
    if (error) {
      setPwStatus("Could not update your password. Please try again.");
      return;
    }
    setPwForm({ password: "", confirm: "" });
    setPwStatus("Password updated.");
  }

  return (
    <Screen>
      <PageHeader title="Vendor Profile" backTo="/" />
      <div className="px-4">
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent-bg text-[20px] font-extrabold text-primary"
              disabled={logoBusy}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
              {logoBusy && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-[10px] font-bold text-white">…</span>}
            </button>
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
            <div>
              <h2 className="text-[18px] font-extrabold text-ink">{vendor?.stall_name}</h2>
              <p className="text-[13px] text-muted">
                {vendor?.product_category ?? "Category not set"}
                {vendor?.city ? ` · ${vendor.city}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-1 text-[11px] font-bold text-warn">
                  <Sparkles size={11} aria-hidden="true" /> {complete}% complete
                </span>
                {vendor?.status === "pending_approval" && <Badge kind="warn">Pending approval</Badge>}
                {vendor?.status === "suspended" && <Badge kind="bad">Suspended</Badge>}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => logoInput.current?.click()} className="text-primary">
            <Camera size={18} />
          </button>
        </Card>
        {vendor?.photo_url && (
          <LinkButton className="mt-1.5 text-muted no-underline" onClick={removeLogo}>
            Remove logo
          </LinkButton>
        )}

        <div className="mt-5 flex items-center justify-between">
          <SectionLabel>Business information</SectionLabel>
          <LinkButton onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</LinkButton>
        </div>

        {!editing ? (
          <div className="flex flex-col gap-2.5">
            {fields.map((f) => (
              <div key={f.label} className="flex items-center justify-between rounded-xl2 border border-border bg-card px-4 py-3.5">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-bold text-muted">
                    <f.icon size={13} /> {f.label}
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold text-ink">{f.value || "Not set"}</p>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-3 rounded-xl2 border border-border bg-card p-4">
            <Field label="Business name">
              <TextInput value={form.stall_name} onChange={(e) => setForm((f) => ({ ...f, stall_name: e.target.value }))} required />
            </Field>
            <Field label="Contact person">
              <TextInput value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
            </Field>
            <Field label="Registered mobile">
              <TextInput value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Email address">
              <TextInput type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Product category">
              <TextInput value={form.product_category} onChange={(e) => setForm((f) => ({ ...f, product_category: e.target.value }))} />
            </Field>
            <Field label="Instagram">
              <TextInput value={form.instagram_handle} onChange={(e) => setForm((f) => ({ ...f, instagram_handle: e.target.value }))} />
            </Field>
            <Field label="City">
              <TextInput value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </Field>
            {status && <p role="alert" className="text-[13px] font-semibold text-bad">{status}</p>}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </form>
        )}

        <SectionLabel>Product images</SectionLabel>
        <div className="flex flex-wrap gap-2.5">
          {products.map((p) => (
            <div key={p.path} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-accent-bg">
              {p.url && <img src={p.url} alt="" className="h-full w-full object-cover" />}
              <button
                type="button"
                onClick={() => removeProduct(p.path)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove image"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => productInput.current?.click()}
            disabled={productBusy}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted"
          >
            {productBusy ? <span className="text-[10px]">Uploading…</span> : <Plus size={18} />}
            {!productBusy && <span className="text-[10px] font-semibold">Add</span>}
          </button>
          <input ref={productInput} type="file" accept="image/*" className="hidden" onChange={onProductChange} />
        </div>
        {products.length === 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
            <ImageIcon size={13} /> Add photos of your products or stall setup.
          </p>
        )}

        <SectionLabel>Documents &amp; security</SectionLabel>
        <div className="flex flex-col gap-2.5">
          <DocRow
            label="GSTIN proof"
            sub={gstinDoc ? "Uploaded" : "Not uploaded"}
            uploaded={Boolean(gstinDoc)}
            busy={docBusy === "gstin"}
            onClick={() => gstinInput.current?.click()}
          />
          <input ref={gstinInput} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onDocChange("gstin", e)} />
          <DocRow
            label="PAN proof"
            sub={panDoc ? "Uploaded" : "Not uploaded"}
            uploaded={Boolean(panDoc)}
            busy={docBusy === "pan"}
            onClick={() => panInput.current?.click()}
          />
          <input ref={panInput} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onDocChange("pan", e)} />

          <button
            type="button"
            onClick={() => setShowSecurity((v) => !v)}
            className="flex items-center justify-between rounded-xl2 border border-border bg-card px-4 py-3.5 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-bg text-primary">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-[14px] font-bold text-ink">Password &amp; Payment PIN</p>
                <p className="text-[12px] text-muted">Manage secure access</p>
              </div>
            </div>
            <ChevronRight size={16} className={`text-muted transition ${showSecurity ? "rotate-90" : ""}`} />
          </button>

          {showSecurity && (
            <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-card p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <KeyRound size={14} className="text-primary" /> Payment PIN
                </span>
                <span className={`font-bold ${pinConfigured ? "text-good" : "text-muted"}`}>
                  {pinConfigured === null ? "Checking…" : pinConfigured ? "Set" : "Not set — set it from Payments"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <Smartphone size={14} className="text-primary" /> Active sessions
                </span>
                <span className="text-muted">This device only</span>
              </div>

              <form onSubmit={changePassword} className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-[13px] font-bold text-ink">Change password</p>
                <Field label="New password">
                  <TextInput
                    type="password"
                    autoComplete="new-password"
                    value={pwForm.password}
                    onChange={(e) => setPwForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </Field>
                <Field label="Confirm new password">
                  <TextInput
                    type="password"
                    autoComplete="new-password"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  />
                </Field>
                {pwStatus && (
                  <p className={`text-[13px] font-semibold ${pwStatus === "Password updated." ? "text-good" : "text-bad"}`}>{pwStatus}</p>
                )}
                <PrimaryButton type="submit" disabled={pwBusy}>
                  {pwBusy ? "Updating…" : "Update password"}
                </PrimaryButton>
              </form>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 text-[14px] font-bold text-bad"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </Screen>
  );
}

function DocRow({
  label,
  sub,
  uploaded,
  busy,
  onClick
}: {
  label: string;
  sub: string;
  uploaded: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="flex items-center justify-between rounded-xl2 border border-border bg-card px-4 py-3.5 text-left">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-bg text-primary">
          <FileText size={16} />
        </span>
        <div>
          <p className="text-[14px] font-bold text-ink">{label}</p>
          <p className={`text-[12px] ${uploaded ? "text-good" : "text-muted"}`}>{busy ? "Uploading…" : sub}</p>
        </div>
      </div>
      <span className="text-[12px] font-bold text-primary">{uploaded ? "Replace" : "Upload"}</span>
    </button>
  );
}
