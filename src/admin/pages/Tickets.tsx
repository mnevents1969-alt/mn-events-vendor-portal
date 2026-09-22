import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { SupportTicket, TicketStatus } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, FilterSelect, formatDateTime } from "../lib/adminUi";
import { Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";

type Row = SupportTicket & { stall_vendors?: { stall_name: string } };

const STATUS_TONE: Record<TicketStatus, "good" | "warn" | "bad" | "neutral"> = {
  open: "warn",
  in_progress: "warn",
  resolved: "good",
  closed: "neutral"
};

export default function Tickets() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = params.get("status") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    let query = supabase.from("support_tickets").select("*, stall_vendors(stall_name)").order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error: err } = await query;
    if (err) setError("Could not load support tickets.");
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <AdminPageHeader title="Support tickets" sub="Vendor questions and issues." />
      <Toolbar>
        <FilterSelect value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </FilterSelect>
      </Toolbar>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[44px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : rows.length === 0 ? (
        <EmptyState>No tickets match.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
              <Th>Last update</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Tr key={t.id}>
                <Td className="font-semibold">
                  <Link to={`/admin/tickets/${t.id}`} className="hover:underline">
                    {t.subject}
                  </Link>
                </Td>
                <Td>{t.stall_vendors?.stall_name ?? "—"}</Td>
                <Td>
                  <Badge kind={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
                </Td>
                <Td>{formatDateTime(t.updated_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
