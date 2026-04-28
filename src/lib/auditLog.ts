import { supabase } from './supabase';

export type AuditAction =
  | 'viewed_application'
  | 'viewed_document'
  | 'updated_status'
  | 'approved_application'
  | 'rejected_application'
  | 'added_note'
  | 'debicheck_initiated'
  | 'debicheck_error'
  | 'debicheck_callback';

export async function logAudit(
  action: AuditAction,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
  });
}
