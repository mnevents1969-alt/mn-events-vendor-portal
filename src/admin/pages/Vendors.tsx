import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { StallVendor, VendorStatus } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, SearchInput, FilterSelect, ExportButton, formatDate } from "../lib/adminUi";
import { downloadCsv } from "../lib/csv";
import { Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";

const STATUS_TONE: Record<VendorStatus, "good" | "warn" | "bad" | "neutral"> = {
  approved: "good",
  pending_approval: "warn",
  suspended: "bad",
  rejected: "neutral"
};

export default function Vendors() {
  const [params, setParams] = useSearchParams();
  const [vendors, setVendors] = useState<StallVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const status = params.get("status") ?? "";

  async function load() {
    setLoading(true);
    setError(null);
    let query = supabase.from("stall_vendors").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error: err } = await query;
    if (err) setError("Could not load vendors.");
    else setVendors((data as StallVendor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = vendors.filter((v) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      v.stall_name.toLowerCase().includes(needle) ||
      (v.email ?? "").toLowerCase().includes(needle) ||
      (v.phone ?? "").toLowerCase().includes(needle) ||
      (v.contact_person ?? "").toLowerCase().includes(needle)
    );
  });

  function exportCsv() {
    downloadCsv(
      "vendor-roster.csv",
      ["Stall name", "Contact person", "Phone", "Email", "Category", "City", "Status", "Registered"],
      filtered.map((v) => [v.stall_name, v.contact_person, v.phone, v.email, v.product_category, v.city, v.status, formatDate(v.created_at)])
    );
  }

  return (
    <div>
      <AdminPageHeader title="Vendors" sub="Review profiles and manage approval status." />
      <Toolbar>
        <SearchInput placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect
          value={status}
          onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
        >
          <option value="">All statuses</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </FilterSelect>
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
        <EmptyState>No vendors match.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Stall</Th>
              <Th>Contact</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <Tr key={v.id}>
                <Td className="font-semibold">
                  <Link to={`/admin/vendors/${v.id}`} className="hover:underline">
                    {v.stall_name}
                  </Link>
                </Td>
                <Td>
                  <p>{v.contact_person ?? "—"}</p>
                  <p className="text-[12px] text-muted">{v.phone ?? v.email ?? "—"}</p>
                </Td>
                <Td>{v.product_category ?? "—"}</Td>
                <Td>
                  <Badge kind={STATUS_TONE[v.status]}>{v.status.replace("_", " ")}</Badge>
                </Td>
                <Td>{formatDate(v.created_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
