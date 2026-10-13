-- Apply to staging first. Existing installations must compare column types and
-- foreign keys with this baseline before migrating; never discard existing rows.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, nickname text check (char_length(nickname) <= 40),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.entries (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null, count integer not null check (count between 0 and 1000),
  notes text check (char_length(notes) <= 2000),
  check (count > 0 or (notes is not null and notes = '[checkin:smoke-free]'))
);
create table if not exists public.goals (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('reduction','smoke_free_days','milestone','streak')),
  target numeric not null check (target > 0), start_date timestamptz not null,
  status text not null check (status in ('active','completed','failed')),
  current_value numeric not null default 0 check (current_value >= 0),
  title text not null, description text not null default '', completed_at timestamptz,
  difficulty text not null default 'easy', icon text not null default 'target',
  red_mean_title text, red_mean_description text,
  reduction_mode text check (reduction_mode in ('daily_limit','percentage')),
  baseline_daily numeric check (baseline_daily > 0)
);
alter table public.goals add column if not exists reduction_mode text;
alter table public.goals add column if not exists baseline_daily numeric;
create table if not exists public.smoking_zones (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);
create index if not exists entries_owner_date on public.entries(user_id, date);
create index if not exists goals_owner_start on public.goals(user_id, start_date);
create index if not exists smoking_zones_coordinates on public.smoking_zones(latitude, longitude);

-- Refuse incompatible old id schemas rather than silently failing every sync.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('entries','goals') and column_name='id' and data_type <> 'text') then
    raise exception 'entries/goals id must be text; prepare a data-preserving staging migration first';
  end if;
end $$;

-- Existing permissive policies would be OR-ed with new policies. Replace policies
-- for these four app-owned tables; review this explicitly on a shared backend.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','entries','goals','smoking_zones') loop
    execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.goals enable row level security;
alter table public.smoking_zones enable row level security;
revoke all on public.profiles, public.entries, public.goals, public.smoking_zones from anon;
grant select,insert,update,delete on public.profiles, public.entries, public.goals, public.smoking_zones to authenticated;
create policy profiles_owner on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy entries_owner on public.entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_owner on public.goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy zones_read on public.smoking_zones for select to authenticated using (true);
create policy zones_insert on public.smoking_zones for insert to authenticated with check ((select auth.uid()) = created_by);
create policy zones_update on public.smoking_zones for update to authenticated using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
create policy zones_delete on public.smoking_zones for delete to authenticated using ((select auth.uid()) = created_by);

create or replace function public.create_smok_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,nickname) values(new.id,new.email,left(new.raw_user_meta_data->>'nickname',40)) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.create_smok_profile() from public,anon,authenticated;
drop trigger if exists smok_profile_created on auth.users;
create trigger smok_profile_created after insert on auth.users for each row execute function public.create_smok_profile();
commit;
