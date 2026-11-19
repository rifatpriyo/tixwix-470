begin;
-- All inventory mutations take the existing parent event lock. This also serializes
-- Sprint 1 edits, publication changes, cancellation and expiry with checkout.
alter table public.event_ticket_categories add column inventory_kind text not null default 'general_admission' check (inventory_kind in ('general_admission','numbered'));
alter table public.event_sessions add constraint session_event_identity unique(id,event_id);
alter table public.event_ticket_categories add constraint category_event_identity unique(id,event_id);
create table public.event_seats (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 category_id uuid not null, section text not null default 'Main', row_label text not null, seat_number integer not null check(seat_number between 1 and 12),
 row_index integer not null check(row_index between 0 and 7), columns integer not null check(columns between 1 and 12),
 label text not null, unique(event_id,label), unique(id,event_id),
 foreign key(category_id,event_id) references public.event_ticket_categories(id,event_id)
);
create index seats_category on public.event_seats(category_id);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references auth.users(id),
 event_id uuid not null references public.events(id), session_id uuid not null,
 idempotency_key uuid not null, request jsonb not null,
 state text not null default 'pending' check(state in ('pending','canceled','expired')),
 expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp(),
 total_minor bigint not null check(total_minor>=0), currency text not null default 'BDT' check(currency='BDT'),
 unique(customer_id,idempotency_key), foreign key(session_id,event_id) references public.event_sessions(id,event_id)
);
create index bookings_session_pending on public.bookings(session_id,expires_at) where state='pending';
create index bookings_event on public.bookings(event_id,session_id);
create index bookings_customer on public.bookings(customer_id,created_at desc);
create table public.booking_items (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 category_id uuid not null references public.event_ticket_categories(id), seat_id uuid references public.event_seats(id),
 label text not null, category_name text not null, quantity integer not null check(quantity between 1 and 20),
 unit_price_minor bigint not null check(unit_price_minor>=0), check(seat_id is null or quantity=1), unique(booking_id,seat_id)
);
create index booking_items_booking on public.booking_items(booking_id);
create index booking_items_seat on public.booking_items(seat_id) where seat_id is not null;
create index booking_items_category on public.booking_items(category_id);
create table public.booking_history (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 state text not null check(state in ('pending','canceled','expired')), created_at timestamptz not null default clock_timestamp()
);
create index booking_history_booking on public.booking_history(booking_id,created_at);
alter table public.event_seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_history enable row level security;
revoke all on public.event_seats,public.bookings,public.booking_items,public.booking_history from public,anon,authenticated;
grant select on public.bookings,public.booking_items,public.booking_history to authenticated;
create policy own_bookings on public.bookings for select to authenticated using(customer_id=(select auth.uid()));
create policy own_items on public.booking_items for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and b.customer_id=(select auth.uid())));
create policy own_history on public.booking_history for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and b.customer_id=(select auth.uid())));
-- Private helpers are not exposed through PostgREST. Public entry points below
-- are invokers, with explicit grants and identity checks inside each workflow.
create function private.hold_duration() returns interval language sql immutable set search_path='' as $$ select interval '10 minutes' $$;
create function private.record_booking_state() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or new.state is distinct from old.state then
  insert into public.booking_history(booking_id,state) values(new.id,new.state);
 end if;
 return new;
end; $$;
create trigger booking_state_history after insert or update of state on public.bookings for each row execute function private.record_booking_state();
create function private.expire_session(p_session uuid) returns void language sql set search_path='' as $$
 update public.bookings set state='expired' where session_id=p_session and state='pending' and expires_at<=clock_timestamp();
$$;
create function private.booking_json(p_id uuid) returns jsonb language sql set search_path='' as $$
 select to_jsonb(b) - 'request' - 'customer_id' - 'idempotency_key' || jsonb_build_object(
 'server_now',clock_timestamp(),'items',coalesce((select jsonb_agg(to_jsonb(i)-'booking_id' order by i.label,i.id) from public.booking_items i where i.booking_id=b.id),'[]'::jsonb))
 from public.bookings b where b.id=p_id;
$$;
create function private.session_availability(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events; s public.event_sessions;
begin
 select * into s from public.event_sessions where id=p_session;
 if not found then raise exception 'Session unavailable' using errcode='P0002'; end if;
 select * into e from public.events where id=s.event_id for update;
 if e.status<>'published' then raise exception 'Event unavailable' using errcode='P0002'; end if;
 perform private.expire_session(s.id);
 return jsonb_build_object('session_id',s.id,'server_now',clock_timestamp(),'eligible',coalesce(s.starts_at>clock_timestamp(),false),
 'preview','concert-hall-v1',
 'seats',coalesce((select jsonb_agg(jsonb_build_object('id',st.id,'category_id',st.category_id,'section',st.section,'row_label',st.row_label,'row_index',st.row_index,'seat_number',st.seat_number,'columns',st.columns,'label',st.label,
 'available',not exists(select 1 from public.booking_items i join public.bookings b on b.id=i.booking_id where i.seat_id=st.id and b.session_id=s.id and b.state='pending' and b.expires_at>clock_timestamp())) order by st.row_index,st.seat_number) from public.event_seats st where st.event_id=e.id),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'price_minor',t.price_minor,'kind',t.inventory_kind,'remaining',case when t.inventory_kind='general_admission' then greatest(0,t.capacity-coalesce((select sum(i.quantity) from public.booking_items i join public.bookings b on b.id=i.booking_id where i.category_id=t.id and b.session_id=s.id and b.state='pending' and b.expires_at>clock_timestamp()),0)) else null end) order by t.id) from public.event_ticket_categories t where t.event_id=e.id),'[]'::jsonb));
end; $$;
create function private.create_reservation(p_session uuid,p_key uuid,p_seats uuid[],p_ga jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events; s public.event_sessions; b public.bookings; canonical jsonb; ids uuid[]; item record; requested integer; used bigint; total bigint:=0; stamp timestamptz;
begin
 if auth.uid() is null or not public.has_role('customer') then raise exception 'Customer required' using errcode='42501'; end if;
 if p_session is null or p_key is null or p_seats is null or p_ga is null or jsonb_typeof(p_ga)<>'array' then raise exception 'Invalid request' using errcode='22023'; end if;
 if cardinality(p_seats)>20 or jsonb_array_length(p_ga)>20 then raise exception 'Maximum 20 items' using errcode='22023'; end if;
 select coalesce(array_agg(x order by x),'{}'::uuid[]) into ids from unnest(p_seats) x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or array_position(ids,null) is not null then raise exception 'Duplicate or invalid seat' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_ga) x where jsonb_typeof(x)<>'object' or (x->>'quantity') is null or (x->>'quantity') !~ '^[0-9]+$' or (x->>'quantity')::numeric not between 1 and 20 or (x->>'category_id') is null) then raise exception 'Invalid quantities' using errcode='22023'; end if;
 if (select count(distinct (x->>'category_id')::uuid) from jsonb_array_elements(p_ga) x)<>jsonb_array_length(p_ga) then raise exception 'Duplicate category' using errcode='22023'; end if;
 if cardinality(ids)+coalesce((select sum((x->>'quantity')::integer) from jsonb_array_elements(p_ga) x),0) not between 1 and 20 then raise exception 'Choose 1 to 20 tickets' using errcode='22023'; end if;
 select jsonb_build_object('session_id',p_session,'seats',to_jsonb(ids),'ga',coalesce((select jsonb_agg(jsonb_build_object('category_id',(x->>'category_id')::uuid,'quantity',(x->>'quantity')::integer) order by (x->>'category_id')::uuid) from jsonb_array_elements(p_ga) x),'[]'::jsonb)) into canonical;
 -- Per-customer retry lock precedes the event lock, including cross-session retries.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into b from public.bookings where customer_id=auth.uid() and idempotency_key=p_key;
 if found then
  if b.request<>canonical then raise exception 'Retry key reused with different selection' using errcode='PT409'; end if;
  perform 1 from public.events where id=b.event_id for update;
  perform private.expire_session(b.session_id);
  return private.booking_json(b.id);
 end if;
 select * into s from public.event_sessions where id=p_session;
 if not found then raise exception 'Session unavailable' using errcode='P0002'; end if;
 select * into e from public.events where id=s.event_id for update;
 -- Re-read after taking the lock: a host may have edited the schedule while waiting.
 select * into s from public.event_sessions where id=p_session;
 stamp:=clock_timestamp();
 if e.status<>'published' or s.starts_at is null or s.starts_at<=stamp then raise exception 'Session is not accepting reservations' using errcode='PT409'; end if;
 perform private.expire_session(s.id);
 if (select count(*) from public.event_seats st join public.event_ticket_categories t on t.id=st.category_id where st.id=any(ids) and st.event_id=e.id and t.inventory_kind='numbered' and t.price_minor is not null)<>cardinality(ids) then raise exception 'Invalid seat selection' using errcode='22023'; end if;
 if exists(select 1 from public.booking_items i join public.bookings booked on booked.id=i.booking_id where i.seat_id=any(ids) and booked.session_id=s.id and booked.state='pending' and booked.expires_at>stamp) then raise exception 'A selected seat is unavailable' using errcode='PT409'; end if;
 for item in select * from jsonb_array_elements(p_ga) loop
  requested:=(item.value->>'quantity')::integer;
  if not exists(select 1 from public.event_ticket_categories t where t.id=(item.value->>'category_id')::uuid and t.event_id=e.id and t.inventory_kind='general_admission' and t.capacity is not null and t.price_minor is not null) then raise exception 'Invalid admission category' using errcode='22023'; end if;
  select coalesce(sum(i.quantity),0) into used from public.booking_items i join public.bookings booked on booked.id=i.booking_id where i.category_id=(item.value->>'category_id')::uuid and booked.session_id=s.id and booked.state='pending' and booked.expires_at>stamp;
  if used+requested>(select capacity from public.event_ticket_categories where id=(item.value->>'category_id')::uuid) then raise exception 'Not enough tickets remain' using errcode='PT409'; end if;
 end loop;
 insert into public.bookings(customer_id,event_id,session_id,idempotency_key,request,expires_at,total_minor) values(auth.uid(),e.id,s.id,p_key,canonical,stamp+private.hold_duration(),0) returning * into b;
 insert into public.booking_items(booking_id,category_id,seat_id,label,category_name,quantity,unit_price_minor)
 select b.id,t.id,st.id,st.section||' '||st.label,t.name,1,t.price_minor from public.event_seats st join public.event_ticket_categories t on t.id=st.category_id where st.id=any(ids);
 insert into public.booking_items(booking_id,category_id,label,category_name,quantity,unit_price_minor)
 select b.id,t.id,t.name,t.name,(x->>'quantity')::integer,t.price_minor from jsonb_array_elements(p_ga) x join public.event_ticket_categories t on t.id=(x->>'category_id')::uuid;
 select sum(quantity*unit_price_minor) into total from public.booking_items where booking_id=b.id;
 update public.bookings set total_minor=total where id=b.id;
 return private.booking_json(b.id);
end; $$;
create function private.reservation(p_id uuid,p_release boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_id and customer_id=auth.uid();
 if not found then raise exception 'Reservation unavailable' using errcode='P0002'; end if;
 perform 1 from public.events where id=b.event_id for update;
 perform private.expire_session(b.session_id);
 if p_release then update public.bookings set state='canceled' where id=b.id and state='pending'; end if;
 return private.booking_json(b.id);
end; $$;
-- Existing editor writes keep IDs; guard its capacity/schedule changes as well.
create function private.guard_inventory_edit() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.events where id=old.event_id for update;
 if tg_table_name='event_ticket_categories' then
  if new.event_id<>old.event_id or new.inventory_kind<>old.inventory_kind then
   if exists(select 1 from public.booking_items where category_id=old.id) then raise exception 'Category has reservations' using errcode='PT409'; end if;
  end if;
  if new.capacity is distinct from old.capacity then
   if (select count(*) from public.event_seats where category_id=old.id)>coalesce(new.capacity,0) or exists(
    select 1 from public.booking_items i join public.bookings b on b.id=i.booking_id where i.category_id=old.id and b.state='pending' and b.expires_at>clock_timestamp() group by b.session_id having sum(i.quantity)>coalesce(new.capacity,0)
   ) then raise exception 'Capacity is below allocated inventory' using errcode='PT409'; end if;
  end if;
 else
  if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.event_id<>old.event_id) and exists(select 1 from public.bookings where session_id=old.id and state='pending' and expires_at>clock_timestamp()) then raise exception 'Release active reservations before rescheduling' using errcode='PT409'; end if;
 end if;
 return new;
end; $$;
create trigger guard_ticket_inventory before update on public.event_ticket_categories for each row execute function private.guard_inventory_edit();
create trigger guard_session_inventory before update on public.event_sessions for each row execute function private.guard_inventory_edit();
create function private.assign_seating(p_event uuid,p_version integer,p_category uuid,p_rows integer,p_columns integer) returns void language plpgsql security definer set search_path='' as $$
declare e public.events; r integer; c integer;
begin
 if not private.approved_host() then raise exception 'Approved host required' using errcode='42501'; end if;
 select * into e from public.events where id=p_event for update;
 if not found or e.host_id<>auth.uid() then raise exception 'Owned event required' using errcode='42501'; end if;
 if e.version is distinct from p_version or e.status='pending_review' then raise exception 'Refresh event before editing' using errcode='PT409'; end if;
 if p_rows is null or p_columns is null or p_rows not between 1 and 8 or p_columns not between 1 and 12 then raise exception 'Layout supports 1-8 rows and 1-12 columns' using errcode='22023'; end if;
 if not exists(select 1 from public.event_ticket_categories where id=p_category and event_id=e.id and capacity>=p_rows*p_columns) then raise exception 'Choose a category with enough capacity' using errcode='22023'; end if;
 if exists(select 1 from public.booking_items where category_id=p_category) then raise exception 'Layout has reservation history and cannot be replaced' using errcode='PT409'; end if;
 -- One supported hall/category per event; other categories remain general admission.
 if exists(select 1 from public.event_seats where event_id=e.id and category_id<>p_category) then raise exception 'This event already has a mapped category' using errcode='PT409'; end if;
 delete from public.event_seats where category_id=p_category;
 update public.event_ticket_categories set inventory_kind='numbered' where id=p_category;
 for r in 0..p_rows-1 loop
  for c in 1..p_columns loop
   insert into public.event_seats(event_id,category_id,row_label,row_index,seat_number,columns,label) values(e.id,p_category,chr(65+r),r,c,p_columns,chr(65+r)||c::text);
  end loop;
 end loop;
 update public.events set status=case when status='published' then 'draft' else status end,version=version+1,updated_at=clock_timestamp() where id=e.id;
 if e.status='published' then insert into public.event_reviews(event_id,actor_id,previous_status,new_status) values(e.id,auth.uid(),'published','draft'); end if;
end; $$;
create function public.session_availability(p_session uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_availability(p_session) $$;
create function public.create_reservation(p_session uuid,p_key uuid,p_seats uuid[],p_ga jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.create_reservation(p_session,p_key,p_seats,p_ga) $$;
create function public.reservation(p_id uuid,p_release boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.reservation(p_id,p_release) $$;
create function public.assign_seating(p_event uuid,p_version integer,p_category uuid,p_rows integer,p_columns integer) returns void language sql security invoker set search_path='' as $$ select private.assign_seating(p_event,p_version,p_category,p_rows,p_columns) $$;
revoke all on function private.hold_duration(),private.record_booking_state(),private.expire_session(uuid),private.booking_json(uuid),private.guard_inventory_edit() from public,anon,authenticated;
revoke all on function private.session_availability(uuid),public.session_availability(uuid) from public,anon,authenticated;
grant execute on function private.session_availability(uuid),public.session_availability(uuid) to anon,authenticated;
revoke all on function private.create_reservation(uuid,uuid,uuid[],jsonb),public.create_reservation(uuid,uuid,uuid[],jsonb),private.reservation(uuid,boolean),public.reservation(uuid,boolean),private.assign_seating(uuid,integer,uuid,integer,integer),public.assign_seating(uuid,integer,uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.create_reservation(uuid,uuid,uuid[],jsonb),public.create_reservation(uuid,uuid,uuid[],jsonb),private.reservation(uuid,boolean),public.reservation(uuid,boolean),private.assign_seating(uuid,integer,uuid,integer,integer),public.assign_seating(uuid,integer,uuid,integer,integer) to authenticated;
commit;