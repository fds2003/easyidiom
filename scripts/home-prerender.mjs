/**
 * Build-time homepage SEO block + HSK study hub HTML.
 * All calendar dates use UTC (same as getTodayGame in src/app.jsx); day rolls at 00:00 UTC.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

export function loadGames() {
  const csvPath = path.join(root, 'game-data', 'game-idioms.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.trim().split(/\r?\n/);
  return lines
    .slice(1)
    .map((line) => {
      const i = line.indexOf(',');
      if (i === -1) return null;
      const id = line.slice(0, i).trim();
      const idiom = line.slice(i + 1).trim();
      return id && idiom ? { id, idiom } : null;
    })
    .filter(Boolean);
}

export function recentAnswerIsoDates(count) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < count; i++) {
    const ms = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - i,
    );
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export function formatDisplayLong(iso) {
  const [y, mo, da] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da));
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildHomePrerenderHtml() {
  const games = loadGames();
  const dates = recentAnswerIsoDates(8).filter((iso) => iso >= '2026-05-11');
  const li = dates
    .map(
      (iso) =>
        `      <li><a href="https://wordlechinese.com/answer/${iso}/">${formatDisplayLong(
          iso,
        )}</a></li>`,
    )
    .join('\n');

  return `<section class="home-prerender" aria-labelledby="home-prerender-heading">
    <h2 id="home-prerender-heading">Chinese Idiom Puzzle &amp; Mandarin Pinyin Variant — Free Daily Chinese Idiom Game | 成语猜词 · 每日一成语</h2>
    <p>Play the free <strong>Chinese idiom puzzle</strong> / <strong>mandarin pinyin variant</strong> / <strong>hanzi game</strong> at 成语猜词: one new four-character idiom (成语) every calendar day, six guesses, keyboard with pinyin input, and a rotating pool of <strong>${games.length.toLocaleString(
      'en-US',
    )}</strong> high-frequency idioms. 免费在线玩中文成语猜词——每日一成语，6次猜词机会，拼音键盘，7000+成语词库。</p>
    <p>Today's puzzle uses the same daily queue as the web app (since Jan&nbsp;27,&nbsp;2022&nbsp;UTC; new puzzle at 00:00&nbsp;UTC). Open the board below to play — <strong>no answer spoilers here.</strong></p>
    <p>If you are looking for a <strong>pinyin puzzle</strong> (palabra del día en chino) or <strong>character guessing game</strong> to learn and play with Chinese characters and pinyin, this daily puzzle is the perfect tool. Auch verfügbar als <strong>汉字游戏</strong> (Hanzi game).</p>
    <h3>Recent answer pages (UTC dates; meanings, examples &amp; pinyin)</h3>
    <ul class="home-prerender-links" id="home-recent-answer-links">
${li}
    </ul>
    <script>
    (function() {
      var container = document.getElementById("home-recent-answer-links");
      if (!container) return;
      var START_DATE_UTC = Date.UTC(2026, 4, 11);
      var now = new Date();
      var todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var dates = [];
      for (var i = 0; i < 8; i++) {
        var ms = todayMs - i * 86400000;
        if (ms < START_DATE_UTC) break;
        var d = new Date(ms);
        var y = d.getUTCFullYear();
        var m = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        var iso = y + '-' + m + '-' + day;
        var display = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        dates.push({ iso: iso, display: display });
      }
      if (dates.length > 0) {
        container.innerHTML = dates.map(function(item) {
          return '      <li><a href="https://wordlechinese.com/answer/' + item.iso + '/">' + item.display + '</a></li>';
        }).join('\\n');
      }
    })();
    </script>
    <p class="home-prerender-meta"><a href="https://wordlechinese.com/learn-chinese-with-idioms">How to learn Chinese with Daily Idiom Puzzle</a> · <a href="https://wordlechinese.com/study/chinese-idiom-hsk-guide">HSK study &amp; chengyu hub</a> · <a href="https://wordlechinese.com/idioms/">成语分类 Browse Idioms</a></p>
  </section>`;
}

export function buildHskStudyGuideHtml() {
  const dates = recentAnswerIsoDates(21).filter((iso) => iso >= '2026-05-11');
  const links = dates
    .map(
      (iso) =>
        `<li><a href="https://wordlechinese.com/answer/${iso}/">${formatDisplayLong(
          iso,
        )} — read answer &amp; example</a></li>`,
    )
    .join('\n');

  const webPageJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'HSK, Mandarin Pinyin Variant & Chinese idiom study hub',
    description:
      'Study hub for HSK learners using 成语猜词: mandarin pinyin style daily puzzles plus answer pages with pinyin and examples.',
    url: 'https://wordlechinese.com/study/chinese-idiom-hsk-guide',
    isPartOf: {
      '@type': 'WebSite',
      name: '成语猜词',
      url: 'https://wordlechinese.com/',
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>HSK &amp; Chinese Idiom Study Guide — Chengyu Wordle</title>
  <meta name="description" content="Study hub for HSK learners using Chengyu Wordle: daily Chinese idiom puzzles plus answer pages with pinyin and examples. Internal links to recent chengyu write-ups." />
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="https://wordlechinese.com/study/chinese-idiom-hsk-guide"/>
  <script type="application/ld+json">${webPageJson}</script>
  <style>
    body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#1a1a1a;line-height:1.65}
    header a{color:#2563eb;text-decoration:none;font-weight:600}
    h1{font-size:1.35rem}
    h2{font-size:1.1rem;margin-top:1.5rem;color:#374151}
    a{color:#2563eb}
    ul{padding-left:1.2rem}
  </style>
</head>
<body>
  <header><a href="https://wordlechinese.com/">🀄 成语猜词</a></header>
  <main>
    <h1>HSK, Mandarin Pinyin Variant &amp; Chinese idioms</h1>
    <p>Teachers and bloggers can link here as a <strong>chengyu archive</strong> tied to the same daily <strong>mandarin pinyin variant</strong> / <strong>Chinese idiom puzzle</strong> you play in the browser. 成语猜词 uses a large <strong>high-frequency (THUOCL-style)</strong> idiom pool — not yet split by official HSK hanzi lists — but every daily answer page includes <strong>pinyin, English gloss, and a usage example</strong> you can reuse in HSK-style lessons.</p>
    <h2>How to use this with HSK prep</h2>
    <ul>
      <li><strong>HSK 1–2:</strong> read answer pages for exposure; repeat aloud with pinyin from each page.</li>
      <li><strong>HSK 3–4:</strong> mine example sentences and teach collocations around each idiom.</li>
      <li><strong>HSK 5–6:</strong> assign "explain this chengyu in Chinese" using meanings from the archive.</li>
      <li><strong>All Levels:</strong> Check out the <a href="https://wordlechinese.com/idioms/">Chinese Idiom Categories</a> categorized by difficulty and theme.</li>
    </ul>
    <h2>Recent answer pages (internal links)</h2>
    <p>Dates below are <strong>UTC calendar days</strong> (same as the live puzzle rollover). Open any date for definitions suitable for lesson snippets:</p>
    <ul id="hsk-recent-answer-links">
${links}
    </ul>
    <script>
    (function() {
      var container = document.getElementById("hsk-recent-answer-links");
      if (!container) return;
      var START_DATE_UTC = Date.UTC(2026, 4, 11);
      var now = new Date();
      var todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var dates = [];
      for (var i = 0; i < 21; i++) {
        var ms = todayMs - i * 86400000;
        if (ms < START_DATE_UTC) break;
        var d = new Date(ms);
        var y = d.getUTCFullYear();
        var m = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        var iso = y + '-' + m + '-' + day;
        var display = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        dates.push({ iso: iso, display: display });
      }
      if (dates.length > 0) {
        container.innerHTML = dates.map(function(item) {
          return '<li><a href="https://wordlechinese.com/answer/' + item.iso + '/">' + item.display + ' — read answer &amp; example</a></li>';
        }).join('\\n');
      }
    })();
    </script>
    <p><a href="https://wordlechinese.com/learn-chinese-with-idioms">← Learn guide</a> · <a href="https://wordlechinese.com/">Play today's puzzle</a></p>
  </main>
</body>
</html>`;
}
