import { describe, it, expect } from 'vitest';
import { generateHTML } from '../generate-answers-deepseek.mjs';

const defaultInfo = {
  pinyin: 'yú bō wèi píng',
  meaning: 'The aftermath or repercussions of an event are not yet settled or resolved.',
  literal: 'remaining waves not yet calm',
  example: 'The scandal\'s ripples were still being felt; the aftermath was not yet over.',
  hint1: 'Think of the lingering effects after a storm.',
  hint2: 'The first character means \'remaining\' or \'leftover\'.',
  difficulty: 'medium',
};

describe('generateHTML', () => {
  it('matches snapshot for a typical answer page', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toMatchSnapshot();
  });

  it('includes year in H1', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, null, '2026-05-16');
    expect(html).toContain('Chengyu Puzzle Answer May 15, 2026');
  });

  it('includes year in <title>', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', null);
    expect(html).toContain('<title>Chengyu Puzzle Answer May 15, 2026');
  });

  it('includes Related section with correct difficulty link', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('/idioms/medium/');
    expect(html).toContain('More medium idioms →');
  });

  it('includes link to idioms index', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, null, null);
    expect(html).toContain('Browse all Chinese idiom categories');
    expect(html).toContain('/idioms/');
  });

  it('renders 4 character boxes', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    const matches = html.match(/<div class="char-box">/g);
    expect(matches).toHaveLength(4);
  });

  it('shows prev/next navigation', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('href="/answer/2026-05-14/"');
    expect(html).toContain('href="/answer/2026-05-16/"');
  });

  it('handles missing difficulty with medium fallback', () => {
    const noDiff = { ...defaultInfo, difficulty: undefined };
    const html = generateHTML('2026-06-01', 'test', noDiff, null, null);
    expect(html).toContain('/idioms/medium/');
    expect(html).toContain('More medium idioms →');
  });

  it('includes JSON-LD article schema', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"headline"');
    expect(html).toContain('"datePublished":"2026-05-15T00:00:00.000Z"');
  });

  it('includes JSON-LD FAQPage schema', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"What is today\'s Chengyu Puzzle answer for 2026-05-15?"');
  });

  it('includes JSON-LD BreadcrumbList schema', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it('includes canonical URL', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('href="https://easyidiom.com/answer/2026-05-15/"');
  });

  it('handles first page (no prev)', () => {
    const html = generateHTML('2026-05-11', 'test', defaultInfo, null, '2026-05-12');
    expect(html).toContain('🏠 Home');
    expect(html).not.toContain('href="/answer/2026-05-10/"');
  });

  it('handles last page (no next)', () => {
    const html = generateHTML('2026-06-13', 'test', defaultInfo, '2026-06-12', null);
    expect(html).toContain('🏠 Home');
    expect(html).not.toContain('href="/answer/2026-06-14/"');
  });

  // ── SEO-specific tests ─────────────────────────────────────

  it('meta description has no double period (SEO fix)', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    const match = html.match(/<meta name="description" content="([^"]+)"/);
    expect(match).not.toBeNull();
    const desc = match[1];
    expect(desc).not.toMatch(/\.\. /);
    expect(desc).not.toMatch(/\.\.$/);
  });

  it('meta description includes CTA to play daily', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toContain('Play daily at https://easyidiom.com!');
  });

  it('meta description uses &amp; instead of plain "and"', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    const match = html.match(/<meta name="description" content="([^"]+)"/);
    const desc = match[1];
    expect(desc).toContain('&amp;');
  });

  it('og:description includes CTA same as meta description', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toMatch(/<meta property="og:description" content="[^"]*Play daily/);
  });

  it('twitter:description includes CTA same as meta description', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    expect(html).toMatch(/<meta name="twitter:description" content="[^"]*Play daily/);
  });

  it('meta description is under 320 chars (Google modern SERP limit)', () => {
    const html = generateHTML('2026-05-15', '余波未平', defaultInfo, '2026-05-14', '2026-05-16');
    const match = html.match(/<meta name="description" content="([^"]+)"/);
    expect(match[1].length).toBeLessThanOrEqual(320);
  });
});
