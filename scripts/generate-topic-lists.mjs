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

const TOPIC_LISTS_JSON = path.join(DATA_DIR, 'topic-lists.json');
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

// 格式化拼音展示
function formatPinyinDisplay(pinyinStr) {
  if (!pinyinStr) return '';
  return pinyinStr.trim();
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
  console.log('🚀 开始生成专题合集页面...');

  // 1. 加载配置文件
  if (!fs.existsSync(TOPIC_LISTS_JSON)) {
    console.error('❌ 找不到 data/topic-lists.json 配置文件');
    process.exit(1);
  }
  const topicLists = JSON.parse(fs.readFileSync(TOPIC_LISTS_JSON, 'utf-8'));

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

  // 加载 CSV 题库用于提取 gameId
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

  // 4. 循环生成专题页面
  for (const list of topicLists) {
    const { slug, title, description, intro, idioms } = list;
    const listDir = path.join(PUBLIC_DIR, 'lists', slug);
    fs.mkdirSync(listDir, { recursive: true });

    let idiomsHtml = '';

    for (const word of idioms) {
      const cacheData = idiomCache[word] || {};
      const dictData = dictMap.get(word) || {};
      const pinyin = formatPinyinDisplay(cacheData.pinyin || dictData.pinyin || '');
      const itemSlug = toSlug(pinyin);
      const explanation = dictData.explanation || '';
      const meaning = cacheData.meaning || '';
      const derivation = dictData.derivation || '';
      const example = cacheData.example || dictData.example || '';
      const gameId = gameIdiomMap.get(word) || '1';

      const chars = word.split('');
      const charCards = chars.map(char => `<span class="char-box">${char}</span>`).join('');

      idiomsHtml += `
      <div class="idiom-card">
        <div class="card-header">
          <div class="char-grid">${charCards}</div>
          <div class="pinyin-text">${pinyin}</div>
        </div>
        <div class="card-body">
          ${meaning ? `<p class="info-row"><strong>English Meaning:</strong> ${meaning}</p>` : ''}
          ${explanation ? `<p class="info-row"><strong>Chinese Definition:</strong> ${explanation}</p>` : ''}
          ${derivation ? `<p class="info-row"><strong>Derivation:</strong> ${derivation}</p>` : ''}
          ${example ? `<p class="info-row"><strong>Example Sentence:</strong> <em>${example}</em></p>` : ''}
        </div>
        <div class="card-actions">
          <a class="action-btn play" href="${BRANDING.siteUrl}/#${gameId}">▶ Play Guess Challenge</a>
          <a class="action-btn details" href="/idiom/${itemSlug}">📖 View Meaning &amp; Pinyin Guide</a>
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
  <link rel="canonical" href="${BRANDING.siteUrl}/lists/${slug}/"/>
  
  <meta property="og:title" content="${title} | ${BRANDING.primaryName}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:url" content="${BRANDING.siteUrl}/lists/${slug}/"/>
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
      font-size: 18px;
      color: var(--light-text);
      margin-bottom: 40px;
      background: #eff6ff;
      padding: 20px;
      border-left: 4px solid var(--primary-color);
      border-radius: 4px;
    }
    .idiom-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      box-shadow: var(--shadow);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .char-grid {
      display: flex;
      gap: 8px;
    }
    .char-box {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      text-align: center;
      background: #3b82f6;
      color: #fff;
      font-size: 24px;
      font-weight: 900;
      border-radius: 8px;
    }
    .pinyin-text {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary-color);
    }
    .card-body p {
      margin: 12px 0;
    }
    .info-row {
      font-size: 16px;
    }
    .card-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .action-btn {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      transition: background 0.2s;
    }
    .action-btn.play {
      background-color: var(--primary-color);
      color: #ffffff;
    }
    .action-btn.play:hover {
      background-color: #1d4ed8;
    }
    .action-btn.details {
      background-color: #f3f4f6;
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    .action-btn.details:hover {
      background-color: #e5e7eb;
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
    <p style="margin:8px 0 0;color:var(--light-text);font-size:14px">Daily Chinese Idiom Guessing Game</p>
  </header>

  <div class="container">
    <div class="breadcrumb">
      <a href="${BRANDING.siteUrl}">Home</a> &gt; 
      <a href="${BRANDING.siteUrl}/idioms/">Collections</a> &gt; 
      <span>${title}</span>
    </div>

    <h1>${title}</h1>
    <div class="intro-text">${intro}</div>

    <div class="idioms-list">
      ${idiomsHtml}
    </div>
  </div>

  <footer>
    <div style="margin: 1.25em 0 0.5em 0;">
      <a href="https://productwatch.io" target="_blank" rel="noopener noreferrer"><img src="https://productwatch.io/backend/api/v1/badge/featured?productId=533b977f-83d8-4e89-a5fb-6235cbe85652&darkMode=false" alt="easyidiom" style="max-width: 250px; width: 100%; height: auto; border-radius: 8px;" /></a>
    </div>
    <p>© ${new Date().getFullYear()} <a href="${BRANDING.siteUrl}">${BRANDING.primaryName}</a> · 
    <a href="/privacy">Privacy Policy</a></p>
  </footer>
</body>
</html>`;

    writeFileSyncWithRetry(path.join(listDir, 'index.html'), htmlContent, 'utf-8', 10, 100);
    generatedUrls.push(`${BRANDING.siteUrl}/lists/${slug}/`);
    console.log(`✅ 已生成专题列表页面: /lists/${slug}`);
  }

  // 4.5 提取并生成纯前端随机成语生成器工具页
  const idiomsDb = [];
  for (const [word, cacheData] of Object.entries(idiomCache)) {
    const dictData = dictMap.get(word) || {};
    const pinyin = cacheData.pinyin || dictData.pinyin || '';
    if (!pinyin) continue;
    const meaning = cacheData.meaning || '';
    const explanation = dictData.explanation || '';
    const example = cacheData.example || dictData.example || '';
    const gameId = gameIdiomMap.get(word) || '1';
    idiomsDb.push({ word, pinyin, meaning, explanation, example, gameId });
  }
  console.log(`📊 提取了 ${idiomsDb.length} 条精选成语，供生成器使用。`);

  const generatorDir = path.join(PUBLIC_DIR, 'generator');
  fs.mkdirSync(generatorDir, { recursive: true });

  const generatorHtml = `<!DOCTYPE html>
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
  <title>Random Chinese Idiom Generator | ${BRANDING.primaryName}</title>
  <meta name="description" content="Generate random Chinese idioms (chengyu) with pinyin, English meanings, examples and audio pronunciation. Perfect for learning and writing."/>
  <link rel="canonical" href="${BRANDING.siteUrl}/generator/"/>
  
  <meta property="og:title" content="Random Chinese Idiom Generator | ${BRANDING.primaryName}"/>
  <meta property="og:description" content="Generate random Chinese idioms (chengyu) with pinyin, English meanings, examples and audio pronunciation. Perfect for learning and writing."/>
  <meta property="og:url" content="${BRANDING.siteUrl}/generator/"/>
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
      max-width: 600px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .breadcrumb {
      font-size: 14px;
      color: var(--light-text);
      margin-bottom: 24px;
      text-align: center;
    }
    .breadcrumb a {
      color: var(--primary-color);
      text-decoration: none;
    }
    h1 {
      font-size: 28px;
      font-weight: 900;
      margin-bottom: 8px;
      text-align: center;
    }
    .subtitle {
      font-size: 16px;
      color: var(--light-text);
      text-align: center;
      margin-bottom: 32px;
    }
    .idiom-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 32px;
      box-shadow: var(--shadow);
      text-align: center;
    }
    .char-grid {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .char-box {
      display: inline-block;
      width: 56px;
      height: 56px;
      line-height: 56px;
      text-align: center;
      background: #eff6ff;
      border: 2px solid #bfdbfe;
      color: var(--primary-color);
      font-size: 32px;
      font-weight: 900;
      border-radius: 12px;
    }
    .pinyin-container {
      font-size: 22px;
      font-weight: 700;
      color: var(--primary-color);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .pronounce-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 22px;
      vertical-align: middle;
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
    .content-area {
      text-align: left;
      border-top: 1px solid var(--border-color);
      padding-top: 20px;
      margin-top: 20px;
    }
    .info-label {
      font-weight: 700;
      color: var(--text-color);
      margin-bottom: 4px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .info-value {
      font-size: 16px;
      color: var(--text-color);
      margin-bottom: 20px;
    }
    .card-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 32px;
    }
    .action-btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 10px;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      transition: background 0.2s;
    }
    .action-btn.generate {
      background-color: var(--primary-color);
      color: #ffffff;
      border: none;
      cursor: pointer;
    }
    .action-btn.generate:hover {
      background-color: #1d4ed8;
    }
    .action-btn.play {
      background-color: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .action-btn.play:hover {
      background-color: #d1fae5;
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
      <span>Generator</span>
    </div>

    <h1>Random Chinese Idiom Generator</h1>
    <div class="subtitle">Generate random Chinese idioms with English meanings, pinyin and audio pronunciation.</div>

    <div class="idiom-card">
      <div id="char-grid" class="char-grid">
        <!-- JS 动态注入 -->
      </div>
      <div class="pinyin-container">
        <span id="pinyin-text">Loading...</span>
        <button class="pronounce-btn" onclick="speakCurrent()" title="Listen to pronunciation">🔊</button>
      </div>
      
      <div class="content-area">
        <div class="info-label">English Meaning</div>
        <div id="meaning-text" class="info-value">Loading...</div>
        
        <div id="definition-section">
          <div class="info-label">Chinese Definition</div>
          <div id="definition-text" class="info-value">Loading...</div>
        </div>
        
        <div id="example-section">
          <div class="info-label">Example Sentence</div>
          <div id="example-text" class="info-value" style="font-style: italic;">Loading...</div>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="action-btn generate" onclick="generateRandom()">🎲 Generate Random Idiom</button>
        <a id="play-link" class="action-btn play" href="#">▶ Challenge this in Daily Game</a>
      </div>
    </div>
  </div>

  <footer>
    <div style="margin: 1.25em 0 0.5em 0;">
      <a href="https://productwatch.io" target="_blank" rel="noopener noreferrer"><img src="https://productwatch.io/backend/api/v1/badge/featured?productId=533b977f-83d8-4e89-a5fb-6235cbe85652&darkMode=false" alt="easyidiom" style="max-width: 250px; width: 100%; height: auto; border-radius: 8px;" /></a>
    </div>
    <p>© ${new Date().getFullYear()} <a href="${BRANDING.siteUrl}">${BRANDING.primaryName}</a> · 
    <a href="/privacy">Privacy Policy</a></p>
  </footer>

  <script>
    const IDIOMS_DB = ${JSON.stringify(idiomsDb)};
    let currentWord = '';

    function generateRandom() {
      if (IDIOMS_DB.length === 0) return;
      const idx = Math.floor(Math.random() * IDIOMS_DB.length);
      const item = IDIOMS_DB[idx];
      
      currentWord = item.word;
      
      const chars = item.word.split('');
      const grid = document.getElementById('char-grid');
      grid.innerHTML = chars.map(char => '<span class="char-box">' + char + '</span>').join('');
      
      document.getElementById('pinyin-text').textContent = item.pinyin;
      document.getElementById('meaning-text').textContent = item.meaning || 'No English translation available.';
      
      if (item.explanation) {
        document.getElementById('definition-section').style.display = 'block';
        document.getElementById('definition-text').textContent = item.explanation;
      } else {
        document.getElementById('definition-section').style.display = 'none';
      }
      
      if (item.example) {
        document.getElementById('example-section').style.display = 'block';
        document.getElementById('example-text').textContent = item.example;
      } else {
        document.getElementById('example-section').style.display = 'none';
      }
      
      document.getElementById('play-link').href = '/#' + item.gameId;
    }

    function speakCurrent() {
      if (!currentWord) return;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(currentWord);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      } else {
        alert('Text-to-speech not supported in this browser.');
      }
    }

    window.onload = function() {
      generateRandom();
    };
  </script>
</body>
</html>`;

  writeFileSyncWithRetry(path.join(generatorDir, 'index.html'), generatorHtml, 'utf-8', 10, 100);
  generatedUrls.push(`${BRANDING.siteUrl}/generator/`);
  console.log('✅ 成功生成纯前端随机成语生成器: /generator/');

  // 5. 写入分卷 Sitemap
  const sitemapFilename = 'sitemap-lists.xml';
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
  console.log(`📄 写入专题 Sitemap 文件: ${sitemapFilename}`);

  // 6. 追加到主 sitemap.xml 索引文件中
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
    // 兼容清理已有 sitemap-lists 项
    const domainCleanRegex = new RegExp(`  <sitemap><loc>https://(wordlechinese\\.com|easyidiom\\.com)/sitemap-lists\\.xml</loc>.*</sitemap>\\n?`, 'g');
    sitemapIndexContent = sitemapIndexContent.replace(domainCleanRegex, '');
    
    sitemapIndexContent = sitemapIndexContent.replace(
      '</sitemapindex>',
      `${newEntries}\n</sitemapindex>`
    );
    fs.writeFileSync(SITEMAP_INDEX_FILE, sitemapIndexContent, 'utf-8');
    console.log('✅ 主 sitemap.xml 索引文件更新成功！');
  }
}

main().catch(err => {
  console.error('❌ 执行错误:', err);
  process.exit(1);
});
