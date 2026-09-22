import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ImagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { EventRow } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { useConfirm } from "../lib/useConfirm";
import { logAdminAction } from "../lib/audit";
import { Card, Field, TextInput, Select, PrimaryButton, ErrorState, Skeleton } from "@/components/ui";

type Status = EventRow["status"];
const STATUSES: Status[] = ["draft", "published", "closed", "cancelled", "archived"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvToArray(s: string) {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const EMPTY = {
  title: "",
  tag: "",
  event_type: "",
  description: "",
  venue: "",
  location: "",
  timing: "",
  starts_at: "",
  ends_at: "",
  booking_deadline: "",
  image_url: "",
  categories: "",
  rules: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  audience_count: "",
  slug: "",
  inclusions: "Canopy, Tables, Chairs, Lights",
  half_stall_price: "",
  half_stall_capacity: "",
  half_stall_inclusions: "",
  full_stall_price: "",
  full_stall_capacity: "",
  full_stall_inclusions: "",
  promotional_stall_price: "",
  promotional_stall_capacity: "",
  status: "draft" as Status
};

export default function EventForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const isNew = !eventId || eventId === "new";
  const navigate = useNavigate();
  const { session } = useAuth();
  const { confirm, ConfirmUI } = useConfirm();

  const [form, setForm] = useState(EMPTY);
  const [originalStatus, setOriginalStatus] = useState<Status | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setLoadError("Could not load this event.");
          setLoading(false);
          return;
        }
        const e = data as EventRow;
        setOriginalStatus(e.status);
        setForm({
          title: e.title,
          tag: e.tag ?? "",
          event_type: e.event_type ?? "",
          description: e.description ?? "",
          venue: e.venue ?? "",
          location: e.location ?? "",
          timing: e.timing ?? "",
          starts_at: toLocalInputValue(e.starts_at),
          ends_at: toLocalInputValue(e.ends_at),
          booking_deadline: toLocalInputValue(e.booking_deadline),
          image_url: e.image_url ?? "",
          categories: (e.categories ?? []).join(", "),
          rules: e.rules ?? "",
          contact_name: e.contact_name ?? "",
          contact_phone: e.contact_phone ?? "",
          contact_email: e.contact_email ?? "",
          audience_count: e.audience_count != null ? String(e.audience_count) : "",
          slug: e.slug,
          inclusions: (e.inclusions ?? []).join(", "),
          half_stall_price: e.half_stall_price != null ? String(e.half_stall_price) : "",
          half_stall_capacity: e.half_stall_capacity != null ? String(e.half_stall_capacity) : "",
          half_stall_inclusions: (e.half_stall_inclusions ?? []).join(", "),
          full_stall_price: e.full_stall_price != null ? String(e.full_stall_price) : "",
          full_stall_capacity: e.full_stall_capacity != null ? String(e.full_stall_capacity) : "",
          full_stall_inclusions: (e.full_stall_inclusions ?? []).join(", "),
          promotional_stall_price: e.promotional_stall_price != null ? String(e.promotional_stall_price) : "",
          promotional_stall_capacity: e.promotional_stall_capacity != null ? String(e.promotional_stall_capacity) : "",
          status: e.status
        });
        setSlugTouched(true);
        setLoading(false);
      });
  }, [eventId, isNew]);

  async function onImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setImageBusy(true);
    const ext = /\.([a-zA-Z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? "jpg";
    // vendor-media is a private bucket (like the vendor-facing buckets) — event artwork uses a
    // long-lived signed URL rather than a public URL, matching how existing events already
    // store their image_url (10-year expiry so it behaves like a stable link in practice).
    const path = `event-images/${slugify(form.title || "event")}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vendor-media").upload(path, file, { contentType: file.type || undefined });
    if (!upErr) {
      const { data, error: signErr } = await supabase.storage.from("vendor-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data && !signErr) setForm((f) => ({ ...f, image_url: data.signedUrl }));
      else setError("Uploaded, but could not generate a link. You can paste an image URL instead.");
    } else {
      setError("Could not upload artwork. You can paste an image URL instead.");
    }
    setImageBusy(false);
  }

  function buildPayload() {
    return {
      title: form.title.trim(),
      tag: form.tag.trim() || null,
      event_type: form.event_type.trim() || null,
      description: form.description.trim() || null,
      venue: form.venue.trim() || null,
      location: form.location.trim() || null,
      timing: form.timing.trim() || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      booking_deadline: form.booking_deadline ? new Date(form.booking_deadline).toISOString() : null,
      image_url: form.image_url.trim() || null,
      categories: csvToArray(form.categories),
      rules: form.rules.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      audience_count: form.audience_count ? Number(form.audience_count) : null,
      slug: form.slug.trim() || slugify(form.title),
      inclusions: csvToArray(form.inclusions),
      half_stall_price: form.half_stall_price ? Number(form.half_stall_price) : null,
      half_stall_capacity: form.half_stall_capacity ? Number(form.half_stall_capacity) : null,
      half_stall_inclusions: csvToArray(form.half_stall_inclusions),
      full_stall_price: form.full_stall_price ? Number(form.full_stall_price) : null,
      full_stall_capacity: form.full_stall_capacity ? Number(form.full_stall_capacity) : null,
      full_stall_inclusions: csvToArray(form.full_stall_inclusions),
      promotional_stall_price: form.promotional_stall_price ? Number(form.promotional_stall_price) : null,
      promotional_stall_capacity: form.promotional_stall_capacity ? Number(form.promotional_stall_capacity) : null,
      status: form.status
    };
  }

  async function save() {
    setError(null);
    if (!form.title.trim() || !form.starts_at) {
      setError("Title and start date/time are required.");
      return;
    }
    const statusChanged = !isNew && originalStatus !== null && originalStatus !== form.status;
    if (statusChanged) {
      const danger = form.status === "cancelled";
      const ok = await confirm({
        title: `Change event status to "${form.status}"?`,
        body:
          form.status === "published"
            ? "This event becomes visible and bookable by every approved vendor."
            : form.status === "cancelled"
            ? "This cancels the event. Existing bookings are not automatically changed — review them separately."
            : "This changes what vendors can see and do with this event.",
        danger,
        requireReauth: danger,
        confirmLabel: "Confirm"
      });
      if (!ok) return;
    }
    setBusy(true);
    const payload = buildPayload();
    if (isNew) {
      const { data, error: insErr } = await supabase
        .from("events")
        .insert({ ...payload, created_by: session!.user.id })
        .select()
        .maybeSingle();
      setBusy(false);
      if (insErr || !data) {
        setError(insErr?.message.includes("slug") ? "That URL slug is already in use — try a different title." : "Could not create the event.");
        return;
      }
      await logAdminAction({
        actorId: session!.user.id,
        actorEmail: session!.user.email ?? null,
        action: "event.create",
        entityType: "event",
        entityId: (data as EventRow).id
      });
      navigate(`/admin/events/${(data as EventRow).id}`, { replace: true });
      return;
    }
    const { error: updErr } = await supabase.from("events").update(payload).eq("id", eventId);
    setBusy(false);
    if (updErr) {
      setError("Could not save this event.");
      return;
    }
    await logAdminAction({
      actorId: session!.user.id,
      actorEmail: session!.user.email ?? null,
      action: statusChanged ? `event.status.${form.status}` : "event.update",
      entityType: "event",
      entityId: eventId
    });
    setOriginalStatus(form.status);
  }

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Event" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div>
        <AdminPageHeader title="Event" />
        <ErrorState>{loadError}</ErrorState>
      </div>
    );
  }

  return (
    <div>
      {ConfirmUI}
      <AdminPageHeader title={isNew ? "New event" : `Edit: ${form.title}`} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Basics</p>
          <Field label="Title">
            <TextInput
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
              }}
            />
          </Field>
          <Field label="URL slug">
            <TextInput value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tag">
              <TextInput value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} />
            </Field>
            <Field label="Event type">
              <TextInput value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))} />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="min-h-[80px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </Field>
          <Field label="Eligible categories (comma separated, blank = open to all)">
            <TextInput value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} />
          </Field>
          <Field label="Rules">
            <textarea
              value={form.rules}
              onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
              rows={3}
              className="min-h-[80px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </Field>
          <Field label="Artwork">
            <div className="flex items-center gap-3">
              {form.image_url && <img src={form.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-bold text-ink">
                <ImagePlus size={14} /> {imageBusy ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} disabled={imageBusy} />
              </label>
            </div>
            <TextInput
              className="mt-2"
              placeholder="or paste an image URL"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
          </Field>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Venue, dates &amp; contact</p>
            <Field label="Venue">
              <TextInput value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
            </Field>
            <Field label="Location / area">
              <TextInput value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts at">
                <TextInput type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </Field>
              <Field label="Ends at">
                <TextInput type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
              </Field>
            </div>
            <Field label="Booking deadline">
              <TextInput type="datetime-local" value={form.booking_deadline} onChange={(e) => setForm((f) => ({ ...f, booking_deadline: e.target.value }))} />
            </Field>
            <Field label="Timing note (shown to vendors)">
              <TextInput value={form.timing} onChange={(e) => setForm((f) => ({ ...f, timing: e.target.value }))} />
            </Field>
            <Field label="Expected footfall">
              <TextInput type="number" value={form.audience_count} onChange={(e) => setForm((f) => ({ ...f, audience_count: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <TextInput placeholder="Contact name" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              <TextInput placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              <TextInput placeholder="Contact email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Stall types (INR)</p>
            <Field label="Included with every stall (comma separated)">
              <TextInput value={form.inclusions} onChange={(e) => setForm((f) => ({ ...f, inclusions: e.target.value }))} />
            </Field>
            <StallTypeRow
              label="Half stall"
              price={form.half_stall_price}
              capacity={form.half_stall_capacity}
              inclusions={form.half_stall_inclusions}
              onPrice={(v) => setForm((f) => ({ ...f, half_stall_price: v }))}
              onCapacity={(v) => setForm((f) => ({ ...f, half_stall_capacity: v }))}
              onInclusions={(v) => setForm((f) => ({ ...f, half_stall_inclusions: v }))}
            />
            <StallTypeRow
              label="Full stall"
              price={form.full_stall_price}
              capacity={form.full_stall_capacity}
              inclusions={form.full_stall_inclusions}
              onPrice={(v) => setForm((f) => ({ ...f, full_stall_price: v }))}
              onCapacity={(v) => setForm((f) => ({ ...f, full_stall_capacity: v }))}
              onInclusions={(v) => setForm((f) => ({ ...f, full_stall_inclusions: v }))}
            />
            <StallTypeRow
              label="Promotional stall"
              price={form.promotional_stall_price}
              capacity={form.promotional_stall_capacity}
              onPrice={(v) => setForm((f) => ({ ...f, promotional_stall_price: v }))}
              onCapacity={(v) => setForm((f) => ({ ...f, promotional_stall_capacity: v }))}
            />
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Status</p>
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            {error && <p role="alert" className="text-[13px] font-semibold text-bad">{error}</p>}
            <PrimaryButton onClick={save} disabled={busy}>
              {busy ? "Saving…" : isNew ? "Create event" : "Save changes"}
            </PrimaryButton>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StallTypeRow({
  label,
  price,
  capacity,
  inclusions,
  onPrice,
  onCapacity,
  onInclusions
}: {
  label: string;
  price: string;
  capacity: string;
  inclusions?: string;
  onPrice: (v: string) => void;
  onCapacity: (v: string) => void;
  onInclusions?: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-[13px] font-bold text-ink">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <TextInput type="number" placeholder="Price (₹)" value={price} onChange={(e) => onPrice(e.target.value)} />
        <TextInput type="number" placeholder="Capacity" value={capacity} onChange={(e) => onCapacity(e.target.value)} />
      </div>
      {onInclusions && (
        <TextInput
          className="mt-2"
          placeholder="Inclusions (comma separated)"
          value={inclusions}
          onChange={(e) => onInclusions(e.target.value)}
        />
      )}
    </div>
  );
}
