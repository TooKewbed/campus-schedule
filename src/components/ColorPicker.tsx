import { COLOR_LABEL, COLOR_NAMES, type ColorName } from '../types/event';

interface Props {
  /** null means automatic — derived from the course rather than chosen. */
  value: ColorName | null;
  onChange: (value: ColorName | null) => void;
  /** What automatic would currently pick, so the option shows its own result. */
  automatic: ColorName;
}

/**
 * Choosing a block's colour.
 *
 * "Automatic" leads and is not a blank slot: it shows the colour it would
 * actually produce, because the useful comparison is between one real colour
 * and another, not between a colour and an absence. Keeping it distinct from
 * picking that same colour by hand also matters — an automatic block follows
 * its course if the course code changes, a pinned one does not.
 */
export default function ColorPicker({ value, onChange, automatic }: Props) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={`Automatic — currently ${COLOR_LABEL[automatic]}`}
        title="Automatic — matches others on the same course"
        className={`swatch swatch-auto ${automatic}${value === null ? ' on' : ''}`}
        onClick={() => onChange(null)}
      >
        <AutoGlyph />
      </button>

      {COLOR_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={COLOR_LABEL[name]}
          title={COLOR_LABEL[name]}
          className={`swatch ${name}${value === name ? ' on' : ''}`}
          onClick={() => onChange(name)}
        />
      ))}
    </div>
  );
}

/** A small "A", so the automatic slot is not just an unlabelled colour. */
function AutoGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.4 11.4 8 4.6l3.6 6.8M5.8 9.4h4.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
