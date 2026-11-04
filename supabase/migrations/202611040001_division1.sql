-- Sprint 1, Division 1. Apply once with Supabase migrations; never reset production.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('customer', 'host', 'admin')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.host_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  previous_application_id uuid unique references public.host_applications(id),
  organizer_name text not null check (char_length(regexp_replace(organizer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 2 and 120),
  contact_email text not null check (char_length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  contact_phone text not null check (contact_phone ~ '^\+?[0-9 ()-]{7,25}$' and char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) between 7 and 15),
  description text not null check (char_length(regexp_replace(description, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 30 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  feedback text check (char_length(feedback) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and feedback is null)
    or (status = 'approved' and reviewed_at is not null)
    or (status = 'rejected' and reviewed_at is not null and feedback ~ '[^[:space:]]' and feedback is not null)
  )
);
create unique index one_pending_application on public.host_applications(applicant_id) where status = 'pending';
create unique index one_approved_application on public.host_applications(applicant_id) where status = 'approved';
create index applications_owner_created on public.host_applications(applicant_id, created_at desc, id desc);
create index applications_status_created on public.host_applications(status, created_at desc);

create table public.host_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  application_id uuid not null unique references public.host_applications(id),
  organizer_name text not null,
  contact_email text not null,
  contact_phone text not null,
  description text not null,
  approved_at timestamptz not null default now()
);

create table public.host_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.host_applications(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  feedback text check (char_length(feedback) <= 2000),
  created_at timestamptz not null default now(),
  check (decision <> 'rejected' or (feedback is not null and feedback ~ '[^[:space:]]'))
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger applications_updated before update on public.host_applications for each row execute function public.touch_updated_at();

create function public.initialize_customer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));
  insert into public.user_roles(user_id, role) values (new.id, 'customer');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.initialize_customer();

-- Include existing accounts without reading roles from editable metadata.
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 100) from auth.users
on conflict (id) do nothing;
insert into public.user_roles(user_id, role) select id, 'customer' from public.profiles on conflict do nothing;

create function public.has_role(requested_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = requested_role);
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.host_applications enable row level security;
alter table public.host_profiles enable row level security;
alter table public.host_application_reviews enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.has_role('admin')));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select public.has_role('admin')));
create policy applications_read on public.host_applications for select to authenticated
using (applicant_id = (select auth.uid()) or (select public.has_role('admin')));
create policy hosts_read on public.host_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.has_role('admin')));
create policy reviews_read on public.host_application_reviews for select to authenticated
using (exists (select 1 from public.host_applications a where a.id = application_id
  and (a.applicant_id = (select auth.uid()) or (select public.has_role('admin')))));

-- Ordinary clients can only read permitted rows and change their display name.
revoke all on public.profiles, public.user_roles, public.host_applications,
  public.host_profiles, public.host_application_reviews from public, anon, authenticated;
grant select on public.profiles, public.user_roles, public.host_applications,
  public.host_profiles, public.host_application_reviews to authenticated;
grant update(display_name) on public.profiles to authenticated;

create function public.submit_host_application(
  p_organizer_name text, p_contact_email text, p_contact_phone text, p_description text
) returns public.host_applications
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.host_applications;
  result public.host_applications;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serializes concurrent submissions and reviews for this applicant.
  perform 1 from public.profiles where id = actor for update;
  if not found then raise exception 'Profile unavailable' using errcode = '42501'; end if;
  if public.has_role('host') then raise exception 'Host access already approved' using errcode = '23505'; end if;
  select * into previous from public.host_applications where applicant_id = actor order by created_at desc, id desc limit 1;
  if previous.status in ('pending', 'approved') then
    raise exception 'An application is already pending or approved' using errcode = '23505';
  end if;
  insert into public.host_applications(applicant_id, previous_application_id, organizer_name, contact_email, contact_phone, description)
  values (actor, previous.id, regexp_replace(p_organizer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), lower(btrim(p_contact_email)), btrim(p_contact_phone), regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
  returning * into result;
  return result;
end;
$$;

create function public.review_host_application(p_application_id uuid, p_decision text, p_feedback text default null)
returns public.host_applications
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.host_applications;
  owner_id uuid;
  clean_feedback text := nullif(regexp_replace(p_feedback, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
begin
  if actor is null or not public.has_role('admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;
  if (p_decision = 'rejected' and clean_feedback is null) or char_length(clean_feedback) > 2000 then
    raise exception 'Rejection requires feedback of 1 to 2000 characters' using errcode = '22023';
  end if;
  select applicant_id into owner_id from public.host_applications where id = p_application_id;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = owner_id for update;
  select * into target from public.host_applications where id = p_application_id for update;
  if target.status = p_decision then return target; end if; -- Idempotent retry, no new review/role.
  if target.status <> 'pending' then raise exception 'Application already reviewed' using errcode = '23505'; end if;
  update public.host_applications set status = p_decision, reviewed_by = actor, reviewed_at = now(), feedback = clean_feedback
  where id = p_application_id returning * into target;
  insert into public.host_application_reviews(application_id, reviewer_id, decision, feedback)
  values (target.id, actor, p_decision, clean_feedback);
  if p_decision = 'approved' then
    insert into public.user_roles(user_id, role, granted_by) values (target.applicant_id, 'host', actor) on conflict do nothing;
    insert into public.host_profiles(user_id, application_id, organizer_name, contact_email, contact_phone, description)
    values (target.applicant_id, target.id, target.organizer_name, target.contact_email, target.contact_phone, target.description);
  end if;
  return target;
end;
$$;

revoke all on function public.touch_updated_at(), public.initialize_customer(), public.has_role(text),
  public.submit_host_application(text,text,text,text), public.review_host_application(uuid,text,text) from public, anon, authenticated;
grant execute on function public.has_role(text), public.submit_host_application(text,text,text,text),
  public.review_host_application(uuid,text,text) to authenticated;

commit;
