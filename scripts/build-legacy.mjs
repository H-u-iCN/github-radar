// 合并历史索引 + 活跃度 + 中文概括，生成站点用的 data/legacy/legacy.js
// 用法：node scripts/build-legacy.mjs（在 check-activity 之后跑）

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = async (rel, fallback) => {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf8'));
  } catch {
    return fallback;
  }
};

const legacy = await readJson('data/legacy/githubdaily.json', { items: [] });
const activity = await readJson('data/legacy/activity.json', {});
const summaries = await readJson('data/legacy/summary-zh.json', {});
const siteSummaries = await readJson('data/summary-zh.json', {});
const notes = await readJson('data/notes.json', {});

const pickLoose = (obj, key) => {
  if (!obj) return '';
  const hit = obj[key] || obj[key.toLowerCase()];
  if (!hit) return '';
  return typeof hit === 'string' ? hit : hit.zh || '';
};

const STATUS_LABEL = {
  active: '仍在更新',
  slowing: '更新放缓',
  stopped: '已停更',
  unknown: '状态未知',
};

const items = legacy.items.map((it) => {
  const key = it.repo.toLowerCase();
  const a = activity[key] || {};
  const zh = summaries[key] || pickLoose(siteSummaries, it.repo) || pickLoose(notes, it.repo);
  return {
    n: it.name,
    r: it.repo,
    u: it.url,
    y: it.year,
    c: it.category,
    s: a.status || 'unknown',
    l: a.lastCommitAt ? String(a.lastCommitAt).slice(0, 10) : null,
    z: zh,
  };
});

const stats = { active: 0, slowing: 0, stopped: 0, unknown: 0 };
const byYear = {};
const byCategory = {};
for (const it of items) {
  stats[it.s] = (stats[it.s] || 0) + 1;
  byYear[it.y] = (byYear[it.y] || 0) + 1;
  byCategory[it.c] = (byCategory[it.c] || 0) + 1;
}

const payload = {
  source: legacy.source,
  sourceUrl: legacy.sourceUrl,
  note: '仅索引项目名称与原始链接，未复制对方文案。活跃度来自 GitHub 最新提交时间。',
  generatedAt: new Date().toISOString(),
  total: items.length,
  stats,
  statusLabel: STATUS_LABEL,
  byYear,
  byCategory,
  items,
};

await fs.mkdir(path.join(ROOT, 'data', 'legacy'), { recursive: true });
await fs.writeFile(
  path.join(ROOT, 'data', 'legacy', 'legacy.js'),
  `window.GH_LEGACY=${JSON.stringify(payload)};\n`,
  'utf8',
);

console.log(`历史索引已生成：${items.length} 条`);
console.log(`  仍在更新 ${stats.active} · 更新放缓 ${stats.slowing} · 已停更 ${stats.stopped} · 未知 ${stats.unknown}`);
console.log(`  已有中文概括：${items.filter((i) => i.z).length} 条`);
console.log('输出：data/legacy/legacy.js');
