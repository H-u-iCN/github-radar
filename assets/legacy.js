/* 历史索引页：筛选 + 分页渲染 */
(() => {
  'use strict';

  const DATA = window.GH_LEGACY || { items: [], stats: {}, statusLabel: {} };
  const ITEMS = DATA.items || [];
  const LABEL = DATA.statusLabel || {};
  const PAGE = 200;

  const $ = (id) => document.getElementById(id);
  const list = $('list');
  const emptyBox = $('empty');
  const searchInput = $('search');
  const statusSel = $('statusSel');
  const yearSel = $('yearSel');
  const catSel = $('catSel');
  const resultCount = $('resultCount');

  const state = { q: '', status: 'all', year: 'all', cat: 'all', shown: PAGE };

  const store = {
    get(k, f) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? f : JSON.parse(v);
      } catch {
        return f;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* 忽略 */
      }
    },
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  const fmtDate = (iso) => (iso ? String(iso).slice(0, 7) : '—');

  let toastTimer;
  function toast(msg) {
    const box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 1600);
  }

  /* 主题 */
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const urlTheme = new URLSearchParams(location.search).get('theme');
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    store.set('ghradar:theme', t);
  };
  applyTheme(urlTheme === 'light' || urlTheme === 'dark' ? urlTheme : store.get('ghradar:theme', prefersLight ? 'light' : 'dark'));
  $('themeBtn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* 统计 */
  const stats = DATA.stats || {};
  $('stTotal').textContent = String(DATA.total ?? ITEMS.length);
  $('stActive').textContent = String(stats.active ?? 0);
  $('stSlowing').textContent = String(stats.slowing ?? 0);
  $('stStopped').textContent = String(stats.stopped ?? 0);
  $('metaLine').textContent = DATA.generatedAt
    ? '生成于 ' + new Date(DATA.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : '';
  $('sourceLine').textContent = DATA.generatedAt ? `本次索引生成于 ${fmtDate(DATA.generatedAt)}。` : '';

  /* 下拉选项 */
  const years = [...new Set(ITEMS.map((i) => i.y))].sort();
  for (const y of years) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
    yearSel.append(o);
  }
  const cats = [...new Set(ITEMS.map((i) => i.c))].sort((a, b) => a.localeCompare(b, 'zh'));
  for (const c of cats) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    catSel.append(o);
  }

  /* 过滤 */
  function filtered() {
    const q = state.q.toLowerCase();
    return ITEMS.filter((it) => {
      if (state.status !== 'all' && it.s !== state.status) return false;
      if (state.year !== 'all' && it.y !== state.year) return false;
      if (state.cat !== 'all' && it.c !== state.cat) return false;
      if (!q) return true;
      return `${it.n} ${it.r} ${it.z} ${it.c}`.toLowerCase().includes(q);
    });
  }

  function buildRow(it) {
    const row = el('div', 'legacy-row');
    row.append(el('span', 'legacy-year', it.y));
    const name = el('a', 'legacy-name', it.n);
    name.href = it.u;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    row.append(name);
    row.append(el('span', 'legacy-repo', it.r));
    row.append(el('span', 'legacy-status s-' + it.s, LABEL[it.s] || it.s));
    if (it.l) {
      const last = el('span', 'legacy-last', it.s === 'stopped' ? '停更 ' + fmtDate(it.l) : fmtDate(it.l));
      last.title = '最后提交：' + it.l;
      row.append(last);
    } else {
      row.append(el('span', 'legacy-last', '—'));
    }
    row.append(el('span', 'legacy-zh', it.z || '中文概括待补'));
    return row;
  }

  function render(reset = true) {
    if (reset) state.shown = PAGE;
    const items = filtered();
    const slice = items.slice(0, state.shown);
    const frag = document.createDocumentFragment();
    slice.forEach((it) => frag.append(buildRow(it)));
    if (items.length > state.shown) {
      const more = el('button', 'ghost-btn legacy-more', `加载更多（还有 ${items.length - state.shown} 条）`);
      more.addEventListener('click', () => {
        state.shown += PAGE;
        render(false);
      });
      frag.append(more);
    }
    list.replaceChildren(frag);
    emptyBox.hidden = items.length > 0;
    resultCount.textContent = `显示 ${Math.min(state.shown, items.length)} / ${items.length} 条（共 ${ITEMS.length}）`;
  }

  /* 事件 */
  let t;
  searchInput.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = searchInput.value.trim();
      render();
    }, 120);
  });
  statusSel.addEventListener('change', () => { state.status = statusSel.value; render(); });
  yearSel.addEventListener('change', () => { state.year = yearSel.value; render(); });
  catSel.addEventListener('change', () => { state.cat = catSel.value; render(); });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  render();
})();
