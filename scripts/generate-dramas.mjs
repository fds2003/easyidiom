import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BRANDING } from './branding.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const DRAMA_LISTS_JSON = path.join(DATA_DIR, 'drama-lists.json');
const DICTIONARY_JSON = path.join(DATA_DIR, 'idioms.json');
const IDIOM_CACHE_JSON = path.join(SCRIPTS_DIR, 'idiom-cache.json');
const SITEMAP_INDEX_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

// 拼音 Slug 化
function toSlug(pinyinStr) {
  if (!pinyinStr) return '';
  return pinyinStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// 文件安全写入自愈机制
function writeFileSyncWithRetry(filePath, content, options, retries = 5, delay = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.writeFileSync(filePath, content, options);
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      const start = Date.now();
      while (Date.now() - start < delay) {
        // 同步等待
      }
    }
  }
}

async function main() {
  console.log('🚀 开始生成 Dramas 影视与游戏热点截流页面...');

  // 1. 加载配置文件
  if (!fs.existsSync(DRAMA_LISTS_JSON)) {
    console.error('❌ 找不到 data/drama-lists.json 配置文件');
    process.exit(1);
  }
  const dramaLists = JSON.parse(fs.readFileSync(DRAMA_LISTS_JSON, 'utf-8'));

  // 2. 加载大字典
  if (!fs.existsSync(DICTIONARY_JSON)) {
    console.error('❌ 找不到 data/idioms.json');
    process.exit(1);
  }
  const dictArray = JSON.parse(fs.readFileSync(DICTIONARY_JSON, 'utf-8'));
  const dictMap = new Map();
  for (const item of dictArray) {
    if (item.word) dictMap.set(item.word, item);
  }

  // 3. 加载英译缓存
  let idiomCache = {};
  if (fs.existsSync(IDIOM_CACHE_JSON)) {
    idiomCache = JSON.parse(fs.readFileSync(IDIOM_CACHE_JSON, 'utf-8'));
  }

  // 4. 加载题库 csv 用于游戏跳转
  const gameIdiomMap = new Map();
  const csvPath = path.join(DATA_DIR, 'idioms.csv');
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = csvContent.split('\n').filter(r => r.trim());
    for (const row of rows) {
      const parts = row.split(',');
      if (parts.length >= 2) {
        gameIdiomMap.set(parts[1].trim(), parts[0].trim());
      }
    }
  }

  const generatedUrls = [];

  // 5. 循环生成剧集专题页面
  for (const drama of dramaLists) {
    const { slug, title, description, intro, quotes, characters } = drama;
    const dramaDir = path.join(PUBLIC_DIR, 'dramas', slug);
    fs.mkdirSync(dramaDir, { recursive: true });

    // 编译台词发音 HTML
    let quotesHtml = '';
    for (const q of quotes) {
      quotesHtml += `
      <div class="quote-row">
        <div class="quote-text-container">
          <div class="quote-chinese">${q.chinese} <button class="play-audio-btn" onclick="speak('${q.chinese}')" title="Listen to pronunciation">🔊 Listen</button></div>
          <div class="quote-pinyin">${q.pinyin}</div>
          <div class="quote-english">"${q.english}"</div>
        </div>
      </div>
      `;
    }

    // 编译人物性格卡片 HTML
    let charsHtml = '';
    for (const c of characters) {
      const dictData = dictMap.get(c.idiom) || {};
      const cacheData = idiomCache[c.idiom] || {};
      const pinyin = cacheData.pinyin || dictData.pinyin || '';
      const itemSlug = toSlug(pinyin) || c.idiomSlug;
      const gameId = gameIdiomMap.get(c.idiom) || '1';

      charsHtml += `
      <div class="char-card">
        <div class="char-meta">
          <div class="char-name">${c.name}</div>
          <div class="char-rel">${c.relationship}</div>
        </div>
        <div class="char-idiom-box">
          Mapped Idiom: 
          <a class="idiom-link" href="/idiom/${itemSlug}" title="Learn about ${c.idiom}">
            ${c.idiom} (${pinyin})
          </a>
        </div>
        <div class="char-desc">
          <strong>Character Analysis:</strong> ${c.desc}
        </div>
        <div style="margin-top:12px;">
          <a class="action-mini-btn" href="${BRANDING.siteUrl}/#${gameId}">▶ Challenge in Game</a>
        </div>
      </div>
      `;
    }

    const htmlContent = `<!DOCTYPE html>
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
  <title>${title} | ${BRANDING.primaryName}</title>
  <meta name="description" content="${description}"/>
  <link rel="canonical" href="${BRANDING.siteUrl}/dramas/${slug}/"/>
  
  <meta property="og:title" content="${title} | ${BRANDING.primaryName}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:url" content="${BRANDING.siteUrl}/dramas/${slug}/"/>
  <meta property="og:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: #2563eb;
      --bg-color: #f9fafb;
      --card-bg: #ffffff;
      --text-color: #1f2937;
      --light-text: #6b7280;
      --border-color: #e5e7eb;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    body {
      font-family: 'Nunito', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    header {
      background-color: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
      text-align: center;
    }
    header a {
      color: var(--primary-color);
      text-decoration: none;
      font-size: 24px;
      font-weight: 900;
    }
    .header-links {
      margin-top: 8px;
    }
    .header-links a {
      font-size: 16px;
      font-weight: 700;
      margin-left: 12px;
      color: var(--primary-color);
      text-decoration: underline;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .breadcrumb {
      font-size: 14px;
      color: var(--light-text);
      margin-bottom: 24px;
    }
    .breadcrumb a {
      color: var(--primary-color);
      text-decoration: none;
    }
    h1 {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 16px;
    }
    .intro-text {
      font-size: 17px;
      color: var(--light-text);
      margin-bottom: 40px;
      background: #eff6ff;
      padding: 20px;
      border-left: 4px solid var(--primary-color);
      border-radius: 6px;
    }
    h2 {
      font-size: 24px;
      font-weight: 900;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 8px;
      margin-top: 40px;
      margin-bottom: 24px;
    }
    .quote-row {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .quote-chinese {
      font-size: 22px;
      font-weight: 900;
      color: var(--text-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .play-audio-btn {
      background-color: #f3f4f6;
      border: 1px solid var(--border-color);
      color: var(--text-color);
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .play-audio-btn:hover {
      background-color: #e5e7eb;
    }
    .quote-pinyin {
      font-size: 16px;
      color: var(--primary-color);
      font-weight: 700;
      margin: 6px 0;
    }
    .quote-english {
      font-size: 15px;
      color: var(--light-text);
      font-style: italic;
    }
    .char-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .char-name {
      font-size: 18px;
      font-weight: 900;
    }
    .char-rel {
      font-size: 14px;
      color: var(--light-text);
      margin-bottom: 12px;
    }
    .char-idiom-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .idiom-link {
      color: #b45309;
      text-decoration: underline;
    }
    .char-desc {
      font-size: 15px;
      color: var(--text-color);
    }
    .action-mini-btn {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      background-color: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      transition: background 0.2s;
    }
    .action-mini-btn:hover {
      background-color: #d1fae5;
    }
    .play-btn-large {
      display: block;
      text-align: center;
      background: var(--primary-color);
      color: white;
      text-decoration: none;
      padding: 16px;
      border-radius: 10px;
      font-weight: 900;
      font-size: 18px;
      margin-top: 40px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
      transition: background 0.2s;
    }
    .play-btn-large:hover {
      background: #1d4ed8;
    }
    footer {
      text-align: center;
      padding: 40px 20px;
      margin-top: 80px;
      border-top: 1px solid var(--border-color);
      color: var(--light-text);
      font-size: 14px;
    }
    footer a {
      color: var(--light-text);
    }
  </style>
</head>
<body>
  <header>
    <a href="${BRANDING.siteUrl}">🀄 ${BRANDING.primaryName}</a>
    <div class="header-links">
      <a href="${BRANDING.siteUrl}/generator/">🎲 Random Generator</a>
      <a href="${BRANDING.siteUrl}/idioms/">📚 Collections</a>
    </div>
  </header>

  <div class="container">
    <div class="breadcrumb">
      <a href="${BRANDING.siteUrl}">Home</a> &gt; 
      <a href="${BRANDING.siteUrl}/idioms/">Collections</a> &gt; 
      <span>Dramas</span> &gt;
      <span>${slug}</span>
    </div>

    <h1>${title}</h1>
    <div class="intro-text">${intro}</div>

    <h2>🎬 Famous Quotes &amp; Pronunciation Guide</h2>
    <div class="quotes-list">
      ${quotesHtml}
    </div>

    <h2>🌳 Character Family Tree &amp; Personality Idioms</h2>
    <div class="chars-list">
      ${charsHtml}
    </div>

    <a class="play-btn-large" href="${BRANDING.siteUrl}/">▶ Challenge Chinese Idiom Puzzle Now (开始成语猜谜)</a>
  </div>

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
        utterance.rate = 0.85; // 放慢便于学习
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Text-to-speech not supported in this browser.');
      }
    }
  </script>
</body>
</html>`;

    writeFileSyncWithRetry(path.join(dramaDir, 'index.html'), htmlContent, 'utf-8', 10, 100);
    generatedUrls.push(`${BRANDING.siteUrl}/dramas/${slug}/`);
    console.log(`✅ 已生成热点 IP 截流页面: /dramas/${slug}`);
  }

  // 6. 写入 dramas Sitemap 分卷
  const sitemapFilename = 'sitemap-dramas.xml';
  const sitemapFilePath = path.join(PUBLIC_DIR, sitemapFilename);
  const lastmod = new Date().toISOString().split('T')[0];

  const sitemapEntries = generatedUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>`).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>`;

  writeFileSyncWithRetry(sitemapFilePath, sitemapXml, 'utf-8', 10, 100);
  console.log(`📄 写入 dramas Sitemap 文件: ${sitemapFilename}`);

  // 7. 追加到主 sitemap.xml 索引中
  updateSitemapIndex([sitemapFilename]);
}

function updateSitemapIndex(newSitemaps) {
  if (!fs.existsSync(SITEMAP_INDEX_FILE)) {
    console.error('❌ 找不到 sitemap.xml 主索引');
    return;
  }
  let sitemapIndexContent = fs.readFileSync(SITEMAP_INDEX_FILE, 'utf-8');
  const lastmod = new Date().toISOString().split('T')[0];

  const newEntries = newSitemaps.map((sitemap) => 
    `  <sitemap><loc>${BRANDING.siteUrl}/${sitemap}</loc><lastmod>${lastmod}</lastmod></sitemap>`
  ).join('\n');

  if (sitemapIndexContent.includes('</sitemapindex>')) {
    // 兼容清洗已有项
    const domainCleanRegex = new RegExp(`  <sitemap><loc>https://(wordlechinese\\.com|easyidiom\\.com)/sitemap-dramas\\.xml</loc>.*</sitemap>\\n?`, 'g');
    sitemapIndexContent = sitemapIndexContent.replace(domainCleanRegex, '');
    
    sitemapIndexContent = sitemapIndexContent.replace(
      '</sitemapindex>',
      `${newEntries}\n</sitemapindex>`
    );
    fs.writeFileSync(SITEMAP_INDEX_FILE, sitemapIndexContent, 'utf-8');
    console.log('✅ 主 sitemap.xml 索引文件更新成功（dramas分卷）！');
  }
}

main().catch(err => {
  console.error('❌ 执行错误:', err);
  process.exit(1);
});
