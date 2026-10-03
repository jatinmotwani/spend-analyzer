// Turns what the speech engine heard into draft spends for the confirm card.
// The browser can return several guesses for one utterance; we parse each and
// keep the one that makes the most sense for *this* user. Pure, so it's testable.
import { CATEGORY_NAMES, type CategoryId } from './categories';
import { parseSpends, type ParsedSpend } from './parser';

export type Draft = Omit<ParsedSpend, 'category'> & { category: CategoryId; learned: boolean };

const GENERIC = new Set(Object.values(CATEGORY_NAMES).map((n) => n.toLowerCase()));

/** Titles worth looking up in the user's history (skips fallbacks like "Food & Drinks"). */
export const lookupTitles = (parsed: ParsedSpend[]) =>
  parsed.map((s) => s.title.toLowerCase()).filter((t) => !GENERIC.has(t));

/**
 * Pick the best of the speech engine's alternatives:
 * a parseable amount first, then places the user has filed before, then keyword hits,
 * and otherwise the engine's own ranking.
 */
export function chooseDrafts(
  alternatives: string[],
  today: string,
  learned: Map<string, CategoryId>,
): { heard: string; drafts: Draft[] } | null {
  let best: { heard: string; drafts: Draft[]; score: number } | null = null;
  for (const [rank, text] of alternatives.entries()) {
    const parsed = parseSpends(text, today);
    if (!parsed.length) continue;
    let score = 100 - rank;
    const drafts = parsed.map((s) => {
      const known = learned.get(s.title.toLowerCase());
      if (known) score += 20;
      else if (s.category !== 'other') score += 5;
      return { ...s, category: known ?? s.category, learned: Boolean(known) };
    });
    if (!best || score > best.score) best = { heard: text, drafts, score };
  }
  return best && { heard: best.heard, drafts: best.drafts };
}
