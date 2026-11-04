-- Run ONLY in the trusted Supabase SQL Editor as the project owner.
-- Copy the verified UUID from Authentication > Users. Never identify an admin by metadata.
begin;
do $$
declare target_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE before running
begin
  if target_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the placeholder with the verified account UUID';
  end if;
  if not exists (select 1 from auth.users where id = target_id and email_confirmed_at is not null) then
    raise exception 'Expected an existing account with a confirmed email';
  end if;
  insert into public.user_roles(user_id, role) values (target_id, 'admin') on conflict do nothing;
end $$;
commit;
