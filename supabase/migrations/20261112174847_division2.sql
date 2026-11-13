begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.events (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references public.host_profiles(user_id) on delete cascade,
 slug text not null unique default ('event-' || gen_random_uuid()::text),
 title text not null default '' check(length(title)<=160), description text not null default '' check(length(description)<=8000),
 category text not null default '' check(category in ('','sports','concert','movie','comedy','other')),
 organizer_name text not null,
 status text not null default 'draft' check(status in ('draft','changes_requested','pending_review','published')),
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index events_host on public.events(host_id,updated_at desc);
create index events_status on public.events(status,category);
create table public.event_venues (
 event_id uuid primary key references public.events(id) on delete cascade,
 name text not null default '' check(length(name)<=160), address text not null default '' check(length(address)<=500), city text not null default '' check(length(city)<=100)
);
create index event_venues_city on public.event_venues(lower(city));
create table public.event_sessions (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 starts_at timestamptz, ends_at timestamptz, check(ends_at>starts_at)
);
create index event_sessions_event on public.event_sessions(event_id,starts_at);
create index event_sessions_start on public.event_sessions(starts_at,event_id);
create table public.event_ticket_categories (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 name text not null default '' check(length(name)<=100), price_minor bigint check(price_minor between 0 and 1000000000), capacity integer check(capacity between 1 and 10000000)
);
create index event_tickets_event on public.event_ticket_categories(event_id);
create table public.event_posters (event_id uuid primary key references public.events(id) on delete cascade, path text not null unique);
create table public.event_reviews (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 previous_status text check(previous_status in ('draft','changes_requested','pending_review','published')),
 new_status text not null check(new_status in ('draft','changes_requested','pending_review','published')),
 feedback text check(length(feedback)<=2000), created_at timestamptz not null default now(),
 check(new_status <> 'changes_requested' or (feedback is not null and feedback ~ '[^[:space:]]'))
);
create index event_reviews_event on public.event_reviews(event_id,created_at);
create index event_reviews_actor on public.event_reviews(actor_id);

create function private.approved_host() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.has_role('host') and exists(select 1 from public.host_profiles where user_id=auth.uid());
$$;
revoke all on function private.approved_host() from public;
grant execute on function private.approved_host() to authenticated;
alter table public.events enable row level security;
create policy events_public on public.events for select to anon,authenticated using(status='published');
create policy events_managers on public.events for select to authenticated using((host_id=(select auth.uid()) and (select private.approved_host())) or (select public.has_role('admin')));
alter table public.event_venues enable row level security;
alter table public.event_sessions enable row level security;
alter table public.event_ticket_categories enable row level security;
alter table public.event_posters enable row level security;
alter table public.event_reviews enable row level security;
create policy venue_read on public.event_venues for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id));
create policy session_read on public.event_sessions for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id));
create policy tickets_read on public.event_ticket_categories for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id));
create policy poster_read on public.event_posters for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id));
create policy reviews_read on public.event_reviews for select to authenticated using(exists(select 1 from public.events e where e.id=event_id and ((e.host_id=(select auth.uid()) and (select private.approved_host())) or (select public.has_role('admin')))));
revoke all on public.events,public.event_venues,public.event_sessions,public.event_ticket_categories,public.event_posters,public.event_reviews from public,anon,authenticated;
grant select on public.events,public.event_venues,public.event_sessions,public.event_ticket_categories,public.event_posters to anon,authenticated;
grant select on public.event_reviews to authenticated;

-- No direct DML grants: all child changes and transitions share the parent lock.
create function private.save_event(p_id uuid,p_version integer,p_data jsonb) returns public.events
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
  if e.version is distinct from p_version or e.status='pending_review' then raise exception 'Stale or locked event' using errcode='40001'; end if;
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
create function private.transition_event(p_id uuid,p_version integer,p_action text,p_feedback text) returns public.events
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
 if e.version is distinct from p_version then raise exception 'Stale decision; refresh' using errcode='40001'; end if;
 if (p_action='submit' and e.status not in ('draft','changes_requested')) or (p_action<>'submit' and e.status<>'pending_review') then raise exception 'Invalid transition' using errcode='40001'; end if;
 if p_action='submit' and (btrim(e.title)='' or btrim(e.description)='' or e.category='' or
  not exists(select 1 from public.event_venues where event_id=e.id and btrim(name)<>'' and btrim(address)<>'' and btrim(city)<>'') or
  not exists(select 1 from public.event_sessions where event_id=e.id) or exists(select 1 from public.event_sessions where event_id=e.id and (starts_at is null or ends_at is null or ends_at<=starts_at)) or
  not exists(select 1 from public.event_ticket_categories where event_id=e.id) or exists(select 1 from public.event_ticket_categories where event_id=e.id and (btrim(name)='' or price_minor is null or capacity is null))) then
  raise exception 'Complete event, venue, schedule and tickets before submission' using errcode='22023';
 end if;
 p_feedback:=nullif(regexp_replace(p_feedback,'^[[:space:]]+|[[:space:]]+$','','g'),'');
 if (p_action='request_changes' and p_feedback is null) or length(p_feedback)>2000 then raise exception 'Feedback required (maximum 2000)' using errcode='22023'; end if;
 previous:=e.status;
 update public.events set status=target,version=version+1,updated_at=now() where id=e.id returning * into e;
 insert into public.event_reviews(event_id,actor_id,previous_status,new_status,feedback) values(e.id,auth.uid(),previous,target,p_feedback);
 return e;
end; $$;
revoke all on function private.save_event(uuid,integer,jsonb),private.transition_event(uuid,integer,text,text) from public;
grant execute on function private.save_event(uuid,integer,jsonb),private.transition_event(uuid,integer,text,text) to authenticated;
create function public.save_event(p_id uuid,p_version integer,p_data jsonb) returns public.events language sql security invoker set search_path='' as $$ select private.save_event(p_id,p_version,p_data); $$;
create function public.transition_event(p_id uuid,p_version integer,p_action text,p_feedback text default null) returns public.events language sql security invoker set search_path='' as $$ select private.transition_event(p_id,p_version,p_action,p_feedback); $$;
revoke all on function public.save_event(uuid,integer,jsonb),public.transition_event(uuid,integer,text,text) from public,anon;
grant execute on function public.save_event(uuid,integer,jsonb),public.transition_event(uuid,integer,text,text) to authenticated;

create view public.event_details with(security_invoker=true) as
select e.*, (select jsonb_build_object('name',v.name,'address',v.address,'city',v.city) from public.event_venues v where v.event_id=e.id) as venue,
 coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.id) from public.event_sessions s where s.event_id=e.id),'[]'::jsonb) as sessions,
 coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'price_minor',t.price_minor,'capacity',t.capacity) order by t.id) from public.event_ticket_categories t where t.event_id=e.id),'[]'::jsonb) as tickets,
 (select path from public.event_posters p where p.event_id=e.id) as poster,
 (select min(starts_at) from public.event_sessions s where s.event_id=e.id and ends_at>now()) as next_session,
 (select min(price_minor) from public.event_ticket_categories t where t.event_id=e.id) as starting_price
from public.events e;
grant select on public.event_details to anon,authenticated;
create function public.search_events(p_query text default '',p_category text default '',p_location text default '',p_date date default null,p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
 with matches as (
  select d.* from public.event_details d where d.status='published' and d.next_session is not null
  and (p_query='' or strpos(lower(d.title),lower(p_query))>0)
  and (p_category='' or d.category=p_category)
  and (p_location='' or strpos(lower(d.venue->>'city'),lower(p_location))>0)
  and (p_date is null or exists(select 1 from public.event_sessions s where s.event_id=d.id and s.starts_at>=p_date::timestamp at time zone 'Asia/Dhaka' and s.starts_at<(p_date+1)::timestamp at time zone 'Asia/Dhaka'))
 ), page as (select * from matches order by next_session,id limit 12 offset ((greatest(1,least(coalesce(p_page,1),1000))-1)*12))
 select jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(page) order by next_session,id) from page),'[]'::jsonb),'total',(select count(*) from matches),'page',greatest(1,least(coalesce(p_page,1),1000)),'pageSize',12);
$$;
revoke all on function public.search_events(text,text,text,date,integer) from public;
grant execute on function public.search_events(text,text,text,date,integer) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-posters','event-posters',false,5242880,array['image/jpeg','image/png','image/webp']);
-- Immutable object names: no UPDATE policy. A published asset cannot be overwritten.
create policy event_poster_upload on storage.objects for insert to authenticated with check(
 bucket_id='event-posters' and (select private.approved_host()) and split_part(name,'/',1)=(select auth.uid())::text and
 exists(select 1 from public.events e where e.id::text=split_part(name,'/',2) and e.host_id=(select auth.uid()) and e.status<>'pending_review'));
create policy event_poster_public_download on storage.objects for select to anon,authenticated using(bucket_id='event-posters' and
 exists(select 1 from public.event_posters p join public.events e on e.id=p.event_id where p.path=name and e.status='published'));
create policy event_poster_private_download on storage.objects for select to authenticated using(bucket_id='event-posters' and
 exists(select 1 from public.events e where e.id::text=split_part(name,'/',2) and ((e.host_id=(select auth.uid()) and (select private.approved_host())) or (select public.has_role('admin')))));
create policy event_poster_cleanup on storage.objects for delete to authenticated using(bucket_id='event-posters' and split_part(name,'/',1)=(select auth.uid())::text and (select private.approved_host()) and not exists(select 1 from public.event_posters p where p.path=name));
commit;
