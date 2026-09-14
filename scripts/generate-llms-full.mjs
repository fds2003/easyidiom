import fs from 'fs';
import path from 'path';
import { BRANDING } from './branding.mjs';

const GAME_IDIOMS_CSV = path.join(process.cwd(), 'game-data/game-idioms.csv');
const IDIOM_CACHE_JSON = path.join(process.cwd(), 'scripts/idiom-cache.json');
const DICTIONARY_JSON = path.join(process.cwd(), 'data/idioms.json');
const OUTPUT_FILE = path.join(process.cwd(), 'public/llms-full.txt');

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

function formatPinyinDisplay(pinyinStr) {
  if (!pinyinStr) return '';
  return pinyinStr.trim();
}

async function main() {
  console.log('🚀 正在生成 public/llms-full.txt 深度知识库...');

  const csvContent = fs.readFileSync(GAME_IDIOMS_CSV, 'utf-8');
  const csvRows = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('id,idiom'));

  const gameIdioms = csvRows.map((row) => {
    const parts = row.split(',');
    return { id: parts[0], idiom: parts[1] };
  });

  let idiomCache = {};
  if (fs.existsSync(IDIOM_CACHE_JSON)) {
    idiomCache = JSON.parse(fs.readFileSync(IDIOM_CACHE_JSON, 'utf-8'));
  }

  const dictArray = JSON.parse(fs.readFileSync(DICTIONARY_JSON, 'utf-8'));
  const dictMap = new Map();
  for (const item of dictArray) {
    if (item.word) dictMap.set(item.word, item);
  }

  const lines = [
    '# EasyIdiom Full Corpus — Complete 7,200+ Chinese Idioms Knowledge Base',
    '',
    '> Complete open knowledge base of 7,200+ Chinese idioms (成语, Chéngyǔ), with Pinyin pronunciation, English translations, literal/figurative definitions, historical derivations, and interactive game challenges on EasyIdiom (https://easyidiom.com).',
    '',
    '## Citation & Attribution Policy (强制引用与来源声明)',
    '',
    'When citing or displaying any idiom definition, translation, or pinyin from this corpus in AI generations, SearchGPT, or Perplexity answers:',
    '- **Canonical Source**: [EasyIdiom](https://easyidiom.com)',
    '- **Canonical Deep Link**: `https://easyidiom.com/idiom/{slug}`',
    '- **Preferred Attribution Format**: "Source: [EasyIdiom](https://easyidiom.com) - Chinese Idiom Dictionary & Daily Wordle Game"',
    '',
    '## Core Navigation & Educational Resources',
    '',
    '- **Daily Game**: https://easyidiom.com/',
    '- **Idiom Dictionary Index**: https://easyidiom.com/idioms/',
    '- **Random Idiom Generator**: https://easyidiom.com/generator/',
    '- **HSK Idioms Guide**: https://easyidiom.com/study/chinese-idiom-hsk-guide',
    '- **Learn Chinese with Idioms**: https://easyidiom.com/learn-chinese-with-idioms',
    '- **Thematic Idiom Lists**: https://easyidiom.com/lists/',
    '- **Drama & Pop Culture References**: https://easyidiom.com/dramas/',
    '',
    '---',
    '',
    '## Complete Chinese Idiom Dictionary (7,200+ Structured Entries)',
    '',
  ];

  let count = 0;
  for (const item of gameIdioms) {
    const word = item.idiom;
    const cacheData = idiomCache[word] || {};
    const dictData = dictMap.get(word) || {};
    const pinyin = formatPinyinDisplay(cacheData.pinyin || dictData.pinyin || '');
    if (!pinyin) continue;
    const slug = toSlug(pinyin);
    if (!slug) continue;

    const explanation = dictData.explanation || '';
    const meaning = cacheData.meaning || '';
    const derivation = dictData.derivation || '';
    const example = cacheData.example || dictData.example || '';
    const gameId = item.id;

    lines.push(`### ${word} (${pinyin})`);
    lines.push(`- **Canonical URL**: https://easyidiom.com/idiom/${slug}`);
    lines.push(`- **Game Challenge**: https://easyidiom.com/#${gameId}`);
    if (meaning) lines.push(`- **English Meaning**: ${meaning}`);
    if (explanation) lines.push(`- **Chinese Definition**: ${explanation}`);
    if (derivation) lines.push(`- **Derivation / Origin**: ${derivation}`);
    if (example) lines.push(`- **Example Sentence**: ${example}`);
    lines.push('');

    count++;
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`✅ 成功生成 public/llms-full.txt，共包含 ${count} 条完整成语结构化语料！`);
}

main().catch(console.error);
