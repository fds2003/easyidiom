/**
 * push-to-baidu.mjs — 百度搜索资源平台主动推送 (API Push) 智能游标轮转系统
 * 
 * 特性：
 * 1. 自动持久化记录已推送地址与游标 (Cursor) 位置；
 * 2. 每天必推当天最新答案与大权重核心页；
 * 3. 7,209 个成语物理详情页像“传送带”一样按序轮转推送，绝不重复浪费百度每日配额；
 * 4. 动态自适应百度每日返回的剩余配额 (remain)。
 */

import fs from 'fs';
import path from 'path';

const BAIDU_PUSH_URL = 'http://data.zz.baidu.com/urls?site=https://easyidiom.com&token=9nW1pPcbJvBMSxOc';
const BASE_URL = 'https://easyidiom.com';
const STATE_FILE = path.resolve('data/baidu-push-history.json');

// 读取或初始化持久化状态
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('读取推送状态文件异常，初始化新状态:', e.message);
    }
  }
  return {
    lastPushDate: '',
    idiomCursor: 0,
    totalIdiomsPushed: 0,
    history: [],
  };
}

// 保存持久化状态
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(`💾 推送状态已持久化保存至: data/baidu-push-history.json (当前游标位置: ${state.idiomCursor})`);
  } catch (e) {
    console.error('保存推送状态失败:', e.message);
  }
}

// 获取全部 7209 个成语的 slug 列表（有序）
function getAllIdiomSlugs() {
  const idiomsDir = path.resolve('public/idiom');
  if (!fs.existsSync(idiomsDir)) return [];
  return fs.readdirSync(idiomsDir).filter(f => !f.startsWith('.'));
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
  console.log('🚀 启动百度主动推送智能游标系统...');
  const state = loadState();
  const allIdioms = getAllIdiomSlugs();
  const totalIdioms = allIdioms.length;
  console.log(`📚 本地成语库总量: ${totalIdioms} 个，上次推送游标进度: [第 ${state.idiomCursor} 个]`);

  const urlsToPush = [];

  // 1. 核心大权重页面 (首页、生成器、学习指南)
  urlsToPush.push(`${BASE_URL}/`);
  urlsToPush.push(`${BASE_URL}/generator/`);
  urlsToPush.push(`${BASE_URL}/study/chinese-idiom-hsk-guide`);

  // 2. 每日最新答案页 (最新的 1~2 个)
  try {
    const answerDir = path.resolve('public/answer');
    if (fs.existsSync(answerDir)) {
      const answerFiles = fs.readdirSync(answerDir).filter(f => f.endsWith('.html'));
      answerFiles.slice(-2).forEach(f => {
        urlsToPush.push(`${BASE_URL}/answer/${f}`);
      });
    }
  } catch (e) {
    console.warn('读取 answer 失败:', e.message);
  }

  // 3. 首次轻量探测推送（3~5 条，探测今天百度给我们的配额）
  console.log(`📊 正在向百度提交今日核心页面 (${urlsToPush.length} 条)...`);
  let result;
  try {
    result = await pushBatch(urlsToPush);
  } catch (error) {
    console.error('❌ 百度 API 请求异常:', error);
    return;
  }

  console.log('\n--- 🎯 百度主动推送响应结果 ---');
  if (!result.success) {
    console.log('⚠️ 百度返回状态:', result);
    return;
  }

  console.log(`✅ 核心页面推送成功！本次成功推送: ${result.success} 条`);
  console.log(`📈 今日剩余可用配额: ${result.remain} 条`);

  // 4. 如果还有剩余额度，按游标顺序向后截取全新成语详情页
  const availableQuota = result.remain || 0;
  if (availableQuota > 0 && totalIdioms > 0) {
    const batchSize = Math.min(availableQuota, 200); // 每次最多推 200 条，避免超时
    const cursor = state.idiomCursor % totalIdioms;
    
    let nextIdioms = [];
    if (cursor + batchSize <= totalIdioms) {
      nextIdioms = allIdioms.slice(cursor, cursor + batchSize);
    } else {
      // 跨越数组末尾，循环回到头部
      nextIdioms = allIdioms.slice(cursor).concat(allIdioms.slice(0, batchSize - (totalIdioms - cursor)));
    }

    const idiomUrls = nextIdioms.map(slug => `${BASE_URL}/idiom/${slug}`);
    console.log(`\n⏳ 正在利用今日剩余配额，推送成语 [第 ${cursor + 1} ~ ${cursor + nextIdioms.length} 个] 共 ${nextIdioms.length} 条...`);

    try {
      const secondResult = await pushBatch(idiomUrls);
      if (secondResult.success) {
        console.log(`✅ 成语批次推送成功！成功条数: ${secondResult.success}，剩余配额: ${secondResult.remain}`);
        
        // 推进游标并记录历史
        state.idiomCursor = (cursor + secondResult.success) % totalIdioms;
        state.totalIdiomsPushed = (state.totalIdiomsPushed || 0) + secondResult.success;
        state.lastPushDate = new Date().toISOString().split('T')[0];
        
        saveState(state);
      } else {
        console.log('⚠️ 成语批次推送返回:', secondResult);
      }
    } catch (e) {
      console.error('❌ 成语批次推送失败:', e.message);
    }
  } else {
    state.lastPushDate = new Date().toISOString().split('T')[0];
    saveState(state);
  }
}

main();
