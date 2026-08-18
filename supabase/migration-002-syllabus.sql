-- Migration 002 — syllabus dates
--
-- Run once in the Supabase SQL editor, after schema.sql. Re-runnable.
--
-- Adds the two things a date pulled from a syllabus needs beyond a hand-typed
-- one: which course it came from, and the fact that it was extracted rather
-- than typed. The course is a column rather than a prefix on the title so that
-- editing the title cannot break which course the date belongs to.

alter table public.day_markers
  add column if not exists course_code text;

-- The original constraint allowed only 'holiday' and 'manual', so inserting a
-- syllabus row would be rejected outright.
alter table public.day_markers
  drop constraint if exists day_markers_source_valid;

alter table public.day_markers
  add constraint day_markers_source_valid
  check (source in ('holiday', 'manual', 'syllabus'));

create index if not exists day_markers_course_idx
  on public.day_markers (user_id, course_code)
  where course_code is not null;
