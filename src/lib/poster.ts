import type { ColorName } from '../types/event';
import type { MarkerKind } from './dateKind';
import { WEEKDAYS } from './weekdays';
import { addDays } from './time';
import { estimateWidth, truncate, type Node, type Scene } from './scene';
import {
  describeRange,
  densityOf,
  isFixedCategory,
  snapshotStart,
  type DateRange,
  type SharedEvent,
  type SharedMarker,
  type Snapshot,
} from './shareSnapshot';

/**
 * The four poster layouts.
 *
 * Each range answers a different question, so each gets a different drawing
 * rather than the same grid at four zoom levels. A day is a timeline, because
 * what matters is when things sit relative to each other. A week is seven of
 * those side by side, because the question is which days are heavy. A month is
 * a calendar, because that is how people already picture a month. A year is
 * density and important dates only — at that size no individual class is
 * legible, and pretending otherwise would just be grey mush.
 *
 * Always drawn light, whatever the app's appearance setting. A shared image
 * lands in someone else's chat window or gets printed, and a dark poster is
 * unpredictable in both. Colours are literal hex for the same reason: an image
 * rasterized outside the page has no CSS custom properties to read.
 */

export const INK = {
  bg: '#ffffff',
  panel: '#f7f7fa',
  panelDeep: '#eeeef3',
  hair: '#e3e3ea',
  hairSoft: '#f0f0f4',
  label: '#1c1c1e',
  label2: '#6e6e78',
  label3: '#a8a8b2',
};

/** Block fills, matching the palette the app draws on screen. */
export const FILL: Record<ColorName, string> = {
  blue: '#007aff',
  orange: '#af52de',
  violet: '#5856d6',
  green: '#34c759',
  aqua: '#30b0c7',
  yellow: '#ffcc00',
  exam: '#ff3b30',
};

/**
 * The same slots, darkened where they have to carry text.
 *
 * Yellow and green at full saturation fail against white badly enough to be
 * unreadable at 11px, and a poster is often looked at on a phone screen in
 * daylight. The fills stay bright; only the type is darkened.
 */
export const TEXT_COLOR: Record<ColorName, string> = {
  blue: '#0062cc',
  orange: '#8a3fb0',
  violet: '#4644ab',
  green: '#1e8a50',
  aqua: '#1a7f92',
  yellow: '#8a6d00',
  exam: '#d32b21',
};

export const KIND_COLOR: Record<MarkerKind, string> = {
  exam: '#ff3b30',
  quiz: '#ff9500',
  assignment: '#007aff',
  project: '#af52de',
  break: '#34c759',
  holiday: '#5856d6',
  other: '#ff2d55',
};

/** A tint of `hex` over white, for block fills. `amount` is 0-1. */
export function tint(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(255 + (channel - 255) * amount);
  const pad = (channel: number) => mix(channel).toString(16).padStart(2, '0');
  return `#${pad(r)}${pad(g)}${pad(b)}`;
}

/* ------------------------------------------------------------------ page -- */

const PAGE: Record<Snapshot['r'], { w: number; h: number }> = {
  day: { w: 760, h: 1060 },
  week: { w: 1240, h: 880 },
  month: { w: 980, h: 1160 },
  year: { w: 1180, h: 900 },
};

const PAD = 44;

export function buildPoster(snapshot: Snapshot): Scene {
  const { w, h } = PAGE[snapshot.r];
  const nodes: Node[] = [];

  const start = snapshotStart(snapshot);
  const range: DateRange = {
    start,
    end: addDays(start, snapshot.n),
    days: snapshot.n,
  };

  const top = header(nodes, snapshot, range, w);
  const bottom = footer(nodes, snapshot, w, h);
  const box = { x: PAD, y: top, w: w - PAD * 2, h: bottom - top };

  switch (snapshot.r) {
    case 'day':
      drawDay(nodes, snapshot, box);
      break;
    case 'week':
      drawWeek(nodes, snapshot, range, box);
      break;
    case 'month':
      drawMonth(nodes, snapshot, range, box);
      break;
    case 'year':
      drawYear(nodes, snapshot, range, box);
      break;
  }

  return { w, h, bg: INK.bg, nodes };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Title block. Returns the y the content may start at. */
function header(nodes: Node[], snapshot: Snapshot, range: DateRange, w: number): number {
  const heading = snapshot.ti || describeRange(snapshot.r, range);
  const sub = snapshot.ti ? describeRange(snapshot.r, range) : countLine(snapshot);

  nodes.push({
    k: 'text',
    x: PAD,
    y: 62,
    s: truncate(heading, w - PAD * 2 - 90, 30, 700),
    size: 30,
    weight: 700,
    fill: INK.label,
    // Display sizes want tighter tracking than body text, the same way the
    // app's own headings do.
    ls: -0.5,
  });

  nodes.push({
    k: 'text',
    x: PAD,
    y: 88,
    s: truncate(sub, w - PAD * 2 - 90, 14),
    size: 14,
    fill: INK.label2,
  });

  // A quiet mark rather than a logo lockup: this is someone's schedule, and
  // the app's name should not be the loudest thing on it.
  nodes.push({
    k: 'text',
    x: w - PAD,
    y: 62,
    s: 'Skedge',
    size: 15,
    weight: 600,
    fill: INK.label3,
    anchor: 'end',
    ls: -0.2,
  });

  nodes.push({
    k: 'line',
    x1: PAD,
    y1: 108,
    x2: w - PAD,
    y2: 108,
    stroke: INK.hair,
  });

  return 132;
}

/** Returns the y the content must stop at. */
function footer(nodes: Node[], snapshot: Snapshot, w: number, h: number): number {
  const bottom = h - PAD;

  nodes.push({
    k: 'line',
    x1: PAD,
    y1: bottom - 26,
    x2: w - PAD,
    y2: bottom - 26,
    stroke: INK.hairSoft,
  });

  nodes.push({
    k: 'text',
    x: PAD,
    y: bottom - 8,
    s: snapshot.ti ? countLine(snapshot) : 'A read-only snapshot',
    size: 11,
    fill: INK.label3,
  });

  return bottom - 46;
}

function countLine(snapshot: Snapshot): string {
  const parts: string[] = [];
  const events = snapshot.r === 'year' ? sum(densityOf(snapshot)) : snapshot.ev.length;

  parts.push(`${events} commitment${events === 1 ? '' : 's'}`);
  if (snapshot.mk.length > 0) {
    parts.push(`${snapshot.mk.length} important date${snapshot.mk.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/* -------------------------------------------------------------- timeline -- */

/**
 * The hours a timeline has to cover.
 *
 * The app's own 8am-9pm window is the floor, so a normal week looks the same
 * shape as it does on screen, but a 7am lab or a 10pm shift widens it rather
 * than being quietly clipped off the top or bottom of the poster.
 */
function hourWindow(events: SharedEvent[]): { from: number; to: number } {
  let from = 8 * 60;
  let to = 21 * 60;
  for (const event of events) {
    from = Math.min(from, event.s);
    to = Math.max(to, event.e);
  }
  return {
    from: Math.max(0, Math.floor(from / 60)),
    to: Math.min(24, Math.ceil(to / 60)),
  };
}

function hourLabel(hour: number): string {
  const h = hour % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return 'Noon';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

interface Packed {
  event: SharedEvent;
  column: number;
  columns: number;
}

/**
 * Overlapping events packed into side-by-side columns.
 *
 * The same greedy packing the day grid uses on screen: group into clusters of
 * transitively overlapping events, then reuse the first column whose last event
 * has finished. Reimplemented here rather than shared because the on-screen
 * version works in pixels against ScheduleEvent, and threading a second
 * coordinate system through it would complicate the part of the app people
 * actually look at every day for the sake of the part they use occasionally.
 */
function packDay(events: SharedEvent[]): Packed[] {
  const sorted = [...events].sort((a, b) => a.s - b.s || a.e - b.e);
  const out: Packed[] = [];

  let cluster: SharedEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned = cluster.map((event) => {
      let column = columnEnds.findIndex((end) => end <= event.s);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[column] = event.e;
      return { event, column };
    });
    for (const item of assigned) {
      out.push({ ...item, columns: columnEnds.length });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (cluster.length > 0 && event.s >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.e);
  }
  flush();

  return out;
}

/* ------------------------------------------------------------------- day -- */

function drawDay(nodes: Node[], snapshot: Snapshot, box: Box): void {
  let top = box.y;

  if (snapshot.mk.length > 0) {
    top = drawMarkerBand(nodes, snapshot.mk, { ...box, y: top });
  }

  if (snapshot.ev.length === 0) {
    emptyState(nodes, 'Nothing scheduled', { ...box, y: top });
    return;
  }

  const { from, to } = hourWindow(snapshot.ev);
  const gutter = 58;
  const lane = { x: box.x + gutter, w: box.w - gutter };
  const height = box.y + box.h - top;
  const perHour = height / (to - from);
  const yAt = (minutes: number) => top + ((minutes - from * 60) / 60) * perHour;

  for (let hour = from; hour <= to; hour++) {
    const y = yAt(hour * 60);
    nodes.push({
      k: 'line',
      x1: lane.x,
      y1: y,
      x2: lane.x + lane.w,
      y2: y,
      stroke: hour === from || hour === to ? INK.hair : INK.hairSoft,
    });
    nodes.push({
      k: 'text',
      x: box.x + gutter - 12,
      // Every hour is labelled, the last one above its line rather than below.
      // On screen the closing hour can go unlabelled because the rest of the
      // app says what day it is; a poster read by someone else has to state
      // where it stops.
      y: hour === to ? y - 5 : y + 12,
      s: hourLabel(hour),
      size: 11,
      fill: INK.label3,
      anchor: 'end',
    });
  }

  const gap = 5;
  // A moment occupies no time, so it is neither packed into a column nor given
  // a minimum height — a 26px box would claim half an hour it does not have.
  for (const { event, column, columns } of packDay(snapshot.ev.filter(hasDuration))) {
    const width = (lane.w - gap * (columns - 1)) / columns;
    const x = lane.x + column * (width + gap);
    const y = yAt(event.s);
    const h = Math.max(26, yAt(event.e) - y);
    drawBlock(nodes, event, { x, y, w: width, h });
  }

  for (const event of snapshot.ev.filter((e) => !hasDuration(e))) {
    drawMoment(nodes, event, lane.x, lane.w, yAt(event.s));
  }
}

/** A time with no end: shared as `e === s`, drawn as a line rather than a box. */
function hasDuration(event: SharedEvent): boolean {
  return event.e > event.s;
}

function drawMoment(nodes: Node[], event: SharedEvent, x: number, w: number, y: number): void {
  const ink = TEXT_COLOR[event.k];
  const label = `${clockLabel(event.s)}  ${event.t}`;

  // Dotted, because a solid rule across the lane would read as a boundary
  // between two things rather than a marker on one.
  nodes.push({ k: 'line', x1: x, y1: y, x2: x + w, y2: y, stroke: ink, sw: 1.2, dash: '3 3' });
  nodes.push({ k: 'circle', cx: x + 4, cy: y, r: 3.5, fill: ink });

  const text = truncate(label, w - 20, 10, 600);
  const textW = estimateWidth(text, 10, 600) + 10;
  nodes.push({ k: 'rect', x: x + 11, y: y - 8, w: textW, h: 16, r: 5, fill: INK.bg });
  nodes.push({
    k: 'text',
    x: x + 16,
    y: y + 3.5,
    s: text,
    size: 10,
    weight: 600,
    fill: ink,
  });
}

/** One event, as it appears on a day or week timeline. */
function drawBlock(nodes: Node[], event: SharedEvent, box: Box): void {
  const base = FILL[event.k];
  const ink = TEXT_COLOR[event.k];
  const fixed = isFixedCategory(event.c);

  if (fixed) {
    nodes.push({ k: 'rect', ...box, r: 7, fill: tint(base, 0.14) });
    // The colour bar down the left edge is what makes two courses tell apart
    // at a glance when the fills are this pale.
    nodes.push({ k: 'rect', x: box.x, y: box.y, w: 3, h: box.h, r: 1.5, fill: base });
  } else {
    // Flexible time is available, not spent, so it is outlined rather than
    // filled — the same distinction the app draws on screen.
    nodes.push({ k: 'rect', ...box, r: 7, fill: tint(base, 0.05) });
    nodes.push({
      k: 'rect',
      ...box,
      r: 7,
      stroke: tint(base, 0.55),
      sw: 1.5,
      fill: undefined,
    });
  }

  const inset = fixed ? 11 : 9;
  const textX = box.x + inset;
  const textW = box.w - inset - 8;
  if (textW < 24) return;

  nodes.push({
    k: 'text',
    x: textX,
    y: box.y + 16,
    s: truncate(event.t, textW, 12.5, 600),
    size: 12.5,
    weight: 600,
    fill: ink,
  });

  // Under about 34px the second line would collide with the first; the block
  // is better with a name and no time than with two lines of overlap.
  if (box.h >= 34) {
    const meta = event.l ? `${clockLabel(event.s)} · ${event.l}` : clockLabel(event.s);
    nodes.push({
      k: 'text',
      x: textX,
      y: box.y + 30,
      s: truncate(meta, textW, 10.5),
      size: 10.5,
      fill: INK.label2,
    });
  }
}

/** Important dates across the top of a day poster. Returns the new top y. */
function drawMarkerBand(nodes: Node[], markers: SharedMarker[], box: Box): number {
  const rowH = 30;
  const shown = markers.slice(0, 4);
  const height = shown.length * rowH + 12;

  nodes.push({ k: 'rect', x: box.x, y: box.y, w: box.w, h: height, r: 12, fill: INK.panel });

  shown.forEach((marker, i) => {
    const y = box.y + 10 + i * rowH;
    const color = KIND_COLOR[marker.k];
    nodes.push({ k: 'rect', x: box.x + 14, y: y + 6, w: 4, h: 14, r: 2, fill: color });
    nodes.push({
      k: 'text',
      x: box.x + 26,
      y: y + 18,
      s: truncate(marker.t, box.w - 60, 13, 600),
      size: 13,
      weight: 600,
      fill: INK.label,
    });
  });

  if (markers.length > shown.length) {
    nodes.push({
      k: 'text',
      x: box.x + box.w - 14,
      y: box.y + height - 12,
      s: `+${markers.length - shown.length} more`,
      size: 11,
      fill: INK.label2,
      anchor: 'end',
    });
  }

  return box.y + height + 16;
}

function emptyState(nodes: Node[], message: string, box: Box): void {
  nodes.push({ k: 'rect', ...box, r: 14, fill: INK.panel });
  nodes.push({
    k: 'text',
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
    s: message,
    size: 15,
    fill: INK.label3,
    anchor: 'middle',
  });
}

/* ------------------------------------------------------------------ week -- */

function drawWeek(nodes: Node[], snapshot: Snapshot, range: DateRange, box: Box): void {
  const gutter = 52;
  const headH = 52;
  const colW = (box.w - gutter) / 7;
  const gridTop = box.y + headH;
  const { from, to } = hourWindow(snapshot.ev);
  const perHour = (box.y + box.h - gridTop) / (to - from);
  const yAt = (minutes: number) => gridTop + ((minutes - from * 60) / 60) * perHour;

  const byDay = new Map<number, SharedMarker[]>();
  for (const marker of snapshot.mk) {
    const list = byDay.get(marker.d) ?? [];
    list.push(marker);
    byDay.set(marker.d, list);
  }

  for (let day = 0; day < 7 && day < range.days; day++) {
    const date = addDays(range.start, day);
    const x = box.x + gutter + day * colW;

    nodes.push({
      k: 'text',
      x: x + colW / 2,
      y: box.y + 16,
      s: WEEKDAYS[date.getDay()].short.toUpperCase(),
      size: 10,
      weight: 600,
      fill: INK.label3,
      anchor: 'middle',
      ls: 0.6,
    });
    nodes.push({
      k: 'text',
      x: x + colW / 2,
      y: box.y + 36,
      s: String(date.getDate()),
      size: 17,
      weight: 600,
      fill: INK.label,
      anchor: 'middle',
    });

    // Important dates get a row of dots under the date, so an exam day is
    // visible from across the week rather than only in its own column.
    const markers = byDay.get(day) ?? [];
    markers.slice(0, 5).forEach((marker, i, shown) => {
      const spread = 9;
      const cx = x + colW / 2 + (i - (shown.length - 1) / 2) * spread;
      nodes.push({ k: 'circle', cx, cy: box.y + 44, r: 3, fill: KIND_COLOR[marker.k] });
    });

    if (day > 0) {
      nodes.push({
        k: 'line',
        x1: x,
        y1: gridTop,
        x2: x,
        y2: box.y + box.h,
        stroke: INK.hairSoft,
      });
    }
  }

  for (let hour = from; hour <= to; hour++) {
    const y = yAt(hour * 60);
    nodes.push({
      k: 'line',
      x1: box.x + gutter,
      y1: y,
      x2: box.x + box.w,
      y2: y,
      stroke: hour === from || hour === to ? INK.hair : INK.hairSoft,
    });
    nodes.push({
      k: 'text',
      x: box.x + gutter - 10,
      y: hour === to ? y - 4 : y + 11,
      s: hourLabel(hour),
      size: 10,
      fill: INK.label3,
      anchor: 'end',
    });
  }

  if (snapshot.ev.length === 0) {
    nodes.push({
      k: 'text',
      x: box.x + gutter + (box.w - gutter) / 2,
      y: gridTop + (box.y + box.h - gridTop) / 2,
      s: 'Nothing scheduled this week',
      size: 15,
      fill: INK.label3,
      anchor: 'middle',
    });
    return;
  }

  for (let day = 0; day < 7; day++) {
    const events = snapshot.ev.filter((e) => e.d === day);
    if (events.length === 0) continue;

    const laneX = box.x + gutter + day * colW + 3;
    const laneW = colW - 6;
    const gap = 3;

    for (const { event, column, columns } of packDay(events.filter(hasDuration))) {
      const width = (laneW - gap * (columns - 1)) / columns;
      const y = yAt(event.s);
      const h = Math.max(20, yAt(event.e) - y);
      drawWeekBlock(nodes, event, {
        x: laneX + column * (width + gap),
        y,
        w: width,
        h,
      });
    }

    // A column this narrow has no room for a time beside the name, so the
    // marker carries the title only — the same trade the week view makes.
    for (const event of events.filter((e) => !hasDuration(e))) {
      const y = yAt(event.s);
      const ink = TEXT_COLOR[event.k];
      nodes.push({
        k: 'line',
        x1: laneX,
        y1: y,
        x2: laneX + laneW,
        y2: y,
        stroke: ink,
        sw: 1.1,
        dash: '2.5 2.5',
      });
      nodes.push({ k: 'circle', cx: laneX + 3, cy: y, r: 2.6, fill: ink });
      const label = truncate(event.t, laneW - 14, 8.5, 650);
      nodes.push({
        k: 'rect',
        x: laneX + 8,
        y: y - 6,
        w: estimateWidth(label, 8.5, 650) + 6,
        h: 12,
        r: 4,
        fill: INK.bg,
      });
      nodes.push({
        k: 'text',
        x: laneX + 11,
        y: y + 2.5,
        s: label,
        size: 8.5,
        weight: 650,
        fill: ink,
      });
    }
  }
}

/** Narrower than a day block, so it drops the metadata line sooner. */
function drawWeekBlock(nodes: Node[], event: SharedEvent, box: Box): void {
  const base = FILL[event.k];
  const fixed = isFixedCategory(event.c);

  nodes.push({ k: 'rect', ...box, r: 5, fill: tint(base, fixed ? 0.16 : 0.06) });
  if (fixed) {
    nodes.push({ k: 'rect', x: box.x, y: box.y, w: 2.5, h: box.h, r: 1.25, fill: base });
  } else {
    nodes.push({ k: 'rect', ...box, r: 5, stroke: tint(base, 0.5), sw: 1.2 });
  }

  const textX = box.x + (fixed ? 7 : 6);
  const textW = box.w - 10;
  if (textW < 20 || box.h < 15) return;

  nodes.push({
    k: 'text',
    x: textX,
    y: box.y + 13,
    s: truncate(event.t, textW, 10.5, 600),
    size: 10.5,
    weight: 600,
    fill: TEXT_COLOR[event.k],
  });

  if (box.h >= 30) {
    nodes.push({
      k: 'text',
      x: textX,
      y: box.y + 25,
      s: truncate(clockLabel(event.s), textW, 9.5),
      size: 9.5,
      fill: INK.label2,
    });
  }
}

/* ----------------------------------------------------------------- month -- */

function drawMonth(nodes: Node[], snapshot: Snapshot, range: DateRange, box: Box): void {
  const headH = 26;
  const colW = box.w / 7;
  // Leading blanks for the weekday the month starts on, then enough rows to
  // hold the rest. Computed rather than fixed at six: a 28-day February
  // starting on Sunday needs four, and empty rows look like missing weeks.
  const lead = range.start.getDay();
  const rows = Math.ceil((lead + range.days) / 7);
  const gridTop = box.y + headH;
  const rowH = (box.y + box.h - gridTop) / rows;

  for (let i = 0; i < 7; i++) {
    nodes.push({
      k: 'text',
      x: box.x + i * colW + colW / 2,
      y: box.y + 12,
      s: WEEKDAYS[i].short.toUpperCase(),
      size: 10,
      weight: 600,
      fill: INK.label3,
      anchor: 'middle',
      ls: 0.6,
    });
  }

  const eventsByDay = new Map<number, SharedEvent[]>();
  for (const event of snapshot.ev) {
    const list = eventsByDay.get(event.d) ?? [];
    list.push(event);
    eventsByDay.set(event.d, list);
  }

  const markersByDay = new Map<number, SharedMarker[]>();
  for (const marker of snapshot.mk) {
    const list = markersByDay.get(marker.d) ?? [];
    list.push(marker);
    markersByDay.set(marker.d, list);
  }

  for (let day = 0; day < range.days; day++) {
    const cell = lead + day;
    const x = box.x + (cell % 7) * colW;
    const y = gridTop + Math.floor(cell / 7) * rowH;
    const date = addDays(range.start, day);
    const markers = markersByDay.get(day) ?? [];
    const events = (eventsByDay.get(day) ?? []).sort((a, b) => a.s - b.s);

    nodes.push({
      k: 'rect',
      x: x + 2,
      y: y + 2,
      w: colW - 4,
      h: rowH - 4,
      r: 8,
      fill: markers.length > 0 ? INK.panel : INK.bg,
      stroke: INK.hairSoft,
      sw: 1,
    });

    const weekend = date.getDay() === 0 || date.getDay() === 6;
    nodes.push({
      k: 'text',
      x: x + 10,
      y: y + 19,
      s: String(date.getDate()),
      size: 12.5,
      weight: 600,
      fill: weekend ? INK.label3 : INK.label,
    });

    markers.slice(0, 3).forEach((marker, i) => {
      nodes.push({
        k: 'circle',
        cx: x + colW - 12 - i * 9,
        cy: y + 15,
        r: 3.2,
        fill: KIND_COLOR[marker.k],
      });
    });

    // Important dates outrank classes for the space: a class repeats every
    // week and an exam happens once.
    const chipH = 15;
    let chipY = y + 26;
    const limit = Math.floor((rowH - 32) / chipH);
    const items: { label: string; color: string; bold: boolean }[] = [
      ...markers.map((m) => ({ label: m.t, color: KIND_COLOR[m.k], bold: true })),
      ...events.map((e) => ({ label: e.t, color: FILL[e.k], bold: false })),
    ];

    const shown = items.slice(0, Math.max(0, limit - (items.length > limit ? 1 : 0)));

    for (const item of shown) {
      nodes.push({ k: 'rect', x: x + 8, y: chipY + 3, w: 3, h: 8, r: 1.5, fill: item.color });
      nodes.push({
        k: 'text',
        x: x + 15,
        y: chipY + 11,
        s: truncate(item.label, colW - 26, 9.5, item.bold ? 600 : 400),
        size: 9.5,
        weight: item.bold ? 600 : 400,
        fill: item.bold ? INK.label : INK.label2,
      });
      chipY += chipH;
    }

    if (items.length > shown.length) {
      nodes.push({
        k: 'text',
        x: x + 15,
        y: chipY + 10,
        s: `+${items.length - shown.length} more`,
        size: 9,
        fill: INK.label3,
      });
    }
  }
}

/* ------------------------------------------------------------------ year -- */

/**
 * Twelve small months, each day shaded by how full it is.
 *
 * Nothing is named except the important dates, which get their own list. At a
 * twelfth of a page a course title is four illegible pixels, so the year view
 * answers the only questions it can answer honestly at that size: when is the
 * term busy, and when are the things that matter.
 */
function drawYear(nodes: Node[], snapshot: Snapshot, range: DateRange, box: Box): void {
  const density = densityOf(snapshot);
  const busiest = Math.max(1, ...density);

  const kindByDay = new Map<number, MarkerKind>();
  for (const marker of snapshot.mk) {
    // Exams win the day's colour, matching how the week strip picks one.
    const current = kindByDay.get(marker.d);
    if (!current || marker.k === 'exam') kindByDay.set(marker.d, marker.k);
  }

  const listH = snapshot.mk.length > 0 ? 96 : 0;
  const gridH = box.h - listH;

  const cols = 4;
  const rows = 3;
  const cellW = box.w / cols;
  const cellH = gridH / rows;
  const year = range.start.getFullYear();

  for (let month = 0; month < 12; month++) {
    const x = box.x + (month % cols) * cellW;
    const y = box.y + Math.floor(month / cols) * cellH;
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Sized to whichever runs out first, the cell's width or its height, so
    // the twelve months stay square and identical however the page is shaped.
    const gap = 2.5;
    const dot = Math.max(
      6,
      Math.min(24, (cellW - 16) / 7 - gap, (cellH - 40) / 6 - gap),
    );
    const gridW = 7 * (dot + gap) - gap;
    const left = x + (cellW - gridW) / 2;
    const gridY = y + 28;
    const lead = first.getDay();

    nodes.push({
      k: 'text',
      x: left,
      y: y + 16,
      s: first.toLocaleDateString(undefined, { month: 'long' }),
      size: 12.5,
      weight: 600,
      fill: INK.label,
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = lead + day - 1;
      const cx = left + (cell % 7) * (dot + gap);
      const cy = gridY + Math.floor(cell / 7) * (dot + gap);
      const index = dayOfYear(year, month, day);
      const count = density[index] ?? 0;
      const kind = kindByDay.get(index);

      nodes.push({
        k: 'rect',
        x: cx,
        y: cy,
        w: dot,
        h: dot,
        r: 3,
        // Never fully transparent: an empty day still has to read as a day.
        fill: count === 0 ? INK.hairSoft : tint(FILL.blue, 0.18 + 0.62 * (count / busiest)),
      });

      if (kind) {
        nodes.push({
          k: 'circle',
          cx: cx + dot - 2.5,
          cy: cy + 2.5,
          r: 2.4,
          fill: KIND_COLOR[kind],
        });
      }
    }
  }

  if (snapshot.mk.length === 0) return;

  const listY = box.y + gridH + 10;
  nodes.push({ k: 'line', x1: box.x, y1: listY, x2: box.x + box.w, y2: listY, stroke: INK.hair });
  nodes.push({
    k: 'text',
    x: box.x,
    y: listY + 20,
    s: 'IMPORTANT DATES',
    size: 10,
    weight: 700,
    fill: INK.label3,
    ls: 0.8,
  });

  // Three columns of the soonest dates. A year can hold far more than fits,
  // and the ones at the start of it are the ones being planned around.
  //
  // Filled evenly rather than four-then-four-then-the-rest: seven dates laid
  // out in fixed columns leave the third one empty and the list looking broken.
  const columns = 3;
  const MAX_ROWS = 4;
  const columnW = box.w / columns;
  const shown = snapshot.mk.slice(0, MAX_ROWS * columns);
  const perColumn = Math.min(MAX_ROWS, Math.ceil(shown.length / columns));

  shown.forEach((marker, i) => {
    const column = Math.floor(i / perColumn);
    const row = i % perColumn;
    const x = box.x + column * columnW;
    const y = listY + 38 + row * 15;
    const date = addDays(range.start, marker.d);
    const when = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    nodes.push({ k: 'circle', cx: x + 3, cy: y - 3.5, r: 3, fill: KIND_COLOR[marker.k] });
    nodes.push({
      k: 'text',
      x: x + 12,
      y,
      s: when,
      size: 10,
      weight: 600,
      fill: INK.label2,
    });

    const offset = 12 + estimateWidth('MMM 00', 10, 600) + 6;
    nodes.push({
      k: 'text',
      x: x + offset,
      y,
      s: truncate(marker.t, columnW - offset - 14, 10),
      size: 10,
      fill: INK.label,
    });
  });

  if (snapshot.mk.length > shown.length) {
    nodes.push({
      k: 'text',
      x: box.x + box.w,
      y: listY + 20,
      s: `+${snapshot.mk.length - shown.length} more`,
      size: 10,
      fill: INK.label3,
      anchor: 'end',
    });
  }
}

/** Zero-based day of the year, matching the density string's indexing. */
function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const target = Date.UTC(year, month, day);
  return Math.round((target - start) / 86_400_000);
}
