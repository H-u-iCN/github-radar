// 生成可直接部署的静态站点目录 _site/
// 用法：node scripts/build-site.mjs
// 本地：npm run build:site
// 部署：Netlify / Cloudflare Pages / GitHub Pages 都用「构建命令 + 发布目录 _site」

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = path.join(ROOT, '_site');

const raw = await fs.readFile(path.join(ROOT, 'data', 'latest.json'), 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`data/latest.json 不是合法 JSON：${e.message}`);
  process.exit(1);
}

await fs.rm(SITE, { recursive: true, force: true });
await fs.mkdir(path.join(SITE, 'data'), { recursive: true });
await fs.mkdir(path.join(SITE, 'assets'), { recursive: true });

// 页面数据：latest.js 给页面用（file:// 也能读），latest.json 给外部程序用
await fs.writeFile(
  path.join(SITE, 'data', 'latest.js'),
  `window.GH_DATA = ${raw.replace(/</g, '\\u003c')};\n`,
  'utf8',
);
await fs.writeFile(path.join(SITE, 'data', 'latest.json'), raw, 'utf8');

// 入口与静态资源
await fs.copyFile(path.join(ROOT, 'index.html'), path.join(SITE, 'index.html'));
for (const file of await fs.readdir(path.join(ROOT, 'assets'))) {
  await fs.copyFile(path.join(ROOT, 'assets', file), path.join(SITE, 'assets', file));
}

// 往期回顾：每日归档脚本（index.js + YYYY-MM-DD.js）
const archiveDir = path.join(ROOT, 'data', 'archive');
try {
  const archiveFiles = await fs.readdir(archiveDir);
  await fs.mkdir(path.join(SITE, 'data', 'archive'), { recursive: true });
  for (const file of archiveFiles) {
    await fs.copyFile(path.join(archiveDir, file), path.join(SITE, 'data', 'archive', file));
  }
} catch {
  // 还没有归档，第一次采集后才有
}

// 历史索引页（2018–2025）
try {
  await fs.copyFile(path.join(ROOT, 'legacy.html'), path.join(SITE, 'legacy.html'));
  await fs.mkdir(path.join(SITE, 'data', 'legacy'), { recursive: true });
  await fs.copyFile(
    path.join(ROOT, 'data', 'legacy', 'legacy.js'),
    path.join(SITE, 'data', 'legacy', 'legacy.js'),
  );
} catch {
  // 还没生成历史索引
}

// 顺手放一个 robots.txt
await fs.writeFile(path.join(SITE, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');

console.log(`_site 已生成：${data.projects?.length ?? 0} 个项目`);
