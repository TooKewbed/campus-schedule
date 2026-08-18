const COURSE_CODE = /\b([A-Z]{2,4})[\s-]?(\d{3}[A-Z]?)\b/;

/**
 * Pull a course code out of a title, so every meeting of the same course —
 * lecture, lab, review — gets the same colour on the grid.
 */
export function extractCourseCode(summary: string): string | undefined {
  const match = COURSE_CODE.exec(summary);
  return match ? `${match[1]} ${match[2]}` : undefined;
}
