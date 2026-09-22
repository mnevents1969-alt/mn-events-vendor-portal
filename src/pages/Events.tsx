import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Calendar, ArrowRight, Store, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { EventRow } from "@/lib/types";
import { useOnline } from "@/lib/useOnline";
import { PageHeader, Screen, Badge, EmptyState, ErrorState, OfflineBanner, Skeleton } from "@/components/ui";

const FILTERS = ["All events", "Corporate", "Community", "Festive"];

export default function Events() {
  const online = useOnline();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("All events");
  const [query, setQuery] = useState("");

  function load() {
    setLoading(true);
    setError(false);
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(true);
          setLoading(false);
          return;
        }
        setEvents((data as EventRow[]) ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const matchesFilter =
        filter === "All events" || (ev.event_type ?? "").toLowerCase().includes(filter.toLowerCase()) ||
        (ev.categories ?? []).some((c) => c.toLowerCase().includes(filter.toLowerCase()));
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || ev.title.toLowerCase().includes(q) || (ev.venue ?? "").toLowerCase().includes(q) || (ev.location ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [events, filter, query]);

  return (
    <Screen>
      <PageHeader title="Browse Events" backTo="/" />
      <div className="px-4">
        {!online && <div className="-mx-4"><OfflineBanner /></div>}

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search event, venue or location"
            className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold ${
                filter === f ? "bg-primary text-white" : "border border-border bg-card text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-muted">Available for booking</p>

        {loading && (
          <div className="mt-2 flex flex-col gap-4">
            <Skeleton className="h-[190px] w-full" />
            <Skeleton className="h-[190px] w-full" />
          </div>
        )}
        {!loading && error && <ErrorState onRetry={load}>Couldn&rsquo;t load events. Check your connection and try again.</ErrorState>}
        {!loading && !error && filtered.length === 0 && <EmptyState>No events match your search.</EmptyState>}

        <div className="mt-2 flex flex-col gap-4">
          {!loading && !error && filtered.map((ev) => <EventCard key={ev.id} event={ev} />)}
        </div>
      </div>
    </Screen>
  );
}

// Purely cosmetic per-category tint for the card header strip — falls back to the neutral
// accent tint for any category not in this list, so unknown/admin-added categories never break.
const CATEGORY_STRIP: Record<string, string> = {
  community: "bg-accent-bg",
  corporate: "bg-[#E3ECF7]",
  festive: "bg-[#F7E9D8]"
};

function categoryStripClass(event: EventRow): string {
  const key = (event.tag ?? event.event_type ?? "").toLowerCase();
  const match = Object.keys(CATEGORY_STRIP).find((k) => key.includes(k));
  return match ? CATEGORY_STRIP[match] : "bg-accent-bg";
}

function EventCard({ event }: { event: EventRow }) {
  const closingSoon = daysUntil(event.starts_at) <= 5;
  return (
    <Link
      to={`/events/${event.id}`}
      className="block overflow-hidden rounded-xl2 border border-border bg-card active:bg-accent-bg/40"
    >
      <div className={`flex items-center justify-between px-4 py-3 ${categoryStripClass(event)}`}>
        <Store size={20} className="text-primary" />
        <Badge kind="neutral">{event.tag ?? event.event_type ?? "Event"}</Badge>
      </div>
      <div className="p-4">
        <h3 className="text-[18px] font-extrabold text-ink">{event.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <MapPin size={14} /> {event.venue ?? event.location ?? "Venue TBA"}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Calendar size={14} />
          {new Date(event.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Badge kind={closingSoon ? "bad" : "warn"}>
            <Sparkles size={11} aria-hidden="true" /> {closingSoon ? "Closing soon" : "Applications open"}
          </Badge>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-white">
            <ArrowRight size={14} /> View &amp; book
          </span>
        </div>
      </div>
    </Link>
  );
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
