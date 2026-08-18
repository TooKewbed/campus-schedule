/**
 * Getting readable text out of a PDF.
 *
 * A PDF has no lines. It has glyph runs at coordinates, and a table is only a
 * table because of where things sit on the page. Concatenating the fragments in
 * document order — which is the obvious approach, and what most naive
 * extractors do — turns a schedule table into one long ribbon where a date and
 * its description end up paragraphs apart.
 *
 * So the text is rebuilt from geometry: fragments are grouped into rows by
 * their vertical position, then ordered left to right within each row. The
 * syllabus parser reads a line at a time, and this is what makes a line mean
 * something.
 *
 * pdf.js is ~350kB and is loaded only when a PDF is actually opened, so the
 * ordinary page load never pays for it.
 */

/** Fragments within this many points of each other count as the same line. */
const ROW_TOLERANCE = 3;

/** Beyond this gap, two fragments are separate cells rather than one phrase. */
const CELL_GAP = 12;

export interface PdfExtraction {
  text: string;
  pages: number;
}

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const pdfjs = await import('pdfjs-dist');

  // The worker is a separate file; Vite needs the URL form to fingerprint and
  // serve it. Without this pdf.js falls back to running on the main thread and
  // freezes the page on anything long.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  // The loading task, not the document, owns teardown — the worker stays alive
  // until it is destroyed, and one leaked worker per opened file adds up.
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(rowsToText(content.items as TextLike[]));
    // Pages hold on to their rendered state; a long syllabus adds up.
    page.cleanup();
  }

  const count = doc.numPages;
  await task.destroy();
  return { text: pages.join('\n'), pages: count };
}

/** The parts of pdf.js's TextItem this file uses. */
interface TextLike {
  str?: string;
  transform?: number[];
  width?: number;
}

interface Fragment {
  text: string;
  x: number;
  y: number;
  width: number;
}

function rowsToText(items: TextLike[]): string {
  const fragments: Fragment[] = [];

  for (const item of items) {
    const text = item.str ?? '';
    if (!text.trim()) continue;
    const transform = item.transform;
    if (!transform || transform.length < 6) continue;

    fragments.push({
      text,
      x: transform[4],
      y: transform[5],
      width: item.width ?? 0,
    });
  }

  if (fragments.length === 0) return '';

  // Top of the page downwards; PDF y grows upwards, hence the reversed compare.
  fragments.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Fragment[][] = [];
  let current: Fragment[] = [fragments[0]];

  for (const fragment of fragments.slice(1)) {
    const rowY = current[0].y;
    if (Math.abs(fragment.y - rowY) <= ROW_TOLERANCE) current.push(fragment);
    else {
      rows.push(current);
      current = [fragment];
    }
  }
  rows.push(current);

  return rows
    .map((row) => {
      const ordered = [...row].sort((a, b) => a.x - b.x);
      let line = '';
      let previousEnd: number | null = null;

      for (const fragment of ordered) {
        if (previousEnd !== null) {
          const gap = fragment.x - previousEnd;
          // A wide gap is a column boundary. Marking it keeps "Oct 6" from
          // fusing with the cell beside it into "Oct 6Chapter 4".
          if (gap > CELL_GAP) line += ' | ';
          else if (gap > 0.5 || !line.endsWith(' ')) line += ' ';
        }
        line += fragment.text.trim();
        previousEnd = fragment.x + fragment.width;
      }
      return line.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * A PDF of page images — a scan or a photographed handout — extracts to
 * nothing. Saying so beats showing an empty result list that looks like the
 * parser simply failed.
 */
export function looksScanned(extraction: PdfExtraction): boolean {
  return extraction.text.replace(/\s/g, '').length < 40 * Math.max(1, extraction.pages);
}
