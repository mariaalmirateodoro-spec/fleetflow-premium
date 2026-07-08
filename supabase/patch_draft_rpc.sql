-- ============================================================
-- FleetFlow Premium — Patch: RPC wrappers for draft bookings
-- Root cause: PostgREST's schema cache has repeatedly lost track of the
-- `is_draft` column on public.bookings (same class of bug as the feedback
-- FK and email_verifications table — reported to Supabase support, ticket
-- SU-415685), which makes any insert/update/select that explicitly
-- references `is_draft` fail with "Could not find the 'is_draft' column
-- ... in the schema cache". Real (non-draft) submissions were fixed by
-- simply not mentioning the column (letting its DB default apply), but
-- drafts fundamentally need to set is_draft = true, so that trick doesn't
-- work for them. These functions do the same inserts/updates in plain SQL
-- inside the database, which never goes through PostgREST's column-aware
-- request parsing, sidestepping the cache bug entirely — regardless of
-- whether Supabase ever fixes the underlying issue.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fleetflow_create_draft_booking(
  p_guest_name TEXT,
  p_guest_nationality TEXT,
  p_guest_count INT,
  p_guest_phone TEXT,
  p_guest_email TEXT,
  p_guest_line_id TEXT,
  p_pickup_location TEXT,
  p_dropoff_location TEXT,
  p_pickup_datetime TIMESTAMPTZ,
  p_dropoff_datetime TIMESTAMPTZ,
  p_vehicle_type TEXT,
  p_driver_required BOOLEAN,
  p_special_requests TEXT
) RETURNS TABLE(id UUID, reference_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.bookings (
    guest_name, guest_nationality, guest_count, guest_phone, guest_email,
    guest_line_id, pickup_location, dropoff_location, pickup_datetime,
    dropoff_datetime, vehicle_type, driver_required, special_requests,
    status, is_draft, created_by
  ) VALUES (
    p_guest_name, p_guest_nationality, p_guest_count, p_guest_phone, p_guest_email,
    p_guest_line_id, p_pickup_location, p_dropoff_location, p_pickup_datetime,
    p_dropoff_datetime, COALESCE(p_vehicle_type, 'sedan'), COALESCE(p_driver_required, true), p_special_requests,
    'pending', true, NULL
  )
  RETURNING bookings.id, bookings.reference_number;
END;
$$;

-- Looks up a booking by reference_number and reports whether it's still a
-- draft — replaces the plain `.select('id, is_draft')` that was hitting
-- the same cache bug.
CREATE OR REPLACE FUNCTION public.fleetflow_get_draft_by_reference(
  p_reference TEXT
) RETURNS TABLE(id UUID, is_draft BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT bookings.id, bookings.is_draft
  FROM public.bookings
  WHERE bookings.reference_number = UPPER(p_reference);
END;
$$;

-- Updates a draft's editable fields, and — only when p_finalize is true —
-- flips is_draft to false (turning it into a real submitted booking).
CREATE OR REPLACE FUNCTION public.fleetflow_update_draft_booking(
  p_id UUID,
  p_finalize BOOLEAN,
  p_guest_name TEXT,
  p_guest_nationality TEXT,
  p_guest_count INT,
  p_guest_phone TEXT,
  p_guest_email TEXT,
  p_guest_line_id TEXT,
  p_pickup_location TEXT,
  p_dropoff_location TEXT,
  p_pickup_datetime TIMESTAMPTZ,
  p_dropoff_datetime TIMESTAMPTZ,
  p_vehicle_type TEXT,
  p_driver_required BOOLEAN,
  p_special_requests TEXT
) RETURNS TABLE(
  id UUID, reference_number TEXT, guest_name TEXT, guest_nationality TEXT,
  guest_email TEXT, guest_count INT, pickup_location TEXT, dropoff_location TEXT,
  pickup_datetime TIMESTAMPTZ, dropoff_datetime TIMESTAMPTZ, vehicle_type TEXT,
  special_requests TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.bookings b SET
    guest_name = p_guest_name,
    guest_nationality = p_guest_nationality,
    guest_count = COALESCE(p_guest_count, b.guest_count),
    guest_phone = p_guest_phone,
    guest_email = p_guest_email,
    guest_line_id = p_guest_line_id,
    pickup_location = p_pickup_location,
    dropoff_location = p_dropoff_location,
    pickup_datetime = p_pickup_datetime,
    dropoff_datetime = p_dropoff_datetime,
    vehicle_type = COALESCE(p_vehicle_type, b.vehicle_type),
    driver_required = COALESCE(p_driver_required, b.driver_required),
    special_requests = p_special_requests,
    is_draft = CASE WHEN p_finalize THEN false ELSE b.is_draft END
  WHERE b.id = p_id
  RETURNING b.id, b.reference_number, b.guest_name, b.guest_nationality,
    b.guest_email, b.guest_count, b.pickup_location, b.dropoff_location,
    b.pickup_datetime, b.dropoff_datetime, b.vehicle_type, b.special_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fleetflow_create_draft_booking(TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN, TEXT) TO service_role, anon;
GRANT EXECUTE ON FUNCTION public.fleetflow_get_draft_by_reference(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fleetflow_update_draft_booking(UUID, BOOLEAN, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
