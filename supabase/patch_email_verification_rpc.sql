-- ============================================================
-- FleetFlow Premium — Patch: RPC wrappers for email_verifications
-- Root cause of "Could not find the table 'public.email_verifications'
-- in the schema cache": PostgREST's table-level schema cache for this
-- specific table has stayed stale in production even after
-- NOTIFY pgrst, 'reload schema' and a full project restart, despite the
-- table provably existing (same class of stuck-cache issue seen on the
-- feedback table earlier). Rather than keep fighting that cache, these
-- two functions do the same inserts/reads directly in SQL and are called
-- via supabase.rpc(...) instead of supabase.from('email_verifications'),
-- which goes through a different part of PostgREST and sidesteps the
-- stuck table cache entirely.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fleetflow_send_email_verification(
  p_email TEXT,
  p_code TEXT,
  p_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_verifications (email, code, expires_at)
  VALUES (p_email, p_code, p_expires_at);
END;
$$;

-- Only marks `verified` here (NOT `used`) — `used` is a separate flag
-- consumed later, at actual booking submission time, by
-- fleetflow_consume_email_verification() below. Mixing the two up would
-- make a freshly-confirmed code look "already used" the moment the guest
-- tries to submit their booking.
CREATE OR REPLACE FUNCTION public.fleetflow_confirm_email_verification(
  p_email TEXT,
  p_code TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_code TEXT;
BEGIN
  SELECT id, code INTO v_id, v_code
  FROM public.email_verifications
  WHERE email = p_email
    AND used = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL OR v_code IS DISTINCT FROM p_code THEN
    RETURN false;
  END IF;

  UPDATE public.email_verifications SET verified = true WHERE id = v_id;
  RETURN true;
END;
$$;

-- Called at actual booking submission time: checks there's a verified,
-- not-yet-used code for this email, and atomically consumes it (marks
-- used = true) so it can't be reused for a second booking. Mirrors the
-- select-then-update that used to happen directly against the table in
-- app/api/public/bookings/route.ts.
CREATE OR REPLACE FUNCTION public.fleetflow_consume_email_verification(
  p_email TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.email_verifications
  WHERE email = p_email
    AND verified = true
    AND used = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.email_verifications SET used = true WHERE id = v_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fleetflow_send_email_verification(TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.fleetflow_confirm_email_verification(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fleetflow_consume_email_verification(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
