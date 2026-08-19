interface Props {
  open: boolean;
}

/**
 * The disclosure arrow on a collapsible panel.
 *
 * Was three byte-identical copies, one per panel. Identical copies do not stay
 * identical — the next person to adjust the stroke weight or the rotation
 * fixes the one they are looking at, and the panels quietly stop matching. One
 * copy makes that impossible rather than merely unlikely.
 */
export default function Chevron({ open }: Props) {
  return (
    <svg
      className={`chevron${open ? ' open' : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 6.5L8 9.5l3-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
