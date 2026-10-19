// 导入 GitHubDaily/GitHubDaily 的历史项目索引
// 只提取「项目名 + 原始链接 + 年份 + 分类」，不复制对方的任何文案。
// 用法：node scripts/import-githubdaily.mjs
// 输出：data/legacy/githubdaily.json

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_DIR = path.join(ROOT, 'data', 'legacy');
const OUT_FILE = path.join(OUT_DIR, 'githubdaily.json');

const REPO = 'GitHubDaily/GitHubDaily';
const BRANCH = 'master';
const FILES = ['README.md', '2018.md', '2019.md', '2020.md', '2021.md', '2022.md', '2023.md', '2024.md'];
const RESERVED_OWNERS = new Set(['sponsors', 'orgs', 'topics', 'collections', 'marketplace', 'apps', 'features', 'login', 'settings']);
const URL_RE = /\[([^\]]*)\]\((https?:\/\/github\.com\/([^/\s()]+)\/([^/\s()#?]+)(?:[#?][^)\s]*)?)\)/g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'gh-radar/1.0' },
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (attempt >= 3) throw e;
    await sleep(1200 * attempt);
    return fetchText(url, attempt + 1);
  }
}

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00A0]/g;

function cleanName(text, repo) {
  const t = String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(ZERO_WIDTH, '')
    .trim();
  return t || repo;
}

function cleanRepoPart(value) {
  return String(value || '').replace(ZERO_WIDTH, '').trim();
}

function parseFile(text, file) {
  const year = file === 'README.md' ? '2025' : file.slice(0, 4);
  const items = [];
  let category = '';
  let skipped = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const heading = rawLine.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      category = heading[1].trim();
      continue;
    }
    const line = rawLine.trim();
    if (!line) continue;

    URL_RE.lastIndex = 0;
    let match;
    while ((match = URL_RE.exec(line)) !== null) {
      const [, label, url, owner, repoRaw] = match;
      const cleanOwner = cleanRepoPart(owner);
      const repo = cleanRepoPart(repoRaw).replace(/\.git$/, '');
      if (!cleanOwner || !repo) continue;
      if (RESERVED_OWNERS.has(cleanOwner.toLowerCase())) {
        skipped += 1;
        continue;
      }
      if (repo.toLowerCase() === 'githubdaily') {
        skipped += 1;
        continue;
      }
      items.push({
        name: cleanName(label, repo),
        repo: `${cleanOwner}/${repo}`,
        url: `https://github.com/${cleanOwner}/${repo}`,
        year,
        category: category || '未分类',
      });
      break; // 一行只取第一个仓库链接
    }
  }
  return { items, skipped };
}

async function main() {
  console.log(`抓取 ${REPO} 的年度复盘文件…`);
  const all = [];
  const perFile = [];
  for (const file of FILES) {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file}`;
    try {
      const text = await fetchText(url);
      const { items, skipped } = parseFile(text, file);
      perFile.push({ file, items: items.length, skipped });
      console.log(`  ${file.padEnd(10)} ${String(items.length).padStart(4)} 条（跳过 ${skipped}）`);
      all.push(...items);
    } catch (e) {
      console.warn(`  ${file} 抓取失败：${e.message}`);
    }
    await sleep(300);
  }

  // 去重：同一仓库只保留最早出现的一次，记录它出现过的年份和分类
  const map = new Map();
  for (const item of all) {
    const key = item.repo.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item, years: [item.year], categories: [item.category] });
      continue;
    }
    if (!prev.years.includes(item.year)) prev.years.push(item.year);
    if (item.category && !prev.categories.includes(item.category)) prev.categories.push(item.category);
    if (Number(item.year) < Number(prev.year)) {
      prev.year = item.year;
      prev.name = item.name;
      prev.url = item.url;
    }
  }

  const items = [...map.values()]
    .map((it) => ({
      name: it.name,
      repo: it.repo,
      url: it.url,
      year: it.year,
      years: it.years.sort(),
      category: it.category,
      categories: it.categories,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year) || a.repo.localeCompare(b.repo));

  const byYear = {};
  const byCategory = {};
  for (const it of items) {
    byYear[it.year] = (byYear[it.year] || 0) + 1;
    for (const c of it.categories) byCategory[c] = (byCategory[c] || 0) + 1;
  }

  const payload = {
    source: REPO,
    sourceUrl: `https://github.com/${REPO}`,
    note: '仅索引项目名称与原始链接，未复制对方文案。原仓库无 LICENSE，此处仅作链接引用。',
    fetchedAt: new Date().toISOString(),
    total: items.length,
    rawEntries: all.length,
    byYear,
    byCategory,
    perFile,
    items,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await fs.writeFile(
    path.join(OUT_DIR, 'githubdaily.js'),
    `window.GH_LEGACY=${JSON.stringify(payload)};\n`,
    'utf8',
  );

  console.log(`\n去重后：${items.length} 个项目（原始 ${all.length} 条）`);
  console.log(`按年份：${Object.entries(byYear).map(([y, n]) => `${y} ${n}`).join(' · ')}`);
  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`热门分类：${topCats.map(([c, n]) => `${c} ${n}`).join(' · ')}`);
  console.log(`输出：${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((e) => {
  console.error('导入失败：', e);
  process.exitCode = 1;
});
