// 合并子任务产出的 _auto-*.txt 到 summary-zh.json，并做完整性校验
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LEG = path.join(ROOT, 'data', 'legacy');

const legacy = JSON.parse(await fs.readFile(path.join(LEG, 'githubdaily.json'), 'utf8'));
const known = new Set(legacy.items.map((i) => i.repo.toLowerCase()));

let store = {};
try {
  store = JSON.parse(await fs.readFile(path.join(LEG, 'summary-zh.json'), 'utf8'));
} catch {
  store = {};
}

const files = (await fs.readdir(LEG)).filter((f) => /^_auto-\d+\.txt$/.test(f)).sort();
let added = 0;
let skipped = 0;
let unknown = 0;

for (const file of files) {
  const text = await fs.readFile(path.join(LEG, file), 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let ok = 0;
  let info = 0;
  for (const line of lines) {
    const idx = line.indexOf('|');
    if (idx < 0) continue;
    const repo = line.slice(0, idx).trim().toLowerCase();
    const zh = line.slice(idx + 1).trim();
    if (!repo || !zh) continue;
    if (!known.has(repo)) {
      unknown += 1;
      continue;
    }
    if (zh.includes('简介信息不足')) {
      info += 1;
      continue;
    }
    store[repo] = zh;
    ok += 1;
  }
  added += ok;
  skipped += info;
  console.log(`${file}: 有效 ${ok} · 信息不足跳过 ${info} · 行数 ${lines.length}`);
}

await fs.writeFile(path.join(LEG, 'summary-zh.json'), JSON.stringify(store, null, 2) + '\n', 'utf8');
console.log(`\n合并完成：本轮新增 ${added}，累计 ${Object.keys(store).length} 条中文概括（未知仓库 ${unknown}）`);
