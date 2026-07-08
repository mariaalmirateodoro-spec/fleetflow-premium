-- ─────────────────────────────────────────────────────────────
-- Audit log — records who changed what on a booking, and when.
-- Targets the specific gap flagged in review: final cost and
-- driver assignment could be silently changed by any staff member
-- with no history. Written only from server-side route handlers
-- (never directly from the browser), same pattern as other
-- server-only tables in this codebase.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id),
  actor_name  TEXT,      -- snapshot, so history reads fine even if the profile is later renamed/removed
  action      TEXT NOT NULL,   -- e.g. 'final_cost_changed', 'driver_changed'
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin/manager can view — matches who's allowed to edit final cost.
CREATE POLICY "Admins and managers can view audit log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_audit_log_booking_id ON public.audit_log(booking_id);
