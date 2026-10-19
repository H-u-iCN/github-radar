// 列出「还没有中文概括」的项目，输出编号清单，供人工/模型补写
// 用法：node scripts/pending-summaries.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'latest.json'), 'utf8'));

const missing = data.projects.filter((p) => !p.descZh);
const idx = {};
const lines = [];
missing.forEach((p, i) => {
  idx[i] = p.fullName;
  const desc = (p.desc || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  lines.push(`${i}\t${p.name}\t${desc}`);
});

await fs.writeFile(path.join(ROOT, 'data', '_pending-index.json'), JSON.stringify(idx), 'utf8');
await fs.writeFile(path.join(ROOT, 'data', '_pending.txt'), lines.join('\n'), 'utf8');
console.log(`待补中文概括：${missing.length} 条（共 ${data.projects.length} 个，已有 ${data.projects.length - missing.length}）`);
console.log('清单已写入 data/_pending.txt');
