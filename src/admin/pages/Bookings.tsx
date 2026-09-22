import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { ApplicationRow, ApplicationStage } from "@/lib/types";
import { STAGE_LABELS } from "../lib/transitions";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, SearchInput, FilterSelect, ExportButton, formatDate } from "../lib/adminUi";
import { downloadCsv } from "../lib/csv";
import { formatMoney } from "@/lib/money";
import { Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";

type Row = ApplicationRow & { stall_vendors?: { id: string; stall_name: string } };

const STAGE_TONE: Record<ApplicationStage, "good" | "warn" | "bad" | "neutral"> = {
  applied: "neutral",
  reviewed: "warn",
  approved: "warn",
  stall_paid: "good",
  confirmed: "good",
  rejected: "bad",
  cancelled: "bad"
};

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const stageParam = params.get("stage") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const stages = stageParam ? (stageParam.split(",") as ApplicationStage[]) : [];

  async function load() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("applications")
      .select("*, events(*), stall_vendors(id, stall_name)")
      .order("created_at", { ascending: false });
    if (stages.length) query = query.in("stage", stages);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    const { data, error: err } = await query;
    if (err) setError("Could not load bookings.");
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageParam, vendorId]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (r.stall_vendors?.stall_name ?? "").toLowerCase().includes(needle) || (r.events?.title ?? "").toLowerCase().includes(needle);
  });

  function exportCsv() {
    downloadCsv(
      "bookings.csv",
      ["Event", "Vendor", "Stage", "Stall type", "Stall #", "Fee", "Payment status", "Applied"],
      filtered.map((r) => [
        r.events?.title,
        r.stall_vendors?.stall_name,
        STAGE_LABELS[r.stage],
        r.stall_type,
        r.stall_number,
        formatMoney(r.stall_fee_minor, r.currency),
        r.payment_status,
        formatDate(r.created_at)
      ])
    );
  }

  return (
    <div>
      <AdminPageHeader title="Bookings" sub="Review applications and manage status transitions." />
      <Toolbar>
        <SearchInput placeholder="Search vendor or event…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect value={stageParam} onChange={(e) => setParams(e.target.value ? { stage: e.target.value } : {})}>
          <option value="">All stages</option>
          <option value="applied,reviewed">Awaiting review</option>
          {Object.entries(STAGE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </FilterSelect>
        {vendorId && (
          <button onClick={() => setParams({})} className="text-[12px] font-bold text-primary underline underline-offset-2">
            Clear vendor filter
          </button>
        )}
        <ExportButton onClick={exportCsv} disabled={filtered.length === 0} />
      </Toolbar>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[44px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : filtered.length === 0 ? (
        <EmptyState>No bookings match.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Vendor</Th>
              <Th>Stage</Th>
              <Th>Stall</Th>
              <Th>Fee</Th>
              <Th>Payment</Th>
              <Th>Applied</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td className="font-semibold">
                  <Link to={`/admin/bookings/${r.id}`} className="hover:underline">
                    {r.events?.title ?? "—"}
                  </Link>
                </Td>
                <Td>{r.stall_vendors?.stall_name ?? "—"}</Td>
                <Td>
                  <Badge kind={STAGE_TONE[r.stage]}>{STAGE_LABELS[r.stage]}</Badge>
                </Td>
                <Td>
                  {r.stall_type ?? "—"}
                  {r.stall_number ? ` · #${r.stall_number}` : ""}
                </Td>
                <Td>{formatMoney(r.stall_fee_minor, r.currency)}</Td>
                <Td>
                  <Badge kind={r.payment_status === "paid" ? "good" : r.payment_status === "refunded" ? "neutral" : "warn"}>
                    {r.payment_status}
                  </Badge>
                </Td>
                <Td>{formatDate(r.created_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
