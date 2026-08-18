import { useRef, useState } from 'react';

export interface ImportSummary {
  fileName: string;
  sourceEventCount: number;
  occurrenceCount: number;
  warnings: string[];
}

interface Props {
  summary: ImportSummary | null;
  error: string | null;
  hasEvents: boolean;
  onImportText: (text: string, fileName: string) => void;
  onClear: () => void;
}

export default function ImportPanel({
  summary,
  error,
  hasEvents,
  onImportText,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = async (file: File) => {
    onImportText(await file.text(), file.name);
  };

  return (
    <section
      className={`import-panel${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void readFile(file);
      }}
    >
      <div className="import-row">
        <div className="import-copy">
          <strong>Import your schedule</strong>
          <span>
            Drop a <code>.ics</code> file here — a registrar export, or Google/Outlook/Apple
            Calendar. Recurring classes are expanded automatically.
          </span>
        </div>

        <div className="import-actions">
          <button className="btn primary" onClick={() => inputRef.current?.click()}>
            Choose .ics file
          </button>
          {hasEvents && (
            <button className="btn plain" onClick={onClear}>
              Clear
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && <div className="notice error">{error}</div>}

      {summary && (
        <div className="notice ok">
          Imported <strong>{summary.fileName}</strong> — {summary.sourceEventCount} calendar
          entries expanded into {summary.occurrenceCount} occurrences.
          {summary.warnings.length > 0 && (
            <ul className="warnings">
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
