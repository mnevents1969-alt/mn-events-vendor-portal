import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { SupportTicket, SupportTicketMessage, TicketStatus } from "@/lib/types";
import { legalNextTicketStatuses } from "../lib/transitions";
import { AdminPageHeader } from "../AdminShell";
import { formatDateTime } from "../lib/adminUi";
import { logAdminAction } from "../lib/audit";
import { Card, Badge, ErrorState, EmptyState, Skeleton } from "@/components/ui";

type Row = SupportTicket & { stall_vendors?: { stall_name: string; email: string | null; phone: string | null } };

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { session } = useAuth();
  const [ticket, setTicket] = useState<Row | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  async function load() {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    const [{ data: t, error: tErr }, { data: m }] = await Promise.all([
      supabase.from("support_tickets").select("*, stall_vendors(stall_name, email, phone)").eq("id", ticketId).maybeSingle(),
      supabase.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true })
    ]);
    if (tErr || !t) {
      setError("Could not load this ticket.");
      setLoading(false);
      return;
    }
    setTicket(t as unknown as Row);
    setMessages((m as SupportTicketMessage[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function send() {
    if (!ticket || !reply.trim() || !session) return;
    setBusy(true);
    const { error: msgErr } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: session.user.id,
      sender_role: "admin",
      body: reply.trim()
    });
    if (!msgErr) {
      const nextStatus = ticket.status === "open" ? "in_progress" : ticket.status;
      await supabase.from("support_tickets").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", ticket.id);
      setReply("");
      await load();
    }
    setBusy(false);
  }

  async function setStatus(next: TicketStatus) {
    if (!ticket || !session) return;
    setStatusBusy(true);
    const { error: updErr } = await supabase.from("support_tickets").update({ status: next }).eq("id", ticket.id);
    if (!updErr) {
      await logAdminAction({
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        action: `ticket.${next}`,
        entityType: "support_ticket",
        entityId: ticket.id
      });
      await load();
    }
    setStatusBusy(false);
  }

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Ticket" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }
  if (error || !ticket) {
    return (
      <div>
        <AdminPageHeader title="Ticket" />
        <ErrorState onRetry={load}>{error ?? "Ticket not found."}</ErrorState>
      </div>
    );
  }

  const options = legalNextTicketStatuses(ticket.status);

  return (
    <div>
      <AdminPageHeader
        title={ticket.subject}
        sub={`${ticket.stall_vendors?.stall_name ?? "Vendor"} · ${ticket.stall_vendors?.email ?? ticket.stall_vendors?.phone ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge kind={ticket.status === "resolved" ? "good" : ticket.status === "closed" ? "neutral" : "warn"}>
              {ticket.status.replace("_", " ")}
            </Badge>
            {options.map((s) => (
              <button
                key={s}
                disabled={statusBusy}
                onClick={() => setStatus(s)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-bold text-ink disabled:opacity-50"
              >
                Mark {s.replace("_", " ")}
              </button>
            ))}
          </div>
        }
      />

      <Card className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <EmptyState>No messages yet.</EmptyState>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2.5 text-[13px] ${m.sender_role === "admin" ? "ml-auto bg-accent-bg text-ink" : "bg-bg border border-border text-ink"}`}>
              <p>{m.body}</p>
              <p className="mt-1 text-[11px] text-muted">{m.sender_role === "admin" ? "You" : "Vendor"} · {formatDateTime(m.created_at)}</p>
            </div>
          ))
        )}
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply…"
            className="min-h-[42px] flex-1 rounded-lg border border-border bg-bg px-3 text-[13px] outline-none focus:border-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={busy || !reply.trim()}
            className="flex min-h-[42px] items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-50"
          >
            <Send size={14} /> Send
          </button>
        </div>
      </Card>
    </div>
  );
}
