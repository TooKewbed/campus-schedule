import { addDays, startOfWeek } from '../lib/time';

/**
 * A realistic semester schedule as a real .ics string, generated around the
 * current week so the app always opens on a live-looking day.
 *
 * This deliberately goes through the same parser as a user's file — sample data
 * that bypassed `parseIcs` would let the import path rot unnoticed.
 *
 * Times are floating (no TZID, no Z), which RFC 5545 defines as local time, so
 * a 9 AM class reads as 9 AM wherever the student happens to be.
 */
export function buildSampleIcs(reference: Date = new Date()): string {
  const monday = startOfWeek(reference);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus Schedule//Sample Data//EN',
    'CALSCALE:GREGORIAN',
  ];

  const weekly = (
    uid: string,
    summary: string,
    location: string,
    dayOffset: number,
    startTime: [number, number],
    endTime: [number, number],
    byDay: string,
    count = 45,
  ) => {
    const day = addDays(monday, dayOffset);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@sample.campus-schedule`,
      `DTSTAMP:${stamp(reference)}`,
      `DTSTART:${at(day, startTime)}`,
      `DTEND:${at(day, endTime)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay};COUNT=${count}`,
      `SUMMARY:${escape(summary)}`,
      `LOCATION:${escape(location)}`,
      'END:VEVENT',
    );
  };

  // --- Fixed: classes ---
  weekly('chem101', 'CHEM 101 General Chemistry', 'Lecture Hall B', 0, [9, 0], [9, 50], 'MO,WE,FR');
  weekly('math152', 'MATH 152 Calculus II', 'Root Hall 204', 1, [11, 0], [12, 15], 'TU,TH');
  weekly('phys211', 'PHYS 211 Physics I', 'Science 140', 0, [13, 0], [13, 50], 'MO,WE,FR');
  weekly('chemlab', 'CHEM 101 Lab', 'Science 118', 1, [14, 0], [15, 15], 'TU');

  // --- Fixed: work. Overlaps the Tuesday lab by 45 minutes — a real conflict. ---
  weekly('bookstore', 'Work Shift — Campus Bookstore', 'Student Union', 1, [14, 30], [17, 30], 'TU,TH');

  // --- Flexible: optional, never blocks time, never conflicts ---
  weekly('oh-chen', 'Office Hours — Prof. Chen', 'Science 302', 1, [13, 0], [14, 0], 'TU');
  weekly('oh-martinez', 'Office Hours — TA Martinez', 'Math Annex 11', 1, [15, 30], [16, 30], 'TU');
  weekly('study-phys', 'Study Group — Physics', 'Library Room 3', 1, [19, 30], [20, 30], 'TU');
  weekly('tutoring', 'Calculus Tutoring Center', 'Learning Commons', 2, [16, 0], [18, 0], 'WE');

  // --- One-off exam, ~two weeks out ---
  const examDay = addDays(monday, 16);
  lines.push(
    'BEGIN:VEVENT',
    'UID:phys211-midterm@sample.campus-schedule',
    `DTSTAMP:${stamp(reference)}`,
    `DTSTART:${at(examDay, [10, 0])}`,
    `DTEND:${at(examDay, [12, 0])}`,
    'SUMMARY:PHYS 211 Midterm Exam',
    'LOCATION:Science 140',
    'CATEGORIES:exam',
    'END:VEVENT',
  );

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function at(day: Date, [hour, minute]: [number, number]): string {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return local(d);
}

function local(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function stamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** RFC 5545 escaping for TEXT values. */
function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
