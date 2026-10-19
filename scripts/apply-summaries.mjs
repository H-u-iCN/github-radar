// 把 `编号|中文概括` 文本合并进 data/summary-zh.json
// 用法：node scripts/apply-summaries.mjs data/_batch-1.txt data/_batch-2.txt ...
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!files.length) {
  console.error('用法：node scripts/apply-summaries.mjs <batch.txt> ...');
  process.exit(1);
}

const idx = JSON.parse(await fs.readFile(path.join(ROOT, 'data', '_pending-index.json'), 'utf8'));
let store = {};
try {
  store = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'summary-zh.json'), 'utf8'));
} catch {
  store = {};
}

let applied = 0;
const skipped = [];
for (const file of files) {
  const text = await fs.readFile(path.resolve(ROOT, file), 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\d+)\s*[|\t]\s*(.+)$/);
    if (!m) {
      skipped.push(`格式不对：${line.slice(0, 40)}`);
      continue;
    }
    const i = m[1];
    const zh = m[2].trim();
    const fullName = idx[i];
    if (!fullName) {
      skipped.push(`编号不存在：${i}`);
      continue;
    }
    if (zh.length < 2 || zh.length > 80) {
      skipped.push(`长度异常(${zh.length})：${i} ${fullName}`);
      continue;
    }
    store[fullName] = zh;
    applied += 1;
  }
}

const sorted = {};
for (const k of Object.keys(store).sort((a, b) => a.localeCompare(b))) sorted[k] = store[k];
await fs.writeFile(path.join(ROOT, 'data', 'summary-zh.json'), JSON.stringify(sorted, null, 2) + '\n', 'utf8');

console.log(`已合并 ${applied} 条，累计 ${Object.keys(sorted).length} 条中文概括`);
if (skipped.length) {
  console.log(`跳过 ${skipped.length} 条：`);
  skipped.slice(0, 10).forEach((s) => console.log('  - ' + s));
}
