// 给历史索引里的项目补中文概括（调用 OpenAI 兼容接口，如 DeepSeek / Kimi / 通义）
// 用法：
//   $env:OPENAI_API_KEY="sk-..."
//   $env:OPENAI_BASE_URL="https://api.deepseek.com/v1"   # 可省略，默认 DeepSeek
//   $env:OPENAI_MODEL="deepseek-chat"                    # 可省略
//   node scripts/summarize-legacy.mjs [--limit=50] [--dry]
//
// 说明：只把仓库名 + 分类 + README 开头片段发给模型，生成的总结写进 data/legacy/summary-zh.json。
// 不保存 README 原文，避免把别人的文档复制进仓库。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LEGACY = path.join(ROOT, 'data', 'legacy', 'githubdaily.json');
const ACTIVITY = path.join(ROOT, 'data', 'legacy', 'activity.json');
const OUT = path.join(ROOT, 'data', 'legacy', 'summary-zh.json');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const LIMIT = Number(args.limit || 0);
const DRY = Boolean(args.dry);
const CONCURRENCY = Number(args.concurrency || 2);

const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
const MODEL = process.env.OPENAI_MODEL || 'deepseek-chat';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (compatible; gh-radar/1.0)';

const legacy = JSON.parse(await fs.readFile(LEGACY, 'utf8'));
let activity = {};
try {
  activity = JSON.parse(await fs.readFile(ACTIVITY, 'utf8'));
} catch {
  activity = {};
}
let store = {};
try {
  store = JSON.parse(await fs.readFile(OUT, 'utf8'));
} catch {
  store = {};
}

async function fetchReadmeHead(repo) {
  for (const name of ['README.md', 'README.rst', 'readme.md']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`, {
        headers: { 'User-Agent': UA, Range: 'bytes=0-1400' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 200 || res.status === 206) {
        const text = await res.text();
        return text
          .replace(/<[^>]+>/g, ' ')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[#>*_`|-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500);
      }
    } catch {
      // 换下一个文件名
    }
  }
  return '';
}

async function summarize(repo, category, snippet) {
  const body = {
    model: MODEL,
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content:
          '你是中文技术编辑。根据仓库名、分类和 README 片段，写一句中文概括：说明它是什么、能用来做什么。' +
          '要求：不超过 40 个汉字；口语化、别用翻译腔；不要写「该项目」「本文」「这款工具」开头；不要编造片段里没有的能力；直接输出概括本身，不要解释。',
      },
      {
        role: 'user',
        content: `仓库：${repo}\n分类：${category}\nREADME 片段：${snippet || '（无）'}`,
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || '')
    .trim()
    .replace(/^["'「]|["'」]$/g, '')
    .split('\n')[0]
    .slice(0, 60);
}

const pending = legacy.items
  .filter((it) => !store[it.repo.toLowerCase()])
  .map((it) => ({
    ...it,
    lastCommitAt: activity[it.repo.toLowerCase()]?.lastCommitAt || null,
    status: activity[it.repo.toLowerCase()]?.status || 'unknown',
  }))
  .slice(0, LIMIT || undefined);

if (!DRY && !API_KEY) {
  console.error('缺少 OPENAI_API_KEY，无法调用模型。先设置环境变量，或加 --dry 只看输入样例。');
  process.exit(1);
}

console.log(`待补中文：${pending.length} 条（已有 ${Object.keys(store).length} / 共 ${legacy.items.length}）`);
if (DRY) {
  for (const it of pending.slice(0, 3)) {
    const snippet = await fetchReadmeHead(it.repo);
    console.log(`\n--- ${it.repo} [${it.category}] ${it.status} ---\nREADME: ${snippet.slice(0, 200)}`);
  }
  process.exit(0);
}

let done = 0;
let failed = 0;
const queue = [...pending];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const it = queue.shift();
    const key = it.repo.toLowerCase();
    try {
      const snippet = await fetchReadmeHead(it.repo);
      const zh = await summarize(it.repo, it.category, snippet);
      if (zh && zh.length >= 2) {
        store[key] = zh;
        done += 1;
      } else {
        failed += 1;
      }
    } catch (e) {
      failed += 1;
      if (failed % 20 === 0) console.warn(`  失败累计 ${failed}：${e.message}`);
      await sleep(1500);
    }
    if (done % 20 === 0 && done > 0) {
      await fs.writeFile(OUT, JSON.stringify(store, null, 2) + '\n', 'utf8');
      console.log(`  进度 ${done}/${pending.length}（失败 ${failed}）`);
    }
    await sleep(200);
  }
});
await Promise.all(workers);
await fs.writeFile(OUT, JSON.stringify(store, null, 2) + '\n', 'utf8');
console.log(`\n完成：新增 ${done} 条，失败 ${failed} 条，累计 ${Object.keys(store).length} 条`);
