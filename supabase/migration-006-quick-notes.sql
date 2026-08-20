-- Quick notes.
--
-- The scratchpad in the margin: a room number, a book someone mentioned, the
-- thing you will need on Tuesday. No `done` column, because a note is never
-- finished — it is either still worth keeping or it is deleted.
--
-- `updated_at` is not housekeeping. It is how the app tells an edited note from
-- a fresh one, so it is written by the client from the moment of the edit
-- rather than defaulted by the database, which would only know when the row
-- happened to reach it.
--
-- Same shape as the rest of the schema: composite primary key on
-- (user_id, id) so per-row upserts work and one device cannot overwrite
-- another's rows wholesale, and RLS so the database, not the client, is what
-- keeps one account's notes out of another's.

create table if not exists public.quick_notes (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  text       text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Notes are read newest first, which is the opposite of the other two lists.
create index if not exists quick_notes_user_created_idx
  on public.quick_notes (user_id, created_at desc);

-- Enabling RLS with no policy denies everything, so the policy below is not
-- optional hardening; without it the app cannot read its own notes.

alter table public.quick_notes enable row level security;

drop policy if exists quick_notes_owner on public.quick_notes;
create policy quick_notes_owner on public.quick_notes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
