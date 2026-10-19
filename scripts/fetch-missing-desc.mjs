// 给「README 片段为空」的剩余条目抓 GitHub 页面 meta 描述（简化版：直接读整页，取 meta）
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LEG = path.join(ROOT, 'data', 'legacy');
const OUT = path.join(LEG, 'snippets2');

const legacy = JSON.parse(await fs.readFile(path.join(LEG, 'githubdaily.json'), 'utf8'));
const activity = JSON.parse(await fs.readFile(path.join(LEG, 'activity.json'), 'utf8'));
const done = JSON.parse(await fs.readFile(path.join(LEG, 'summary-zh.json'), 'utf8'));
let siteZh = {};
try {
  siteZh = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'summary-zh.json'), 'utf8'));
} catch {}
let notes = {};
try {
  notes = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'notes.json'), 'utf8'));
} catch {}

const has = (repo) => {
  const k = repo.toLowerCase();
  return Boolean(done[k] || siteZh[repo] || siteZh[k] || notes[repo] || notes[k]);
};

const pending = legacy.items
  .filter((it) => !has(it.repo))
  .map((it) => ({ ...it, status: activity[it.repo.toLowerCase()]?.status || 'unknown' }));

const clean = (t) =>
  String(t || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);

async function pageDescription(repo) {
  try {
    const res = await fetch(`https://github.com/${repo}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gh-radar/1.0)' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.log(`  ${repo}: HTTP ${res.status}`);
      return '';
    }
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ||
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
    if (!m) return '';
    let desc = clean(m[1]);
    const cut = desc.indexOf('Contribute to');
    if (cut > 0) desc = desc.slice(0, cut).trim();
    return desc;
  } catch (e) {
    console.log(`  ${repo}: ${e.message}`);
    return '';
  }
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const lines = [];
let n = 0;
const queue = [...pending];
async function worker() {
  while (queue.length) {
    const it = queue.shift();
    const desc = await pageDescription(it.repo);
    if (desc) lines.push(`${it.repo}\t${it.name}\t${it.category}\t${it.status}\t${desc}`);
    n += 1;
    if (n % 50 === 0) console.log(`  已处理 ${n}/${pending.length}，拿到描述 ${lines.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}
await Promise.all(Array.from({ length: 3 }, worker));

lines.sort();
let batch = 0;
for (let i = 0; i < lines.length; i += 120) {
  batch += 1;
  await fs.writeFile(
    path.join(OUT, `batch-${String(batch).padStart(2, '0')}.txt`),
    lines.slice(i, i + 120).join('\n') + '\n',
    'utf8',
  );
}
console.log(`\n完成：待补 ${pending.length}，拿到描述 ${lines.length}，切成 ${batch} 批`);
