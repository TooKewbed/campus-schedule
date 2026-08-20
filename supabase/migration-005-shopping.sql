-- The shopping list.
--
-- A separate table rather than a flag on `tasks`. A task carries a deadline, a
-- repeat and a course, and every query that reads those — reminders, the day
-- brief, the overdue count — would have to learn to exclude the groceries.
-- Missing one of those exclusions is the kind of bug that ships quietly and
-- then reminds someone about bananas at 8am.
--
-- Same shape as the rest of the schema: composite primary key on
-- (user_id, id) so per-row upserts work and one device cannot overwrite
-- another's rows wholesale, and RLS so the database, not the client, is what
-- keeps one account's list out of another's.

create table if not exists public.shopping_items (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  id           text        not null,
  title        text        not null,
  done         boolean     not null default false,
  notes        text        not null default '',
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, id)
);

create index if not exists shopping_items_user_created_idx
  on public.shopping_items (user_id, created_at);

-- Enabling RLS with no policy denies everything, so the policy below is not
-- optional hardening; without it the app cannot read its own list.

alter table public.shopping_items enable row level security;

drop policy if exists shopping_items_owner on public.shopping_items;
create policy shopping_items_owner on public.shopping_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
