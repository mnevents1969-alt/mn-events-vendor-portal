import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ApplicationStage, EventRow } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, formatDate } from "../lib/adminUi";
import { Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";

const STATUS_TONE: Record<EventRow["status"], "good" | "warn" | "bad" | "neutral"> = {
  draft: "neutral",
  published: "good",
  archived: "neutral",
  closed: "warn",
  cancelled: "bad"
};

export default function Events() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: ev, error: evErr }, { data: apps }] = await Promise.all([
      supabase.from("events").select("*").order("starts_at", { ascending: false }),
      supabase.from("applications").select("event_id, stage")
    ]);
    if (evErr) {
      setError("Could not load events.");
      setLoading(false);
      return;
    }
    const tally: Record<string, number> = {};
    ((apps as { event_id: string; stage: ApplicationStage }[]) ?? []).forEach((a) => {
      if (a.stage === "rejected" || a.stage === "cancelled") return;
      tally[a.event_id] = (tally[a.event_id] ?? 0) + 1;
    });
    setCounts(tally);
    setEvents((ev as EventRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <AdminPageHeader
        title="Events"
        sub="Create and manage events, stall pricing and eligibility."
        actions={
          <Link
            to="/admin/events/new"
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-bold text-white"
          >
            <Plus size={15} /> New event
          </Link>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[48px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : events.length === 0 ? (
        <EmptyState>No events yet — create your first one.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Venue</Th>
              <Th>Starts</Th>
              <Th>Status</Th>
              <Th>Active bookings</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <Tr key={ev.id}>
                <Td className="font-semibold">
                  <Link to={`/admin/events/${ev.id}`} className="hover:underline">
                    {ev.title}
                  </Link>
                </Td>
                <Td>{ev.venue ?? ev.location ?? "—"}</Td>
                <Td>{formatDate(ev.starts_at)}</Td>
                <Td>
                  <Badge kind={STATUS_TONE[ev.status]}>{ev.status}</Badge>
                </Td>
                <Td>{counts[ev.id] ?? 0}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
