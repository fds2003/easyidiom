/**
 * generate-categories.mjs
 * 生成分类聚合页：按难度 + 按主题
 *
 * 用法: node generate-categories.mjs
 * 依赖: npm install papaparse
 * 前提: 已运行过 generate-answers-deepseek.mjs，
 *       scripts/idiom-cache.json 中有成语数据
 */
import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';

const CACHE_FILE = 'scripts/idiom-cache.json';
const OUTPUT_DIR = 'public/idioms';
const SITE_URL = 'https://wordlechinese.com';

// ─── 主题关键词映射 ────────────────────────────────────────────
// 每个主题包含若干中文关键字，成语中含这些字即归入该主题
const TOPIC_KEYWORDS = {
  animals: {
    label: 'Animals (动物)',
    slug: 'animals',
    description:
      'Chinese idioms about animals — dragons, tigers, fish, horses, birds and more. Explore chengyu featuring 50+ animal characters with pinyin and English meanings.',
    keywords: [
      // 走兽
      '龙',
      '虎',
      '马',
      '牛',
      '羊',
      '猪',
      '狗',
      '蛇',
      '鼠',
      '兔',
      '猴',
      '狼',
      '熊',
      '狐',
      '象',
      '鹿',
      '豹',
      '狮',
      '猫',
      '驴',
      '猿',
      '狸',
      // 禽鸟
      '鸡',
      '鸭',
      '鸟',
      '鹰',
      '鹤',
      '燕',
      '雀',
      '鸽',
      '鸦',
      '凤',
      '鹏',
      '鸾',
      '鸿',
      '鹊',
      '鸥',
      '鸳',
      '鸯',
      // 水族
      '鱼',
      '虾',
      '蟹',
      '蛙',
      '龟',
      '鳖',
      '鲸',
      '蚌',
      '鲤',
      '鳞',
      '蛟',
      // 虫类
      '蚕',
      '蜂',
      '蝶',
      '虫',
      '蝇',
      '蚁',
      '蝉',
      '螳',
      '蛾',
    ],
  },
  numbers: {
    label: 'Numbers (数字)',
    slug: 'numbers',
    description:
      'Chinese idioms with numbers — one, two, three, hundred, thousand, ten thousand. Learn number chengyu (数字成语) for HSK prep with pinyin and English.',
    keywords: [
      '一',
      '二',
      '三',
      '四',
      '五',
      '六',
      '七',
      '八',
      '九',
      '十',
      '百',
      '千',
      '万',
      '两',
      '双',
      '半',
    ],
  },
  nature: {
    label: 'Nature (自然)',
    slug: 'nature',
    description:       'Chinese nature idioms — mountains, rivers, wind, rain, moon, flowers. Discover chengyu inspired by the natural world with pinyin and English.',
    keywords: [
      '山',
      '水',
      '风',
      '雨',
      '云',
      '雪',
      '火',
      '土',
      '木',
      '金',
      '石',
      '海',
      '江',
      '河',
      '湖',
      '天',
      '地',
      '日',
      '月',
      '星',
      '花',
      '草',
      '树',
      '林',
      '叶',
    ],
  },
  people: {
    label: 'People (人物)',
    slug: 'people',
    description:
      'Chinese idioms about people — character, relationships, emotions, wisdom. Learn human-nature chengyu (人物成语) with pinyin, meanings and examples.',
    keywords: [
      '人',
      '心',
      '情',
      '义',
      '礼',
      '智',
      '信',
      '仁',
      '勇',
      '忠',
      '孝',
      '友',
      '师',
      '父',
      '母',
      '子',
      '兄',
      '弟',
      '君',
      '臣',
      '民',
    ],
  },
  colors: {
    label: 'Colors (颜色)',
    slug: 'colors',
    description:       'Chinese color idioms — red, green, black, white, blue, gold in chengyu. Explore colorful Chinese idioms with pinyin and English meanings.',
    keywords: [
      '红',
      '绿',
      '蓝',
      '黄',
      '白',
      '黑',
      '青',
      '紫',
      '金',
      '银',
      '彩',
      '色',
    ],
  },
};

// ─── 难度分类（来自 cache 中的 difficulty 字段）────────────────
const DIFFICULTY_META = {
  easy: {
    label: 'Easy 😊',
    slug: 'easy',
    description: 'Learn easy Chinese idioms (成语) with pinyin and English. Beginner-friendly 4-character chengyu perfect for HSK prep and daily mandarin wordle practice.',
  },
  medium: {
    label: 'Medium 🤔',
    slug: 'medium',
    description: 'Intermediate Chinese idioms (成语) to build vocabulary. Medium-difficulty chengyu with pinyin, English meanings and examples. HSK 4-5 level practice.',
  },
  hard: {
    label: 'Hard 🔥',
    slug: 'hard',
    description: 'Advanced Chinese idioms (成语) for serious learners. Challenging chengyu with deep cultural meanings, pinyin and English explanations. HSK 6+ level.',
  },
};

// ─── 工具函数 ─────────────────────────────────────────────────
function loadData() {
  const csv = fs.readFileSync('game-data/game-idioms.csv', 'utf-8');
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const idioms = data
    .map((r) => ({ id: r.id, idiom: r.idiom }))
    .filter((r) => r.idiom);

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.error(
        '❌ 无法解析 scripts/idiom-cache.json，请重新生成:',
        e.message,
      );
      process.exit(1);
    }
  }

  // 合并：只处理 cache 中有数据的成语
  return idioms
    .filter((r) => cache[r.idiom])
    .map((r) => ({ ...r, ...cache[r.idiom] }));
}

function buildIdiomDateMap() {
  const map = {};
  const answerDir = 'public/answer';
  if (!fs.existsSync(answerDir)) return map;
  const dates = fs.readdirSync(answerDir).filter((d) => {
    try {
      return fs.statSync(path.join(answerDir, d)).isDirectory();
    } catch {
      return false;
    }
  });
  let unmatched = 0;
  for (const d of dates) {
    const htmlPath = path.join(answerDir, d, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const match = html.match(/<title>[^<]*— ([^ (]+) \(/);
    if (match) {
      map[match[1]] = d;
    } else {
      unmatched++;
    }
  }
  if (unmatched > 0) {
    console.warn(
      `⚠️  ${unmatched}/${dates.length} answer 页面 title 格式未识别`,
    );
  }
  return map;
}

let _idiomDateMap = null;
function getIdiomDateMap() {
  if (!_idiomDateMap) _idiomDateMap = buildIdiomDateMap();
  return _idiomDateMap;
}

function idiomCard(item, dateMap) {
  const date = dateMap[item.idiom];
  const link = date ? `${SITE_URL}/answer/${date}/` : `${SITE_URL}`;
  const difficulty = item.difficulty || 'medium';
  const diffColor = { easy: '#6aaa64', medium: '#c9b458', hard: '#787c7e' }[
    difficulty
  ];

  return `
  <a class="card" href="${link}">
    <div class="hanzi">${item.idiom}</div>
    <div class="pinyin">${item.pinyin || ''}</div>
    <div class="meaning">${
      item.meaning
        ? item.meaning.slice(0, 60) + (item.meaning.length > 60 ? '…' : '')
        : ''
    }</div>
    <span class="badge" style="background:${diffColor}">${difficulty}</span>
  </a>`;
}

function generatePage({
  slug,
  label,
  description,
  items,
  parentSlug = null,
  dateMap = {},
}) {
  const canonicalPath = parentSlug
    ? `/idioms/${parentSlug}/${slug}/`
    : `/idioms/${slug}/`;

  const breadcrumb = parentSlug
    ? `<a href="/idioms/">Idioms</a> › <a href="/idioms/${parentSlug}/">${parentSlug}</a> › ${label}`
    : `<a href="/idioms/">Idioms</a> › ${label}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${label} Chinese Idioms | WordleChinese.com</title>
  <meta name="description" content="${description}"/>
  <link rel="canonical" href="${SITE_URL}${canonicalPath}"/>
  <meta property="og:title" content="${label} Chinese Idioms | WordleChinese.com"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:url" content="${SITE_URL}${canonicalPath}"/>
  <meta property="og:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${label} Chinese Idioms | WordleChinese.com"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="https://i.imgur.com/HaFiQgi.jpg"/>
  <meta name="robots" content="index, follow"/>
  <link rel="alternate" hreflang="en" href="${SITE_URL}${canonicalPath}"/>
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${canonicalPath}"/>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${label} Chinese Idioms",
    "description": "${description}",
    "url": "${SITE_URL}${canonicalPath}",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type":"ListItem","position":1,"name":"Home","item":"${SITE_URL}/"},
        {"@type":"ListItem","position":2,"name":"Idioms","item":"${SITE_URL}/idioms/"},
        {"@type":"ListItem","position":3,"name":"${label}","item":"${SITE_URL}${canonicalPath}"}
      ]
    }
  }
  </script>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1a1a1a}
    header{text-align:center;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:24px}
    header a{color:#2563eb;text-decoration:none;font-weight:600}
    .breadcrumb{font-size:13px;color:#6b7280;margin-bottom:16px}
    .breadcrumb a{color:#2563eb;text-decoration:none}
    h1{font-size:26px;margin:0 0 8px}
    .subtitle{color:#6b7280;margin-bottom:24px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
    .card{display:block;text-decoration:none;color:#1a1a1a;border:1px solid #e5e7eb;
          border-radius:10px;padding:16px;transition:box-shadow .2s}
    .card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);border-color:#6aaa64}
    .hanzi{font-size:28px;font-weight:bold;margin-bottom:4px}
    .pinyin{font-size:13px;color:#6b7280;margin-bottom:6px}
    .meaning{font-size:12px;color:#374151;margin-bottom:8px;line-height:1.4}
    .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;
           font-weight:600;color:white}
    .play-btn{display:block;text-align:center;background:#6aaa64;color:white;
              text-decoration:none;padding:12px;border-radius:8px;font-weight:700;
              font-size:16px;margin:24px 0}
    .play-btn:hover{background:#538d4e}
    .count{color:#6b7280;font-size:14px;margin-bottom:16px}
    nav.back{margin-top:32px;padding-top:16px;border-top:2px solid #eee;font-size:14px}
    nav.back a{color:#2563eb;text-decoration:none;margin-right:16px}
    footer{text-align:center;margin-top:40px;color:#9ca3af;font-size:13px}
  </style>
</head>
<body>
  <header>
    <a href="${SITE_URL}">🀄 WordleChinese.com</a>
    <p style="margin:8px 0 0;color:#6b7280;font-size:14px">Daily Chinese Idiom Wordle Game</p>
  </header>

  <div class="breadcrumb">${breadcrumb}</div>

  <h1>${label} Chinese Idioms</h1>
  <p class="subtitle">${description}</p>
  <p class="count">${items.length} idioms in this collection</p>

  <a class="play-btn" href="${SITE_URL}">▶ Play Today's Wordle Chinese</a>

  <div class="grid">
    ${items.map((item) => idiomCard(item, dateMap)).join('')}
  </div>

  <nav class="back">
    <a href="/idioms/">← All Categories</a>
    <a href="${SITE_URL}">🏠 Today's Game</a>
  </nav>

  <footer>
    <p>© ${new Date().getFullYear()} <a href="${SITE_URL}" style="color:#6b7280">WordleChinese.com</a> ·
    <a href="/privacy" style="color:#6b7280">Privacy Policy</a></p>
  </footer>
</body>
</html>`;
}

function generateIndexPage(categories) {
  const cards = categories
    .map(
      (c) => `
  <a class="cat-card" href="/idioms/${c.slug}/">
    <div class="cat-icon">${c.icon}</div>
    <div class="cat-label">${c.label}</div>
    <div class="cat-count">${c.count} idioms</div>
  </a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Chinese Idiom Categories | WordleChinese.com</title>
  <meta name="description" content="Browse Chinese idioms by difficulty or theme — animals, numbers, nature, colors and more. Play Wordle Chinese daily."/>
  <link rel="canonical" href="${SITE_URL}/idioms/"/>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How many Chinese idioms are on Wordle Chinese?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Wordle Chinese has 7,200+ idioms organized by difficulty (easy, medium, hard) and theme (animals, numbers, nature, people, colors)."
        }
      },
      {
        "@type": "Question",
        "name": "What is the easiest Chinese idiom to learn?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Easy idioms like 一心一意 (yī xīn yī yì — wholeheartedly) and 雪中送炭 (xuě zhōng sòng tàn — timely help) use common characters and are great for beginners learning chengyu."
        }
      },
      {
        "@type": "Question",
        "name": "Are there Chinese idioms about animals?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, many Chinese idioms feature animals like dragons (龙), tigers (虎), horses (马), and fish (鱼). Browse our animals category for chengyu organized by theme."
        }
      }
    ]
  }
  </script>
  <style>
    body{font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a1a}
    header{text-align:center;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:24px}
    header a{color:#2563eb;text-decoration:none;font-weight:600}
    h1{font-size:26px;margin:0 0 8px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:24px}
    .cat-card{display:block;text-decoration:none;color:#1a1a1a;border:1px solid #e5e7eb;
              border-radius:10px;padding:20px;text-align:center;transition:box-shadow .2s}
    .cat-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);border-color:#6aaa64}
    .cat-icon{font-size:32px;margin-bottom:8px}
    .cat-label{font-weight:600;margin-bottom:4px}
    .cat-count{font-size:12px;color:#6b7280}
    .play-btn{display:block;text-align:center;background:#6aaa64;color:white;
              text-decoration:none;padding:12px;border-radius:8px;font-weight:700;
              font-size:16px;margin:24px 0}
    footer{text-align:center;margin-top:40px;color:#9ca3af;font-size:13px}
  </style>
</head>
<body>
  <header>
    <a href="${SITE_URL}">🀄 WordleChinese.com</a>
    <p style="margin:8px 0 0;color:#6b7280;font-size:14px">Daily Chinese Idiom Wordle Game</p>
  </header>

  <h1>Browse Chinese Idioms</h1>
  <p style="color:#6b7280">Explore our collection of Chinese idioms (成语) by difficulty or theme.</p>

  <a class="play-btn" href="${SITE_URL}">▶ Play Today's Wordle Chinese</a>

  <h2 style="font-size:18px;margin-bottom:8px">By Difficulty</h2>
  <div class="grid">${categories
    .filter((c) => c.type === 'difficulty')
    .map(
      (c) => `
  <a class="cat-card" href="/idioms/${c.slug}/">
    <div class="cat-icon">${c.icon}</div>
    <div class="cat-label">${c.label}</div>
    <div class="cat-count">${c.count} idioms</div>
  </a>`,
    )
    .join('')}</div>

  <h2 style="font-size:18px;margin:24px 0 8px">By Theme</h2>
  <div class="grid">${categories
    .filter((c) => c.type === 'topic')
    .map(
      (c) => `
  <a class="cat-card" href="/idioms/${c.slug}/">
    <div class="cat-icon">${c.icon}</div>
    <div class="cat-label">${c.label}</div>
    <div class="cat-count">${c.count} idioms</div>
  </a>`,
    )
    .join('')}</div>

  <footer>
    <p>© ${new Date().getFullYear()} <a href="${SITE_URL}" style="color:#6b7280">WordleChinese.com</a> ·
    <a href="/privacy" style="color:#6b7280">Privacy Policy</a></p>
  </footer>
</body>
</html>`;
}

// ─── 主流程 ───────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ 找不到 scripts/idiom-cache.json，请先运行答案页生成脚本');
    process.exit(1);
  }

  const allItems = loadData();
  console.log(`📚 加载 ${allItems.length} 条有完整数据的成语`);

  // 构建 idiom → date 反向索引（只扫描一次）
  const dateMap = buildIdiomDateMap();
  console.log(`📅 建立 ${Object.keys(dateMap).length} 条成语→日期映射`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const categoryMeta = [];
  const icons = {
    easy: '😊',
    medium: '🤔',
    hard: '🔥',
    animals: '🐉',
    numbers: '🔢',
    nature: '🌊',
    people: '👥',
    colors: '🎨',
  };

  // ── 按难度生成 ──
  for (const [diff, meta] of Object.entries(DIFFICULTY_META)) {
    const items = allItems.filter((i) => (i.difficulty || 'medium') === diff);
    if (items.length === 0) {
      console.log(`⚠️  ${diff} 无数据，跳过`);
      continue;
    }

    const dir = path.join(OUTPUT_DIR, meta.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      generatePage({
        slug: meta.slug,
        label: meta.label,
        description: meta.description,
        items,
        dateMap,
      }),
    );
    console.log(`✅ /idioms/${meta.slug}/ — ${items.length} 条`);
    categoryMeta.push({
      type: 'difficulty',
      slug: meta.slug,
      label: meta.label,
      count: items.length,
      icon: icons[diff],
    });
  }

  // ── 按主题生成 ──
  for (const [key, topic] of Object.entries(TOPIC_KEYWORDS)) {
    const items = allItems.filter((i) =>
      topic.keywords.some((kw) => i.idiom.includes(kw)),
    );
    if (items.length === 0) {
      console.log(`⚠️  ${key} 无匹配，跳过`);
      continue;
    }

    const dir = path.join(OUTPUT_DIR, topic.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      generatePage({
        slug: topic.slug,
        label: topic.label,
        description: topic.description,
        items,
        dateMap,
      }),
    );
    console.log(`✅ /idioms/${topic.slug}/ — ${items.length} 条`);
    categoryMeta.push({
      type: 'topic',
      slug: topic.slug,
      label: topic.label,
      count: items.length,
      icon: icons[key],
    });
  }

  // ── 生成分类索引页 ──
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'index.html'),
    generateIndexPage(categoryMeta),
  );
  console.log(`✅ /idioms/ 索引页生成完成`);

  // ── 生成分类 sitemap ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url><loc>${SITE_URL}/idioms/</loc><lastmod>${todayStr}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...categoryMeta.map(
      (c) =>
        `  <url><loc>${SITE_URL}/idioms/${c.slug}/</loc><lastmod>${todayStr}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ),
  ].join('\n');

  fs.writeFileSync(
    'public/category-sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
  );
  console.log(`📄 public/category-sitemap.xml 已生成`);

  // ── 自动追加到 sitemap 索引 ──
  const sitemapIndexPath = 'public/sitemap.xml';
  if (fs.existsSync(sitemapIndexPath)) {
    let sitemapIndex = fs.readFileSync(sitemapIndexPath, 'utf-8');
    if (!sitemapIndex.includes('category-sitemap.xml')) {
      sitemapIndex = sitemapIndex.replace(
        /<\/sitemapindex>\s*$/,
        `  <sitemap>\n    <loc>${SITE_URL}/category-sitemap.xml</loc>\n    <lastmod>${new Date()
          .toISOString()
          .slice(0, 10)}</lastmod>\n  </sitemap>\n</sitemapindex>`,
      );
      fs.writeFileSync(sitemapIndexPath, sitemapIndex);
      console.log(`📎 已自动追加 category-sitemap.xml 到 public/sitemap.xml`);
    } else {
      console.log(`📎 category-sitemap.xml 已在 sitemap 索引中`);
    }
  }

  console.log(`\n🎉 共生成 ${categoryMeta.length} 个分类页`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
