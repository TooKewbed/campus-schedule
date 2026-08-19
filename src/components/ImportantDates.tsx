import { useState } from 'react';
import { describeMarkerDate, sortMarkers, type DayMarker } from '../types/dayMarker';
import Chevron from './Chevron';
import DatePicker from './DatePicker';

interface Props {
  markers: DayMarker[];
  holidayCount: number;
  showHolidays: boolean;
  onToggleHolidays: (value: boolean) => void;
  onAdd: (title: string, month: number, day: number, year: number | null) => void;
  onDelete: (id: string) => void;
}

export default function ImportantDates({
  markers,
  holidayCount,
  showHolidays,
  onToggleHolidays,
  onAdd,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [annual, setAnnual] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setProblem('Give it a name.');
      return;
    }

    // Parse the YYYY-MM-DD parts directly. Passing the string to `new Date()`
    // would read it as UTC midnight and land on the previous day west of GMT.
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) {
      setProblem('Pick a date.');
      return;
    }

    onAdd(title, m, d, annual ? null : y);
    setTitle('');
    setProblem(null);
  };

  const ordered = sortMarkers(markers);

  return (
    <section className="manual dates">
      <button className="manual-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="manual-head-text">
          <strong>Important dates</strong>
          <span className="manual-head-sub">
            {summarize(markers.length, showHolidays ? holidayCount : 0)}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      <div className="manual-body" data-open={open}>
        <div className="manual-body-inner">
          <div className="manual-form">
            <label className="field field-wide">
              <span className="field-label">Occasion</span>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setProblem(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Mom's birthday"
              />
            </label>

            <div className="field">
              <span className="field-label">Date</span>
              <DatePicker
                value={date}
                onChange={(next) => {
                  setDate(next);
                  setProblem(null);
                }}
              />
            </div>

            <div className="field">
              <span className="field-label">Repeat</span>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={annual}
                  onChange={(e) => setAnnual(e.target.checked)}
                />
                <span>Every year</span>
              </label>
              <span className="field-hint">
                {annual ? 'Birthdays, anniversaries' : 'This year only'}
              </span>
            </div>
          </div>

          {problem && <p className="manual-problem">{problem}</p>}

          <div className="manual-actions">
            <button className="btn primary" onClick={submit}>
              Add date
            </button>
          </div>

          <div className="holiday-row">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={showHolidays}
                onChange={(e) => onToggleHolidays(e.target.checked)}
              />
              <span>Show US federal holidays</span>
            </label>
            <span className="field-hint">{holidayCount} per year, added automatically</span>
          </div>

          {ordered.length > 0 && (
            <ul className="series-list">
              {ordered.map((marker) => (
                <li key={marker.id} className="series">
                  <span className="series-rail marker" aria-hidden="true" />
                  <span className="series-main">
                    <span className="series-title">{marker.title}</span>
                    <span className="series-meta">
                      {/* "Exam 1" means nothing once three courses have been
                          imported, so the course leads the line when there is
                          one. */}
                      {marker.courseCode && (
                        <span className="series-course">{marker.courseCode}</span>
                      )}
                      {describeMarkerDate(marker)}
                    </span>
                  </span>
                  <button
                    className="icon-btn danger"
                    onClick={() => onDelete(marker.id)}
                    aria-label={`Remove ${marker.title}`}
                    title="Remove"
                  >
                    <TrashGlyph />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function summarize(personal: number, holidays: number): string {
  if (personal === 0 && holidays === 0) return 'Birthdays and one-off dates — no time slot needed';
  const parts: string[] = [];
  if (personal > 0) parts.push(`${personal} of your own`);
  if (holidays > 0) parts.push(`${holidays} holidays`);
  return parts.join(' · ');
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3.2h3v1.3M4.6 4.5l.6 8.3h5.6l.6-8.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
