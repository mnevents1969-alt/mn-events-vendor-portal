import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, SearchInput, ExportButton, formatDateTime } from "../lib/adminUi";
import { downloadCsv } from "../lib/csv";
import { formatMoney } from "@/lib/money";
import { ErrorState, EmptyState, Skeleton } from "@/components/ui";

type Row = {
  id: string;
  created_at: string;
  amount_minor: number | null;
  currency: string;
  issuer_name_freeform: string | null;
  receiver: { stall_name: string } | null;
  issuer: { stall_name: string } | null;
};

// Read-only by design: the confirmed redemption model has no admin-issued code/campaign
// system, so this is a search/filter view over what vendors have already logged, not a
// place to generate or manage redemption codes.
export default function Redemptions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("stall_redemptions")
      .select("id, created_at, amount_minor, currency, issuer_name_freeform, receiver:stall_vendors!receiver_vendor_id(stall_name), issuer:stall_vendors!issuer_vendor_id(stall_name)")
      .order("created_at", { ascending: false });
    if (err) setError("Could not load redemptions.");
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (r.receiver?.stall_name ?? "").toLowerCase().includes(needle) ||
      (r.issuer?.stall_name ?? "").toLowerCase().includes(needle) ||
      (r.issuer_name_freeform ?? "").toLowerCase().includes(needle)
    );
  });

  function exportCsv() {
    downloadCsv(
      "redemption-log.csv",
      ["Date", "Receiving vendor", "Issued by", "Amount", "Currency"],
      filtered.map((r) => [formatDateTime(r.created_at), r.receiver?.stall_name, r.issuer?.stall_name ?? r.issuer_name_freeform, r.amount_minor != null ? r.amount_minor / 100 : "", r.currency])
    );
  }

  return (
    <div>
      <AdminPageHeader title="Redemptions" sub="Read-only log of vendor-to-vendor redemptions." />
      <Toolbar>
        <SearchInput placeholder="Search by vendor name…" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <EmptyState>No redemptions logged yet.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Receiving vendor</Th>
              <Th>Issued by</Th>
              <Th>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td>{formatDateTime(r.created_at)}</Td>
                <Td className="font-semibold">{r.receiver?.stall_name ?? "—"}</Td>
                <Td>{r.issuer?.stall_name ?? r.issuer_name_freeform ?? "—"}</Td>
                <Td>{formatMoney(r.amount_minor, r.currency)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
