import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Calendar, Clock, Tag, CheckCircle2, ArrowRight, Users, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { EventRow } from "@/lib/types";
import { PageHeader, Screen, Card, Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui";

function formatRupees(value: number | null) {
  if (value == null) return null;
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function EventDetails() {
  const { eventId } = useParams();
  const { vendor } = useAuth();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    if (!eventId) return;
    setLoading(true);
    setError(false);
    supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(true);
          setLoading(false);
          return;
        }
        setEvent((data as EventRow) ?? null);
        setLoading(false);
      });
  }

  useEffect(load, [eventId]);

  if (loading) {
    return (
      <Screen>
        <PageHeader title="Event details" backTo="/events" />
        <div className="flex flex-col gap-3 px-4">
          <Skeleton className="h-[160px] w-full" />
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[140px] w-full" />
        </div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <PageHeader title="Event details" backTo="/events" />
        <ErrorState onRetry={load}>Couldn&rsquo;t load this event. Check your connection and try again.</ErrorState>
      </Screen>
    );
  }

  if (!event || event.status !== "published") {
    return (
      <Screen>
        <PageHeader title="Event details" backTo="/events" />
        <EmptyState>This event isn&rsquo;t open for applications right now.</EmptyState>
      </Screen>
    );
  }

  const closingSoon = daysUntil(event.starts_at) <= 5 && daysUntil(event.starts_at) >= 0;
  const eventEnded = daysUntil(event.starts_at) < 0;
  const eligible =
    !vendor?.product_category ||
    !event.categories?.length ||
    event.categories.some((c) => c.toLowerCase().includes(vendor.product_category!.toLowerCase()) || vendor.product_category!.toLowerCase().includes(c.toLowerCase()));

  const stallOptions = [
    { label: "Half Stall", price: event.half_stall_price, inclusions: event.half_stall_inclusions },
    { label: "Full Stall", price: event.full_stall_price, inclusions: event.full_stall_inclusions },
    { label: "Promotional Stall", price: event.promotional_stall_price, inclusions: null as string[] | null }
  ].filter((s) => s.price != null);

  return (
    <Screen>
      <PageHeader title="Event details" backTo="/events" />
      <div className="px-4">
        <div className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#5B1640] to-[#7A2154] p-5 text-white">
          <Badge kind="neutral">{event.tag ?? event.event_type ?? "Event"}</Badge>
          <h1 className="mt-2 text-[24px] font-extrabold leading-tight">{event.title}</h1>
          {event.description && <p className="mt-2 text-[13px] leading-relaxed text-white/85">{event.description}</p>}
          <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-white/90">
            <span className="flex items-center gap-2">
              <MapPin size={14} /> {event.venue ?? event.location ?? "Venue TBA"}
            </span>
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              {new Date(event.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            {event.timing && (
              <span className="flex items-center gap-2">
                <Clock size={14} /> {event.timing}
              </span>
            )}
            {event.audience_count != null && (
              <span className="flex items-center gap-2">
                <Users size={14} /> ~{event.audience_count.toLocaleString("en-IN")} footfall expected
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Badge kind={eventEnded ? "bad" : closingSoon ? "bad" : "good"}>
            {eventEnded ? "Applications closed" : closingSoon ? "Closing soon — apply now" : "Applications open"}
          </Badge>
          <Badge kind={eligible ? "good" : "neutral"}>
            <Tag size={11} /> {eligible ? "Open to your category" : "Different category — still open to apply"}
          </Badge>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Exact application cut-off is confirmed by MN Events closer to the date — apply early as stalls are limited.
        </p>

        {stallOptions.length > 0 && (
          <>
            <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Stall options &amp; pricing</p>
            <div className="flex flex-col gap-2.5">
              {stallOptions.map((s) => (
                <Card key={s.label} className="!p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-bold text-ink">{s.label}</p>
                    <p className="text-[16px] font-extrabold text-primary">{formatRupees(s.price)}</p>
                  </div>
                  {s.inclusions && s.inclusions.length > 0 && (
                    <p className="mt-1.5 text-[12px] text-muted">Includes: {s.inclusions.join(", ")}</p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="px-1 pb-2 pt-5 text-[13px] font-bold uppercase tracking-wide text-muted">Included with every stall</p>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            {(event.inclusions?.length ? event.inclusions : ["Canopy", "Tables", "Chairs", "Lights"]).map((item) => (
              <span key={item} className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <CheckCircle2 size={16} className="text-good" /> {item}
              </span>
            ))}
          </div>
        </Card>

        <Card className="mt-4 flex gap-3 !p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[12px] leading-relaxed text-muted">
            MN Events assigns your exact stall position based on the event layout, stall type and category — a specific spot
            isn&rsquo;t guaranteed. Transferring, sharing or subletting your stall to another vendor requires MN Events&rsquo;
            prior written approval. See{" "}
            <Link to="/help" className="font-bold text-primary underline underline-offset-2">
              Vendor Rules
            </Link>{" "}
            for full policies.
          </p>
        </Card>

        {eventEnded ? (
          <div className="mt-5 rounded-xl border border-border bg-accent-bg px-4 py-3 text-center text-[13px] font-semibold text-muted">
            This event has passed and is no longer accepting applications.
          </div>
        ) : (
          <Link
            to={`/events/${event.id}/book`}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-bold text-white transition active:translate-y-px"
          >
            <ArrowRight size={18} /> Book this stall
          </Link>
        )}
      </div>
    </Screen>
  );
}
