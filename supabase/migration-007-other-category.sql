-- Migration 007 — a commitment type you name yourself.
--
-- Run once in the Supabase SQL editor, after schema.sql. Re-runnable.
--
-- Two new categories rather than one. The fixed/flexible split is the whole
-- job of a category — it is what decides whether something blocks time and can
-- raise a conflict — so a custom type still has to answer that question. The
-- entry form already groups the dropdown by exactly that split, so "Other"
-- appears under each heading and the choice is made by which one is picked.
-- Storing a single 'other' plus a separate blocks-time flag would put a second
-- source of truth beside the one table the app derives kind from, which is the
-- drift that table exists to prevent.
--
-- `category_label` holds the words. Null for the eight built-in categories,
-- and cleared by the client whenever a commitment is changed away from
-- "Other", so a stale label can never sit invisibly on a class and reappear
-- later. Deliberately unconstrained beyond its length: it is a person's own
-- wording, and the app caps it at 40 characters on the way in.

alter table public.events
  add column if not exists category_label text;

-- The check has to be replaced rather than added to; Postgres has no syntax
-- for widening one in place. Dropped first so this migration is re-runnable.
alter table public.events
  drop constraint if exists events_category_valid;

alter table public.events
  add constraint events_category_valid check (category in (
    'class', 'lab', 'exam', 'work', 'appointment', 'other',
    'office-hours', 'study', 'tutoring', 'other-flexible'
  ));
