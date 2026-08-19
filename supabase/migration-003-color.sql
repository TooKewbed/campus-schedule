-- Migration 003 — per-commitment colour
--
-- Run once in the Supabase SQL editor, after schema.sql. Re-runnable.
--
-- Null means the automatic colour, derived from the course code so that every
-- meeting of a course matches without being told to. A stored value is a
-- deliberate override and is left alone even when the course changes.
--
-- Deliberately not constrained to the palette: a check constraint here would
-- have to be edited in lockstep with the CSS every time a slot is added, and
-- an unknown value degrades to the automatic colour on read rather than
-- breaking the row.

alter table public.events
  add column if not exists color text;
