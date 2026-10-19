// GitHub 没有 trending API，只能解析网页。解析失败不报错，只是少一个"今日/本周涨幅"字段。

const UA = 'Mozilla/5.0 (compatible; gh-radar/1.0; +https://github.com)';

function stripTags(s = '') {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(html, period) {
  const out = new Map();
  const chunks = html.split('<article class="Box-row">').slice(1);
  let rank = 0;
  for (const chunk of chunks) {
    const h2 = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2) continue;
    const link = h2[1].match(/href="\/([^"/]+)\/([^"/]+)"/);
    if (!link) continue;
    const owner = link[1];
    const name = link[2].replace(/[?#].*$/, '');
    if (!owner || !name) continue;

    const starsMatch = chunk.match(/([\d,]+)\s+stars\s+(today|this week|this month)/i);
    const langMatch = chunk.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</);
    const descMatch = chunk.match(/<p class="col-9 color-fg-muted my-1 pr-4">([\s\S]*?)<\/p>/);

    rank += 1;
    out.set(`${owner}/${name}`.toLowerCase(), {
      rank,
      starsInPeriod: starsMatch ? Number(starsMatch[1].replace(/,/g, '')) : 0,
      period,
      language: langMatch ? langMatch[1].trim() : null,
      desc: descMatch ? stripTags(descMatch[1]) : null,
    });
  }
  return out;
}

export async function fetchTrending(cfg) {
  const merged = new Map();
  for (const url of cfg.urls) {
    const period = /since=weekly/.test(url) ? 'weekly' : 'daily';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const page = parsePage(html, period);
      for (const [key, val] of page) {
        const cur = merged.get(key) || { fullName: key, rank: 999, daily: 0, weekly: 0, language: null, desc: null };
        if (period === 'daily') {
          cur.rank = Math.min(cur.rank, val.rank);
          cur.daily = Math.max(cur.daily, val.starsInPeriod);
        } else {
          cur.weekly = Math.max(cur.weekly, val.starsInPeriod);
        }
        cur.language = cur.language || val.language;
        cur.desc = cur.desc || val.desc;
        merged.set(key, cur);
      }
      console.log(`  [trending] ${url} → ${page.size} 条`);
    } catch (e) {
      console.warn(`  [trending] ${url} 抓取失败：${e.message}（跳过，不影响主流程）`);
    }
  }
  return merged;
}
