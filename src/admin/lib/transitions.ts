import type { ApplicationStage, RefundStatus, TicketStatus } from "@/lib/types";

// Mirrors private.enforce_application_stage_transition() exactly (Phase 4 migration) so the
// UI only ever offers legal next stages. The database trigger is the real enforcement — this
// is purely so admins don't hit an avoidable rejected write.
const LEGAL_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  applied: ["reviewed", "rejected", "cancelled"],
  reviewed: ["approved", "rejected", "cancelled"],
  approved: ["stall_paid", "rejected", "cancelled"],
  stall_paid: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  rejected: [],
  cancelled: []
};

export function legalNextStages(current: ApplicationStage): ApplicationStage[] {
  return LEGAL_TRANSITIONS[current] ?? [];
}

export function isLegalTransition(from: ApplicationStage, to: ApplicationStage): boolean {
  if (from === to) return true;
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: "Applied",
  reviewed: "Reviewed",
  approved: "Approved",
  stall_paid: "Paid",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled"
};

// refund_requests.status has no DB-level trigger (unlike applications.stage), so this UI-side
// map is the only guard — it mirrors the intended manual workflow: a vendor files a request,
// an admin approves or rejects it, and only an approved request can be marked "processed" —
// which means the admin has manually confirmed the money actually moved outside this system,
// never something the UI infers or auto-completes on approval.
const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["processed", "rejected"],
  processed: [],
  rejected: []
};

export function legalNextRefundStatuses(current: RefundStatus): RefundStatus[] {
  return REFUND_TRANSITIONS[current] ?? [];
}

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"]
};

export function legalNextTicketStatuses(current: TicketStatus): TicketStatus[] {
  return TICKET_TRANSITIONS[current] ?? [];
}
