import fs from 'fs';
import path from 'path';

import { BRANDING } from './branding.mjs';

// ─── 配置与路径 ────────────────────────────────────────────────
const GAME_IDIOMS_CSV = path.join(process.cwd(), 'game-data/game-idioms.csv');
const IDIOM_CACHE_JSON = path.join(process.cwd(), 'scripts/idiom-cache.json');
const DICTIONARY_JSON = path.join(process.cwd(), 'data/idioms.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'idiom');
const SITEMAP_INDEX_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

// ─── 辅助函数 ──────────────────────────────────────────────────
// 安全重试写入文件，规避偶发的防病毒扫描器锁死
function writeFileSyncWithRetry(filePath, content, options, retries = 3, delay = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.writeFileSync(filePath, content, options);
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      const start = Date.now();
      while (Date.now() - start < delay) {
        // 同步延时等待
      }
    }
  }
}

// 拼音去声调并 Slug 化
function toSlug(pinyinStr) {
  if (!pinyinStr) return '';
  return pinyinStr
    .toLowerCase()
    .normalize('NFD') // 分解声调符号
    .replace(/[\u0300-\u036f]/g, '') // 清除声调变音符号
    .replace(/[^a-z0-9\s-]/g, '') // 去除标点
    .trim()
    .replace(/\s+/g, '-'); // 空格转为连字符
}

// 格式化展示的拼音（声调空格保留）
function formatPinyinDisplay(pinyinStr) {
  if (!pinyinStr) return '';
  return pinyinStr.trim();
}

// ─── 主流程 ────────────────────────────────────────────────────
async function main() {
  console.log('🚀 开始生成成语详情页...');

  // 1. 读取 CSV 列表 (7,210 条题库成语)
  if (!fs.existsSync(GAME_IDIOMS_CSV)) {
    console.error('❌ 找不到 game-data/game-idioms.csv');
    process.exit(1);
  }
  const csvContent = fs.readFileSync(GAME_IDIOMS_CSV, 'utf-8');
  const csvRows = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('id,idiom'));

  const gameIdioms = csvRows.map((row) => {
    const parts = row.split(',');
    return { id: parts[0], idiom: parts[1] };
  });
  console.log(`📊 加载了 ${gameIdioms.length} 条游戏成语`);

  // 2. 读取英译缓存 (scripts/idiom-cache.json)
  let idiomCache = {};
  if (fs.existsSync(IDIOM_CACHE_JSON)) {
    idiomCache = JSON.parse(fs.readFileSync(IDIOM_CACHE_JSON, 'utf-8'));
    console.log(`📖 加载了 ${Object.keys(idiomCache).length} 条英译缓存`);
  }

  // 3. 读取并索引本地大字典 (data/idioms.json, 24万条)
  if (!fs.existsSync(DICTIONARY_JSON)) {
    console.error('❌ 找不到 data/idioms.json 字典库');
    process.exit(1);
  }
  console.log('⏳ 正在加载 24 万条本地大字典，建立索引...');
  const dictArray = JSON.parse(fs.readFileSync(DICTIONARY_JSON, 'utf-8'));
  const dictMap = new Map();
  for (const item of dictArray) {
    if (item.word) {
      dictMap.set(item.word, item);
    }
  }
  console.log('✅ 大字典索引建立完成！');

  // 4. 数据融合并建立接龙映射
  const charMap = new Map();
  const pinyinMap = new Map();
  const allGameIdioms = [];

  for (const item of gameIdioms) {
    const word = item.idiom;
    const cacheData = idiomCache[word] || {};
    const dictData = dictMap.get(word) || {};
    const pinyin = formatPinyinDisplay(cacheData.pinyin || dictData.pinyin || '');
    if (!pinyin) continue;
    const slug = toSlug(pinyin);
    if (!slug) continue;

    const pinyinParts = pinyin.split(' ');
    const firstChar = word.charAt(0);
    const lastChar = word.charAt(word.length - 1);
    
    // 拼音去声调
    const firstPinyinSlug = toSlug(pinyinParts[0]);
    const lastPinyinSlug = toSlug(pinyinParts[pinyinParts.length - 1]);

    const info = { word, slug, pinyin, firstChar, lastChar, firstPinyinSlug, lastPinyinSlug };
    allGameIdioms.push({ item, info });

    if (!charMap.has(firstChar)) charMap.set(firstChar, []);
    charMap.get(firstChar).push(info);

    if (!pinyinMap.has(firstPinyinSlug)) pinyinMap.set(firstPinyinSlug, []);
    pinyinMap.get(firstPinyinSlug).push(info);
  }
  console.log(`✅ 接龙映射建立完成！参与接龙成语数: ${allGameIdioms.length}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const generatedUrls = [];

  let count = 0;
  for (const { item, info } of allGameIdioms) {
    const word = info.word;
    const slug = info.slug;
    const pinyin = info.pinyin;
    const gameId = item.id;

    // 融合匹配数据
    const cacheData = idiomCache[word] || {};
    const dictData = dictMap.get(word) || {};

    const explanation = dictData.explanation || '';
    const meaning = cacheData.meaning || '';
    const derivation = dictData.derivation || '';
    const example = cacheData.example || dictData.example || '';
    const difficulty = cacheData.difficulty || 'medium';

    // 查找接龙成语
    let nextIdiom = null;
    const lastChar = info.lastChar;
    const lastPinyinSlug = info.lastPinyinSlug;

    // 1) 同汉字接龙
    const charMatches = charMap.get(lastChar) || [];
    const charCandidates = charMatches.filter(x => x.word !== word);
    if (charCandidates.length > 0) {
      nextIdiom = charCandidates[0];
    } else {
      // 2) 同拼音接龙
      const pinyinMatches = pinyinMap.get(lastPinyinSlug) || [];
      const pinyinCandidates = pinyinMatches.filter(x => x.word !== word);
      if (pinyinCandidates.length > 0) {
        nextIdiom = pinyinCandidates[0];
      }
    }

    // 生成页面 HTML
    const html = buildIdiomHtml(word, pinyin, slug, gameId, explanation, meaning, derivation, example, difficulty, nextIdiom);
    const idiomDir = path.join(OUTPUT_DIR, slug);
    fs.mkdirSync(idiomDir, { recursive: true });
    writeFileSyncWithRetry(path.join(idiomDir, 'index.html'), html, 'utf-8', 10, 100);

    generatedUrls.push(`${BRANDING.siteUrl}/idiom/${slug}`);
    count++;
    if (count % 1000 === 0) {
      console.log(`✨ 已生成 ${count} 个成语单页...`);
    }
  }
  console.log(`🎉 成功生成 ${count} 个物理成语详情页！`);

  // 5. 写入分卷 Sitemap
  const itemsPerSitemap = 5000;
  const sitemapFiles = [];
  const lastmod = new Date().toISOString().split('T')[0];

  for (let i = 0; i < generatedUrls.length; i += itemsPerSitemap) {
    const chunk = generatedUrls.slice(i, i + itemsPerSitemap);
    const sitemapNum = Math.floor(i / itemsPerSitemap) + 1;
    const sitemapFilename = `sitemap-idioms-${sitemapNum}.xml`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map((url) => `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`).join('\n')}
</urlset>`;

    fs.writeFileSync(path.join(PUBLIC_DIR, sitemapFilename), xml, 'utf-8');
    sitemapFiles.push(sitemapFilename);
    console.log(`📄 生成分卷地图: ${sitemapFilename} (${chunk.length} URLs)`);
  }

  // 6. 更新主 sitemap.xml 索引
  updateSitemapIndex(sitemapFiles);
}

// ─── HTML 页面构建模板 ─────────────────────────────────────────
function buildIdiomHtml(word, pinyin, slug, gameId, explanation, meaning, derivation, example, difficulty, nextIdiom) {
  const chars = word.split('');
  const pinyinParts = pinyin.split(' ');

  // 渲染每个汉字的拼音+大字组合卡片
  const charCardsHtml = chars.map((char, idx) => {
    const py = pinyinParts[idx] || '';
    return `
      <div class="char-card">
        <div class="char-pinyin">${py}</div>
        <div class="char-hanzi">${char}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LDHD1VQKGD"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-LDHD1VQKGD');
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Idiom ${word} (${pinyin}) Meaning, Pinyin &amp; Examples | ${BRANDING.primaryName}</title>
  <meta name="description" content="Study the ${BRANDING.primaryName} idiom ${word} (${pinyin}): English meaning, pinyin spelling, derivation origin, and sentence examples. Play daily at ${BRANDING.primaryName}."/>
  <link rel="canonical" href="${BRANDING.siteUrl}/idiom/${slug}"/>
  <meta property="og:title" content="Idiom ${word} (${pinyin}) Meaning &amp; Pinyin | ${BRANDING.primaryName}"/>
  <meta property="og:description" content="Study the ${BRANDING.primaryName} idiom ${word} (${pinyin}): English meaning, pinyin spelling, derivation origin, and sentence examples."/>
  <meta property="og:url" content="${BRANDING.siteUrl}/idiom/${slug}"/>
  <meta property="og:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
  <meta property="og:type" content="article"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Idiom ${word} (${pinyin}) Meaning &amp; Pinyin | ${BRANDING.primaryName}"/>
  <meta name="twitter:description" content="Study the ${BRANDING.primaryName} idiom ${word} (${pinyin}): English meaning, pinyin spelling, derivation origin, and sentence examples."/>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${BRANDING.primaryName} Idiom ${word} (${pinyin}) Meaning &amp; Examples",
    "description": "Chinese definitions, English translation, pinyin, derivation and sentence examples of idiom ${word}.",
    "publisher": {
      "@type": "Organization",
      "name": "${BRANDING.zhName}",
      "url": "${BRANDING.siteUrl}"
    }
  }
  </script>
  <style>
    :root {
      --primary-color: #2b5c8f;
      --accent-color: #e5a93c;
      --text-color: #1a1a1a;
      --light-text: #6b7280;
      --bg-color: #fcfbfa;
      --card-bg: #ffffff;
      --border-color: #e5e7eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --text-color: #e5e7eb;
        --light-text: #9ca3af;
        --bg-color: #121213;
        --card-bg: #1e1e1f;
        --border-color: #374151;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.65;
      padding: 20px;
      max-width: 700px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    header a {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 700;
      font-size: 20px;
    }
    .breadcrumb {
      font-size: 13px;
      color: var(--light-text);
      margin-bottom: 20px;
    }
    .breadcrumb a {
      color: var(--primary-color);
      text-decoration: none;
    }
    .grid-word {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 24px 0;
    }
    .char-card {
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      width: 80px;
      height: 90px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
    }
    .char-pinyin {
      font-size: 13px;
      color: var(--accent-color);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .char-hanzi {
      font-size: 32px;
      font-weight: 700;
    }
    h1 {
      font-size: 24px;
      text-align: center;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      background-color: var(--primary-color);
      text-transform: uppercase;
      margin: 0 auto 16px;
    }
    .difficulty-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .play-btn {
      display: block;
      text-align: center;
      background: var(--primary-color);
      color: white;
      text-decoration: none;
      padding: 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 18px;
      margin: 24px 0;
      box-shadow: 0 4px 12px rgba(43, 92, 143, 0.2);
    }
    .play-btn:hover {
      background: #20456b;
    }
    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .section-card h2 {
      font-size: 16px;
      color: var(--accent-color);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .section-card p {
      font-size: 15px;
      color: var(--text-color);
    }
    footer {
      text-align: center;
      margin-top: 40px;
      color: var(--light-text);
      font-size: 13px;
      border-top: 2px solid var(--border-color);
      padding-top: 16px;
    }
    footer a {
      color: var(--light-text);
    }
    .pronounce-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 24px;
      vertical-align: middle;
      margin-left: 8px;
      padding: 4px;
      border-radius: 50%;
      transition: background 0.2s, transform 0.1s;
    }
    .pronounce-btn:hover {
      background-color: var(--border-color);
    }
    .pronounce-btn:active {
      transform: scale(0.9);
    }
  </style>
</head>
<body>
  <header>
    <a href="${BRANDING.siteUrl}">🀄 ${BRANDING.primaryName}</a>
    <div style="margin-top:8px;">
      <a href="${BRANDING.siteUrl}/generator/" style="font-size:14px;font-weight:700;margin-left:8px;color:var(--primary-color);text-decoration:underline;">🎲 Random Generator</a>
      <a href="${BRANDING.siteUrl}/idioms/" style="font-size:14px;font-weight:700;margin-left:12px;color:var(--primary-color);text-decoration:underline;">📚 Collections</a>
    </div>
  </header>

  <div class="breadcrumb">
    <a href="${BRANDING.siteUrl}">Home</a> &gt; 
    <a href="${BRANDING.siteUrl}/idioms/">Browse Idioms</a> &gt; 
    <span>${word}</span>
  </div>

  <h1>${word} (${pinyin})<button class="pronounce-btn" onclick="speak('${word}')" title="Listen to pronunciation">🔊</button></h1>
  <div class="difficulty-container">
    <span class="badge">${difficulty}</span>
  </div>

  <div class="grid-word">
    ${charCardsHtml}
  </div>

  <a class="play-btn" href="${BRANDING.siteUrl}/#${gameId}">▶ Play this Idiom Challenge (在游戏中猜这道题)</a>

  ${meaning ? `
  <div class="section-card">
    <h2>English Meaning (英文释义)</h2>
    <p>${meaning}</p>
  </div>` : ''}

  ${explanation ? `
  <div class="section-card">
    <h2>Definition (中文解释)</h2>
    <p>${explanation}</p>
  </div>` : ''}

  ${derivation ? `
  <div class="section-card">
    <h2>Derivation (典故出处)</h2>
    <p>${derivation}</p>
  </div>` : ''}

  ${example ? `
  <div class="section-card">
    <h2>Example (造句示例)</h2>
    <p>${example}</p>
  </div>` : ''}

  ${nextIdiom ? `
  <div class="section-card connection-card" style="background:#fffcf0;border:1px solid #fce8b2">
    <h2 style="color:#b78103">🔗 Idiom Solitaire (成语接龙)</h2>
    <p style="margin-top:8px">Learn the next connected idiom: 
      <strong>${word}</strong> (${pinyin}) 
      → 
      <a href="/idiom/${nextIdiom.slug}" style="color:var(--primary-color);font-weight:700;text-decoration:underline">${nextIdiom.word}</a> 
      (${nextIdiom.pinyin})
    </p>
  </div>` : ''}

  <p style="text-align:center;margin-top:24px;font-size:14px;color:var(--light-text)">
    Want to explore more random idioms? Try our 🎲 <a href="/generator/" style="color:var(--primary-color);font-weight:700;text-decoration:underline">Chinese Idiom Generator</a>
  </p>

  <footer>
    <p>© ${new Date().getFullYear()} <a href="${BRANDING.siteUrl}">${BRANDING.primaryName}</a> · 
    <a href="/privacy">Privacy Policy</a></p>
  </footer>
  
  <script>
    function speak(text) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Text-to-speech not supported in this browser.');
      }
    }
  </script>
</body>
</html>`;
}

// ─── 更新 Sitemap 索引文件 ──────────────────────────────────────
function updateSitemapIndex(newSitemaps) {
  if (!fs.existsSync(SITEMAP_INDEX_FILE)) {
    console.error('❌ 找不到 sitemap.xml 主索引');
    return;
  }
  let sitemapIndexContent = fs.readFileSync(SITEMAP_INDEX_FILE, 'utf-8');

  // 构建新的 sitemap index 项
  const lastmod = new Date().toISOString().split('T')[0];
  const newEntries = newSitemaps.map((sitemap) => 
    `  <sitemap><loc>${BRANDING.siteUrl}/${sitemap}</loc><lastmod>${lastmod}</lastmod></sitemap>`
  ).join('\n');

  // 在 </sitemapindex> 前插入新 entries
  if (sitemapIndexContent.includes('</sitemapindex>')) {
    const domainCleanRegex = new RegExp(`  <sitemap><loc>https://(wordlechinese\\.com|easyidiom\\.com)/sitemap-idioms-\\d+\\.xml</loc>.*</sitemap>\\n?`, 'g');
    sitemapIndexContent = sitemapIndexContent.replace(domainCleanRegex, '');
    
    sitemapIndexContent = sitemapIndexContent.replace(
      '</sitemapindex>',
      `${newEntries}\n</sitemapindex>`
    );
    fs.writeFileSync(SITEMAP_INDEX_FILE, sitemapIndexContent, 'utf-8');
    console.log('✅ 主 sitemap.xml 索引文件更新成功！');
  }
}

// 执行
main().catch((err) => {
  console.error('❌ 执行失败: ', err);
  process.exit(1);
});
