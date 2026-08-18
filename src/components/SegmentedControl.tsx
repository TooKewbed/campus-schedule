import type { CSSProperties } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/**
 * iOS-style segmented control. The thumb is a single absolutely-positioned
 * element moved with `translateX` — transform-only, so it stays on the
 * compositor, and it retargets smoothly if you click through the segments fast.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const style = {
    '--index': index,
    '--count': options.length,
  } as CSSProperties;

  return (
    <div className="segmented" role="tablist" aria-label={label} style={style}>
      <div className="thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
