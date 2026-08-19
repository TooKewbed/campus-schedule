/**
 * A tiny drawing model: shapes as data, rendered two ways.
 *
 * A shared poster has to exist as both a picture on screen and a PNG file, and
 * the two must be identical — a preview that differs from what gets downloaded
 * is worse than no preview. So the layout code produces this scene graph and
 * never touches SVG or canvas: `PosterView` renders it as React elements, and
 * `sceneToSvg` serializes the same nodes for rasterizing.
 *
 * Being data also makes the layouts testable. Positions and truncation are the
 * parts that actually go wrong, and they can be asserted on directly here
 * rather than by parsing generated markup or squinting at an image.
 */

export interface RectNode {
  k: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius. */
  r?: number;
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
}

export interface TextNode {
  k: 'text';
  x: number;
  /** Baseline, not top — matches SVG, and keeps rows aligned across sizes. */
  y: number;
  s: string;
  size: number;
  fill: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Letter spacing in px; negative tightens large text, as display type wants. */
  ls?: number;
  op?: number;
}

export interface LineNode {
  k: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  sw?: number;
  dash?: string;
  op?: number;
}

export interface CircleNode {
  k: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill: string;
  op?: number;
}

export type Node = RectNode | TextNode | LineNode | CircleNode;

export interface Scene {
  w: number;
  h: number;
  bg: string;
  nodes: Node[];
}

/**
 * The font stack the poster is drawn in.
 *
 * Rasterizing goes through an <img>, which gets no access to the page's fonts —
 * only what the OS already has. Generic families are therefore the only safe
 * choice, and the widths below are calibrated against them.
 */
export const POSTER_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/* ------------------------------------------------------------ text width -- */

/**
 * Roughly how wide a string will be, as a multiple of the font size.
 *
 * SVG cannot measure text before it is laid out and canvas measurement is not
 * available where these functions run, so truncation works from an estimate.
 * It is deliberately a little pessimistic: over-estimating trims a title one
 * character early, while under-estimating lets it run past the edge of its box,
 * and only one of those is visible as a bug.
 */
const NARROW = new Set("ijltfrI.,:;'`|!()[]{}/\ ");
const WIDE = new Set('mwMW@%_');

export function estimateWidth(text: string, size: number, weight = 400): number {
  let units = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) units += 0.31;
    else if (WIDE.has(ch)) units += 0.87;
    else if (ch >= 'A' && ch <= 'Z') units += 0.66;
    else if (ch >= '0' && ch <= '9') units += 0.56;
    else units += 0.53;
  }
  // Bold faces run wider at the same nominal size.
  return units * size * (weight >= 600 ? 1.06 : 1);
}

/** `text`, shortened with an ellipsis until it fits `maxWidth`. */
export function truncate(text: string, maxWidth: number, size: number, weight = 400): string {
  if (maxWidth <= 0) return '';
  if (estimateWidth(text, size, weight) <= maxWidth) return text;

  const chars = [...text];
  let out = '';
  for (const ch of chars) {
    if (estimateWidth(`${out}${ch}…`, size, weight) > maxWidth) break;
    out += ch;
  }
  // A single character plus an ellipsis says nothing; better to show nothing.
  return out.length === 0 ? '' : `${out.trimEnd()}…`;
}

/* ------------------------------------------------------------------ svg -- */

/** Two decimals is under a tenth of a pixel at 2x, and halves the file size. */
function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nodeToSvg(node: Node): string {
  const op = node.op !== undefined && node.op !== 1 ? ` opacity="${n(node.op)}"` : '';

  switch (node.k) {
    case 'rect': {
      const fill = node.fill ? ` fill="${node.fill}"` : ' fill="none"';
      const stroke = node.stroke ? ` stroke="${node.stroke}" stroke-width="${n(node.sw ?? 1)}"` : '';
      const r = node.r ? ` rx="${n(node.r)}"` : '';
      return `<rect x="${n(node.x)}" y="${n(node.y)}" width="${n(node.w)}" height="${n(node.h)}"${r}${fill}${stroke}${op}/>`;
    }
    case 'text': {
      const anchor = node.anchor && node.anchor !== 'start' ? ` text-anchor="${node.anchor}"` : '';
      const weight = node.weight ? ` font-weight="${node.weight}"` : '';
      const ls = node.ls ? ` letter-spacing="${n(node.ls)}"` : '';
      return `<text x="${n(node.x)}" y="${n(node.y)}" font-size="${n(node.size)}" fill="${node.fill}"${weight}${anchor}${ls}${op}>${escapeXml(node.s)}</text>`;
    }
    case 'line':
      return `<line x1="${n(node.x1)}" y1="${n(node.y1)}" x2="${n(node.x2)}" y2="${n(node.y2)}" stroke="${node.stroke}" stroke-width="${n(node.sw ?? 1)}"${node.dash ? ` stroke-dasharray="${node.dash}"` : ''}${op}/>`;
    case 'circle':
      return `<circle cx="${n(node.cx)}" cy="${n(node.cy)}" r="${n(node.r)}" fill="${node.fill}"${op}/>`;
  }
}

export function sceneToSvg(scene: Scene): string {
  const body = scene.nodes.map(nodeToSvg).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.w}" height="${scene.h}" ` +
    `viewBox="0 0 ${scene.w} ${scene.h}" font-family="${escapeXml(POSTER_FONT)}">` +
    `<rect width="${scene.w}" height="${scene.h}" fill="${scene.bg}"/>${body}</svg>`
  );
}
