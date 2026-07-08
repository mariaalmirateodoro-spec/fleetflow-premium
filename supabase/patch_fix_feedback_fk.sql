-- ============================================================
-- FleetFlow Premium — Patch: repair missing feedback -> bookings FK
-- Root cause: PostgREST reported
--   "Could not find a relationship between 'bookings' and 'feedback'
--   in the schema cache"
-- even after a schema-cache reload, meaning the foreign key itself
-- was never actually created on public.feedback.booking_id (most
-- likely because patch_feedback.sql's `CREATE TABLE IF NOT EXISTS`
-- silently no-opped if a feedback table already existed under a
-- different shape, so the FK clause inside it never ran).
-- This adds the FK only if it's missing, then reloads PostgREST's
-- schema cache so the API picks it up immediately.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.feedback'::regclass
      AND contype = 'f'
      AND confrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
