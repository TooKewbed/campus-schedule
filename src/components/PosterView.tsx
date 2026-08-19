import { POSTER_FONT, type Scene } from '../lib/scene';

interface Props {
  scene: Scene;
  /** Announced in place of the drawing, which is meaningless to a screen reader. */
  label: string;
  className?: string;
}

/**
 * A scene, drawn as React elements.
 *
 * The same nodes the PNG is rasterized from, so the preview cannot drift from
 * the file — a preview that lies is worse than no preview at all.
 *
 * Rendered as elements rather than by dropping in the serialized SVG string.
 * Some of these scenes are built from a link someone else made, and while the
 * serializer escapes what it writes, "this markup is safe because a function
 * over there is careful" is the kind of reasoning that stops being true during
 * a later edit. React inserts text as text, so the question does not arise.
 */
export default function PosterView({ scene, label, className }: Props) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${scene.w} ${scene.h}`}
      width={scene.w}
      height={scene.h}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily={POSTER_FONT}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMin meet"
    >
      <rect width={scene.w} height={scene.h} fill={scene.bg} />
      {scene.nodes.map((node, i) => {
        switch (node.k) {
          case 'rect':
            return (
              <rect
                key={i}
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={node.r}
                fill={node.fill ?? 'none'}
                stroke={node.stroke}
                strokeWidth={node.stroke ? node.sw ?? 1 : undefined}
                opacity={node.op}
              />
            );
          case 'text':
            return (
              <text
                key={i}
                x={node.x}
                y={node.y}
                fontSize={node.size}
                fontWeight={node.weight}
                fill={node.fill}
                textAnchor={node.anchor}
                letterSpacing={node.ls}
                opacity={node.op}
              >
                {node.s}
              </text>
            );
          case 'line':
            return (
              <line
                key={i}
                x1={node.x1}
                y1={node.y1}
                x2={node.x2}
                y2={node.y2}
                stroke={node.stroke}
                strokeWidth={node.sw ?? 1}
                strokeDasharray={node.dash}
                opacity={node.op}
              />
            );
          case 'circle':
            return (
              <circle
                key={i}
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill={node.fill}
                opacity={node.op}
              />
            );
        }
      })}
    </svg>
  );
}
