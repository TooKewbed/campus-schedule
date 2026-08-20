-- Repeating to-do items.
--
-- A weekly reading is the same job every week; without this the only way to
-- keep one is to retype it. The value is one of 'daily', 'weekly', 'biweekly'
-- or 'monthly', and null for a task that does not repeat — which is almost all
-- of them, so the column is nullable rather than defaulted.
--
-- Only ever meaningful alongside due_date: "repeats weekly" says nothing
-- without a first date to repeat from. Not enforced as a constraint because
-- clearing a deadline should not be blocked by a stale repeat sitting beside
-- it; the app treats a repeat with no deadline as no repeat.

alter table public.tasks
  add column if not exists repeat text;

alter table public.tasks
  drop constraint if exists tasks_repeat_valid;

alter table public.tasks
  add constraint tasks_repeat_valid
  check (repeat is null or repeat in ('daily', 'weekly', 'biweekly', 'monthly'));
