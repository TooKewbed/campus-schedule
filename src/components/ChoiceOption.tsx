interface Props {
  on: boolean;
  onSelect: () => void;
  /** Radio group name; must differ between groups rendered at the same time. */
  name: string;
  title: string;
  sub: string;
}

/**
 * One option in a two-way choice, shown as a card rather than a bare radio.
 *
 * A real `<input type="radio">` sits inside it, so arrow-key navigation and
 * screen-reader grouping come from the platform instead of being reimplemented
 * on top of buttons.
 *
 * Shared between the commitment dialog and the manual entry panel: both ask the
 * same question — does this repeat, or is it one date — and it would be odd for
 * the same question to look different depending on how it was reached.
 */
export default function ChoiceOption({ on, onSelect, name, title, sub }: Props) {
  return (
    <label className={`repeat-option${on ? ' on' : ''}`}>
      <input type="radio" name={name} checked={on} onChange={onSelect} />
      <span>
        <strong>{title}</strong>
        <span className="repeat-sub">{sub}</span>
      </span>
    </label>
  );
}
