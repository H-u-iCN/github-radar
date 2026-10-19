// 检查历史索引里每个仓库的活跃度（最后提交时间）
// 数据源：github.com/{owner}/{repo}/commits.atom（不占 API 配额，返回最新提交时间）
// 用法：node scripts/check-activity.mjs [--limit=100] [--refresh]
// 输出：data/legacy/activity.json（增量保存，中断可续跑）

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LEGACY = path.join(ROOT, 'data', 'legacy', 'githubdaily.json');
const OUT = path.join(ROOT, 'data', 'legacy', 'activity.json');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const LIMIT = Number(args.limit || 0);
const REFRESH = Boolean(args.refresh);
const CONCURRENCY = Number(args.concurrency || 3);
const UA = 'Mozilla/5.0 (compatible; gh-radar/1.0)';

const legacy = JSON.parse(await fs.readFile(LEGACY, 'utf8'));
let cache = {};
try {
  cache = JSON.parse(await fs.readFile(OUT, 'utf8'));
} catch {
  cache = {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = Date.now();
const DAY = 86400000;

function classify(lastCommitAt) {
  if (!lastCommitAt) return { status: 'unknown', daysSince: null };
  const days = Math.floor((now - new Date(lastCommitAt).getTime()) / DAY);
  if (days <= 90) return { status: 'active', daysSince: days };
  if (days <= 365) return { status: 'slowing', daysSince: days };
  return { status: 'stopped', daysSince: days };
}

async function fetchAtom(repo, attempt = 1) {
  const url = `https://github.com/${repo}/commits.atom`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (res.status === 429 || res.status === 403) {
      if (attempt > 3) return { httpStatus: res.status, lastCommitAt: null };
      await sleep(20000 * attempt);
      return fetchAtom(repo, attempt + 1);
    }
    if (!res.ok) return { httpStatus: res.status, lastCommitAt: null };
    const text = await res.text();
    const m = text.match(/<updated>([^<]+)<\/updated>/);
    return { httpStatus: res.status, lastCommitAt: m ? m[1] : null };
  } catch (e) {
    if (attempt > 3) return { httpStatus: 0, lastCommitAt: null, error: e.message };
    await sleep(1500 * attempt);
    return fetchAtom(repo, attempt + 1);
  }
}

const todo = legacy.items
  .filter((it) => REFRESH || !cache[it.repo.toLowerCase()])
  .slice(0, LIMIT || undefined);

console.log(`待检查 ${todo.length} 个（已完成 ${Object.keys(cache).length}，共 ${legacy.items.length}）`);
let done = 0;
let failed = 0;

const queue = [...todo];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const item = queue.shift();
    const key = item.repo.toLowerCase();
    const res = await fetchAtom(item.repo);
    const { status, daysSince } = classify(res.lastCommitAt);
    cache[key] = {
      repo: item.repo,
      lastCommitAt: res.lastCommitAt,
      status,
      daysSince,
      httpStatus: res.httpStatus,
      checkedAt: new Date().toISOString(),
    };
    done += 1;
    if (!res.lastCommitAt) failed += 1;
    if (done % 50 === 0) {
      await fs.writeFile(OUT, JSON.stringify(cache), 'utf8');
      console.log(`  进度 ${done}/${todo.length}（失败 ${failed}）`);
    }
    await sleep(120);
  }
});

await Promise.all(workers);
await fs.writeFile(OUT, JSON.stringify(cache), 'utf8');

const stats = { active: 0, slowing: 0, stopped: 0, unknown: 0 };
for (const v of Object.values(cache)) stats[v.status] = (stats[v.status] || 0) + 1;
console.log('\n=== 检查完成 ===');
console.log(`活跃(90天内): ${stats.active} · 放缓(90-365天): ${stats.slowing} · 停止(1年以上): ${stats.stopped} · 未知: ${stats.unknown}`);
console.log(`输出：${path.relative(ROOT, OUT)}`);
