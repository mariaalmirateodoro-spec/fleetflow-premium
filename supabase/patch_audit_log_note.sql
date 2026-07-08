-- Adds a free-text "note" column to audit_log, needed now that the activity
-- log covers actions beyond simple field changes (cancellation reasons,
-- approval comments, "added driver X", etc.).
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS note TEXT;
