-- Campus Schedule — database schema
--
-- Run this once in the Supabase SQL editor. It is written to be re-runnable:
-- every statement is guarded, so pasting it twice does no harm.
--
-- Two things matter here beyond the columns:
--
--   1. Every table carries user_id and has Row Level Security ON. The
--      publishable key in the browser bundle grants nothing by itself; these
--      policies are what make one signed-in user unable to read another's
--      schedule. A table without RLS is world-readable to anyone holding that
--      key, which is everyone.
--
--   2. Primary keys are (user_id, id), not id alone. The app generates ids
--      client-side from a timestamp plus randomness. Collisions across two
--      users are vanishingly unlikely but would surface as a baffling insert
--      failure; scoping the key to the user removes the possibility entirely.

-- ----------------------------------------------------------------- events --
-- Recurring commitments are stored already expanded, one row per occurrence,
-- sharing a series_id. That mirrors how the app holds them in memory and keeps
-- "delete this one" vs "delete the series" a simple filter on both sides.

create table if not exists public.events (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  title       text        not null,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  category    text        not null,
  location    text,
  course_code text,
  description text,
  source      text        not null default 'manual',
  series_id   text,
  recurring   boolean     not null default false,
  primary key (user_id, id),
  constraint events_category_valid check (category in (
    'class', 'lab', 'exam', 'work', 'appointment',
    'office-hours', 'study', 'tutoring'
  )),
  constraint events_source_valid check (source in ('ics', 'manual')),
  constraint events_ends_after_start check (end_at > start_at)
);

create index if not exists events_user_start_idx
  on public.events (user_id, start_at);

create index if not exists events_series_idx
  on public.events (user_id, series_id)
  where series_id is not null;

-- ------------------------------------------------------------------ tasks --
-- course_code and due_date are unused today. They exist because the to-do list
-- and the eventual assignment tracker are meant to share one record rather
-- than becoming two systems that need syncing to each other.

create table if not exists public.tasks (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  id           text        not null,
  title        text        not null,
  done         boolean     not null default false,
  notes        text        not null default '',
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  course_code  text,
  due_date     timestamptz,
  primary key (user_id, id)
);

create index if not exists tasks_user_created_idx
  on public.tasks (user_id, created_at);

-- ------------------------------------------------------------ day markers --
-- All-day notes: birthdays, deadlines without a time. US federal holidays are
-- NOT stored here — the app computes them per displayed year, so they stay
-- correct forever without a row per holiday per year.
--
-- A null year means the marker repeats annually.

create table if not exists public.day_markers (
  user_id uuid    not null references auth.users (id) on delete cascade,
  id      text    not null,
  title   text    not null,
  month   smallint not null,
  day     smallint not null,
  year    integer,
  source  text    not null default 'manual',
  course_code text,
  primary key (user_id, id),
  constraint day_markers_month_valid check (month between 1 and 12),
  constraint day_markers_day_valid   check (day between 1 and 31),
  constraint day_markers_source_valid check (source in ('holiday', 'manual', 'syllabus'))
);

-- ------------------------------------------------------------ preferences --
-- One row per user. Small enough that a single row beats a key/value table.

create table if not exists public.preferences (
  user_id       uuid    primary key references auth.users (id) on delete cascade,
  show_holidays boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------- row level security --
-- Enabling RLS with no policy denies everything, so the policies below are not
-- optional hardening; without them the app cannot read its own data.

alter table public.events      enable row level security;
alter table public.tasks       enable row level security;
alter table public.day_markers enable row level security;
alter table public.preferences enable row level security;

-- "for all" covers select, insert, update and delete in one policy.
--   using       — which existing rows this user may see or modify
--   with check  — what they are allowed to write, blocking a row from being
--                 inserted or updated into someone else's name

drop policy if exists events_owner on public.events;
create policy events_owner on public.events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tasks_owner on public.tasks;
create policy tasks_owner on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists day_markers_owner on public.day_markers;
create policy day_markers_owner on public.day_markers
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists preferences_owner on public.preferences;
create policy preferences_owner on public.preferences
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
