import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ApplicationRow, EventRow, StallVendor } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { FilterSelect } from "../lib/adminUi";
import { logAdminAction } from "../lib/audit";
import { Card, Badge, ErrorState, EmptyState, Skeleton, TextInput } from "@/components/ui";

type Row = ApplicationRow & { stall_vendors?: StallVendor };

export default function Allocation() {
  const [params, setParams] = useSearchParams();
  const { session } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const eventId = params.get("eventId") ?? "";

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .in("status", ["published", "closed"])
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        const list = (data as EventRow[]) ?? [];
        setEvents(list);
        if (!eventId && list.length > 0) setParams({ eventId: list[0].id });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("applications")
      .select("*, stall_vendors(*)")
      .eq("event_id", eventId)
      .in("stage", ["stall_paid", "confirmed"])
      .order("created_at", { ascending: true });
    if (err) setError("Could not load bookings for this event.");
    else {
      const list = (data as unknown as Row[]) ?? [];
      setRows(list);
      setDrafts(Object.fromEntries(list.map((r) => [r.id, r.stall_number ?? ""])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const event = events.find((e) => e.id === eventId) ?? null;

  const byType = useMemo(() => {
    const tally: Record<string, number> = {};
    rows.forEach((r) => {
      if (!r.stall_type) return;
      tally[r.stall_type] = (tally[r.stall_type] ?? 0) + 1;
    });
    return tally;
  }, [rows]);

  function capacityFor(stallType: string | null): number | null {
    if (!event || !stallType) return null;
    const t = stallType.toLowerCase();
    if (t.includes("half")) return event.half_stall_capacity;
    if (t.includes("full")) return event.full_stall_capacity;
    if (t.includes("promo")) return event.promotional_stall_capacity;
    return null;
  }

  async function saveAllocation(row: Row) {
    const value = drafts[row.id]?.trim() ?? "";
    setSavingId(row.id);
    setRowError((e) => ({ ...e, [row.id]: "" }));
    const { error: updErr } = await supabase
      .from("applications")
      .update({ stall_number: value || null })
      .eq("id", row.id);
    setSavingId(null);
    if (updErr) {
      const conflict = updErr.message.toLowerCase().includes("duplicate") || updErr.message.toLowerCase().includes("unique");
      setRowError((e) => ({
        ...e,
        [row.id]: conflict ? `Stall #${value} is already taken at this event — choose another.` : "Could not save this allocation."
      }));
      return;
    }
    await logAdminAction({
      actorId: session!.user.id,
      actorEmail: session!.user.email ?? null,
      action: "allocation.set_stall_number",
      entityType: "application",
      entityId: row.id,
      metadata: { event_id: eventId, stall_number: value || null }
    });
    await load();
  }

  return (
    <div>
      <AdminPageHeader title="Stall allocation" sub="List-based allocation for confirmed and paid bookings." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterSelect value={eventId} onChange={(e) => setParams({ eventId: e.target.value })}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </FilterSelect>
        {event && (
          <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-muted">
            {event.half_stall_capacity != null && (
              <CapacityBadge label="Half" used={countByPrefix(byType, "half")} capacity={event.half_stall_capacity} />
            )}
            {event.full_stall_capacity != null && (
              <CapacityBadge label="Full" used={countByPrefix(byType, "full")} capacity={event.full_stall_capacity} />
            )}
            {event.promotional_stall_capacity != null && (
              <CapacityBadge label="Promo" used={countByPrefix(byType, "promo")} capacity={event.promotional_stall_capacity} />
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : rows.length === 0 ? (
        <EmptyState>No paid or confirmed bookings for this event yet.</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const capacity = capacityFor(row.stall_type);
            const overCapacity = capacity != null && (byType[row.stall_type ?? ""] ?? 0) > capacity;
            return (
              <Card key={row.id} className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-ink">{row.stall_vendors?.stall_name ?? "Vendor"}</p>
                    <p className="text-[12px] text-muted">
                      {row.stall_type ?? "Stall type not set"} · {row.product_category ?? "—"}
                      {capacity != null && ` · capacity ${capacity}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {overCapacity && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-warn">
                        <AlertTriangle size={12} /> Over soft capacity
                      </span>
                    )}
                    <TextInput
                      value={drafts[row.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      placeholder="Stall #"
                      className="!min-h-[38px] w-28"
                    />
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => saveAllocation(row)}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      <Save size={13} /> Save
                    </button>
                    <Badge kind={row.stage === "confirmed" ? "good" : "warn"}>{row.stage}</Badge>
                  </div>
                </div>
                {rowError[row.id] && <p className="mt-2 text-[12px] font-semibold text-bad">{rowError[row.id]}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function countByPrefix(byType: Record<string, number>, prefix: string) {
  return Object.entries(byType).reduce((sum, [type, n]) => (type.toLowerCase().includes(prefix) ? sum + n : sum), 0);
}

function CapacityBadge({ label, used, capacity }: { label: string; used: number; capacity: number }) {
  return (
    <span className={`rounded-full px-2.5 py-1 ${used > capacity ? "bg-bad-bg text-bad" : "bg-accent-bg text-primary"}`}>
      {label}: {used}/{capacity}
    </span>
  );
}
