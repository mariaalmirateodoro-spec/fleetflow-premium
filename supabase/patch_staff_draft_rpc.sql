-- ============================================================
-- FleetFlow Premium — Patch: generic is_draft get/set RPCs
-- The internal staff "New Booking" dashboard modal (BookingModal.tsx)
-- always sends `is_draft` explicitly (true OR false) on every create/edit,
-- and app/api/bookings/route.ts + app/api/bookings/[id]/route.ts write that
-- field directly via supabase-js .insert()/.update() — hitting the same
-- PostgREST schema-cache bug already fixed for the public guest-facing
-- draft routes (see patch_draft_rpc.sql, ticket SU-415685). These two
-- generic functions let the API routes read/write just the is_draft column
-- via plain SQL inside the database, bypassing the column entirely on the
-- main insert/update/select calls.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fleetflow_get_is_draft(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_draft BOOLEAN;
BEGIN
  SELECT is_draft INTO v_is_draft FROM public.bookings WHERE id = p_id;
  RETURN v_is_draft;
END;
$$;

CREATE OR REPLACE FUNCTION public.fleetflow_set_is_draft(p_id UUID, p_is_draft BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings SET is_draft = p_is_draft WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fleetflow_get_is_draft(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.fleetflow_set_is_draft(UUID, BOOLEAN) TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
