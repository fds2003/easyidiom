/**
 * branding.mjs — Single source of truth for brand names used across
 * generated pages (answer pages, idiom detail pages, category pages,
 * landing pages) and the SEO validator.
 *
 * Kept dependency-free so any Node script (ESM or CJS) can import it.
 */

export const BRANDING = {
  primaryName: 'Chengyu Puzzle',
  zhName: '成语猜词',
  alternates: ['Chengyu Puzzle', 'Chinese Idiom Game', 'Hanzi Game', '成语猜词'],
  siteUrl: 'https://easyidiom.com',
  answerDir: 'public/answer',
  learnPage: '/learn-chinese-with-idioms',
  studyHub: '/study/chinese-idiom-hsk-guide',
  legacyTerms: ['Chengyu Guesser', 'Chinese Wordle Guide', 'Chengyu Wordle', 'Chinese Wordle', 'Hanzi Wordle'],
  faqBrandedTerms: {
    from: ['Chengyu Guesser', 'Chengyu Wordle'],
    to: 'Chengyu Puzzle',
  },
};

/**
 * Idempotent replacement of legacy brand strings with the current brand.
 * Never throws; returns the input unchanged when nothing matches.
 * @param {string} str
 * @returns {string}
 */
export function replaceBranding(str) {
  if (typeof str !== 'string' || !str) return str;
  let out = str;
  for (const legacy of BRANDING.legacyTerms) {
    if (out.includes(legacy)) {
      out = out.split(legacy).join(BRANDING.primaryName);
    }
  }
  return out;
}