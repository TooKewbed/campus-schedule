import { colorFor } from './colors';
import { markerKind, type MarkerKind } from './dateKind';
import { addDays, sameDay, startOfDay, startOfWeek, toISODate, parseISODate } from './time';
import {
  CATEGORY_KIND,
  type ColorName,
  type EventCategory,
  type ScheduleEvent,
} from '../types/event';
import { markersOn, type DayMarker } from '../types/dayMarker';

/**
 * A shareable copy of part of a schedule.
 *
 * The whole snapshot travels in the URL fragment. That is the decision this
 * module is built around, and it buys a lot: no table to migrate, no rows to
 * clean up, no way for a link to expose anything beyond the days it was made
 * for, and it works for someone who never signed in. The fragment is never sent
 * to a server, so a shared schedule does not touch our hosting at all.
 *
 * What it costs is that a link is a photograph, not a window. It shows the
 * schedule as it was when the link was made, and editing afterwards does not
 * reach the people holding it. For "here is my week" that is the right shape;
 * a link that silently changed under the person reading it would be worse.
 *
 * Field names are one or two characters because every byte is URL length.
 */

export type RangeKind = 'day' | 'week' | 'month' | 'year';

export const RANGE_LABEL: Record<RangeKind, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

export interface SharedEvent {
  /** Days from the start of the range. */
  d: number;
  /** Minutes into the day. */
  s: number;
  e: number;
  t: string;
  c: EventCategory;
  /** Resolved here so the viewer never has to rerun the colour rules. */
  k: ColorName;
  l?: string;
}

export interface SharedMarker {
  d: number;
  t: string;
  k: MarkerKind;
}

export interface Snapshot {
  v: 1;
  r: RangeKind;
  /** First day of the range, YYYY-MM-DD in the sharer's local time. */
  f: string;
  /**
   * Days covered. Stored rather than recomputed so February and leap years
   * cannot be got wrong twice, once on each side of the link.
   */
  n: number;
  /** Optional name the sharer typed, e.g. "Fall term". */
  ti?: string;
  /** Empty on a year, which is drawn from `dn` instead. */
  ev: SharedEvent[];
  mk: SharedMarker[];
  /** One base-36 digit per day: how many commitments it holds. Year only. */
  dn?: string;
}

/* ---------------------------------------------------------------- ranges -- */

export interface DateRange {
  start: Date;
  /** Exclusive. */
  end: Date;
  days: number;
}

export function rangeFor(kind: RangeKind, anchor: Date): DateRange {
  const day = startOfDay(anchor);

  switch (kind) {
    case 'day':
      return { start: day, end: addDays(day, 1), days: 1 };
    case 'week': {
      const start = startOfWeek(day);
      return { start, end: addDays(start, 7), days: 7 };
    }
    case 'month': {
      const start = new Date(day.getFullYear(), day.getMonth(), 1);
      const end = new Date(day.getFullYear(), day.getMonth() + 1, 1);
      return { start, end, days: daysBetween(start, end) };
    }
    case 'year': {
      const start = new Date(day.getFullYear(), 0, 1);
      const end = new Date(day.getFullYear() + 1, 0, 1);
      return { start, end, days: daysBetween(start, end) };
    }
  }
}

/**
 * Whole days between two local midnights.
 *
 * Via a UTC round-trip because subtracting local timestamps is off by an hour
 * across a daylight-saving boundary, which is exactly where a month or a year
 * would come out a day short.
 */
function daysBetween(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Which day of the range a date falls on, or -1 when it falls outside. */
export function dayIndex(range: DateRange, date: Date): number {
  const index = daysBetween(range.start, startOfDay(date));
  return index >= 0 && index < range.days ? index : -1;
}

/** "Tuesday, August 18, 2026", "Aug 16 - 22, 2026", "August 2026", "2026". */
export function describeRange(kind: RangeKind, range: DateRange): string {
  const { start } = range;
  const last = addDays(start, range.days - 1);

  switch (kind) {
    case 'day':
      return start.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    case 'week': {
      const from = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const to =
        start.getMonth() === last.getMonth()
          ? String(last.getDate())
          : last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${from} – ${to}, ${last.getFullYear()}`;
    }
    case 'month':
      return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    case 'year':
      return String(start.getFullYear());
  }
}

/* -------------------------------------------------------------- building -- */

export interface SnapshotInput {
  kind: RangeKind;
  anchor: Date;
  events: ScheduleEvent[];
  /**
   * Holidays included if the sharer has them switched on — the snapshot
   * mirrors what they are looking at, not a different set of defaults.
   */
  markers: DayMarker[];
  title?: string;
  /**
   * Whether optional commitments — office hours, study, tutoring — travel with
   * the snapshot. Defaults to true, matching what the sharer is looking at.
   *
   * Filtered out here rather than hidden while drawing, so turning it off
   * genuinely removes them: they are not in the link, not in the image, and not
   * recoverable by anyone who takes the link apart. A switch labelled "don't
   * show" that still shipped the data would be the wrong kind of surprise.
   */
  includeFlexible?: boolean;
}

export function buildSnapshot({
  kind,
  anchor,
  events,
  markers,
  title,
  includeFlexible = true,
}: SnapshotInput): Snapshot {
  const range = rangeFor(kind, anchor);

  const inRange = events
    .filter((e) => e.start < e.end && dayIndex(range, e.start) !== -1)
    .filter((e) => includeFlexible || isFixedCategory(e.category))
    .sort((a, b) => +a.start - +b.start);

  const mk: SharedMarker[] = [];
  const density: number[] = new Array(range.days).fill(0);

  for (let i = 0; i < range.days; i++) {
    const date = addDays(range.start, i);
    for (const marker of markersOn(markers, date)) {
      mk.push({ d: i, t: marker.title, k: markerKind(marker) });
    }
  }

  for (const event of inRange) {
    const index = dayIndex(range, event.start);
    if (index !== -1) density[index]++;
  }

  const snapshot: Snapshot = {
    v: 1,
    r: kind,
    f: toISODate(range.start),
    n: range.days,
    ev: [],
    mk,
  };

  if (title && title.trim()) snapshot.ti = title.trim().slice(0, MAX_TITLE);

  // A year is drawn as density and important dates. Carrying a thousand
  // occurrences would push the link past what a browser or a chat app accepts,
  // and none of them would be legible at that size anyway.
  if (kind === 'year') {
    snapshot.dn = density.map(base36).join('');
    return snapshot;
  }

  snapshot.ev = inRange.map((event) => {
    const shared: SharedEvent = {
      d: dayIndex(range, event.start),
      s: minutesInto(event.start),
      // An event running past midnight is clamped to the end of its own day
      // rather than drawn backwards or spilling onto a day it is not on.
      e: sameDay(event.start, event.end) ? minutesInto(event.end) : 24 * 60,
      t: event.title.slice(0, MAX_TITLE),
      c: event.category,
      k: colorFor(event),
    };
    if (event.location) shared.l = event.location.slice(0, MAX_TITLE);
    return shared;
  });

  return snapshot;
}

function minutesInto(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function base36(count: number): string {
  return Math.min(count, 35).toString(36);
}

/** Commitments per day, for the year view. */
export function densityOf(snapshot: Snapshot): number[] {
  if (snapshot.dn) {
    const counts = new Array(snapshot.n).fill(0);
    [...snapshot.dn].forEach((c, i) => {
      if (i < counts.length) counts[i] = parseInt(c, 36) || 0;
    });
    return counts;
  }

  const counts = new Array(snapshot.n).fill(0);
  for (const event of snapshot.ev) {
    if (event.d >= 0 && event.d < counts.length) counts[event.d]++;
  }
  return counts;
}

/** The first day of the snapshot as a local date. */
export function snapshotStart(snapshot: Snapshot): Date {
  return parseISODate(snapshot.f);
}

/** Only fixed commitments block time; flexible ones are drawn as available. */
export function isFixedCategory(category: EventCategory): boolean {
  return CATEGORY_KIND[category] === 'fixed';
}

/**
 * How many optional commitments a range holds.
 *
 * Lets the dialog offer the switch only when there is something for it to do —
 * a control that visibly changes nothing reads as broken, and on a week with no
 * office hours in it that is exactly how it would read.
 */
export function flexibleCountIn(
  kind: RangeKind,
  anchor: Date,
  events: ScheduleEvent[],
): number {
  const range = rangeFor(kind, anchor);
  return events.filter(
    (e) =>
      e.start < e.end &&
      dayIndex(range, e.start) !== -1 &&
      !isFixedCategory(e.category),
  ).length;
}

/* -------------------------------------------------------------- encoding -- */

const MAX_TITLE = 120;
const MAX_EVENTS = 2000;
const MAX_MARKERS = 500;

/** Anything longer is likely to be truncated by a chat app or a mail client. */
export const LINK_WARN_LENGTH = 8000;

/**
 * Base64url, so the payload survives being pasted anywhere a URL goes.
 *
 * Standard base64 uses "+" and "/", which have their own meaning in a URL, and
 * "=" padding that some clients helpfully strip. The three substitutions here
 * are the usual fix, reversed on the way back in.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    // In chunks: spreading a large array into apply() overflows the stack.
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Encoded as "z" plus base64url when compressed, "u" plus base64url when not.
 *
 * A schedule is extremely repetitive text — the same course names at the same
 * times, over and over — so gzip takes a week down by roughly four fifths,
 * which is the difference between a link that pastes cleanly and one that
 * wraps. The uncompressed form is the fallback for anywhere CompressionStream
 * is missing, and the leading letter means a reader never has to guess which
 * form it is holding.
 */
export async function encodeSnapshot(snapshot: Snapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot));

  if (typeof CompressionStream === 'undefined') return `u${toBase64Url(json)}`;

  try {
    const stream = new Blob([json as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    return `z${toBase64Url(await collect(stream))}`;
  } catch {
    return `u${toBase64Url(json)}`;
  }
}

export async function decodeSnapshot(payload: string): Promise<Snapshot> {
  const flag = payload[0];
  const body = fromBase64Url(payload.slice(1));

  let json: Uint8Array;
  if (flag === 'z') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot open compressed schedule links.');
    }
    const stream = new Blob([body as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    json = await collect(stream);
  } else if (flag === 'u') {
    json = body;
  } else {
    throw new Error('This link is not a shared schedule.');
  }

  return validate(JSON.parse(new TextDecoder().decode(json)));
}

/**
 * Everything arriving from a link is untrusted input.
 *
 * It is not sensitive — it only draws a picture for the person who opened it —
 * but a hand-edited link should produce a clear "this link is damaged" rather
 * than a half-drawn poster or a renderer looping on a nonsense length. So every
 * field is checked and the collections are capped.
 */
function validate(raw: unknown): Snapshot {
  if (!raw || typeof raw !== 'object') throw new Error('This link is damaged.');
  const value = raw as Record<string, unknown>;

  const kind = value.r;
  if (kind !== 'day' && kind !== 'week' && kind !== 'month' && kind !== 'year') {
    throw new Error('This link is damaged.');
  }

  const from = typeof value.f === 'string' ? value.f : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('This link is damaged.');

  const days = Number(value.n);
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error('This link is damaged.');
  }

  const events = Array.isArray(value.ev) ? value.ev.slice(0, MAX_EVENTS) : [];
  const markers = Array.isArray(value.mk) ? value.mk.slice(0, MAX_MARKERS) : [];

  const snapshot: Snapshot = {
    v: 1,
    r: kind,
    f: from,
    n: days,
    ev: events.flatMap((e) => cleanEvent(e, days)),
    mk: markers.flatMap((m) => cleanMarker(m, days)),
  };

  if (typeof value.ti === 'string' && value.ti.trim()) {
    snapshot.ti = value.ti.trim().slice(0, MAX_TITLE);
  }
  if (typeof value.dn === 'string') snapshot.dn = value.dn.slice(0, days);

  return snapshot;
}

const CATEGORIES = new Set<string>(Object.keys(CATEGORY_KIND));
const KINDS = new Set<string>([
  'exam',
  'quiz',
  'assignment',
  'project',
  'break',
  'other',
  'holiday',
]);
const COLORS = new Set<string>([
  'blue',
  'orange',
  'violet',
  'green',
  'aqua',
  'yellow',
  'exam',
]);

/** Returns a one-element array, or an empty one to drop the entry. */
function cleanEvent(raw: unknown, days: number): SharedEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = raw as Record<string, unknown>;

  const d = Number(value.d);
  const s = Number(value.s);
  const e = Number(value.e);
  if (!Number.isInteger(d) || d < 0 || d >= days) return [];
  if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e > 1440 || e <= s) return [];

  const category = typeof value.c === 'string' && CATEGORIES.has(value.c) ? value.c : 'class';
  const color = typeof value.k === 'string' && COLORS.has(value.k) ? value.k : 'blue';

  const event: SharedEvent = {
    d,
    s,
    e,
    t: text(value.t) || 'Untitled',
    c: category as EventCategory,
    k: color as ColorName,
  };
  const location = text(value.l);
  if (location) event.l = location;
  return [event];
}

function cleanMarker(raw: unknown, days: number): SharedMarker[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = raw as Record<string, unknown>;

  const d = Number(value.d);
  if (!Number.isInteger(d) || d < 0 || d >= days) return [];

  const kind = typeof value.k === 'string' && KINDS.has(value.k) ? value.k : 'other';
  const title = text(value.t);
  if (!title) return [];

  return [{ d, t: title, k: kind as MarkerKind }];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TITLE).trim() : '';
}

/* ----------------------------------------------------------------- links -- */

/** The fragment prefix a shared link is recognised by. */
export const SHARE_HASH = '#/s/';

export function shareUrl(
  payload: string,
  origin: string = window.location.origin,
  path: string = window.location.pathname,
): string {
  return `${origin}${path}${SHARE_HASH}${payload}`;
}

/** The payload in a URL fragment, or null when it is not a share link. */
export function payloadFromHash(hash: string): string | null {
  if (!hash.startsWith(SHARE_HASH)) return null;
  const payload = hash.slice(SHARE_HASH.length).trim();
  return payload.length > 0 ? payload : null;
}
