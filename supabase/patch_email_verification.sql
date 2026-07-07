-- ============================================================
-- FleetFlow Premium — Patch: guest email verification
-- Run this AFTER schema.sql + patch_missing_columns.sql + patch_drafts.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications(email);

-- RLS is on, but with NO policies for anon/authenticated — this table is only
-- ever touched by our API routes using the service-role key (never directly
-- from the browser), so "enabled with zero policies" = fully locked down.
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
