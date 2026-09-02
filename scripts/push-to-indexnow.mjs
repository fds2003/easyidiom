/**
 * push-to-indexnow.mjs — 微软必应 (Bing) & IndexNow 协议极速主动推送系统
 * 
 * 官方标准：https://www.bing.com/indexnow/getstarted
 * 支持向 Bing、Yandex、Seznam 等全球搜索引擎一次性批量推送多达 10,000 条 URL，实现秒级收录。
 */

import fs from 'fs';
import path from 'path';

const HOST = 'easyidiom.com';
const KEY = '891dc89a95bf4852b7e05b2055b7d76a';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const INDEXNOW_API = 'https://api.indexnow.org/indexnow';
const BASE_URL = `https://${HOST}`;

async function collectAllUrls() {
  const urls = new Set();

  // 1. 核心导航、工具与指南页
  urls.add(`${BASE_URL}/`);
  urls.add(`${BASE_URL}/generator/`);
  urls.add(`${BASE_URL}/study/chinese-idiom-hsk-guide`);
  urls.add(`${BASE_URL}/learn-chinese-with-idioms`);

  // 2. 专题合集页 (Lists)
  try {
    const topicPath = path.resolve('data/topic-lists.json');
    if (fs.existsSync(topicPath)) {
      const topicData = JSON.parse(fs.readFileSync(topicPath, 'utf8'));
      if (Array.isArray(topicData)) {
        topicData.forEach(item => {
          urls.add(`${BASE_URL}/lists/${item.slug}/`);
        });
      }
    }
  } catch (e) {
    console.warn('读取 topic-lists 失败:', e.message);
  }

  // 3. 影视与热点截流页 (Dramas)
  try {
    const dramaPath = path.resolve('data/drama-lists.json');
    if (fs.existsSync(dramaPath)) {
      const dramaData = JSON.parse(fs.readFileSync(dramaPath, 'utf8'));
      if (Array.isArray(dramaData)) {
        dramaData.forEach(item => {
          urls.add(`${BASE_URL}/dramas/${item.slug}/`);
        });
      }
    }
  } catch (e) {
    console.warn('读取 drama-lists 失败:', e.message);
  }

  // 4. 每日答案页 (最近 60 天)
  try {
    const answerDir = path.resolve('public/answer');
    if (fs.existsSync(answerDir)) {
      const answerFiles = fs.readdirSync(answerDir).filter(f => f.endsWith('.html'));
      answerFiles.slice(-60).forEach(f => {
        urls.add(`${BASE_URL}/answer/${f}`);
      });
    }
  } catch (e) {
    console.warn('读取 answer 失败:', e.message);
  }

  // 5. 成语物理详情页 (取前 1000 个高权重成语)
  try {
    const idiomsDir = path.resolve('public/idiom');
    if (fs.existsSync(idiomsDir)) {
      const idiomDirs = fs.readdirSync(idiomsDir).filter(f => !f.startsWith('.'));
      idiomDirs.slice(0, 1000).forEach(slug => {
        urls.add(`${BASE_URL}/idiom/${slug}`);
      });
    }
  } catch (e) {
    console.warn('读取 idiom 失败:', e.message);
  }

  return Array.from(urls);
}

async function pushToIndexNow() {
  console.log('🚀 启动 IndexNow (Bing / 必应) 极速推送系统...');
  const urlList = await collectAllUrls();
  console.log(`📊 共收集到 ${urlList.length} 个优质页面准备提交至 Bing IndexNow 引擎`);

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urlList,
  };

  try {
    const response = await fetch(INDEXNOW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    console.log(`\n--- 🎯 IndexNow 响应状态: HTTP ${response.status} (${response.statusText}) ---`);
    if (response.status === 200 || response.status === 202) {
      console.log(`✅ 恭喜！${urlList.length} 个 URL 已成功提交至 IndexNow！`);
      console.log('⚡ 微软必应 (Bing) 和 Yandex 等搜索引擎将在数秒内启动秒级抓取与收录。');
    } else {
      const text = await response.text();
      console.log(`⚠️ IndexNow 返回信息:`, text || response.statusText);
    }
  } catch (error) {
    console.error('❌ IndexNow 请求发生异常:', error);
  }
}

pushToIndexNow();
