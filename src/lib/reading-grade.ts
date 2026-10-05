/**
 * Flesch-Kincaid grade level, for explainers.reading_grade.
 *
 * The editorial standard caps the grade (site_settings
 * explainer_max_reading_grade, 9 to start) and explainer_problems() refuses
 * to publish above it, so this is what decides whether a page can go out.
 * It is the textbook formula with a plain syllable counter. That is rough on
 * any single word and close enough over a paragraph, which is all it is
 * asked to judge.
 *
 *   grade = 0.39 x (words / sentences) + 11.8 x (syllables / words) - 15.59
 */

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  const trimmed = w
    // A silent final e, but not "le" after a consonant (table, little).
    .replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (m) => m.slice(0, 1))
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 0);
}

/** Splits on sentence ends and on line breaks, since a list item is a sentence. */
function sentencesIn(text: string): string[] {
  return text
    .split(/[.!?]+(?:\s|$)|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));
}

function wordsIn(text: string): string[] {
  // Numbers count as words but not as syllables to stumble on: "$87" reads as
  // one short word, not as the eight syllables of "eighty seven dollars".
  return text.match(/[a-z][a-z'’-]*|\d[\d,.]*%?/gi) ?? [];
}

/** Null when there is not enough text to judge. */
export function readingGrade(text: string): number | null {
  const sentences = sentencesIn(text);
  const words = wordsIn(text);
  if (sentences.length === 0 || words.length === 0) return null;

  const syllables = words.reduce(
    (sum, word) => sum + (/^\d/.test(word) ? 1 : countSyllables(word)),
    0,
  );

  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}
