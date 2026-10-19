#!/usr/bin/env node
// GitHub 热门项目采集器
// 用法：
//   node scripts/collect.mjs                 # 正常采集
//   node scripts/collect.mjs --skip-trending # 不抓网页 trending
//   node scripts/collect.mjs --max=300       # 限制最终条目数
// 可选：设置环境变量 GITHUB_TOKEN 提高 API 配额（6000 次/小时，否则 10 次/分钟搜索配额）

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.mjs';
import { classify, CATEGORIES } from './classify.mjs';
import { fetchTrending } from './trending.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const MAX_PROJECTS = Number(args.max || CONFIG.maxProjects);
const SKIP_TRENDING = Boolean(args['skip-trending']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const dayStr = (d) => new Date(d).toISOString().slice(0, 10);
const shiftDay = (iso, days) => dayStr(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000);

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gh-radar/1.0',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

let lastSearchAt = 0;

async function ghJson(url, { search = false } = {}) {
  if (search) {
    const wait = lastSearchAt + CONFIG.searchDelayMs - Date.now();
    if (wait > 0) await sleep(wait);
  }
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(40000) });
    } catch (e) {
      const code = e?.cause?.code || e?.code || '';
      if (/CERT|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) {
        throw new Error(
          `TLS 证书校验失败（${code}）。这台机器可能装了抓包/代理的根证书，Node 默认只信自带的 CA 库。\n` +
            '请改用：\n  npm run collect\n或：\n  node --use-system-ca scripts/collect.mjs',
        );
      }
      lastErr = e;
      await sleep(1500 * attempt);
      continue;
    }
    if (search) lastSearchAt = Date.now();

    if (res.ok) return res.json();

    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
      const retryAfter = Number(res.headers.get('retry-after') || 0) * 1000;
      const waitMs = Math.min(
        Math.max(retryAfter, reset - Date.now(), 5000 * attempt),
        120000,
      );
      console.warn(`    配额受限（HTTP ${res.status}），等待 ${Math.round(waitMs / 1000)}s 后重试…`);
      await sleep(waitMs);
      lastErr = new Error(`HTTP ${res.status}`);
      continue;
    }

    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} ${res.statusText} ${url}\n${body.slice(0, 300)}`);
  }
  throw lastErr || new Error(`请求失败：${url}`);
}

function normalize(item) {
  return {
    fullName: item.full_name,
    name: item.name,
    owner: item.owner?.login || item.full_name.split('/')[0],
    url: item.html_url,
    desc: clean(item.description),
    descZh: '',
    homepage: clean(item.homepage),
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    openIssues: item.open_issues_count || 0,
    language: item.language || '',
    topics: (item.topics || []).slice(0, 20),
    license: item.license?.spdx_id || '',
    createdAt: item.created_at,
    pushedAt: item.pushed_at,
    archived: Boolean(item.archived),
    fork: Boolean(item.fork),
    hints: [],
  };
}

async function loadHistory() {
  const dir = path.join(ROOT, CONFIG.historyDir);
  const map = new Map();
  try {
    const files = (await fs.readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    for (const f of files) {
      const date = f.slice(0, 10);
      try {
        const j = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
        map.set(date, j.stars || {});
      } catch {
        // 坏文件跳过
      }
    }
  } catch {
    // 目录不存在：第一次运行
  }
  return map;
}

async function loadJson(relPath) {
  try {
    const raw = await fs.readFile(path.join(ROOT, relPath), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n=== GitHub 热门项目采集开始（${today}）===`);
  console.log(`Token: ${TOKEN ? '已配置（配额更宽松）' : '未配置（搜索 10 次/分钟，自动限速）'}`);

  // 1. 搜索采集（--reuse：仅复用上次数据重算分类，不请求 GitHub，方便调分类规则）
  const repoMap = new Map();
  let reusedSource = null;
  if (args.reuse) {
    const prev = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'latest.json'), 'utf8'));
    for (const p of prev.projects || []) {
      if (p.trendingRank >= 999) delete p.trendingRank;
      repoMap.set(p.fullName.toLowerCase(), { ...p, hints: [] });
    }
    CONFIG.collections = [];
    CONFIG.trending.enabled = false;
    reusedSource = prev.meta?.source || null;
    console.log(`复用上次采集结果：${repoMap.size} 个项目（不请求 GitHub）`);
  }
  for (const c of CONFIG.collections) {
    for (let p = 1; p <= (c.pages || 1); p++) {
      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.set('q', c.q);
      url.searchParams.set('sort', c.sort || 'stars');
      url.searchParams.set('order', 'desc');
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(p));
      try {
        const data = await ghJson(url, { search: true });
        let added = 0;
        for (const item of data.items || []) {
          if (!item.full_name) continue;
          const repo = normalize(item);
          const key = repo.fullName.toLowerCase();
          const prev = repoMap.get(key);
          if (prev) {
            if (c.hint && !prev.hints.includes(c.hint)) prev.hints.push(c.hint);
            prev.stars = Math.max(prev.stars, repo.stars);
          } else {
            if (c.hint) repo.hints.push(c.hint);
            repoMap.set(key, repo);
            added += 1;
          }
        }
        console.log(`  [${c.id}] 第 ${p} 页：${(data.items || []).length} 条，新增 ${added}（累计 ${repoMap.size}）`);
      } catch (e) {
        console.warn(`  [${c.id}] 第 ${p} 页失败：${e.message}`);
      }
      if (p < (c.pages || 1)) await sleep(1200);
    }
  }

  // 2. Trending 网页
  let trending = new Map();
  if (CONFIG.trending.enabled && !SKIP_TRENDING) {
    console.log('抓取 GitHub Trending 网页…');
    trending = await fetchTrending(CONFIG.trending);
  }

  // 3. trending 里没被搜索到的项目，补一次详情（数量有限）
  const missing = [...trending.keys()].filter((k) => !repoMap.has(k)).slice(0, 20);
  for (const key of missing) {
    try {
      const item = await ghJson(`https://api.github.com/repos/${key}`);
      repoMap.set(key, normalize(item));
    } catch {
      // 单个失败不影响整体
    }
    await sleep(300);
  }

  // 4. 合并 trending 指标
  for (const [key, t] of trending) {
    const repo = repoMap.get(key);
    if (!repo) continue;
    if (t.rank && t.rank < 999) {
      repo.trendingRank = t.rank;
      repo.trendingDailyStars = t.daily;
    }
    if (t.weekly) repo.trendingWeeklyStars = t.weekly;
    if (!repo.desc && t.desc) repo.desc = t.desc;
  }

  // 5. 过滤
  let projects = [...repoMap.values()].filter(
    (r) => !r.archived && !r.fork && r.stars >= CONFIG.minStars,
  );

  // 6. 分类
  for (const p of projects) {
    const { categories, primary } = classify(p, p.hints[0]);
    p.categories = categories;
    p.primaryCategory = primary;
    delete p.hints;
  }

  // 7. 历史增量
  const history = await loadHistory();
  const pastDates = [...history.keys()].filter((d) => d < today).sort();
  const prevDate = pastDates.at(-1) || null;
  const weekTarget = shiftDay(today, -7);
  const weekDate = pastDates.filter((d) => d <= weekTarget).at(-1) || null;

  for (const p of projects) {
    const key = p.fullName.toLowerCase();
    let firstSeen = today;
    for (const d of [...history.keys()].sort()) {
      if (history.get(d)?.[key] != null) {
        firstSeen = d;
        break;
      }
    }
    p.firstSeen = firstSeen;
    p.delta1d = prevDate && history.get(prevDate)?.[key] != null
      ? p.stars - history.get(prevDate)[key]
      : null;
    p.delta7d = weekDate && history.get(weekDate)?.[key] != null
      ? p.stars - history.get(weekDate)[key]
      : null;
    if (p.delta1d === 0) p.delta1d = null;
    if (p.delta7d === 0) p.delta7d = null;
  }

  // 8. 排序 + 截断：trending 优先，其次周增速，其次 Star（用对数，避免几十万星的项目彻底压死榜单）
  const rank = (p) =>
    (p.trendingRank ? 1e6 - p.trendingRank * 1000 : 0) +
    (p.delta7d || 0) +
    Math.log10((p.stars || 0) + 10) * 100;
  projects.sort((a, b) => rank(b) - rank(a));
  const totalBefore = projects.length;
  if (projects.length > MAX_PROJECTS) projects = projects.slice(0, MAX_PROJECTS);

  // 9. 中文概括：人工 notes.json 优先，其次 summary-zh.json，最后自动翻译缓存 summary-zh-auto.json
  const notes = await loadJson('data/notes.json');
  const zhMain = await loadJson('data/summary-zh.json');
  const zhAuto = await loadJson('data/summary-zh-auto.json');
  const pick = (obj, key) => {
    if (!obj) return undefined;
    return obj[key] ?? obj[key.toLowerCase()];
  };
  for (const p of projects) {
    const manual = pick(notes, p.fullName);
    if (manual) {
      const note = manual;
      if (typeof note === 'string') p.descZh = note;
      else {
        p.descZh = note.zh || '';
        if (note.tag) p.noteTag = note.tag;
      }
      p.zhSource = 'manual';
      continue;
    }
    const zh = pick(zhMain, p.fullName) || pick(zhAuto, p.fullName);
    if (zh) {
      p.descZh = typeof zh === 'string' ? zh : zh.zh || '';
      p.zhSource = pick(zhMain, p.fullName) ? 'curated' : 'auto';
    }
  }
  const zhCount = projects.filter((p) => p.descZh).length;

  // 10. 汇总
  const countBy = (field, list) => {
    const m = new Map();
    for (const p of list) {
      const v = p[field];
      if (!v) continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const catCount = new Map();
  for (const p of projects) for (const c of p.categories) catCount.set(c, (catCount.get(c) || 0) + 1);

  const categories = CATEGORIES.map((c) => ({
    ...c,
    count: catCount.get(c.id) || 0,
  })).filter((c) => c.count > 0);

  const languages = countBy('language', projects)
    .filter(([l]) => l && !CONFIG.ignoreLanguages.includes(l))
    .slice(0, 16)
    .map(([name, count]) => ({ name, count }));

  const trendingKeys = new Set([...trending.keys()]);
  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedAtLocal: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      source: reusedSource || ('GitHub Search API' + (trending.size ? ' + Trending' : '')),
      total: projects.length,
      collected: totalBefore,
      trendingCount: projects.filter((p) => p.trendingRank).length,
      zhCount,
      hasToken: Boolean(TOKEN),
      prevSnapshot: prevDate,
      weekSnapshot: weekDate,
      durationMs: Date.now() - started,
    },
    categories,
    languages,
    projects,
  };

  // 11. 落盘
  const dataDir = path.join(ROOT, CONFIG.dataDir);
  const historyDir = path.join(ROOT, CONFIG.historyDir);
  await fs.mkdir(historyDir, { recursive: true });

  // 11.1 历史归档：每天保存当日热门前 80 条，供站点「往期回顾」使用
  const archiveDir = path.join(dataDir, 'archive');
  await fs.mkdir(archiveDir, { recursive: true });
  const topDaily = projects.slice(0, 80).map((p) => ({
    f: p.fullName,
    n: p.name,
    u: p.url,
    s: p.stars,
    z: p.descZh || p.desc || '',
    c: p.primaryCategory,
    r: p.trendingRank || 0,
  }));
  await fs.writeFile(
    path.join(archiveDir, `${today}.js`),
    `window.GH_ARCHIVE=window.GH_ARCHIVE||{};window.GH_ARCHIVE['${today}']=${JSON.stringify({ date: today, items: topDaily })};\n`,
    'utf8',
  );
  const archiveFiles = (await fs.readdir(archiveDir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.js$/.test(f))
    .sort()
    .reverse();
  await fs.writeFile(
    path.join(archiveDir, 'index.js'),
    `window.GH_ARCHIVE_DATES=${JSON.stringify(archiveFiles.map((f) => f.slice(0, 10)))};\n`,
    'utf8',
  );
  // 归档保留一年
  const archiveCutoff = shiftDay(today, -365);
  for (const f of archiveFiles) {
    if (f.slice(0, 10) < archiveCutoff) await fs.unlink(path.join(archiveDir, f));
  }
  payload.meta.archiveDays = archiveFiles.length;

  const json = JSON.stringify(payload);
  await fs.writeFile(path.join(dataDir, 'latest.json'), json, 'utf8');
  await fs.writeFile(
    path.join(dataDir, 'latest.js'),
    `window.GH_DATA = ${json.replace(/</g, '\\u003c')};\n`,
    'utf8',
  );
  const stars = {};
  for (const p of projects) stars[p.fullName.toLowerCase()] = p.stars;
  await fs.writeFile(
    path.join(historyDir, `${today}.json`),
    JSON.stringify({ date: today, total: projects.length, stars }),
    'utf8',
  );

  // 清理过期历史
  const cutoff = shiftDay(today, -CONFIG.historyKeepDays);
  for (const f of await fs.readdir(historyDir)) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < cutoff) {
      await fs.unlink(path.join(historyDir, f));
    }
  }

  // 12. 控制台汇总
  console.log('\n=== 采集完成 ===');
  console.log(`项目数：${projects.length}（去重前 ${totalBefore}）`);
  console.log(`分类分布：${categories.map((c) => `${c.name} ${c.count}`).join(' · ')}`);
  console.log('今日 trending 前 10：');
  for (const p of projects.filter((x) => x.trendingRank).sort((a, b) => a.trendingRank - b.trendingRank).slice(0, 10)) {
    console.log(`  #${p.trendingRank} ${p.fullName}  ★${p.stars}  +${p.trendingDailyStars}/天`);
  }
  if (!prevDate) console.log('\n提示：首次运行没有历史快照，日/周涨幅要等下一次运行才有数据。');
  console.log(`耗时 ${((Date.now() - started) / 1000).toFixed(1)}s，输出目录：${dataDir}`);
}

main().catch((e) => {
  console.error('\n采集失败：', e);
  process.exitCode = 1;
});
