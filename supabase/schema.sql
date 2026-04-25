create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('pending', 'matched', 'completed');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  avatar_url text,
  bio text not null default '',
  skills text[] not null default '{}',
  credits int not null default 15 check (credits >= 0),
  location geography(point, 4326),
  search_radius int not null default 5 check (search_radius > 0),
  is_verified boolean not null default false,
  vouch_count int not null default 0 check (vouch_count >= 0),
  rating double precision not null default 5.0 check (rating >= 0 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  budget numeric(10, 2) not null check (budget > 0),
  category text not null,
  location geography(point, 4326) not null,
  required_skills text[] not null default '{}',
  is_boosted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  doer_id uuid not null references public.profiles (id) on delete cascade,
  bid_note text not null,
  is_unlocked boolean not null default false,
  status public.match_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, doer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists profiles_location_gix on public.profiles using gist (location);
create index if not exists tasks_location_gix on public.tasks using gist (location);
create index if not exists tasks_required_skills_gin on public.tasks using gin (required_skills);
create index if not exists tasks_boosted_idx on public.tasks (is_boosted, created_at desc);
create index if not exists matches_task_idx on public.matches (task_id);
create index if not exists matches_doer_idx on public.matches (doer_id, status);
create index if not exists messages_match_created_idx on public.messages (match_id, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
before update on public.matches
for each row execute function public.touch_updated_at();

create or replace function public.get_gig_deck(
  user_lng double precision,
  user_lat double precision,
  radius_miles int,
  user_skills text[],
  deck_limit int default 40
)
returns table (
  id uuid,
  poster_id uuid,
  title text,
  description text,
  budget numeric,
  category text,
  latitude double precision,
  longitude double precision,
  required_skills text[],
  is_boosted boolean,
  created_at timestamptz,
  distance_miles double precision,
  skill_match_count int
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography as geog
  ),
  filtered as (
    select
      t.*,
      st_distance(t.location, origin.geog) / 1609.344 as distance_miles,
      (
        select count(*)
        from unnest(t.required_skills) required(skill)
        where lower(required.skill) = any (
          select lower(skill) from unnest(user_skills) skill
        )
      )::int as skill_match_count
    from public.tasks t, origin
    where st_dwithin(t.location, origin.geog, radius_miles * 1609.344)
  ),
  ranked as (
    select *
    from filtered
    where skill_match_count > 0
    order by
      case when is_boosted then 0 else 1 end,
      distance_miles asc,
      created_at desc
    limit deck_limit
  )
  select
    id,
    poster_id,
    title,
    description,
    budget,
    category,
    st_y(location::geometry) as latitude,
    st_x(location::geometry) as longitude,
    required_skills,
    is_boosted,
    created_at,
    distance_miles,
    skill_match_count
  from ranked;
$$;

create or replace function public.unlock_match_chat(match_uuid uuid, doer_uuid uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_match public.matches;
begin
  perform 1
  from public.profiles
  where id = doer_uuid
    and credits >= 5
  for update;

  if not found then
    raise exception 'not_enough_credits';
  end if;

  update public.profiles
  set credits = credits - 5
  where id = doer_uuid;

  update public.matches
  set is_unlocked = true
  where id = match_uuid
    and doer_id = doer_uuid
    and status = 'matched'
  returning * into updated_match;

  if updated_match.id is null then
    raise exception 'match_not_unlockable';
  end if;

  return updated_match;
end;
$$;

create or replace function public.complete_match_and_vouch(match_uuid uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_match public.matches;
begin
  update public.matches
  set status = 'completed'
  where id = match_uuid
    and status = 'matched'
  returning * into completed_match;

  if completed_match.id is null then
    raise exception 'match_not_completable';
  end if;

  update public.profiles
  set vouch_count = vouch_count + 1
  where id = completed_match.doer_id;

  return completed_match;
end;
$$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
create policy "Profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Tasks are visible to authenticated users" on public.tasks;
create policy "Tasks are visible to authenticated users"
on public.tasks for select
to authenticated
using (true);

drop policy if exists "Posters can create tasks" on public.tasks;
create policy "Posters can create tasks"
on public.tasks for insert
to authenticated
with check (auth.uid() = poster_id);

drop policy if exists "Posters can update own tasks" on public.tasks;
create policy "Posters can update own tasks"
on public.tasks for update
to authenticated
using (auth.uid() = poster_id)
with check (auth.uid() = poster_id);

drop policy if exists "Match participants can read matches" on public.matches;
create policy "Match participants can read matches"
on public.matches for select
to authenticated
using (
  auth.uid() = doer_id
  or auth.uid() in (
    select poster_id from public.tasks where tasks.id = matches.task_id
  )
);

drop policy if exists "Doers can bid" on public.matches;
create policy "Doers can bid"
on public.matches for insert
to authenticated
with check (auth.uid() = doer_id);

drop policy if exists "Participants can update matches" on public.matches;
create policy "Participants can update matches"
on public.matches for update
to authenticated
using (
  auth.uid() = doer_id
  or auth.uid() in (
    select poster_id from public.tasks where tasks.id = matches.task_id
  )
);

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    join public.tasks t on t.id = m.task_id
    where m.id = messages.match_id
      and (m.doer_id = auth.uid() or t.poster_id = auth.uid())
  )
);

drop policy if exists "Unlocked participants can send messages" on public.messages;
create policy "Unlocked participants can send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    join public.tasks t on t.id = m.task_id
    where m.id = match_id
      and m.is_unlocked = true
      and (m.doer_id = auth.uid() or t.poster_id = auth.uid())
  )
);
