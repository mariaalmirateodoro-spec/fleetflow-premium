import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

interface AuditEntry {
  bookingId?: string | null
  actorId: string
  actorName: string
  action: string
  field?: string
  oldValue?: string | number | boolean | null
  newValue?: string | number | boolean | null
  note?: string | null
}

// Records a single action/change. Called from server-side route handlers
// only, right after a mutation succeeds — never from the browser, so the log
// can't be spoofed by whoever is making the change. bookingId is optional so
// this can also cover actions that aren't tied to one booking (driver/
// supplier/user management).
export async function logAudit(admin: SupabaseClient, entry: AuditEntry) {
  const { error } = await admin.from('audit_log').insert({
    booking_id: entry.bookingId ?? null,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    field: entry.field ?? null,
    old_value: entry.oldValue == null ? null : String(entry.oldValue),
    new_value: entry.newValue == null ? null : String(entry.newValue),
    note: entry.note ?? null,
  })
  if (error) console.error('[audit] failed to log entry:', error)
}

export function adminClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
