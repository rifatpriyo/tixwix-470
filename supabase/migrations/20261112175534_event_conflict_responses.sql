-- Business conflicts must not be retried as transient server failures.
begin;
create or replace function private.save_event(p_id uuid,p_version integer,p_data jsonb) returns public.events
language plpgsql security definer set search_path='' as $$
declare e public.events; old_status text; poster text; s timestamptz; en timestamptz; price numeric; cap numeric;
begin
 if not private.approved_host() then raise exception 'Approved host required' using errcode='42501'; end if;
 if p_id is null then
  insert into public.events(host_id,organizer_name) select auth.uid(),organizer_name from public.host_profiles where user_id=auth.uid() returning * into e;
 else
  select * into e from public.events where id=p_id for update;
  if not found then raise exception 'Event unavailable' using errcode='P0002'; end if;
  if e.host_id<>auth.uid() then raise exception 'Not owner' using errcode='42501'; end if;
  if e.version is distinct from p_version or e.status='pending_review' then raise exception 'Stale or locked event' using errcode='PT409'; end if;
 end if;
 old_status:=e.status;
 s:=nullif(p_data->>'starts_at','')::timestamptz; en:=nullif(p_data->>'ends_at','')::timestamptz;
 price:=nullif(p_data->>'price_minor','')::numeric; cap:=nullif(p_data->>'capacity','')::numeric;
 if price<>trunc(price) or cap<>trunc(cap) then raise exception 'Integer price and capacity required' using errcode='22023'; end if;
 poster:=nullif(p_data->>'poster','');
 if poster is not null and (split_part(poster,'/',1)<>auth.uid()::text or split_part(poster,'/',2)<>e.id::text or not exists(select 1 from storage.objects where bucket_id='event-posters' and name=poster)) then
  raise exception 'Invalid owned poster' using errcode='42501';
 end if;
 update public.events set title=coalesce(btrim(p_data->>'title'),''),description=coalesce(btrim(p_data->>'description'),''),category=coalesce(p_data->>'category',''),
 status=case when old_status='published' then 'draft' else old_status end,version=case when p_id is null then 1 else version+1 end,updated_at=now() where id=e.id returning * into e;
 insert into public.event_venues(event_id,name,address,city) values(e.id,coalesce(btrim(p_data->>'venue_name'),''),coalesce(btrim(p_data->>'address'),''),coalesce(btrim(p_data->>'city'),''))
 on conflict(event_id) do update set name=excluded.name,address=excluded.address,city=excluded.city;
 -- Division 2 editor has one session/category; preserve their stable IDs.
 if exists(select 1 from public.event_sessions where event_id=e.id) then
  update public.event_sessions set starts_at=s,ends_at=en where id=(select id from public.event_sessions where event_id=e.id order by id limit 1);
 else insert into public.event_sessions(event_id,starts_at,ends_at) values(e.id,s,en); end if;
 if exists(select 1 from public.event_ticket_categories where event_id=e.id) then
  update public.event_ticket_categories set name=coalesce(btrim(p_data->>'ticket_name'),''),price_minor=price,capacity=cap where id=(select id from public.event_ticket_categories where event_id=e.id order by id limit 1);
 else insert into public.event_ticket_categories(event_id,name,price_minor,capacity) values(e.id,coalesce(btrim(p_data->>'ticket_name'),''),price,cap); end if;
 if poster is null then delete from public.event_posters where event_id=e.id;
 else insert into public.event_posters(event_id,path) values(e.id,poster) on conflict(event_id) do update set path=excluded.path; end if;
 if p_id is null or old_status<>e.status then
  insert into public.event_reviews(event_id,actor_id,previous_status,new_status) values(e.id,auth.uid(),case when p_id is null then null else old_status end,e.status);
 end if;
 return e;
end; $$;
create or replace function private.transition_event(p_id uuid,p_version integer,p_action text,p_feedback text) returns public.events
language plpgsql security definer set search_path='' as $$
declare e public.events; previous text; target text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into e from public.events where id=p_id for update;
 if not found then raise exception 'Event unavailable' using errcode='P0002'; end if;
 if p_action='submit' then
  if not private.approved_host() or e.host_id<>auth.uid() then raise exception 'Owner required' using errcode='42501'; end if;
  target:='pending_review';
 elsif p_action in ('publish','request_changes') then
  if not public.has_role('admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  target:=case when p_action='publish' then 'published' else 'changes_requested' end;
 else raise exception 'Invalid action' using errcode='22023'; end if;
 if e.version is distinct from p_version then raise exception 'Stale decision; refresh' using errcode='PT409'; end if;
 if (p_action='submit' and e.status not in ('draft','changes_requested')) or (p_action<>'submit' and e.status<>'pending_review') then raise exception 'Invalid transition' using errcode='PT409'; end if;
 if p_action='submit' and (e.title !~ '[^[:space:]]' or e.description !~ '[^[:space:]]' or e.category='' or
  not exists(select 1 from public.event_venues where event_id=e.id and name ~ '[^[:space:]]' and address ~ '[^[:space:]]' and city ~ '[^[:space:]]') or
  not exists(select 1 from public.event_sessions where event_id=e.id) or exists(select 1 from public.event_sessions where event_id=e.id and (starts_at is null or ends_at is null or ends_at<=starts_at)) or
  not exists(select 1 from public.event_ticket_categories where event_id=e.id) or exists(select 1 from public.event_ticket_categories where event_id=e.id and (name !~ '[^[:space:]]' or price_minor is null or capacity is null))) then
  raise exception 'Complete event, venue, schedule and tickets before submission' using errcode='22023';
 end if;
 p_feedback:=nullif(regexp_replace(p_feedback,'^[[:space:]]+|[[:space:]]+$','','g'),'');
 if (p_action='request_changes' and p_feedback is null) or length(p_feedback)>2000 then raise exception 'Feedback required (maximum 2000)' using errcode='22023'; end if;
 previous:=e.status;
 update public.events set status=target,version=version+1,updated_at=now() where id=e.id returning * into e;
 insert into public.event_reviews(event_id,actor_id,previous_status,new_status,feedback) values(e.id,auth.uid(),previous,target,p_feedback);
 return e;
end; $$;
commit;
