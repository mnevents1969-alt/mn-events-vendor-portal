import { supabase } from "@/lib/supabase";

/**
 * Records a material admin action to admin_audit_log. This is a best-effort client write —
 * it never blocks or fails the action it's logging (audit failures shouldn't stop admin work),
 * but it does surface a console warning so a broken log doesn't fail silently forever.
 * RLS only lets an admin insert a row with actor_id = themselves (see Phase 4 migration).
 */
export async function logAdminAction(params: {
  actorId: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to write admin audit log entry:", error.message);
  }
}
