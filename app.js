/* 가지 (GAJI) — 실험 동아리 연구 관리
 * 화면: 홈 · 가지 · 찾기 · 더 보기(보드 · 전체 지도 · 설정)
 * 지금은 체험 모드(브라우저에만 저장). 다음 단계에서 구글 드라이브 시트와 연결합니다.
 */
(function () {
  'use strict';

  /* ---------- 기본 도구 ---------- */
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dstr = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const TODAY = new Date(dstr(new Date()));
  const fmt = (d) => { const x = new Date(d); return (x.getMonth() + 1) + '/' + x.getDate(); };
  const days = (d) => Math.round((new Date(d) - TODAY) / 864e5);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2000); }

  /* ---------- 저장 (체험 모드: 이 브라우저에만) ---------- */
  const KEY = 'gaji-demo-v1';
  function freshSample() {
    const S = JSON.parse(JSON.stringify(window.GAJI_SAMPLE));
    const shift = TODAY - new Date(S.base);
    const mv = (d) => dstr(new Date(new Date(d).getTime() + shift));
    S.nodes.forEach((n) => { n.date = mv(n.date); n.created = mv(n.created); });
    S.lastNo = { exp: 27, q: 7, res: 6 };
    return S;
  }
  function load() { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return freshSample(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  let db = load();
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('gaji-prefs') || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('gaji-prefs', JSON.stringify(prefs)); } catch (e) {} };

  /* ---------- 의미 ---------- */
  const ICON = {
    exp: 'M9 3h6M10 3v6.5L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.5V3M7.5 15h9',
    idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v.5h5V16c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z',
    q: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 17h.01',
    res: 'M10 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 7v12a2 2 0 0 0 2 2h9M11.5 8h5M11.5 12h5',
    branch: 'M6 7v10M18 11c0 4-6 3-12 6', check: 'M5 12l4 4 10-10', minus: 'M7 12h10', plus: 'M12 5v14M5 12h14'
  };
  const TYPE = { exp: { label: '실험', color: 'var(--exp)' }, idea: { label: '아이디어', color: 'var(--idea)' }, q: { label: '질문', color: 'var(--q)' }, res: { label: '자료', color: 'var(--res)' } };
  const STAGES = ['아이디어', '계획 작성', '검토 중', '준비 중', '실험 완료', '기록 완료'];
  const FCODE = { '물리': 'PHY', '화학': 'CHE', '생명': 'BIO', '지구': 'EAR', '공통': 'GEN', '융합': 'MIX' };
  const PREFIX = { exp: 'EXP', idea: 'EXP', q: 'Q', res: 'R' };
  const uid = (n) => PREFIX[n.type] + '-' + n.no;
  const code = (n) => (n.type === 'exp' || n.type === 'idea') ? String(n.created).slice(2, 4) + '-' + (FCODE[n.field] || 'GEN') + '-' + String(n.no).padStart(3, '0') : uid(n);
  const isExpLike = (n) => n && (n.type === 'exp' || n.type === 'idea');
  const byId = (id) => db.nodes.find((n) => n.id === id);
  const linksOf = (id) => db.links.filter((l) => l.s === id || l.t === id);
  const lineName = (k) => db.lines[k] || k || '줄기 없음';

  function ready(n) { return [(n.fans || 0) >= 3, !!n.volunteer, !!n.equip]; }
  function tone(n) {
    if (n.type === 'idea') { const ok = ready(n).filter(Boolean).length; return ok === 3 ? ['t-ok', '● 전환 가능'] : ['t-warn', '숙성 ' + ok + '/3']; }
    if (n.type === 'q') return n.status === '해결' ? ['t-ok', '해결'] : ['t-bad', '미해결'];
    if (n.type === 'res') return ['t-neutral', n.status || '자료'];
    if (n.status === '취소') return ['t-neutral', '취소'];
    if (n.status === '기록 완료') return n.verdict === '가설 기각' ? ['t-bad', '가설 기각'] : ['t-ok', n.verdict || '기록 완료'];
    if (n.status === '준비 중') { const s = n.signal || 0; return s >= 5 ? ['t-ok', '● GO'] : (days(n.date) <= 7 ? ['t-bad', '● 위험 ' + s + '/5'] : ['t-warn', '● 준비 ' + s + '/5']); }
    if (n.status === '검토 중') return (n.review || 0) >= 2 ? ['t-ok', '검토 2/2'] : ['t-warn', '검토 ' + (n.review || 0) + '/2'];
    if (n.status === '실험 완료') return ['t-warn', '기록 대기'];
    return ['t-neutral', n.status];
  }
  const nodeColor = (n) => n.type === 'exp' ? (n.status === '기록 완료' ? 'var(--done)' : n.status === '취소' ? 'var(--edge)' : 'var(--exp)') : TYPE[n.type].color;
  const svgIcon = (k, color) => '<svg viewBox="0 0 24 24" style="stroke:' + color + '" aria-hidden="true"><path d="' + ICON[k] + '"/></svg>';
  function ico(n) { const c = nodeColor(n); return n.type === 'idea' ? '<span class="ico" style="border:2px dashed ' + c + '">' + svgIcon('idea', c) + '</span>' : '<span class="ico" style="background:' + c + '">' + svgIcon(n.type, '#fff') + '</span>'; }
  const badge = (n) => { const t = tone(n); return '<span class="badge ' + t[0] + '">' + esc(t[1]) + '</span>'; };

  /* ---------- 계보 ---------- */
  function parentOf(n) { const l = db.links.find((l) => l.t === n.id && (l.k === 'follow' || l.k === 'next')); const p = l && byId(l.s); return isExpLike(p) ? p : null; }
  function lineage(n) { const c = [n]; let cur = n, g = 0; while (g++ < 40) { const p = parentOf(cur); if (!p || c.includes(p)) break; c.unshift(p); cur = p; } return c; }
  function childrenOf(n) { return db.links.filter((l) => l.s === n.id && (l.k === 'follow' || l.k === 'next')).map((l) => byId(l.t)).filter(isExpLike).sort((a, b) => a.date.localeCompare(b.date)); }
  function treeRows(roots) { const rows = [], seen = new Set(); (function walk(list, d, p) { list.forEach((x) => { if (seen.has(x.id)) return; seen.add(x.id); rows.push({ n: x, depth: d, parent: p }); walk(childrenOf(x), d + 1, x); }); })(roots, 0, null); return rows; }
  const familyRows = (n) => treeRows([lineage(n)[0]]);
  const after = (n) => treeRows([n]).length - 1;

  /* 줄기 = 같은 연구 주제(line)로 묶인 뿌리 실험들의 나무 */
  function computeLines() {
    const roots = db.nodes.filter((n) => isExpLike(n) && !parentOf(n));
    const groups = {};
    roots.forEach((r) => { const k = r.line || ('_' + r.id); (groups[k] = groups[k] || []).push(r); });
    return Object.entries(groups).map(([k, rs]) => {
      rs.sort((a, b) => a.date.localeCompare(b.date));
      const rows = treeRows(rs);
      const open = rows.map((r) => r.n).filter((n) => !['기록 완료', '취소'].includes(n.status));
      const exps = open.filter((n) => n.type === 'exp');
      const state = exps.length ? 'active' : open.length ? 'idea' : 'done';
      const next = (exps.length ? exps : open).sort((a, b) => a.date.localeCompare(b.date))[0] || rows[rows.length - 1].n;
      return { key: k, name: lineName(k), rows, state, next, last: rows.map((r) => r.n.date).sort().pop() };
    }).sort((a, b) => ({ active: 0, idea: 1, done: 2 }[a.state] - { active: 0, idea: 1, done: 2 }[b.state]) || a.next.date.localeCompare(b.next.date));
  }

  /* ---------- 그림: 가지 ---------- */
  // 세로 가지 (상세 · 줄기 화면)
  function branchSvg(rows, selId, opts) {
    opts = opts || {};
    const RH = opts.rh || 58, W = 340, H = rows.length * RH + 10;
    const chain = new Set(selId && byId(selId) ? lineage(byId(selId)).map((x) => x.id) : []);
    rows.forEach((r, i) => { r.x = 18 + r.depth * 22; r.y = 24 + i * RH; });
    let lines = '', dots = '';
    rows.forEach((r) => {
      if (!r.parent) return; const p = rows.find((q) => q.n.id === r.parent.id); if (!p) return;
      const hot = chain.has(r.n.id) && chain.has(p.n.id), fut = days(r.n.date) > 0 && r.n.status !== '기록 완료';
      lines += '<path d="M ' + p.x + ' ' + (p.y + 11) + ' L ' + p.x + ' ' + (r.y - 10) + ' Q ' + p.x + ' ' + r.y + ' ' + (p.x + 10) + ' ' + r.y + ' L ' + (r.x - 12) + ' ' + r.y + '" fill="none" stroke="' + (hot ? nodeColor(r.n) : 'var(--edge)') + '" stroke-width="' + (hot ? 3.5 : 2.5) + '" stroke-linecap="round"' + (fut ? ' stroke-dasharray="5 5"' : '') + '/>';
    });
    rows.forEach((r) => {
      const n = r.n, c = nodeColor(n), sel = n.id === selId, hol = n.type === 'idea' || (days(n.date) > 0 && n.status !== '기록 완료');
      const max = Math.floor((W - r.x - 30) / 14.5), ttl = n.title.length > max ? n.title.slice(0, max - 1) + '…' : n.title;
      dots += '<g data-go="' + n.id + '" role="button" tabindex="0" aria-label="' + esc(code(n) + ' ' + n.title) + '">' +
        '<rect x="0" y="' + (r.y - RH / 2) + '" width="' + W + '" height="' + RH + '" fill="transparent"/>' +
        (sel ? '<circle cx="' + r.x + '" cy="' + r.y + '" r="17" fill="var(--halo)"/>' : '') +
        '<circle cx="' + r.x + '" cy="' + r.y + '" r="' + (sel ? 11 : 9) + '" fill="' + (hol ? 'var(--surface)' : c) + '" stroke="' + c + '" stroke-width="3"' + (hol ? ' stroke-dasharray="4 3"' : '') + '/>' +
        '<text x="' + (r.x + 20) + '" y="' + (r.y - 5) + '" font-size="11.5" style="fill:var(--muted);font-family:var(--f-num)">' + esc(code(n)) + ' · ' + fmt(n.date) + ' · ' + esc(tone(n)[1].replace('● ', '')) + '</text>' +
        '<text x="' + (r.x + 20) + '" y="' + (r.y + 13) + '" font-size="14.5" font-weight="' + (chain.has(n.id) || !selId ? 700 : 500) + '" style="fill:var(--fg)">' + esc(ttl) + '</text></g>';
    });
    return '<svg class="branch-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" role="group" aria-label="가지 그림">' + lines + dots + '</svg>';
  }
  // 가로 미니 가지 (카드 안)
  function miniLine(rows) {
    const shown = rows.slice(0, 9), SX = 30, W = Math.max(60, shown.length * SX + 20), H = 20 + Math.min(3, Math.max(...shown.map((r) => r.depth))) * 14 + 12;
    shown.forEach((r, i) => { r.mx = 14 + i * SX; r.my = 14 + Math.min(3, r.depth) * 14; });
    let s = '';
    shown.forEach((r) => { if (!r.parent) return; const p = shown.find((q) => q.n.id === r.parent.id); if (!p) return; const fut = days(r.n.date) > 0 && r.n.status !== '기록 완료';
      s += '<path d="M ' + p.mx + ' ' + p.my + ' L ' + p.mx + ' ' + r.my + ' L ' + r.mx + ' ' + r.my + '" fill="none" stroke="var(--edge)" stroke-width="2.5"' + (fut ? ' stroke-dasharray="4 3"' : '') + '/>'; });
    shown.forEach((r) => { const c = nodeColor(r.n), hol = r.n.type === 'idea' || (days(r.n.date) > 0 && r.n.status !== '기록 완료');
      s += '<circle cx="' + r.mx + '" cy="' + r.my + '" r="7" fill="' + (hol ? 'var(--surface)' : c) + '" stroke="' + c + '" stroke-width="2.5"' + (hol ? ' stroke-dasharray="3 2"' : '') + '/>'; });
    if (rows.length > shown.length) s += '<text x="' + (W - 4) + '" y="18" font-size="11" text-anchor="end" style="fill:var(--muted)">+' + (rows.length - shown.length) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + s + '</svg>';
  }
  // 관계도: 가운데 하나 + 위 질문 · 왼쪽 자료 · 오른쪽 다음 · 아래 이전
  function relationSvg(n) {
    const W = 340, H = 250, cx = 170, cy = 118, slots = { up: [], left: [], right: [], down: [] };
    linksOf(n.id).forEach((l) => {
      const o = byId(l.s === n.id ? l.t : l.s); if (!o) return;
      if (o.type === 'q') slots.up.push(o); else if (o.type === 'res') slots.left.push(o);
      else if (l.t === n.id && (l.k === 'follow' || l.k === 'next')) slots.down.push(o); else slots.right.push(o);
    });
    const pos = { up: (i, k) => [cx + (i - (k - 1) / 2) * 110, 30], down: (i, k) => [cx + (i - (k - 1) / 2) * 110, 206], left: (i, k) => [46, cy + (i - (k - 1) / 2) * 62], right: (i, k) => [W - 46, cy + (i - (k - 1) / 2) * 62] };
    let e = '', d = '';
    Object.entries(slots).forEach(([side, list]) => { list.slice(0, 3).forEach((o, i, arr) => {
      const [x, y] = pos[side](i, arr.length), c = nodeColor(o), ttl = o.title.length > 8 ? o.title.slice(0, 7) + '…' : o.title;
      e += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="var(--edge)" stroke-width="2"/>';
      d += '<g data-go="' + o.id + '" role="button" tabindex="0" aria-label="' + esc(TYPE[o.type].label + ' ' + o.title) + '"><circle cx="' + x + '" cy="' + y + '" r="13" fill="' + (o.type === 'idea' ? 'var(--surface)' : c) + '" stroke="' + c + '" stroke-width="3"' + (o.type === 'idea' ? ' stroke-dasharray="4 3"' : '') + '/>' +
        '<text x="' + x + '" y="' + (y + 28) + '" text-anchor="middle" font-size="11.5" font-weight="700" style="fill:var(--fg);paint-order:stroke;stroke:var(--surface);stroke-width:4px">' + esc(ttl) + '</text></g>';
    }); });
    const labels = '<text x="' + cx + '" y="12" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">질문</text><text x="8" y="' + (cy - 30) + '" font-size="10.5" style="fill:var(--muted)">자료</text><text x="' + (W - 8) + '" y="' + (cy - 30) + '" text-anchor="end" font-size="10.5" style="fill:var(--muted)">다음 · 관련</text><text x="' + cx + '" y="' + (H - 4) + '" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">이전</text>';
    const c = nodeColor(n);
    d += '<circle cx="' + cx + '" cy="' + cy + '" r="22" fill="var(--halo)"/><circle cx="' + cx + '" cy="' + cy + '" r="15" fill="' + c + '"/>';
    const total = Object.values(slots).reduce((a, b) => a + b.length, 0);
    if (!total) return '<p class="muted" style="margin:0;font-size:13px">아직 연결된 질문 · 자료 · 실험이 없습니다.</p>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" role="group" aria-label="관련된 것">' + labels + e + d + '</svg>';
  }

  /* ---------- 화면 상태 ---------- */
  // 휴대폰 · 태블릿 세로: 한 화면씩 쌓임. 태블릿 가로(1024px 이상): 실험 · 줄기 상세는 오른쪽 칸에.
  let nav = [{ s: prefs.tab || 'home' }];
  const SPLIT = new Set(['item', 'line']);
  const wide = () => window.matchMedia('(min-width: 1024px)').matches;
  const cur = () => nav[nav.length - 1];
  function mainIndex() { if (!wide()) return nav.length - 1; let i = nav.length - 1; while (i > 0 && SPLIT.has(nav[i].s)) i--; return i; }
  function go(s, arg, src) { if (wide() && src === 'main' && SPLIT.has(s)) nav = nav.slice(0, mainIndex() + 1); nav.push({ s, arg }); render(src !== 'pane'); if (src === 'pane') $('#pane').scrollTop = 0; }
  function tab(s) { nav = [{ s }]; prefs.tab = s; savePrefs(); render(true); }
  function back() { const mi = mainIndex(); nav = nav.slice(0, Math.max(1, wide() ? mi : nav.length - 1)); render(true); }

  /* ---------- 홈 ---------- */
  function todos() {
    const out = [];
    db.nodes.forEach((n) => {
      if (n.type === 'exp' && n.status === '준비 중' && (n.signal || 0) < 5 && days(n.date) <= 14) out.push({ n, why: '실험 ' + (days(n.date) >= 0 ? 'D-' + days(n.date) : '날짜 지남') + ' · 출발 신호 ' + (n.signal || 0) + '/5', w: days(n.date) });
      if (n.type === 'exp' && n.status === '검토 중' && (n.review || 0) < 2) out.push({ n, why: '검토가 ' + (2 - (n.review || 0)) + '명 더 필요해요', w: days(n.date) - 3 });
      if (n.type === 'exp' && n.status === '실험 완료') out.push({ n, why: '결과 기록을 남겨 주세요', w: 1 });
      if (n.type === 'q' && n.status !== '해결') out.push({ n, why: '함께 답을 찾아 주세요', w: 10 });
      if (n.type === 'idea' && ready(n).every(Boolean)) out.push({ n, why: '계획서로 바꿀 수 있어요', w: 6 });
    });
    return out.sort((a, b) => a.w - b.w).slice(0, 3);
  }
  function viewHome() {
    const t = todos(), lines = computeLines().filter((l) => l.state !== 'done').slice(0, 3);
    return '<div class="home-grid"><div><div class="hello"><span class="muted">' + (TODAY.getMonth() + 1) + '월 ' + TODAY.getDate() + '일 ' + WD[TODAY.getDay()] + '요일</span><b>지금 챙길 것 ' + t.length + '개</b></div>' +
      '<div class="todo">' + (t.length ? t.map((x) => '<button type="button" class="todo-item" data-item="' + x.n.id + '">' + ico(x.n) + '<span class="tx"><b>' + esc(x.n.title) + '</b><small>' + esc(x.why) + '</small></span>' + badge(x.n) + '</button>').join('') : '<div class="card empty">지금 챙길 일이 없어요.</div>') + '</div>' +
      '<div class="quick">' +
        '<button type="button" data-new="exp" style="background:#2F6FDB">' + svgIcon('exp', '#fff') + '새 실험</button>' +
        '<button type="button" data-new="idea" style="background:#B86200">' + svgIcon('idea', '#fff') + '아이디어</button>' +
        '<button type="button" data-new="q" style="background:#6E4FE0">' + svgIcon('q', '#fff') + '질문</button></div></div>' +
      '<div><h2 class="sec">진행 중인 가지 <small>누르면 줄기가 펼쳐져요</small></h2>' + lines.map(lineCard).join('') +
      '<button type="button" class="fold" data-tab-go="tree">가지 전체 보기 →</button></div></div>';
  }

  /* ---------- 가지 ---------- */
  function lineCard(L) {
    const st = { active: ['t-info', '진행 중'], idea: ['t-warn', '아이디어'], done: ['t-neutral', '끝남'] }[L.state];
    return '<button type="button" class="line-card" data-line="' + esc(L.key) + '"><span class="head"><b>' + esc(L.name) + '</b><span class="badge ' + st[0] + '">' + st[1] + '</span></span>' +
      '<span class="mini">' + miniLine(L.rows) + '</span>' +
      '<span class="next">' + (L.state === 'done' ? '마지막 ' + fmt(L.last) + ' · 실험 ' + L.rows.length + '개' : '다음: <b>' + fmt(L.next.date) + ' ' + esc(L.next.title) + '</b> · ' + esc(tone(L.next)[1].replace('● ', ''))) + '</span></button>';
  }
  function viewTree() {
    const mode = prefs.treeMode || 'line';
    let h = '<div class="seg" role="group" aria-label="보기"><button type="button" data-tmode="line" aria-pressed="' + (mode === 'line') + '">줄기별</button><button type="button" data-tmode="date" aria-pressed="' + (mode === 'date') + '">날짜별</button></div>';
    if (mode === 'line') {
      const L = computeLines(), live = L.filter((l) => l.state !== 'done'), done = L.filter((l) => l.state === 'done');
      h += '<div class="grid2 wide3">' + live.map(lineCard).join('') + '</div>' || '<div class="card empty">아직 가지가 없어요. 홈에서 새 실험이나 아이디어를 올려 보세요.</div>';
      if (done.length) h += '<button type="button" class="fold" data-fold>' + (prefs.showDone ? '▾' : '▸') + ' 끝난 줄기 ' + done.length + '개</button>' + (prefs.showDone ? '<div class="grid2 wide3">' + done.map(lineCard).join('') + '</div>' : '');
    } else {
      const items = db.nodes.filter(isExpLike).filter((n) => n.status !== '취소').sort((a, b) => a.date.localeCompare(b.date));
      let m = '', t = false; h += '<div class="day-list">';
      items.forEach((n) => { const d = new Date(n.date), mk = d.getFullYear() + '-' + d.getMonth();
        if (mk !== m) { m = mk; h += '<div class="month">' + (d.getFullYear() !== TODAY.getFullYear() ? d.getFullYear() + '년 ' : '') + (d.getMonth() + 1) + '월</div>'; }
        if (!t && d >= TODAY) { t = true; h += '<div class="todayline">오늘 ' + fmt(TODAY) + '</div>'; }
        const g = lineage(n).length, a = after(n);
        h += '<button type="button" class="srow' + (d < TODAY && n.status === '기록 완료' ? ' past' : '') + '" data-item="' + n.id + '"><span class="sdate"><b>' + d.getDate() + '</b><small>' + WD[d.getDay()] + '</small></span>' + ico(n) +
          '<span class="tx"><small class="code">' + esc(code(n)) + (g > 1 || a ? ' · ' + (g > 1 ? g + '세대' : '') + (g > 1 && a ? ' · ' : '') + (a ? '후속 ' + a : '') : '') + '</small><b>' + esc(n.title) + '</b></span>' + badge(n) + '</button>'; });
      if (!t) h += '<div class="todayline">오늘 ' + fmt(TODAY) + '</div>';
      h += '</div>';
    }
    return h;
  }
  function viewLine(key) {
    const L = computeLines().find((l) => l.key === key);
    if (!L) return '<div class="card empty">줄기를 찾지 못했어요.</div>';
    return '<div class="card"><div class="panel-title"><span>실험 ' + L.rows.filter((r) => r.n.type === 'exp').length + '개 · 아이디어 ' + L.rows.filter((r) => r.n.type === 'idea').length + '개</span><span>점선 = 아직 안 한 일</span></div>' + branchSvg(L.rows, null) + '</div>' +
      '<p class="muted" style="margin:0 4px;font-size:13px">점을 누르면 그 실험으로 들어가요.</p>';
  }

  /* ---------- 상세 ---------- */
  function cond(ok, label) { return '<div><span class="cdot" style="background:' + (ok ? 'var(--done)' : 'var(--edge)') + '"><svg viewBox="0 0 24 24"><path d="' + (ok ? ICON.check : ICON.minus) + '"/></svg></span>' + label + '</div>'; }
  function viewItem(id) {
    const n = byId(id); if (!n) return '<div class="card empty">항목을 찾지 못했어요.</div>';
    let h = '<div class="detail-head"><div class="idrow">' + ico(n) + '<span class="idchip">' + esc(code(n)) + '</span><button type="button" class="chipbtn" data-act="copy">번호 복사</button><span class="muted" style="font-size:12px">' + TYPE[n.type].label + ' · ' + esc(n.field) + '</span></div>' +
      '<h2>' + esc(n.title) + '</h2><div class="idrow">' + badge(n) + (n.type === 'exp' && tone(n)[1] !== n.status ? '<span class="badge t-info">' + esc(n.status) + '</span>' : '') + '</div></div>';
    if (isExpLike(n)) { const rows = familyRows(n);
      h += '<div class="card"><div class="panel-title"><span>이 실험의 가지 · ' + lineage(n).length + '세대' + (after(n) ? ' · 후속 ' + after(n) + '개' : '') + '</span><span>' + esc(lineName(lineage(n)[0].line)) + '</span></div>' + branchSvg(rows, n.id) + '</div>'; }
    if (n.type === 'idea') { const r = ready(n); h += '<div class="card conds">' + cond(r[0], '같이 해요 3명 이상 (' + (n.fans || 0) + '명)') + cond(r[1], n.volunteer ? '담당 지원 · ' + esc(n.volunteer) : '담당 지원자 없음') + cond(r[2], '과학실 장비로 가능') + '</div>'; }
    h += '<div class="btn-row">' + actions(n) + '</div>';
    h += '<div class="card"><dl class="kv"><dt>고유번호</dt><dd><span class="code">' + esc(uid(n)) + '</span> <span class="muted" style="font-size:12px">바뀌지 않음</span></dd>' + (n.owner ? '<dt>담당</dt><dd>' + esc(n.owner) + '</dd>' : '') + '<dt>' + (n.type === 'exp' ? '실험일' : '날짜') + '</dt><dd>' + fmt(n.date) + (isExpLike(n) && days(n.date) >= 0 && n.status !== '기록 완료' ? ' · D-' + days(n.date) : '') + '</dd></dl>' + (n.desc ? '<p style="margin:12px 0 0;font-size:14px;line-height:1.7">' + esc(n.desc) + '</p>' : '') + '</div>';
    h += '<div class="card"><div class="panel-title"><span>관련된 것</span><span>누르면 이동</span></div>' + relationSvg(n) + '</div>';
    return h;
  }
  function actions(n) {
    if (n.type === 'idea') { const ok = ready(n).every(Boolean);
      return '<button type="button" class="btn" data-act="fan">같이 해요 +1</button>' + (ok ? '<button type="button" class="btn primary" data-act="convert">계획서로 만들기</button>' : (!n.volunteer ? '<button type="button" class="btn" data-act="volunteer">담당 지원</button>' : '<button type="button" class="btn" data-act="equip">장비 확인</button>')); }
    if (n.type === 'exp' && n.status !== '취소') { const i = STAGES.indexOf(n.status);
      return (i > 0 && i < STAGES.length - 1 ? '<button type="button" class="btn blue" data-act="advance">다음 단계: ' + STAGES[i + 1] + '</button>' : '') + '<button type="button" class="btn" data-act="branch">이어서 가지 치기</button>'; }
    if (n.type === 'q' && n.status !== '해결') return '<button type="button" class="btn primary" data-act="solve">해결됨으로 표시</button><button type="button" class="btn" data-act="toIdea">실험 아이디어로</button>';
    return '';
  }

  /* ---------- 찾기 ---------- */
  function viewFind() {
    const q = (prefs.q || '').trim().toLowerCase(), ty = prefs.ty || 'all';
    const list = db.nodes.filter((n) => (ty === 'all' || n.type === ty || (ty === 'exp' && n.type === 'idea')) && (!q || n.title.toLowerCase().includes(q) || code(n).toLowerCase().includes(q) || uid(n).toLowerCase() === q))
      .sort((a, b) => b.date.localeCompare(a.date));
    const chip = (k, label, c) => '<button type="button" class="chip" data-ty="' + k + '" aria-pressed="' + (ty === k) + '">' + (c ? '<i style="background:' + c + '"></i>' : '') + label + '</button>';
    return '<label for="q" class="muted" style="font-size:13px;font-weight:700;margin:4px 2px -10px">제목 또는 번호로 찾기</label><input id="q" class="search" type="search" placeholder="예: 효소, CHE-019" value="' + esc(prefs.q || '') + '">' +
      '<div class="chips" role="group" aria-label="종류">' + chip('all', '전체') + chip('exp', '실험 · 아이디어', 'var(--exp)') + chip('q', '질문', 'var(--q)') + chip('res', '자료', 'var(--res)') + '</div>' +
      '<div class="day-list">' + (list.length ? list.map((n) => '<button type="button" class="srow" data-item="' + n.id + '">' + ico(n) + '<span class="tx"><small class="code">' + esc(code(n)) + '</small><b>' + esc(n.title) + '</b></span>' + badge(n) + '</button>').join('') : '<div class="card empty">찾는 항목이 없어요.</div>') + '</div>';
  }

  /* ---------- 더 보기 ---------- */
  function viewMore() {
    const mi = (s, c, path, t, d) => '<button type="button" class="menu-item" data-go-screen="' + s + '"><span class="mi" style="background:' + c + '"><svg viewBox="0 0 24 24"><path d="' + path + '"/></svg></span><span class="tx"><b>' + t + '</b><small>' + d + '</small></span></button>';
    return '<div class="menu">' +
      mi('settings', 'var(--club)', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z', '설정', '동아리 이름 · 로고 · 색 · 화면 밝기') +
      mi('board', 'var(--exp)', 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z', '보드', '단계별로 실험 카드 보기 (관리자용)') +
      mi('map', 'var(--q)', 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M10.2 10.2L6.4 6.4M13.8 11l3.6-3.6M10.3 13.8L7.4 17.4', '전체 지도', '동아리 연구 전체를 한 장으로 (발표용)') +
      mi('about', 'var(--idea)', 'M6 7v10M18 11c0 4-6 3-12 6', '가지 소개', '체험 모드 · 드라이브 연결 안내') +
      '</div>';
  }
  function viewBoard() {
    const items = db.nodes.filter(isExpLike);
    return '<p class="muted" style="margin:0 2px;font-size:13px">카드를 누르면 상세로 들어가요. 단계는 상세의 버튼으로 바꿉니다.</p><div class="board">' + STAGES.map((st) => { const l = items.filter((n) => n.status === st);
      return '<div class="col"><h3>' + st + '<span class="badge t-neutral">' + l.length + '</span></h3>' + l.map((n) => '<button type="button" class="bcard' + (n.type === 'idea' ? ' idea' : '') + '" data-item="' + n.id + '"><span class="code">' + esc(code(n)) + '</span><b>' + esc(n.title) + '</b>' + badge(n) + '</button>').join('') + '</div>'; }).join('') + '</div>';
  }
  function viewMap() {
    const W = 760, H = 520, ns = db.nodes.filter((n) => n.status !== '취소');
    const CEN = { '생명': [200, 260], '화학': [500, 200], '물리': [540, 400], '공통': [360, 300], '지구': [180, 430], '융합': [360, 110] };
    const P = {}; ns.forEach((n, i) => { const c = CEN[n.field] || [W / 2, H / 2], a = i * 2.4; P[n.id] = { x: c[0] + Math.cos(a) * 50, y: c[1] + Math.sin(a) * 50 }; });
    for (let it = 0; it < 260; it++) {
      ns.forEach((a) => ns.forEach((b) => { if (a === b) return; const p = P[a.id], q = P[b.id], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy + .01, f = 2600 / d2, d = Math.sqrt(d2); p.x += dx / d * f * .5; p.y += dy / d * f * .5; }));
      db.links.forEach((l) => { const p = P[l.s], q = P[l.t]; if (!p || !q) return; const dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) + .01, k = (d - 90) * .02; p.x += dx / d * k; p.y += dy / d * k; q.x -= dx / d * k; q.y -= dy / d * k; });
      ns.forEach((n) => { const c = CEN[n.field] || [W / 2, H / 2], p = P[n.id]; p.x += (c[0] - p.x) * .02; p.y += (c[1] - p.y) * .02; p.x = Math.min(W - 50, Math.max(50, p.x)); p.y = Math.min(H - 40, Math.max(40, p.y)); });
    }
    let s = '';
    db.links.forEach((l) => { const p = P[l.s], q = P[l.t]; if (p && q) s += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="var(--edge)" stroke-width="2"' + (l.k === 'next' ? ' stroke-dasharray="6 5"' : '') + '/>'; });
    ns.forEach((n) => { const p = P[n.id], c = nodeColor(n), t = n.title.length > 9 ? n.title.slice(0, 8) + '…' : n.title;
      s += '<g data-go="' + n.id + '" style="cursor:pointer"><circle cx="' + p.x + '" cy="' + p.y + '" r="14" fill="' + (n.type === 'idea' ? 'var(--surface)' : c) + '" stroke="' + c + '" stroke-width="3"' + (n.type === 'idea' ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + p.x + '" y="' + (p.y + 30) + '" text-anchor="middle" font-size="12" font-weight="700" style="paint-order:stroke;stroke:var(--surface);stroke-width:4px">' + esc(t) + '</text></g>'; });
    return '<p class="muted" style="margin:0 2px;font-size:13px">동아리 연구 전체가 어떻게 이어졌는지 보는 발표용 화면이에요. 원을 누르면 상세로 들어가요.</p><div class="mapbox"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:560px;height:auto">' + s + '</svg></div>';
  }
  const COLORS = ['#C26A00', '#2F6FDB', '#1F8F5A', '#6E4FE0', '#D2394B', '#475467'];
  function viewSettings() {
    const st = db.settings, th = prefs.theme || 'system';
    return '<div class="card" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="logo-edit"><span class="logo" id="logoPreview">' + logoInner() + '</span><div style="display:flex;flex-direction:column;gap:6px"><label class="btn" for="logoFile" style="min-height:40px">로고 바꾸기</label><input id="logoFile" type="file" accept="image/*" hidden>' + (st.logo ? '<button type="button" class="chipbtn" data-act="logoClear">기본 로고로</button>' : '') + '</div></div>' +
      '<label class="field">동아리 이름<input id="clubInput" maxlength="24" value="' + esc(st.clubName) + '"></label>' +
      '<div class="field">대표 색<div class="swatches">' + COLORS.map((c) => '<button type="button" data-color="' + c + '" aria-label="색 ' + c + '" aria-pressed="' + (st.color === c) + '" style="background:' + c + '"></button>').join('') + '</div></div>' +
      '<div class="field">화면 밝기<div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => '<button type="button" data-theme="' + k + '" aria-pressed="' + (th === k) + '">' + l + '</button>').join('') + '</div></div>' +
      '</div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>체험 데이터</b><span class="muted" style="font-size:13px">지금은 이 브라우저에만 저장돼요. 드라이브 연결은 다음 단계에서 열립니다.</span><button type="button" class="btn" data-act="reset">예시로 되돌리기</button></div>';
  }
  function viewAbout() {
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px;line-height:1.7"><b style="font-size:18px">가지 · 실험이 가지를 치며 이어지는 곳</b>' +
      '<span>계획서, 준비, 측정, 결과, 그리고 다음 실험까지 한 줄기로 이어서 기록하는 동아리 연구 관리 도구입니다.</span>' +
      '<span><b>데이터는 각 동아리의 구글 드라이브에만</b> 저장됩니다. 가지 제작자도 동아리 기록을 볼 수 없습니다.</span>' +
      '<span class="muted" style="font-size:13px">지금 보는 화면은 체험 모드예요. 바꾼 내용은 이 기기 브라우저에만 남습니다.</span></div>';
  }

  /* ---------- 새로 만들기 (아래에서 올라오는 창) ---------- */
  function openSheet(html) { $('#sheet').innerHTML = html; $('#sheet').hidden = false; $('#sheetBg').hidden = false; const f = $('#sheet input,#sheet select'); if (f) f.focus(); }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; }
  function newForm(type, parent) {
    const lines = [...new Set(db.nodes.map((n) => n.line).filter(Boolean))];
    const d = new Date(TODAY); d.setDate(d.getDate() + 14);
    const label = { exp: '새 실험', idea: '새 아이디어', q: '새 질문' }[type];
    openSheet('<h3>' + label + (parent ? ' · ' + esc(code(parent)) + '에서 이어서' : '') + '</h3><form id="newForm" data-type="' + type + '" data-parent="' + (parent ? parent.id : '') + '" style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="field">' + (type === 'q' ? '궁금한 것' : '제목') + '<input name="title" maxlength="60" required placeholder="' + (type === 'q' ? '예: 몰 농도는 언제 써요?' : '예: 소금 농도와 끓는점') + '"></label>' +
      '<label class="field">분야<select name="field">' + Object.keys(FCODE).map((f) => '<option' + (parent && parent.field === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></label>' +
      (type !== 'q' ? '<label class="field">' + (type === 'exp' ? '실험 예정일' : '해 보고 싶은 때') + '<input type="date" name="date" value="' + dstr(d) + '" required></label>' +
        (parent ? '' : '<label class="field">연구 줄기 (같은 주제끼리 묶여요)<select name="line"><option value="__new">새 줄기 만들기</option>' + lines.map((l) => '<option value="' + esc(l) + '">' + esc(lineName(l)) + '</option>').join('') + '</select></label>') : '') +
      '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">만들기</button></div></form>');
  }
  function create(f, parent) {
    const fam = f.type === 'q' ? 'q' : f.type === 'res' ? 'res' : 'exp';
    db.lastNo[fam] = (db.lastNo[fam] || 0) + 1;
    const n = Object.assign({ id: 'n' + Date.now().toString(36), no: db.lastNo[fam], created: dstr(TODAY), desc: '' }, f);
    db.nodes.push(n);
    if (parent) db.links.push({ s: parent.id, t: n.id, k: f.type === 'q' ? 'q' : 'next' });
    save(); return n;
  }

  /* ---------- 그리기 ---------- */
  const TITLES = { line: '', item: '', board: '보드', map: '전체 지도', settings: '설정', about: '가지 소개' };
  function logoInner() { const st = db.settings; return st.logo ? '<img src="' + esc(st.logo) + '" alt="">' : '<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="' + ICON.branch + '"/></svg>'; }
  function applyBrand() {
    const st = db.settings;
    document.documentElement.style.setProperty('--brand', st.color || '#C26A00');
    $('#clubName').textContent = st.clubName; $('#clubLogo').innerHTML = logoInner();
    const th = prefs.theme || 'system'; if (th === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th);
  }
  const titleOf = (e) => e.s === 'line' ? lineName(e.arg) : e.s === 'item' ? (byId(e.arg) ? TYPE[byId(e.arg).type].label + ' 상세' : '') : TITLES[e.s] || '';
  function viewFor(e) { return ({ home: viewHome, tree: viewTree, find: viewFind, more: viewMore, line: () => viewLine(e.arg), item: () => viewItem(e.arg), board: viewBoard, map: viewMap, settings: viewSettings, about: viewAbout }[e.s] || (() => ''))(); }
  function render(scrollTop) {
    applyBrand();
    const mi = mainIndex(), main = nav[mi], paneOn = mi < nav.length - 1, root = mi === 0;
    $('#backBtn').hidden = root; $('#brand').hidden = !root; $('#screenTitle').hidden = root;
    if (!root) $('#screenTitle').textContent = titleOf(main);
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === nav[0].s ? 'page' : 'false'));
    $('#screen').innerHTML = viewFor(main);
    $('#pane').hidden = !paneOn;
    if (paneOn) {
      const p = cur(); $('#paneTitle').textContent = titleOf(p); $('#paneBack').hidden = nav.length - 1 - mi <= 1;
      $('#paneBody').innerHTML = viewFor(p);
      const sel = p.s === 'item' ? '[data-item="' + p.arg + '"]' : '[data-line="' + p.arg + '"]';
      document.querySelectorAll('#screen ' + sel).forEach((el) => el.classList.add('sel-ring'));
    }
    if (scrollTop) window.scrollTo(0, 0);
  }

  /* ---------- 이벤트 ---------- */
  document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
  $('#backBtn').addEventListener('click', back);
  $('#paneBack').addEventListener('click', () => { nav.pop(); render(); });
  $('#paneClose').addEventListener('click', () => { nav = nav.slice(0, mainIndex() + 1); render(); });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => render(), 150); });
  $('#sheetBg').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  function onClick(e, src) {
    const t = e.target;
    const it = t.closest('[data-item],[data-go]'); if (it) return go('item', it.dataset.item || it.dataset.go, src);
    const ln = t.closest('[data-line]'); if (ln) return go('line', ln.dataset.line, src);
    const nw = t.closest('[data-new]'); if (nw) return newForm(nw.dataset.new);
    const tg = t.closest('[data-tab-go]'); if (tg) return tab(tg.dataset.tabGo);
    const gs = t.closest('[data-go-screen]'); if (gs) return go(gs.dataset.goScreen);
    const tm = t.closest('[data-tmode]'); if (tm) { prefs.treeMode = tm.dataset.tmode; savePrefs(); return render(); }
    if (t.closest('[data-fold]')) { prefs.showDone = !prefs.showDone; savePrefs(); return render(); }
    const ty = t.closest('[data-ty]'); if (ty) { prefs.ty = ty.dataset.ty; savePrefs(); return render(); }
    const col = t.closest('[data-color]'); if (col) { db.settings.color = col.dataset.color; save(); return render(); }
    const th = t.closest('[data-theme]'); if (th) { prefs.theme = th.dataset.theme; savePrefs(); return render(); }
    const a = t.closest('[data-act]'); if (!a) return;
    const n = cur().s === 'item' ? byId(cur().arg) : null, act = a.dataset.act;
    if (act === 'reset') { db = freshSample(); save(); toast('예시 데이터로 되돌렸어요'); return render(); }
    if (act === 'logoClear') { db.settings.logo = ''; save(); return render(); }
    if (!n) return;
    if (act === 'copy') { const c = code(n); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast(c + ' 복사했어요'), () => toast('번호: ' + c)); return; }
    if (act === 'fan') { n.fans = (n.fans || 0) + 1; toast('같이 해요 ' + n.fans + '명'); }
    if (act === 'volunteer') { n.volunteer = '나'; toast('담당으로 지원했어요'); }
    if (act === 'equip') { n.equip = true; toast('장비 확인 완료'); }
    if (act === 'convert') { n.type = 'exp'; n.status = '계획 작성'; n.owner = n.volunteer; n.signal = 0; n.review = 0; toast('계획서가 됐어요 · 번호 ' + code(n) + ' 그대로'); }
    if (act === 'advance') { const i = STAGES.indexOf(n.status); n.status = STAGES[i + 1]; if (n.status === '준비 중') n.signal = n.signal || 2; toast(n.status + ' 단계로 옮겼어요'); }
    if (act === 'solve') { n.status = '해결'; toast('해결됨으로 표시했어요'); }
    if (act === 'branch') { save(); return newForm('idea', n); }
    if (act === 'toIdea') { save(); return newForm('idea', n); }
    save(); render();
  }
  $('#screen').addEventListener('click', (e) => onClick(e, 'main'));
  $('#paneBody').addEventListener('click', (e) => onClick(e, 'pane'));
  const onKey = (src) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('g[data-go]')) { e.preventDefault(); go('item', e.target.closest('g[data-go]').dataset.go, src); } };
  $('#screen').addEventListener('keydown', onKey('main'));
  $('#paneBody').addEventListener('keydown', onKey('pane'));
  $('#screen').addEventListener('input', (e) => {
    if (e.target.id === 'q') { prefs.q = e.target.value; savePrefs(); const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
    if (e.target.id === 'clubInput') { db.settings.clubName = e.target.value.trim() || '실험 동아리'; save(); applyBrand(); }
  });
  $('#screen').addEventListener('change', (e) => {
    if (e.target.id !== 'logoFile' || !e.target.files[0]) return;
    const f = e.target.files[0]; if (f.size > 2e6) return toast('2MB 이하 이미지를 골라 주세요');
    const img = new Image(), r = new FileReader();
    r.onload = () => { img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 160; const cx = cv.getContext('2d'), s = Math.min(img.width, img.height);
      cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160); db.settings.logo = cv.toDataURL('image/png'); save(); render(); toast('로고를 바꿨어요'); }; img.src = r.result; };
    r.readAsDataURL(f);
  });
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-act="closeSheet"]')) closeSheet(); });
  $('#sheet').addEventListener('submit', (e) => {
    e.preventDefault(); const fm = e.target, fd = new FormData(fm), type = fm.dataset.type, parent = fm.dataset.parent ? byId(fm.dataset.parent) : null;
    const title = String(fd.get('title') || '').trim(); if (!title) return;
    const f = { type, title, field: fd.get('field'), date: fd.get('date') || dstr(TODAY) };
    if (type !== 'q') { let ln = parent ? parent.line : fd.get('line'); if (!ln || ln === '__new') { ln = 'L' + Date.now().toString(36); db.lines[ln] = title.slice(0, 12); } f.line = ln; }
    if (type === 'exp') Object.assign(f, { status: '계획 작성', owner: '나', signal: 0, review: 0 });
    if (type === 'idea') Object.assign(f, { status: '아이디어', fans: 1, volunteer: '', equip: false });
    if (type === 'q') f.status = '미해결';
    const n = create(f, parent); closeSheet(); toast(TYPE[type].label + '를 만들었어요 · ' + code(n)); go('item', n.id, 'main');
  });

  render();
})();
