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
    <p>© ${new Date().getFullYear()} <a href="${BRANDING.siteUrl}">${BRANDING.primaryName}</a> · 
    <a href="/privacy">Privacy Policy</a></p>
  </footer>
</body>
</html>`;

    writeFileSyncWithRetry(path.join(listDir, 'index.html'), htmlContent, 'utf-8', 10, 100);
    generatedUrls.push(`${BRANDING.siteUrl}/lists/${slug}/`);
    console.log(`✅ 已生成专题列表页面: /lists/${slug}`);
  }

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
