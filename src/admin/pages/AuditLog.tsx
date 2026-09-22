import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuditLogEntry } from "@/lib/types";
import { AdminPageHeader } from "../AdminShell";
import { TableWrap, Th, Td, Tr, Toolbar, SearchInput, FilterSelect, formatDateTime } from "../lib/adminUi";
import { ErrorState, EmptyState, Skeleton } from "@/components/ui";

export default function AuditLog() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) setError("Could not load the audit log.");
    else setRows((data as AuditLogEntry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const entityTypes = Array.from(new Set(rows.map((r) => r.entity_type))).sort();

  const filtered = rows.filter((r) => {
    if (entityType && r.entity_type !== entityType) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return r.action.toLowerCase().includes(needle) || (r.actor_email ?? "").toLowerCase().includes(needle) || (r.reason ?? "").toLowerCase().includes(needle);
  });

  return (
    <div>
      <AdminPageHeader title="Audit log" sub="Every material admin action, in order." />
      <Toolbar>
        <SearchInput placeholder="Search action, actor, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load}>{error}</ErrorState>
      ) : filtered.length === 0 ? (
        <EmptyState>No matching audit entries.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td>{formatDateTime(r.created_at)}</Td>
                <Td>{r.actor_email ?? r.actor_id.slice(0, 8)}</Td>
                <Td className="font-semibold">{r.action}</Td>
                <Td>
                  {r.entity_type}
                  {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                </Td>
                <Td className="max-w-[280px] truncate">{r.reason ?? "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
