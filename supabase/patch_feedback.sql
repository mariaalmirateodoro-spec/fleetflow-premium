-- ─────────────────────────────────────────────────────────────
-- Guest feedback / trip ratings
-- One rating per booking (guest can resubmit to update, via upsert
-- on booking_id). Inserted only via the service-role client from
-- app/api/public/feedback/route.ts — guests have no session, same
-- pattern already used for guest bookings and email_verifications.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id       UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id)
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Staff can view feedback in the dashboard (no policy needed for guest
-- inserts — those go through the service-role client, which bypasses RLS).
CREATE POLICY "Authenticated staff can view feedback" ON public.feedback
  FOR SELECT USING (auth.uid() IS NOT NULL);

GRANT SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

CREATE INDEX IF NOT EXISTS idx_feedback_booking_id ON public.feedback(booking_id);
