-- Supabase's public-schema defaults grant view DML; explicitly keep this read-only.
begin;
revoke all on public.event_details from public,anon,authenticated;
grant select on public.event_details to anon,authenticated;
commit;
