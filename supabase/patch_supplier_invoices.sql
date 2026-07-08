-- Lets staff attach a supplier's invoice file to a quote, so the amount on
-- the invoice can be checked against what was quoted/charged. Suppliers
-- don't have their own login in this system — staff upload the invoice
-- themselves after receiving it by email/LINE/etc.

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS invoice_path TEXT;

-- Private storage bucket — files are only reachable via a short-lived signed
-- URL generated server-side, never a public link.
insert into storage.buckets (id, name, public)
values ('supplier-invoices', 'supplier-invoices', false)
on conflict (id) do nothing;

-- Any signed-in staff member (admin/manager/staff/finance — anyone who can
-- reach the booking detail screen) can upload and view invoices.
create policy "Staff can upload supplier invoices"
on storage.objects for insert
with check (
  bucket_id = 'supplier-invoices'
  and exists (select 1 from public.profiles where id = auth.uid())
);

create policy "Staff can view supplier invoices"
on storage.objects for select
using (
  bucket_id = 'supplier-invoices'
  and exists (select 1 from public.profiles where id = auth.uid())
);

create policy "Staff can replace supplier invoices"
on storage.objects for update
using (
  bucket_id = 'supplier-invoices'
  and exists (select 1 from public.profiles where id = auth.uid())
);

create policy "Staff can delete supplier invoices"
on storage.objects for delete
using (
  bucket_id = 'supplier-invoices'
  and exists (select 1 from public.profiles where id = auth.uid())
);
