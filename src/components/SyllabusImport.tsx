import { useRef, useState, type DragEvent } from 'react';
import type { DayMarker } from '../types/dayMarker';
import {
  KIND_LABEL,
  defaultSelection,
  describeCandidate,
  extractDates,
  markersFrom,
  type Candidate,
} from '../lib/syllabus';

interface Props {
  onAdd: (markers: DayMarker[]) => void;
}

/**
 * Pull exam and deadline dates out of a syllabus.
 *
 * The panel has two phases, and the second one is the point. Pattern matching
 * on prose is wrong often enough that adding dates straight to the calendar
 * would be worse than useless — a wrong exam date is actively harmful, and
 * a silently missing one is indistinguishable from an empty syllabus. So the
 * results are always shown as a list to approve, tick by tick, with the line
 * each came from visible underneath and every title editable before it lands.
 */
export default function SyllabusImport({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [text, setText] = useState('');
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  async function loadFile(file: File) {
    setBusy(true);
    setError(null);
    setCandidates(null);

    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const { extractPdfText, looksScanned } = await import('../lib/pdfText');
        const result = await extractPdfText(file);

        if (looksScanned(result)) {
          setError(
            `“${file.name}” has almost no selectable text — it is probably a scan. ` +
              'Copy the schedule out of it and paste below instead.',
          );
          setFileNote(null);
          return;
        }

        setText(result.text);
        setFileNote(`${file.name} · ${result.pages} page${result.pages === 1 ? '' : 's'}`);
      } else {
        // .txt, .md, .csv and anything else readable as plain text.
        setText(await file.text());
        setFileNote(file.name);
      }
    } catch (problem) {
      setError(
        problem instanceof Error
          ? `Could not read that file: ${problem.message}`
          : 'Could not read that file.',
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  function findDates() {
    const found = extractDates(text);
    setCandidates(found);
    setSelected(defaultSelection(found));
    setTitles(new Map());
    setError(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function retitle(id: string, value: string) {
    setTitles((prev) => new Map(prev).set(id, value));
  }

  function titleOf(candidate: Candidate): string {
    return titles.get(candidate.id) ?? candidate.title;
  }

  function addSelected() {
    if (!candidates) return;

    const markers = candidates
      .filter((c) => selected.has(c.id))
      .flatMap((c) => markersFrom({ ...c, title: titleOf(c).trim() || c.title }, courseCode));

    if (markers.length === 0) return;
    onAdd(markers);

    setCandidates(null);
    setSelected(new Set());
    setTitles(new Map());
    setText('');
    setFileNote(null);
  }

  const dayCount = candidates
    ? candidates.filter((c) => selected.has(c.id)).reduce((n, c) => n + c.span, 0)
    : 0;

  return (
    <section className="syllabus">
      <div className="syllabus-head">
        <div className="syllabus-head-text">
          <h2>From a syllabus</h2>
          <span className="syllabus-head-sub">
            Find exams and deadlines in a course syllabus, then choose which to keep.
          </span>
        </div>
        <button
          className="btn plain"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>

      {open && (
        <div className="syllabus-body">
          {!candidates && (
            <>
              <div className="field">
                <label className="field-label" htmlFor="syllabus-course">
                  Course
                </label>
                <input
                  id="syllabus-course"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="CHEM 101"
                />
                <span className="field-hint">
                  Shown beside each date so you can tell courses apart. Optional.
                </span>
              </div>

              <div
                className={`dropzone${dragging ? ' over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void loadFile(file);
                    // Lets the same file be picked twice in a row.
                    e.target.value = '';
                  }}
                />
                <p className="dropzone-main">
                  {busy ? 'Reading…' : 'Drop a PDF here'}
                </p>
                <button
                  className="btn tiny"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  Choose a file
                </button>
              </div>

              <div className="syllabus-or" aria-hidden="true">
                <span>or paste it</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="syllabus-text">
                  Syllabus text
                </label>
                <textarea
                  id="syllabus-text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setFileNote(null);
                  }}
                  placeholder={'Exam 1 — Thursday, October 16\nNo class Nov 26-28\nFinal project due Dec 8'}
                  rows={6}
                />
                {fileNote && <span className="field-hint">Loaded from {fileNote}</span>}
              </div>

              {error && (
                <p className="syllabus-error" role="alert">
                  {error}
                </p>
              )}

              <div className="syllabus-actions">
                <button
                  className="btn primary"
                  onClick={findDates}
                  disabled={busy || !text.trim()}
                >
                  Find dates
                </button>
              </div>
            </>
          )}

          {candidates && candidates.length === 0 && (
            <div className="syllabus-empty">
              <p>No dates found in that text.</p>
              <p className="field-hint">
                Dates need to look like “Oct 16”, “October 16” or “10/16”. If the syllabus
                lists them as “Week 6” with the dates in a separate calendar, there is
                nothing here to match on.
              </p>
              <button className="btn" onClick={() => setCandidates(null)}>
                Back
              </button>
            </div>
          )}

          {candidates && candidates.length > 0 && (
            <>
              <div className="review-head">
                <span className="review-count">
                  {candidates.length} found · {selected.size} selected
                  {dayCount !== selected.size && ` · ${dayCount} days`}
                </span>
                <div className="review-bulk">
                  <button
                    className="linkish"
                    onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
                  >
                    All
                  </button>
                  <button className="linkish" onClick={() => setSelected(new Set())}>
                    None
                  </button>
                </div>
              </div>

              <ul className="review-list">
                {candidates.map((candidate) => {
                  const on = selected.has(candidate.id);
                  return (
                    <li
                      key={candidate.id}
                      className={`review-row${on ? ' on' : ''} conf-${candidate.confidence}`}
                    >
                      <button
                        className="check"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`Include ${titleOf(candidate)}`}
                        onClick={() => toggle(candidate.id)}
                      >
                        <CheckGlyph />
                      </button>

                      <div className="review-main">
                        <div className="review-top">
                          <span className={`kind-chip kind-${candidate.kind}`}>
                            {KIND_LABEL[candidate.kind]}
                          </span>
                          <span className="review-date">{describeCandidate(candidate)}</span>
                          {candidate.span > 1 && (
                            <span className="review-span">{candidate.span} days</span>
                          )}
                          {candidate.confidence === 'low' && (
                            <span className="review-flag">unsure</span>
                          )}
                        </div>

                        <input
                          className="review-title"
                          value={titleOf(candidate)}
                          onChange={(e) => retitle(candidate.id, e.target.value)}
                          aria-label="Title"
                        />

                        {/* What it was read from, so a wrong row is diagnosable
                            rather than mysterious. */}
                        <p className="review-context">{candidate.context}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="syllabus-actions">
                <button className="btn" onClick={() => setCandidates(null)}>
                  Back
                </button>
                <button
                  className="btn primary"
                  onClick={addSelected}
                  disabled={selected.size === 0}
                >
                  Add {dayCount} date{dayCount === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
