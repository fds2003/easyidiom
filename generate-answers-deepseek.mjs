/**
 * generate-answers-deepseek.mjs
 * 修复说明：
 *   1. 统一所有日期运算使用 UTC，消除时区歧义
 *   2. 限制生成范围：今天 + MAX_FUTURE_DAYS，不再无限预生成未来
 *   3. htmlOnlyMode 日期解析与主流程保持一致
 *   4. sitemap 只写入已生成的有效日期范围
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const START_DATE_STR = '2026-05-11';

// ✅ 修复1：统一用 UTC 时间戳做日期运算基点
const START_DATE_UTC = Date.UTC(2026, 4, 11); // 月份从 0 起，4 = May

// ✅ 修复2：限制最多预生成未来 N 天，防止生成过远的日期页面
const MAX_FUTURE_DAYS = 90; // 可调整

const OUTPUT_DIR = 'public/answer';
const CACHE_FILE = 'scripts/idiom-cache.json';

// ─── 工具函数 ──────────────────────────────────────────────────

/**
 * ✅ 修复3：所有日期格式化统一走这个函数，避免 toISOString() 时区问题
 * 输入：UTC 时间戳（ms）
 * 输出：'YYYY-MM-DD' 字符串
 */
function utcMsToDateStr(utcMs) {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * ✅ 修复4：解析 'YYYY-MM-DD' 字符串为 UTC 时间戳，不受本地时区影响
 */
function dateStrToUtcMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * 获取今天 UTC 日期的时间戳（精确到天，去掉时分秒）
 */
function getTodayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// ─── 1. 读取词库 ───────────────────────────────────────────────
function loadIdioms() {
  const csv = fs.readFileSync('game-data/game-idioms.csv', 'utf-8');
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return data.map(row => ({ id: row.id, idiom: row.idiom })).filter(r => r.idiom);
}

// ─── 2. 调用 DeepSeek API ──────────────────────────────────────
async function fetchIdiomInfo(idiom) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a Chinese language expert. Always respond in valid JSON format only.' },
        {
          role: 'user',
          content: `For the Chinese idiom "${idiom}", return a JSON object with these exact keys:
{
  "pinyin": "pinyin with tone marks for each character separated by spaces",
  "meaning": "concise English meaning in 1-2 sentences",
  "literal": "literal translation of each character",
  "example": "one short example sentence in English showing how this concept applies",
  "hint1": "a subtle hint that doesn't give away the answer (mention the theme or feeling)",
  "hint2": "a slightly more obvious hint (mention one character's meaning without naming it)",
  "difficulty": "easy or medium or hard"
}`
        }
      ]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

// ─── 3. 生成单个 HTML 页面（无改动）────────────────────────────
function generateHTML(dateStr, idiom, info, prevStr, nextStr) {
  // ✅ 修复5：用 UTC 解析日期，确保 displayDate 正确
  const utcMs = dateStrToUtcMs(dateStr);
  const d = new Date(utcMs);
  const displayDate = d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  });
  const difficulty = info.difficulty || 'medium'; // fallback for bad API data
  const h1Text = `成语猜词 Answer ${displayDate} — ${idiom} (${info.pinyin})`;
  const seoTitle = `成语猜词 Answer ${displayDate} — ${idiom} (${info.pinyin}) | 每日成语答案`;
  const pageUrl = `https://wordlechinese.com/answer/${dateStr}/`;
  const articleDescription = `Need hints or the answer for today's Chinese idiom puzzle on ${displayDate}? Get the daily puzzle hints, character pinyin clues, English translation &amp; final idiom answer here. Play today's puzzle at wordlechinese.com! 每日成语猜词答案与详解。`;

  const chars = idiom.split('');
  const pinyins = info.pinyin.split(' ');

  const articleJSON = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: seoTitle,
    description: articleDescription,
    datePublished: `${dateStr}T00:00:00.000Z`,
    dateModified: `${dateStr}T00:00:00.000Z`,
    url: pageUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${pageUrl}` },
    publisher: { '@type': 'Organization', name: '成语猜词', url: 'https://wordlechinese.com' }
  });

  const faqJSON = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is 成语猜词 (Chinese Idiom Puzzle)?',
        acceptedAnswer: { '@type': 'Answer', text: '成语猜词 (Chinese Idiom Puzzle) is a free daily word puzzle game where you guess a hidden Chinese idiom (成语) in 6 tries.' }
      },
      {
        '@type': 'Question',
        name: `What is today's 成语猜词 answer for ${dateStr}?`,
        acceptedAnswer: { '@type': 'Answer', text: `Today's 成语猜词 answer is ${idiom} (${info.pinyin}), which means ${info.meaning}` }
      },
      {
        '@type': 'Question',
        name: `成语猜词 hint 1 for ${dateStr}`,
        acceptedAnswer: { '@type': 'Answer', text: info.hint1 }
      },
      {
        '@type': 'Question',
        name: `成语猜词 hint 2 for ${dateStr}`,
        acceptedAnswer: { '@type': 'Answer', text: info.hint2 }
      }
    ]
  });

  const breadcrumbJSON = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '成语猜词', item: 'https://wordlechinese.com/' },
      { '@type': 'ListItem', position: 2, name: `Answer for ${dateStr}`, item: `https://wordlechinese.com/answer/${dateStr}/` }
    ]
  });

  const isFirst = !prevStr;
  const isLast = !nextStr;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${seoTitle}</title>
<meta name="description" content="${articleDescription}"/>
<meta name="robots" content="index, follow"/>
<meta property="og:url" content="${pageUrl}"/>
<link rel="canonical" href="${pageUrl}"/>
<link rel="alternate" hreflang="en" href="https://wordlechinese.com/answer/${dateStr}/"/>
<link rel="alternate" hreflang="x-default" href="https://wordlechinese.com/answer/${dateStr}/"/>
<meta property="og:title" content="${seoTitle}"/>
<meta property="og:description" content="${articleDescription}"/>
<meta property="og:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${seoTitle}"/>
<meta name="twitter:description" content="${articleDescription}"/>
<meta name="twitter:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
<script type="application/ld+json">${articleJSON}</script>
<script type="application/ld+json">${faqJSON}</script>
<script type="application/ld+json">${breadcrumbJSON}</script>
<style>
body{font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#1a1a1a}
header{text-align:center;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:24px}
header a{color:#2563eb;text-decoration:none;font-weight:600}
.spoiler{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:14px}
.chars{display:flex;gap:12px;justify-content:center;margin:24px 0}
.char-box{text-align:center;border:2px solid #2563eb;border-radius:8px;padding:12px 16px;background:#2563eb;color:white}
.char-box .hanzi{font-size:36px;font-weight:bold;line-height:1}
.char-box .pinyin{font-size:14px;margin-top:6px;opacity:.9}
.section{background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:16px}
.section h2{margin:0 0 10px;font-size:16px;color:#374151;text-transform:uppercase;letter-spacing:.05em}
.section p{margin:0;line-height:1.6}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600}
.easy{background:#dbeafe;color:#1e40af}.medium{background:#fef3c7;color:#854d0e}.hard{background:#f3f4f6;color:#374151}
details{background:white;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:8px}
summary{font-weight:600;color:#6b7280;cursor:pointer;list-style:none}
summary::before{content:"🔍 "}
.nav{display:flex;justify-content:space-between;margin-top:32px;padding-top:16px;border-top:2px solid #eee}
.nav a{color:#2563eb;text-decoration:none;font-size:14px}
.play-btn{display:block;text-align:center;background:#2563eb;color:white;text-decoration:none;padding:14px;border-radius:8px;font-weight:700;font-size:18px;margin:24px 0}
.play-btn:hover{background:#1d4ed8}
</style>
</head>
<body>
<header>
<a href="https://wordlechinese.com">🀄 成语猜词</a>
<p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Daily Chinese Idiom Puzzle Game</p>
</header>
<h1 style="text-align:center;font-size:22px;">${h1Text}</h1>
<div class="spoiler">⚠️ <strong>Spoiler Warning!</strong> Today's answer is revealed below. Try playing first → <a href="https://wordlechinese.com/?date=${dateStr}">Play This Day's Game</a></div>
<div class="chars">
${chars.map((c, i) => `<div class="char-box"><div class="hanzi">${c}</div><div class="pinyin">${pinyins[i] || ''}</div></div>`).join('')}
</div>
<a class="play-btn" href="https://wordlechinese.com/?date=${dateStr}">▶ Play This Day's Game (${dateStr})</a>
<div class="section">
<h2>📖 Meaning <span class="badge ${difficulty}">${difficulty}</span></h2>
<p><strong>${idiom}</strong> (${info.pinyin})</p>
<p style="margin-top:8px">${info.meaning}</p>
<p style="margin-top:8px;color:#6b7280;font-size:14px"><em>Literal: ${info.literal}</em></p>
</div>
<div class="section"><h2>💡 Example</h2><p>${info.example}</p></div>
<div style="margin-bottom:16px">
<h2 style="font-size:16px;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">🎯 Hints (for next time)</h2>
<details><summary>Hint 1 — Subtle</summary><p style="margin-top:8px">${info.hint1}</p></details>
<details><summary>Hint 2 — More Obvious</summary><p style="margin-top:8px">${info.hint2}</p></details>
</div>
<div class="section" style="background:#fff;border:1px solid #e5e7eb">
<h2>📚 Learn Chinese with This Idiom</h2>
<p>The idiom <strong>${idiom}</strong> (${info.pinyin}) is a widely-used Chinese expression meaning <em>${info.meaning}</em>. Literally, each character means: ${info.literal}.</p>
<p style="margin-top:12px">Learning Chinese idioms (成语, chéngyǔ) is one of the most effective ways to improve your Chinese. Each four-character idiom packs centuries of culture and wisdom into a compact phrase.</p>
<ul style="line-height:1.8;margin-top:12px">
<li><strong>Example usage:</strong> ${info.example}</li>
<li><strong>Practice tip:</strong> Try using <strong>${idiom}</strong> in a sentence about your own life.</li>
<li><strong>Spaced repetition:</strong> Come back tomorrow and see if you still remember it without looking.</li>
</ul>
<p style="margin-top:16px;padding:12px;background:#f0f9ff;border-radius:6px;font-size:14px">
📖 <a href="/learn-chinese-with-wordle" style="color:#2563eb;font-weight:600">Read our full guide: How to Learn Chinese with Daily Idiom Puzzle →</a></p>
</div>
<div class="section" style="border-top:2px solid #e5e7eb;padding-top:16px;margin-top:16px">
<h2 style="font-size:16px;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">🔗 Related</h2>
<p style="font-size:14px;line-height:2">
<a href="/idioms/${difficulty}/" style="color:#2563eb;font-weight:600">More ${difficulty} idioms →</a><br/>
<a href="/idioms/" style="color:#2563eb">Browse all Chinese idiom categories (成语分类)</a><br/>
<a href="/study/chinese-wordle-hsk-guide" style="color:#2563eb">HSK &amp; Mandarin word variant study guide</a><br/>
<a href="/learn-chinese-with-wordle" style="color:#2563eb">How to Learn Chinese with Daily Idiom Puzzle (如何学中文)</a><br/>
<a href="/" style="color:#2563eb">Play today's idiom puzzle (今日成语猜词)</a>
</p>
</div>
<div class="nav">
${isFirst ? `<a href="https://wordlechinese.com">🏠 Home</a>` : `<a href="/answer/${prevStr}/">← ${prevStr}</a>`}
<a href="https://wordlechinese.com">🏠 Today's Game</a>
${isLast ? `<a href="https://wordlechinese.com">🏠 Home</a>` : `<a href="/answer/${nextStr}/">${nextStr} →</a>`}
</div>
<footer style="text-align:center;margin-top:40px;color:#9ca3af;font-size:13px">
<p>© ${new Date().getUTCFullYear()} <a href="https://wordlechinese.com" style="color:#6b7280">成语猜词</a> · <a href="/privacy" style="color:#6b7280">Privacy Policy</a></p>
</footer>
</body>
</html>`;
}

// ─── 4. 生成 sitemap（只包含实际存在的日期）──────────────────
function generateSitemaps(generatedDates) {
  const todayUtcMs = getTodayUtcMs();
  const todayStr = utcMsToDateStr(todayUtcMs);

  // 过滤出今天及以前的日期，防止未来预生成的页面被提前抓取导致零点击曝光
  const activeDates = generatedDates.filter(ds => ds <= todayStr);
  const lastmod = todayStr;

  // answer-sitemap.xml：只写已发布（今天及以前）的日期
  const entries = activeDates.map(ds =>
    `  <url><loc>https://wordlechinese.com/answer/${ds}/</loc><lastmod>${ds}</lastmod><changefreq>never</changefreq><priority>0.6</priority></url>`
  ).join('\n');

  fs.writeFileSync('public/answer-sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`
  );
  const lastDate = activeDates.length ? activeDates[activeDates.length - 1] : '(none)';
  console.log(`📄 answer-sitemap.xml (${activeDates.length} URLs, up to ${lastDate})`);

  fs.writeFileSync('public/sitemap-home.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://wordlechinese.com/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://wordlechinese.com/learn-chinese-with-wordle</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://wordlechinese.com/study/chinese-wordle-hsk-guide</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.65</priority></url>
  <url><loc>https://wordlechinese.com/privacy</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>`
  );

  fs.writeFileSync('public/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://wordlechinese.com/sitemap-home.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
  <sitemap><loc>https://wordlechinese.com/answer-sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
  <sitemap><loc>https://wordlechinese.com/category-sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
</sitemapindex>`
  );
  console.log(`📄 sitemap.xml + sitemap-home.xml`);
}

// ─── 5. html-only 模式（修复时区 Bug）────────────────────────
function htmlOnlyMode() {
  const idioms = loadIdioms();
  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ 缓存文件不存在: ' + CACHE_FILE);
    process.exit(1);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error('❌ 目录不存在: ' + OUTPUT_DIR);
    process.exit(1);
  }

  const todayMs = getTodayUtcMs();
  const maxMs = todayMs + MAX_FUTURE_DAYS * 86400000;

  // ✅ 修复6：扫描已有目录时，用 UTC 解析，统一基准
  const dirs = fs.readdirSync(OUTPUT_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  const validDirs = dirs.filter(d => {
    const ms = dateStrToUtcMs(d);
    return ms >= START_DATE_UTC && ms <= maxMs; // ✅ 同时过滤未来超出范围的目录
  });

  console.log(`📁 扫描到 ${dirs.length} 个目录，有效（含未来${MAX_FUTURE_DAYS}天内）: ${validDirs.length} 个`);
  if (dirs.length > validDirs.length) {
    const invalid = dirs.filter(d => !validDirs.includes(d));
    console.warn(`⚠️  以下目录超出范围，将跳过生成（建议手动删除）:\n  ${invalid.join('\n  ')}`);
  }

  let count = 0;
  for (let vi = 0; vi < validDirs.length; vi++) {
    const dateStr = validDirs[vi];
    const dateMs = dateStrToUtcMs(dateStr);

    // ✅ 修复7：dayIndex 完全基于 UTC ms 差值
    const dayIndex = Math.round((dateMs - START_DATE_UTC) / 86400000);
    if (dayIndex < 0) continue;

    let { idiom } = idioms[dayIndex % idioms.length];
    let info = cache[idiom];

    if (!info) {
      const outPath = path.join(OUTPUT_DIR, dateStr, 'index.html');
      if (fs.existsSync(outPath)) {
        const oldHtml = fs.readFileSync(outPath, 'utf-8');
        const m = oldHtml.match(/<strong>([一-鿿]{4})<\/strong>/);
        if (m && cache[m[1]]) { idiom = m[1]; info = cache[idiom]; }
      }
    }

    if (!info) { console.warn(`⚠️  ${dateStr} → ${idiom} 缓存未命中，跳过`); continue; }

    const prevStr = vi > 0 ? validDirs[vi - 1] : null;
    const nextStr = vi < validDirs.length - 1 ? validDirs[vi + 1] : null;

    const html = generateHTML(dateStr, idiom, info, prevStr, nextStr);
    fs.writeFileSync(path.join(OUTPUT_DIR, dateStr, 'index.html'), html, 'utf-8');
    count++;
  }

  console.log(`✅ 重新生成 ${count} 个 HTML 文件`);
  generateSitemaps(validDirs);
}

// ─── 6. 主流程 ────────────────────────────────────────────────
async function main() {
  const htmlOnly = process.argv.includes('--html-only');
  if (htmlOnly) { htmlOnlyMode(); return; }

  if (!API_KEY) { console.error('❌ 请设置 DEEPSEEK_API_KEY'); process.exit(1); }

  const idioms = loadIdioms();
  console.log(`📚 词库: ${idioms.length} 条成语`);

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`💾 缓存: ${Object.keys(cache).length} 条`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync('scripts', { recursive: true });

  // ✅ 修复8：动态计算结束日期 = 今天 + MAX_FUTURE_DAYS，不再硬编码固定天数
  const todayMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const endMs = todayMs + MAX_FUTURE_DAYS * 86400000;
  const DAYS = Math.round((endMs - START_DATE_UTC) / 86400000) + 1;

  console.log(`📅 生成范围: ${START_DATE_STR} → ${utcMsToDateStr(endMs)}（共 ${DAYS} 天）`);

  let generated = 0, skipped = 0, errors = 0;
  const generatedDates = [];

  for (let i = 0; i < DAYS; i++) {
    const dateMs = START_DATE_UTC + i * 86400000;
    const dateStr = utcMsToDateStr(dateMs); // ✅ 全程 UTC，无时区漂移
    const { idiom } = idioms[i % idioms.length];
    const outPath = path.join(OUTPUT_DIR, dateStr, 'index.html');

    generatedDates.push(dateStr);

    if (fs.existsSync(outPath)) { skipped++; continue; }

    let info = cache[idiom];
    if (!info) {
      try {
        console.log(`🔄 [${i + 1}/${DAYS}] ${dateStr} → ${idiom}`);
        info = await fetchIdiomInfo(idiom);
        cache[idiom] = info;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`❌ ${idiom}: ${e.message}`);
        errors++;
        generatedDates.pop(); // 失败的不加入 sitemap
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    } else {
      console.log(`✅ [${i + 1}/${DAYS}] ${dateStr} → ${idiom}（缓存）`);
    }

    const prevStr = i > 0 ? utcMsToDateStr(START_DATE_UTC + (i - 1) * 86400000) : null;
    const nextStr = i < DAYS - 1 ? utcMsToDateStr(START_DATE_UTC + (i + 1) * 86400000) : null;

    const html = generateHTML(dateStr, idiom, info, prevStr, nextStr);
    fs.mkdirSync(path.join(OUTPUT_DIR, dateStr), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf-8');
    generated++;
  }

  generateSitemaps(generatedDates);
  console.log(`\n🎉 完成！新生成 ${generated}，跳过 ${skipped}，失败 ${errors}`);
}

// Export for testing
export { generateHTML };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(console.error);
}