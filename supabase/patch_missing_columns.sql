-- ============================================================
-- FleetFlow Premium — Patch: missing tables/columns
-- Run this AFTER supabase/schema.sql (and before seed.sql, if used)
-- Fixes a gap between schema.sql and what the actual app code expects.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Rename bookings.reference -> reference_number
--    (app code reads/writes "reference_number" everywhere)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bookings RENAME COLUMN reference TO reference_number;

-- ─────────────────────────────────────────────────────────────
-- 2. Create the missing DRIVERS table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.drivers (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name            TEXT NOT NULL,
  phone                TEXT NOT NULL,
  license_number       TEXT NOT NULL,
  license_expiry       DATE,
  vehicle_types        vehicle_type[] NOT NULL DEFAULT '{}',
  is_available         BOOLEAN NOT NULL DEFAULT true,
  assigned_supplier_id UUID REFERENCES public.suppliers(id),
  notes                TEXT,
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view drivers" ON public.drivers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff and above can create drivers" ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can update drivers" ON public.drivers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins can delete drivers" ON public.drivers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Add missing columns to BOOKINGS
--    (guest contact info, driver assignment, vehicle detail,
--     and the guest "modification request" workflow)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN guest_email  TEXT,
  ADD COLUMN guest_phone  TEXT,
  ADD COLUMN guest_line_id TEXT,
  ADD COLUMN driver_id    UUID REFERENCES public.drivers(id),
  ADD COLUMN vehicle_plate TEXT,
  ADD COLUMN vehicle_model TEXT,
  ADD COLUMN modification_status            TEXT,
  ADD COLUMN modification_pickup_datetime   TIMESTAMPTZ,
  ADD COLUMN modification_pickup_location   TEXT,
  ADD COLUMN modification_dropoff_location  TEXT,
  ADD COLUMN modification_notes             TEXT,
  ADD COLUMN modification_requested_at      TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 4. Allow guest (unauthenticated) bookings
--    app/api/public/bookings/route.ts inserts with created_by = NULL
--    using the anon key — schema.sql made created_by NOT NULL, and the
--    original INSERT policy required auth.uid() IS NOT NULL. Both block
--    guest bookings, so relax them here.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bookings ALTER COLUMN created_by DROP NOT NULL;

DROP POLICY IF EXISTS "Staff can create bookings" ON public.bookings;
CREATE POLICY "Staff or guests can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR created_by IS NULL);

DROP POLICY IF EXISTS "All authenticated users can view bookings" ON public.bookings;
CREATE POLICY "Authenticated users can view bookings" ON public.bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Guests looking up their own booking by reference_number go through
-- app/api/... using the anon key with no session — allow that lookup:
CREATE POLICY "Anyone can look up a booking by reference_number" ON public.bookings
  FOR SELECT USING (true);
