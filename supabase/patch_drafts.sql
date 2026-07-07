-- ============================================================
-- FleetFlow Premium — Patch: draft bookings
-- Run this AFTER schema.sql + patch_missing_columns.sql
-- Adds support for saving an incomplete booking as a draft
-- (both staff-created and guest-created), to be finished later.
-- ============================================================

-- 1. Flag column
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_bookings_is_draft ON public.bookings(is_draft);

-- 2. A draft, by definition, may be missing fields that are normally required.
--    Relax NOT NULL on the core fields so a partially-filled booking can be saved.
--    (Non-draft submissions still enforce these at the application layer.)
ALTER TABLE public.bookings ALTER COLUMN guest_name        DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN guest_nationality DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN pickup_location    DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN dropoff_location   DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN pickup_datetime    DROP NOT NULL;
