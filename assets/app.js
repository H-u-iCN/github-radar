/* GitHub 开源雷达 · 前端逻辑（无框架、无构建步骤） */
(() => {
  'use strict';

  const DATA = window.GH_DATA || { meta: {}, categories: [], languages: [], projects: [] };
  const PROJECTS = (DATA.projects || []).map((p, i) => ({ ...p, _i: i }));
  const CAT_MAP = new Map((DATA.categories || []).map((c) => [c.id, c]));

  const state = { q: '', cat: 'all', lang: 'all', sort: 'heat', favOnly: false, newOnly: false };

  const $ = (id) => document.getElementById(id);
  const grid = $('grid');
  const emptyBox = $('empty');
  const searchInput = $('search');
  const sortSel = $('sortSel');
  const langSel = $('langSel');
  const favOnly = $('favOnly');
  const chipsBox = $('catChips');
  const resultCount = $('resultCount');

  /* ---------------- 本地存储（file:// 下可能不可用，做降级） ---------------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* 忽略 */
      }
    },
  };

  const favs = new Set(store.get('ghradar:favs', []));

  /* ---------------- 格式化 ---------------- */
  const fmtNum = (n) => {
    if (n == null || Number.isNaN(n)) return '—';
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  };

  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const daysAgo = (iso) => {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00Z');
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  // 90 天内创建的仓库算「新项目」
  const NEW_DAYS = 90;
  const isNew = (p) => {
    if (!p.createdAt) return false;
    const t = new Date(p.createdAt).getTime();
    return Date.now() - t <= NEW_DAYS * 86400000;
  };

  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Rust: '#dea584',
    Go: '#00ADD8', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Java: '#b07219',
    Kotlin: '#A97BFF', Swift: '#F05138', Dart: '#00B4AB', Ruby: '#701516', PHP: '#4F5D95',
    Zig: '#ec915c', Lua: '#000080', Shell: '#89e051', Vue: '#41b883', Svelte: '#ff3e00',
    'Jupyter Notebook': '#DA5B0B', HTML: '#e34c26', CSS: '#563d7c', Elixir: '#6e4a7e',
    Haskell: '#5e5086', Scala: '#c22d40', 'Objective-C': '#438eff', Assembly: '#6E4C13',
  };
  const langColor = (l) => LANG_COLORS[l] || '#8b949e';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 1800);
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    store.set('ghradar:theme', theme);
  }
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const urlTheme = new URLSearchParams(location.search).get('theme');
  applyTheme(urlTheme === 'light' || urlTheme === 'dark' ? urlTheme : store.get('ghradar:theme', prefersLight ? 'light' : 'dark'));

  /* ---------------- 过滤 / 排序 ---------------- */
  function matches(p) {
    if (state.cat !== 'all' && !(p.categories || []).includes(state.cat)) return false;
    if (state.lang !== 'all' && p.language !== state.lang) return false;
    if (state.favOnly && !favs.has(p.fullName)) return false;
    if (state.newOnly && !isNew(p)) return false;
    if (!state.q) return true;
    const hay = [
      p.fullName, p.name, p.owner, p.desc, p.descZh, p.language, p.license,
      (p.topics || []).join(' '),
      (p.categories || []).map((c) => CAT_MAP.get(c)?.name || '').join(' '),
    ].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  }

  const cmp = {
    heat: (a, b) => a._i - b._i,
    stars: (a, b) => b.stars - a.stars,
    trend: (a, b) => (b.trendingDailyStars || 0) - (a.trendingDailyStars || 0),
    week: (a, b) =>
      (b.delta7d ?? b.trendingWeeklyStars ?? -1) - (a.delta7d ?? a.trendingWeeklyStars ?? -1),
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    updated: (a, b) => String(b.pushedAt).localeCompare(String(a.pushedAt)),
    name: (a, b) => a.fullName.localeCompare(b.fullName),
  };

  function currentList() {
    return PROJECTS.filter(matches).sort(cmp[state.sort] || cmp.heat);
  }

  /* ---------------- 卡片 ---------------- */
  function buildCard(p) {
    const card = el('article', 'card');
    card.tabIndex = 0;
    card.dataset.repo = p.fullName;

    const top = el('div', 'card-top');
    const cat = CAT_MAP.get(p.primaryCategory);
    if (cat) top.append(el('span', 'cat-tag', `${cat.icon} ${cat.name}`));
    if (p.trendingRank) top.append(el('span', 'rank-tag', `今日 #${p.trendingRank}`));
    if (isNew(p)) top.append(el('span', 'new-tag', 'NEW'));
    top.append(el('span', 'spacer'));

    const title = el('h3', 'card-title');
    title.append(el('span', 'owner', `${p.owner} /`));
    title.append(document.createTextNode(' ' + p.name));

    const original = p.desc || '';
    const desc = el('p', 'card-desc' + (p.descZh ? ' zh' : ''), p.descZh || original || '（作者未填写简介）');
    if (p.descZh && original) desc.title = original;

    const topics = el('div', 'topics');
    (p.topics || []).slice(0, 4).forEach((t) => topics.append(el('span', 'topic', t)));

    const foot = el('div', 'card-foot');
    if (p.language) {
      const lang = el('span', '');
      const dot = el('span', 'lang-dot');
      dot.style.background = langColor(p.language);
      lang.append(dot, document.createTextNode(p.language));
      foot.append(lang);
    }
    const stars = el('span', 'stars', fmtNum(p.stars));
    stars.title = `${p.stars.toLocaleString()} star`;
    foot.append(stars);

    const d1 = p.trendingDailyStars || p.delta1d;
    const d7 = p.delta7d || p.trendingWeeklyStars;
    if (d1) foot.append(el('span', 'grow', `+${fmtNum(d1)}/天`));
    if (d7) foot.append(el('span', 'grow', `+${fmtNum(d7)}/周`));

    const cmp = el('button', 'cmp-btn' + (compareSet.has(p.fullName) ? ' on' : ''), compareSet.has(p.fullName) ? '✓' : '⇄');
    cmp.dataset.repo = p.fullName;
    cmp.title = '加入对比（最多 3 个）';
    cmp.setAttribute('aria-label', '加入对比');
    cmp.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCompare(p.fullName);
    });
    foot.append(cmp);

    const fav = el('button', 'fav-btn' + (favs.has(p.fullName) ? ' on' : ''), favs.has(p.fullName) ? '★' : '☆');
    fav.title = '收藏 / 取消收藏';
    fav.setAttribute('aria-label', '收藏');
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(p.fullName);
      const on = favs.has(p.fullName);
      fav.textContent = on ? '★' : '☆';
      fav.classList.toggle('on', on);
      if (state.favOnly) render();
    });
    foot.append(fav);

    card.append(top, title, desc, topics, foot);
    card.addEventListener('click', () => openDetail(p));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(p);
      }
    });
    return card;
  }

  function toggleFav(fullName) {
    if (favs.has(fullName)) favs.delete(fullName);
    else favs.add(fullName);
    store.set('ghradar:favs', [...favs]);
    updateStats();
    if (!state.favOnly) {
      const btn = document.querySelector(`.card[data-repo="${CSS.escape(fullName)}"] .fav-btn`);
      if (btn) {
        btn.textContent = favs.has(fullName) ? '★' : '☆';
        btn.classList.toggle('on', favs.has(fullName));
      }
    }
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const list = currentList();
    const frag = document.createDocumentFragment();
    list.forEach((p) => frag.append(buildCard(p)));
    grid.replaceChildren(frag);
    emptyBox.hidden = list.length > 0;
    resultCount.textContent = `显示 ${list.length} / ${PROJECTS.length} 个项目`;
    const hintMap = {
      heat: '综合热度 = Trending 排名 + 周增速 + Star 权重',
      stars: '按 Star 总数排序',
      trend: '按今日新增 Star 排序（来自 Trending）',
      week: '按最近 7 天 Star 增量排序（需要至少两次采集）',
      newest: '按仓库创建时间排序，找新项目',
      updated: '按最近推送时间排序，找还在维护的',
      name: '按名称排序',
    };
    $('sortHint').textContent = hintMap[state.sort] || '';
  }

  function buildChips() {
    const all = el('button', 'chip active', '全部');
    all.dataset.cat = 'all';
    all.append(el('span', 'cnt', String(PROJECTS.length)));
    chipsBox.append(all);
    for (const c of DATA.categories || []) {
      const chip = el('button', 'chip', `${c.icon} ${c.name}`);
      chip.dataset.cat = c.id;
      chip.append(el('span', 'cnt', String(c.count)));
      chipsBox.append(chip);
    }
    chipsBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.cat = chip.dataset.cat;
      chipsBox.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function buildLangSelect() {
    for (const l of DATA.languages || []) {
      const opt = el('option', null, `${l.name}（${l.count}）`);
      opt.value = l.name;
      langSel.append(opt);
    }
  }

  function updateStats() {
    const meta = DATA.meta || {};
    $('statTotal').textContent = fmtNum(PROJECTS.length);
    $('statCats').textContent = String((DATA.categories || []).length);
    $('statTrending').textContent = String(PROJECTS.filter((p) => p.trendingRank).length);
    const zh = PROJECTS.filter((p) => p.descZh).length;
    $('statZh').textContent = `${zh}/${PROJECTS.length}`;
    const totalStars = PROJECTS.reduce((sum, p) => sum + (p.stars || 0), 0);
    $('statStars').textContent = fmtNum(totalStars);

    $('metaLine').textContent = meta.generatedAt
      ? `更新于 ${fmtTime(meta.generatedAt)}`
      : '尚未采集数据';
    $('sourceLine').textContent = meta.generatedAt
      ? `本次数据生成于 ${fmtTime(meta.generatedAt)}（${meta.source || 'GitHub API'}）。`
      : '';
  }

  /* ---------------- 详情弹窗 ---------------- */
  const dialog = $('detail');
  const detailBody = $('detailBody');

  function fact(label, value) {
    const row = el('div');
    row.append(el('span', null, label), el('span', null, value == null || value === '' ? '—' : value));
    return row;
  }

  function openDetail(p) {
    const cat = CAT_MAP.get(p.primaryCategory);
    const head = el('div');
    const h2 = el('h2', null, p.name);
    head.append(h2, el('div', 'repo-path', `${p.owner} / ${p.name}${cat ? ' · ' + cat.name : ''}`));

    const descs = el('div');
    if (p.descZh) {
      descs.append(el('div', 'desc-label', '中文概括'));
      descs.append(el('p', 'full-desc zh', p.descZh));
      if (p.desc) {
        descs.append(el('div', 'desc-label', '仓库原文'));
        descs.append(el('p', 'full-desc', p.desc));
      }
    } else if (p.desc) {
      descs.append(el('p', 'full-desc', p.desc));
    }

    const facts = el('div', 'facts');
    facts.append(
      fact('Star', p.stars.toLocaleString()),
      fact('Fork', p.forks.toLocaleString()),
      fact('语言', p.language),
      fact('协议', p.license || '未标注'),
      fact('创建于', fmtDate(p.createdAt)),
      fact('最近推送', fmtDate(p.pushedAt)),
      fact('首次收录', p.firstSeen),
      fact('近 7 日增量', p.delta7d != null ? `+${p.delta7d.toLocaleString()}` : '暂无历史'),
    );
    if (p.trendingRank) facts.append(fact('今日 Trending', `第 ${p.trendingRank} 名`), fact('今日新增 Star', `+${(p.trendingDailyStars || 0).toLocaleString()}`));

    const topics = el('div', 'topics');
    (p.topics || []).forEach((t) => topics.append(el('span', 'topic', t)));

    const actions = el('div', 'dlg-actions');
    const open = el('a', 'btn primary', '↗ 打开 GitHub');
    open.href = p.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    actions.append(open);
    if (p.homepage) {
      const hp = el('a', 'btn', '🏠 项目主页');
      hp.href = p.homepage;
      hp.target = '_blank';
      hp.rel = 'noopener noreferrer';
      actions.append(hp);
    }
    const copy = el('button', 'btn', '📋 复制 Markdown');
    copy.addEventListener('click', () => {
      copyText(`- [${p.fullName}](${p.url}) — ${p.descZh || p.desc || ''}（★${p.stars}）`);
    });
    const fav = el('button', 'btn', favs.has(p.fullName) ? '★ 已收藏' : '☆ 收藏');
    fav.addEventListener('click', () => {
      toggleFav(p.fullName);
      fav.textContent = favs.has(p.fullName) ? '★ 已收藏' : '☆ 收藏';
      if (state.favOnly) render();
    });
    actions.append(copy, fav);

    detailBody.replaceChildren(head, descs, facts, topics, actions);
    dialog.showModal();
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ---------------- 项目对比 ---------------- */
  const compareSet = new Set();
  const compareBar = $('compareBar');
  const compareChips = $('compareChips');
  const compareCount = $('compareCount');
  const compareGo = $('compareGo');
  const compareClear = $('compareClear');
  const compareDialog = $('compareDialog');
  const compareBody = $('compareBody');
  const byRepo = new Map(PROJECTS.map((p) => [p.fullName, p]));

  function refreshCompareBar() {
    compareCount.textContent = String(compareSet.size);
    compareGo.disabled = compareSet.size < 2;
    compareBar.hidden = compareSet.size === 0;
    const frag = document.createDocumentFragment();
    for (const repo of compareSet) {
      const chip = el('span', 'compare-chip', repo);
      const x = el('button', null, '×');
      x.title = '移出对比';
      x.addEventListener('click', () => toggleCompare(repo));
      chip.append(x);
      frag.append(chip);
    }
    compareChips.replaceChildren(frag);
    document.querySelectorAll('.card .cmp-btn').forEach((btn) => {
      const on = compareSet.has(btn.dataset.repo);
      btn.classList.toggle('on', on);
      btn.textContent = on ? '✓' : '⇄';
    });
  }

  function toggleCompare(repo) {
    if (compareSet.has(repo)) compareSet.delete(repo);
    else if (compareSet.size >= 3) {
      toast('最多同时对比 3 个项目');
      return;
    } else compareSet.add(repo);
    refreshCompareBar();
  }

  function openCompare() {
    const list = [...compareSet].map((r) => byRepo.get(r)).filter(Boolean);
    if (list.length < 2) return;

    const head = el('div');
    head.append(el('h2', null, '项目对比'));
    head.append(el('p', 'repo-path', `并排对比 ${list.length} 个项目：Star、Fork、语言、协议、时间、分类`));

    const table = el('table', 'cmp-table');
    const thead = el('thead');
    const headRow = el('tr');
    headRow.append(el('th', null, ''));
    for (const p of list) {
      const th = el('th');
      const link = el('a', null, p.fullName);
      link.href = p.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      th.append(link);
      headRow.append(th);
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    const rows = [
      ['中文概括', (p) => p.descZh || p.desc || '—', 'cmp-zh'],
      ['Star', (p) => p.stars.toLocaleString()],
      ['Fork', (p) => p.forks.toLocaleString()],
      ['语言', (p) => p.language || '—'],
      ['协议', (p) => p.license || '—'],
      ['创建于', (p) => fmtDate(p.createdAt)],
      ['最近推送', (p) => fmtDate(p.pushedAt)],
      ['分类', (p) => (p.categories || []).map((c) => CAT_MAP.get(c)?.name).filter(Boolean).join(' / ') || '—'],
      ['今日新增 Star', (p) => (p.trendingDailyStars ? '+' + p.trendingDailyStars.toLocaleString() : '—')],
      ['周涨幅', (p) => (p.delta7d != null ? '+' + p.delta7d.toLocaleString() : '—')],
    ];
    for (const [label, get, cls] of rows) {
      const tr = el('tr');
      tr.append(el('th', null, label));
      for (const p of list) tr.append(el('td', cls || null, get(p)));
      tbody.append(tr);
    }
    table.append(tbody);
    compareBody.replaceChildren(head, table);
    compareDialog.showModal();
  }

  compareGo.addEventListener('click', openCompare);
  compareClear.addEventListener('click', () => {
    compareSet.clear();
    refreshCompareBar();
  });
  compareDialog.addEventListener('click', (e) => {
    if (e.target === compareDialog) compareDialog.close();
  });

  /* ---------------- 往期回顾（每天 Top 80 归档） ---------------- */
  const historyDialog = $('historyDialog');
  const historyDateSel = $('historyDate');
  const historyMeta = $('historyMeta');
  const historyList = $('historyList');
  const ARCHIVE_DATES = Array.isArray(window.GH_ARCHIVE_DATES) ? window.GH_ARCHIVE_DATES : [];
  const archiveLoading = new Set();

  function renderArchive(date) {
    const data = window.GH_ARCHIVE && window.GH_ARCHIVE[date];
    if (!data) {
      historyMeta.textContent = '';
      historyList.replaceChildren(el('p', 'repo-path', '这个日期没有归档数据'));
      return;
    }
    historyMeta.textContent = `${date} · ${data.items.length} 条`;
    const frag = document.createDocumentFragment();
    data.items.forEach((it, i) => {
      const row = el('div', 'history-row');
      row.append(el('span', 'history-rank', String(i + 1)));
      const a = el('a', 'history-name', it.f);
      a.href = it.u;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      row.append(a);
      const cat = CAT_MAP.get(it.c);
      if (cat) row.append(el('span', 'history-cat', cat.name));
      if (it.r) row.append(el('span', 'history-rank-badge', '#' + it.r));
      row.append(el('span', 'history-desc', it.z || ''));
      row.append(el('span', 'history-stars', '★' + fmtNum(it.s)));
      frag.append(row);
    });
    historyList.replaceChildren(frag);
  }

  function loadArchive(date) {
    if (window.GH_ARCHIVE && window.GH_ARCHIVE[date]) return renderArchive(date);
    if (archiveLoading.has(date)) return;
    archiveLoading.add(date);
    historyMeta.textContent = '加载中…';
    historyList.replaceChildren();
    const script = document.createElement('script');
    script.src = `data/archive/${date}.js`;
    script.onload = () => {
      archiveLoading.delete(date);
      renderArchive(date);
    };
    script.onerror = () => {
      archiveLoading.delete(date);
      historyMeta.textContent = '归档文件加载失败';
    };
    document.head.append(script);
  }

  function openHistory() {
    if (!ARCHIVE_DATES.length) {
      toast('还没有历史归档，明天再采集一次就有了');
      return;
    }
    historyDateSel.replaceChildren(
      ...ARCHIVE_DATES.map((d) => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        return option;
      }),
    );
    historyDateSel.value = ARCHIVE_DATES[0];
    historyDialog.showModal();
    loadArchive(ARCHIVE_DATES[0]);
  }

  historyDialog.addEventListener('click', (e) => {
    if (e.target === historyDialog) historyDialog.close();
  });
  historyDateSel.addEventListener('change', () => loadArchive(historyDateSel.value));
  $('historyBtn').addEventListener('click', openHistory);

  function showHelp() {
    const box = el('div');
    box.append(el('h2', null, '怎么用这个站'));
    const list = el('div');
    const items = [
      ['🔍 搜索', '按 / 聚焦搜索框，可搜项目名、中文概括、简介、topic、分类。'],
      ['🇨🇳 中文概括', '每张卡片正文就是「这是什么、能干什么」；鼠标悬停可看仓库英文原文，详情里中英文对照。'],
      ['🏷️ 分类', '按主题筛选；一个项目可以属于多个主题。'],
      ['🆕 新项目', '橙色 NEW 表示仓库是最近 90 天内创建的；勾选「只看新项目」可只看这些新冒头的。'],
      ['🔥 综合热度', '优先展示 GitHub Trending 当日上榜项目，再叠加周增速和总 Star。'],
      ['📈 涨幅', '「+3.2k/周」需要至少两次采集后才有；首日只有 Trending 的当日涨幅。'],
      ['⭐ 收藏', '点卡片右下角星标，数据存在本机浏览器，下次打开还在。'],
      ['⚖️ 项目对比', '点卡片上的 ⇄ 最多选 3 个项目，底部出现「开始对比」，可以并排比 Star、语言、协议和时间。'],
      ['📅 往期回顾', '点右上角日历图标，可以翻看以前每天的热门前 80 条——历史是本站自己归档的，不依赖外部。'],
      ['📋 导出', '把当前筛选结果复制成 Markdown 列表，直接贴到聊天或笔记里分享。'],
    ];
    for (const [t, d] of items) {
      const row = el('p', 'full-desc');
      row.append(el('b', null, t + '　'), document.createTextNode(d));
      list.append(row);
    }
    box.append(list);
    const foot = el('p', 'repo-path', '数据每天自动更新；采集脚本在 scripts/collect.mjs，规则在 scripts/config.mjs。');
    box.append(foot);
    detailBody.replaceChildren(box);
    dialog.showModal();
  }

  /* ---------------- 复制 ---------------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制到剪贴板');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('已复制到剪贴板');
      } catch {
        toast('复制失败，请手动选择');
      }
      ta.remove();
    }
  }

  /* ---------------- 事件 ---------------- */
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      render();
    }, 120);
  });

  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    render();
  });

  langSel.addEventListener('change', () => {
    state.lang = langSel.value;
    render();
  });

  favOnly.addEventListener('change', () => {
    state.favOnly = favOnly.checked;
    render();
  });

  $('newOnly').addEventListener('change', () => {
    state.newOnly = $('newOnly').checked;
    render();
  });

  $('exportBtn').addEventListener('click', () => {
    const list = currentList();
    if (!list.length) return toast('当前筛选结果为空');
    const md = list
      .map((p) => `- [${p.fullName}](${p.url}) — ${p.descZh || p.desc || ''}（★${p.stars}）`)
      .join('\n');
    copyText(`## GitHub 开源雷达 · 精选 ${list.length} 项\n\n${md}`);
  });

  $('themeBtn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  $('helpBtn').addEventListener('click', showHelp);

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape') {
      if (dialog.open || historyDialog.open || compareDialog.open) return;
      if (document.activeElement === searchInput) {
        searchInput.value = '';
        state.q = '';
        render();
      }
    } else if ((e.key === 't' || e.key === 'T') && !typing && !e.ctrlKey && !e.metaKey) {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    }
  });

  /* ---------------- 启动 ---------------- */
  buildChips();
  buildLangSelect();
  updateStats();
  render();
  if (!PROJECTS.length) {
    grid.innerHTML =
      '<div class="empty"><p>还没有数据。</p><p class="muted">先在项目根目录运行：<code>node scripts/collect.mjs</code>，然后刷新本页。</p></div>';
  }
})();
