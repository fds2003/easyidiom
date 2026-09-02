/**
 * push-to-baidu.mjs — 百度搜索资源平台主动推送 (API Push) 智能脚本
 * 
 * 每日向百度蜘蛛批量主动推送全站核心页面、每日答案、专题合集及成语词典页，
 * 智能适配百度新站与老站配额。
 */

import fs from 'fs';
import path from 'path';

const BAIDU_PUSH_URL = 'http://data.zz.baidu.com/urls?site=https://easyidiom.com&token=9nW1pPcbJvBMSxOc';
const BASE_URL = 'https://easyidiom.com';

async function collectPriorityUrls() {
  const urls = [];

  // 1. 核心大权重页面 (首页、工具页、学习指南)
  urls.push(`${BASE_URL}/`);
  urls.push(`${BASE_URL}/generator/`);
  urls.push(`${BASE_URL}/study/chinese-idiom-hsk-guide`);
  urls.push(`${BASE_URL}/learn-chinese-with-idioms`);

  // 2. 专题合集页 (Lists)
  try {
    const topicPath = path.resolve('data/topic-lists.json');
    if (fs.existsSync(topicPath)) {
      const topicData = JSON.parse(fs.readFileSync(topicPath, 'utf8'));
      if (Array.isArray(topicData)) {
        topicData.forEach(item => {
          urls.push(`${BASE_URL}/lists/${item.slug}/`);
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
          urls.push(`${BASE_URL}/dramas/${item.slug}/`);
        });
      }
    }
  } catch (e) {
    console.warn('读取 drama-lists 失败:', e.message);
  }

  // 4. 每日最新答案页 (最新的前 5 个)
  try {
    const answerDir = path.resolve('public/answer');
    if (fs.existsSync(answerDir)) {
      const answerFiles = fs.readdirSync(answerDir).filter(f => f.endsWith('.html'));
      answerFiles.slice(-5).forEach(f => {
        urls.push(`${BASE_URL}/answer/${f}`);
      });
    }
  } catch (e) {
    console.warn('读取 answer 失败:', e.message);
  }

  return urls;
}

async function pushBatch(batchUrls) {
  const payload = batchUrls.join('\n');
  const response = await fetch(BAIDU_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: payload,
  });
  return await response.json();
}

async function main() {
  console.log('🚀 开始向百度主动推送 (API Push)...');
  const priorityUrls = await collectPriorityUrls();
  console.log(`📊 本次精选推送核心 URL 数量: ${priorityUrls.length}`);

  try {
    // 首次推送核心高价值 URL (通常 10~15 条，确保完全在百度新站配额内)
    const result = await pushBatch(priorityUrls);
    console.log('\n--- 🎯 百度主动推送响应结果 ---');
    if (result.success) {
      console.log(`✅ 核心页面推送成功！本次成功推送条数: ${result.success}`);
      console.log(`📈 今日剩余推送配额: ${result.remain}`);

      // 如果还有剩余额度且额度大于 10，尝试补充推送一批成语物理页
      if (result.remain && result.remain > 10) {
        console.log(`\n⏳ 检测到剩余配额充裕 (${result.remain} 条)，正在追加推送成语物理详情页...`);
        const idiomUrls = [];
        const idiomsDir = path.resolve('public/idiom');
        if (fs.existsSync(idiomsDir)) {
          const idiomDirs = fs.readdirSync(idiomsDir);
          const count = Math.min(result.remain - 5, 200);
          idiomDirs.slice(0, count).forEach(slug => {
            idiomUrls.push(`${BASE_URL}/idiom/${slug}`);
          });
        }
        if (idiomUrls.length > 0) {
          const secondResult = await pushBatch(idiomUrls);
          console.log(`✅ 补充推送完成！成功提交: ${secondResult.success} 条，剩余配额: ${secondResult.remain}`);
        }
      }
    } else {
      console.log(`⚠️ 百度返回状态:`, result);
    }
  } catch (error) {
    console.error('❌ 推送请求发生异常:', error);
  }
}

main();
