import { WEEKDAYS } from '../lib/weekdays';

interface Props {
  value: number[];
  onChange: (weekdays: number[]) => void;
  label?: string;
}

/** The S M T W T F S row shared by every "repeats on" control. */
export default function WeekdayPicker({ value, onChange, label = 'Repeats on' }: Props) {
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  };

  return (
    <div className="day-picker" role="group" aria-label={label}>
      {WEEKDAYS.map((day) => {
        const on = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            className={`day-toggle${on ? ' on' : ''}`}
            aria-pressed={on}
            aria-label={day.full}
            title={day.full}
            onClick={() => toggle(day.value)}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
