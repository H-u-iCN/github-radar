// 把 data/latest.json 转成 data/latest.js（页面用 <script> 加载，file:// 下也能读）
// 单独抽出来是因为：latest.js 不提交进 Git（每天一份会撑大仓库历史），
// 部署前在 CI 里用最新提交的 latest.json 重新生成即可。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const jsonPath = path.join(ROOT, 'data', 'latest.json');

const raw = await fs.readFile(jsonPath, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`data/latest.json 不是合法 JSON：${e.message}`);
  process.exit(1);
}

await fs.writeFile(
  path.join(ROOT, 'data', 'latest.js'),
  `window.GH_DATA = ${raw.replace(/</g, '\\u003c')};\n`,
  'utf8',
);

console.log(`data/latest.js 已生成（${data.projects?.length ?? 0} 个项目）`);
