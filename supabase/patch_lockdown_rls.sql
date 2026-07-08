-- Security fix: the bookings table had a policy meant to let a guest look up
-- ONE booking by reference number, but it was written as USING (true) with
-- no reference_number condition at all. RLS policies filter row-by-row, not
-- by what WHERE clause the caller happens to send — so this actually let
-- ANY anonymous request (no login required) read every row in the bookings
-- table: guest names, phones, emails, budgets, everything.
--
-- The app code has been updated so guest-facing reference-number lookups
-- (app/(public)/book/status/[reference]/page.tsx and
-- app/api/public/bookings/[reference]/route.ts) now go through the
-- service-role client instead, with the reference_number filter enforced
-- in the query itself rather than relied on as an RLS condition. So this
-- policy is no longer needed by anything and can simply be dropped.
DROP POLICY IF EXISTS "Anyone can look up a booking by reference_number" ON public.bookings;

-- Same category of issue, smaller blast radius: notifications could be
-- inserted by literally anyone, no auth check at all. Nothing in the app
-- inserts notifications from the browser (session/anon key) — every
-- notification insert already goes through a server route using the
-- service-role client, which bypasses RLS entirely — so tightening this
-- doesn't break anything that currently works.
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Notifications are inserted by the server only" ON public.notifications
  FOR INSERT WITH CHECK (false);
