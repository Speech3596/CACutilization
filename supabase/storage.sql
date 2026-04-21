-- Storage buckets + policies.
-- Run in the Supabase SQL editor (buckets are in the `storage` schema).

insert into storage.buckets (id, name, public)
values
  ('student-snapshots','student-snapshots', false),
  ('access-logs','access-logs', false),
  ('reports','reports', false)
on conflict (id) do nothing;

-- Everyone authenticated may SELECT (download via signed URL).
drop policy if exists authenticated_read on storage.objects;
create policy authenticated_read on storage.objects
  for select to authenticated using (true);

-- Admin may write to any CANB bucket.
drop policy if exists admin_write on storage.objects;
create policy admin_write on storage.objects
  for all to authenticated
  using (
    bucket_id in ('student-snapshots','access-logs','reports')
    and (
      select role from public.profiles where id = auth.uid()
    ) = 'admin'
  )
  with check (
    bucket_id in ('student-snapshots','access-logs','reports')
    and (
      select role from public.profiles where id = auth.uid()
    ) = 'admin'
  );
