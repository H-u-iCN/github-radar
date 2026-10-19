// 批量抓取历史项目 README 片段，切成小批次供并行写中文概括
// 用法：node scripts/fetch-snippets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LEG = path.join(ROOT, 'data', 'legacy');
const OUT = path.join(LEG, 'snippets');

const legacy = JSON.parse(await fs.readFile(path.join(LEG, 'githubdaily.json'), 'utf8'));
const activity = JSON.parse(await fs.readFile(path.join(LEG, 'activity.json'), 'utf8'));
const done = {};
for (const f of ['summary-zh.json', 'summary-zh-auto.json']) {
  try {
    Object.assign(done, JSON.parse(await fs.readFile(path.join(LEG, f), 'utf8')));
  } catch {
    /* 忽略 */
  }
}
try {
  Object.assign(done, JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'summary-zh.json'), 'utf8')));
} catch {
  /* 忽略 */
}

const STATUS_ORDER = { active: 0, slowing: 1, stopped: 2, unknown: 3 };
const CAT_ORDER = ['AI 工具', '实用工具', '开发工具', '学习教程', '资料集合', '媒体工具', '工具'];
const catRank = (c) => {
  const i = CAT_ORDER.indexOf(c);
  return i === -1 ? 50 : i;
};

const pending = legacy.items
  .filter((it) => !done[it.repo.toLowerCase()])
  .map((it) => ({
    ...it,
    status: activity[it.repo.toLowerCase()]?.status || 'unknown',
  }))
  .sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      catRank(a.category) - catRank(b.category) ||
      Number(b.year) - Number(a.year),
  );

const clean = (t) =>
  String(t)
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);

async function readme(repo) {
  for (const name of ['README.md', 'README.rst', 'readme.md']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`, {
        headers: { 'User-Agent': 'gh-radar', Range: 'bytes=0-700' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 200 || res.status === 206) return clean(await res.text());
    } catch {
      /* 下一个文件名 */
    }
  }
  return '';
}

const BATCH = 120;
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const lines = [];
let doneCount = 0;
const queue = [...pending];
async function worker() {
  while (queue.length) {
    const it = queue.shift();
    const snippet = await readme(it.repo);
    lines.push(`${it.repo}\t${it.name}\t${it.category}\t${it.status}\t${snippet}`);
    doneCount += 1;
    if (doneCount % 200 === 0) console.log(`  已抓取 ${doneCount}/${pending.length}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

lines.sort();
let batchNo = 0;
for (let i = 0; i < lines.length; i += BATCH) {
  batchNo += 1;
  const file = path.join(OUT, `batch-${String(batchNo).padStart(3, '0')}.txt`);
  await fs.writeFile(file, lines.slice(i, i + BATCH).join('\n') + '\n', 'utf8');
}

console.log(`\n完成：${lines.length} 条，切成 ${batchNo} 个批次`);
console.log(`输出目录：data/legacy/snippets/`);
