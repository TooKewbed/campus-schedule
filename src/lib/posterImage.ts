import { sceneToSvg, type Scene } from './scene';
import { describeRange, snapshotStart, type DateRange, type Snapshot } from './shareSnapshot';
import { addDays } from './time';

/**
 * Turning a poster into a file, in the browser.
 *
 * Everything here needs a real document, which is why it is separate from the
 * layout code — `poster.ts` stays pure and testable, and this holds the parts
 * that can only be checked by running them.
 *
 * The route is SVG to blob URL to <img> to canvas. A blob URL rather than a
 * data URI because base64-encoding a UTF-8 string by hand is a needless step
 * with a well-known unicode trap in it, and rather than drawing to canvas
 * directly because canvas has no text layout worth the name — no wrapping, no
 * ellipsis, and metrics that differ between browsers.
 */

/** Retina by default: a poster is usually looked at on a phone. */
const SCALE = 2;

export async function sceneToPngBlob(scene: Scene, scale = SCALE): Promise<Blob> {
  const svg = sceneToSvg(scene);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(scene.w * scale);
    canvas.height = Math.round(scene.h * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot render the image.');

    // The scene paints its own background, but a canvas starts transparent and
    // a PNG with holes in it looks broken on any dark background it lands on.
    context.fillStyle = scene.bg;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not draw the schedule.'));
    image.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the navigation to have been started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether this browser can put an image on the clipboard at all. */
export function canCopyImages(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

export async function copyImage(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** "skedge-week-2026-08-16.png" — sorts chronologically in a downloads folder. */
export function posterFilename(snapshot: Snapshot): string {
  return `skedge-${snapshot.r}-${snapshot.f}.png`;
}

/** What the poster is of, for a share sheet or a page title. */
export function posterTitle(snapshot: Snapshot): string {
  const start = snapshotStart(snapshot);
  const range: DateRange = { start, end: addDays(start, snapshot.n), days: snapshot.n };
  return snapshot.ti ? `${snapshot.ti} · ${describeRange(snapshot.r, range)}` : describeRange(snapshot.r, range);
}

/** The system share sheet, where there is one — the natural path on a phone. */
export function canShareFiles(blob: Blob, filename: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, filename: string, title: string): Promise<void> {
  await navigator.share({
    files: [new File([blob], filename, { type: 'image/png' })],
    title,
  });
}
