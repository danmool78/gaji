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
  /* 진단 화면: 주소 끝에 ?debug 를 붙이면 오른쪽 위에 상태가 보임 */
  const DEBUG = /[?&]debug/.test(location.search);
  const D = { 열림: 0, 그리기: 0, 바뀜: 0, 동아리설정: 0, 로그인변화: 0, 크기변화: 0, 모드: '', 포커스잃음: '', 복사: '', 오류: '', 클릭: '', 클릭도착: '', 바뀐이유: '' };
  try { D.열림 = +(sessionStorage.getItem('gajiLoads') || 0) + 1; sessionStorage.setItem('gajiLoads', D.열림); } catch (e) {}
  function dbg(k, v) {
    if (k) D[k] = v === undefined ? (D[k] || 0) + 1 : v;
    if (!DEBUG) return;
    let el = document.getElementById('dbg');
    if (!el) { el = document.createElement('pre'); el.id = 'dbg'; el.style.cssText = 'position:fixed;top:4px;right:4px;z-index:999;margin:0;background:rgba(0,0,0,.82);color:#7CFC9A;font:12px/1.5 monospace;padding:8px 10px;border-radius:8px;max-width:46vw;pointer-events:none;white-space:pre-wrap'; document.body.appendChild(el); }
    el.textContent = Object.entries(D).map(([a, b]) => a + ': ' + b).join('\n') + '\n' + navigator.userAgent.replace(/.*\) /, '').slice(0, 60);
  }
  if (DEBUG) {
    document.addEventListener('focusout', (e) => { const t = e.target; dbg('포커스잃음', (t.name || t.id || t.tagName) + ' → ' + (e.relatedTarget ? (e.relatedTarget.name || e.relatedTarget.id || e.relatedTarget.tagName) : '없음') + ' @' + new Date().toLocaleTimeString()); }, true);
    document.addEventListener('pointerdown', (e) => { const t = e.target.closest('[data-act],input,button,textarea') || e.target; dbg('클릭', (t.dataset && t.dataset.act) || t.name || t.id || t.tagName); }, true);
    window.addEventListener('error', (e) => dbg('오류', e.message));
    setInterval(() => dbg(), 1000);
  }
  function toast(msg, action) {
    const t = $('#toast'); t.textContent = msg;
    if (action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label; b.onclick = () => { t.hidden = true; action.fn(); }; t.appendChild(b); }
    t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), action ? 8000 : 2400);
  }

  /* ---------- 저장 (체험 모드: 이 브라우저에만) ---------- */
  // 체험: 이 브라우저에만 저장, 날짜가 바뀌면 처음 상태로 (매일 리셋)
  const KEY = 'gaji-demo-v2';
  function freshSample() {
    const S = JSON.parse(JSON.stringify(window.GAJI_SAMPLE));
    const shiftDays = Math.round((TODAY - new Date(S.base)) / 864e5);
    // 'YYYY-MM-DD' 또는 'YYYY-MM-DDT…' 글자를 모두 오늘 기준으로 옮김 (계획서 · 진행 노트 · 댓글 · 사진 시각까지)
    const mv = (v) => { const d = new Date(String(v).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + shiftDays); const ymd = d.toISOString().slice(0, 10); return String(v).length > 10 ? ymd + String(v).slice(10) : ymd; };
    const walk = (o) => { if (Array.isArray(o)) return o.map(walk); if (o && typeof o === 'object') { const r = {}; Object.keys(o).forEach((k) => { const nk = /^\d{4}-\d\d-\d\d/.test(k) ? k : k; r[nk] = walk(o[k]); }); return r; } return typeof o === 'string' && /^\d{4}-\d\d-\d\d(T[\d:.]+Z)?$/.test(o) ? mv(o) : o; };
    const out = walk({ nodes: S.nodes, comments: S.comments || [], files: S.files || [] });
    S.nodes = out.nodes; S.comments = out.comments; S.files = out.files;
    S.lastNo = { exp: Math.max(27, ...S.nodes.filter((n) => n.type !== 'q' && n.type !== 'res').map((n) => n.no || 0)), q: Math.max(7, ...S.nodes.filter((n) => n.type === 'q').map((n) => n.no || 0)), res: 6 };
    S.day = dstr(new Date());
    return S;
  }
  // 날짜가 바뀌거나 예시 데이터가 새 판(ver)이면 처음 상태로
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.day === dstr(new Date()) && s.ver === (window.GAJI_SAMPLE.ver || '')) return s; } catch (e) {} return freshSample(); }
  function save() { if (PF.mode === 'live') return scheduleSync(); try { db.day = db.day || dstr(new Date()); localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('이 브라우저 저장 공간이 꽉 찼어요'); } }
  let db = load();
  /* 실제 동아리 주소(/c/주소)로 열렸을 때 platform.js 가 채워 줌 */
  const PF = { club: null, isMaster: false, api: null, slug: null, handover: null, mode: 'demo', me: null, dev: null, rev: 0, base: null, busy: false, newDevices: [], people: null, myMoves: {},
    approveId: new URLSearchParams(location.search).get('approve') };
  window.GAJI_APP = {
    setClub(club, isMaster, api, slug) {
      dbg('동아리설정');
      // 같은 동아리를 다시 알려 주면(저장해 둔 정보로 먼저 연 뒤 명부 확인) 다시 시작하지 않고 정보만 바꿈
      if (PF.started && PF.slug === slug && PF.club && (PF.club.connector || '') === (club.connector || '')) {
        PF.club = club; PF.isMaster = !!isMaster; PF.api = api; if (PF.mode === 'live') masterExtras(); if (PF.mode === 'join' || PF.mode === 'closed' || PF.mode === 'preview') startClub(); else render(); return;
      }
      PF.club = club; PF.isMaster = !!isMaster; PF.api = api; PF.slug = slug; PF.started = true; startClub();
    },
    refresh() { render(); }, toast: (m) => toast(m), dbg: (k, v) => dbg(k, v),
    open(sc) { nav = [{ s: 'more' }, { s: sc }]; render(true); }
  };
  const brand = () => PF.club ? { clubName: PF.club.name, color: PF.club.color, color2: PF.club.color2 || '', logo: PF.club.logo || '' } : db.settings;
  const canEditBrand = () => !PF.club || PF.isMaster;
  function saveBrand(patch) {
    if (PF.club) { if (!PF.isMaster) return toast('동아리 마스터만 바꿀 수 있어요'); Object.assign(PF.club, patch); render(); PF.api.savePublic(patch).catch(() => toast('저장하지 못했어요 · 다시 시도해 주세요')); return; }
    if ('name' in patch) { db.settings.clubName = patch.name; delete patch.name; }
    Object.assign(db.settings, patch); save(); render();
  }
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('gaji-prefs') || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('gaji-prefs', JSON.stringify(prefs)); } catch (e) {} };

  /* ================= 드라이브 연결 (동아리 연결기) =================
   * mode: demo(체험) · preview(마스터, 연결 전 · 예시 데이터) · closed(부원, 연결 전)
   *       join(학번 + 개인 코드) · pending(승인 기다림) · loading · error · live(연결됨) */
  const NEED_VER = '1.1.0';   // 이 화면에 꼭 필요한 연결기 판 (이보다 낮을 때만 업데이트 안내)
  const LATEST_VER = '2.0.0';   // 2.0.0부터 자동 업데이트 연결기
  const verOld = (v, need) => { const a = String(v || '0').split('.').map(Number), b = (need || NEED_VER).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i]; } return false; };
  const GATE = new Set(['closed', 'join', 'pending', 'loading', 'error']);
  const devKey = () => 'gaji-dev:' + PF.slug;
  const getDev = () => { try { return JSON.parse(localStorage.getItem(devKey()) || 'null'); } catch (e) { return null; } };
  const putDev = (d) => { try { localStorage.setItem(devKey(), JSON.stringify(d)); } catch (e) {} PF.dev = d; };
  const cacheKey = () => 'gaji-cache:' + PF.slug;
  const dropDev = () => { try { localStorage.removeItem(devKey()); localStorage.removeItem(cacheKey()); } catch (e) {} PF.dev = null; };
  // 마지막으로 불러온 데이터를 이 기기에 보관 → 다음에 열 때 바로 보여 주고 뒤에서 최신으로 맞춤
  function putCache(d) { try { localStorage.setItem(cacheKey(), JSON.stringify({ url: PF.club.connector, at: Date.now(), d })); } catch (e) {} }
  function getCache() { try { const c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); return c && c.url === PF.club.connector ? c : null; } catch (e) { return null; } }
  // 내 역할: 연결된 동아리는 연결기가 알려 준 역할, 체험은 고른 사람의 역할, 연결 전 마스터 미리 보기는 마스터
  const myRole = () => PF.mode === 'live' ? (PF.me && PF.me.role) || '부원' : PF.mode === 'preview' ? '마스터' : (((typeof db !== 'undefined' && db.members) || []).find((m) => m.name === meName()) || { role: '마스터' }).role;
  const isAdmin = () => myRole() === '관리자' || myRole() === '마스터' || myRole() === '교사';
  const meName = () => (PF.mode === 'live' && PF.me ? PF.me.name : prefs.demoMe || '김기장');
  const URL_RE = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/;
  function deviceLabel() {
    const u = navigator.userAgent;
    if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(u)) return 'iPhone';
    if (/Android/.test(u)) return /Mobile/.test(u) ? '안드로이드 휴대폰' : '안드로이드 태블릿';
    if (/CrOS/.test(u)) return '크롬북'; if (/Windows/.test(u)) return 'Windows PC'; if (/Mac/.test(u)) return 'Mac'; return '기기';
  }
  /* 기다리는 동안: 누른 버튼에 스피너 + 화면 위 진행 막대 (뒤에서 몰래 하는 확인은 quiet) */
  const SPIN = '<span class="spin" aria-hidden="true"></span>';
  let lastBtn = null, lastAt = 0, pending = 0;
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button,a.btn'); if (b) { lastBtn = b; lastAt = Date.now(); } }, true);
  document.addEventListener('submit', (e) => { const b = e.submitter || e.target.querySelector('[type=submit]'); if (b) { lastBtn = b; lastAt = Date.now(); } }, true);
  function busyStart(quiet) {
    if (quiet) return null;
    pending++; document.documentElement.classList.add('loading');
    const b = Date.now() - lastAt < 1500 && lastBtn && document.contains(lastBtn) ? lastBtn : null;
    if (b && !b.classList.contains('busy')) { b.classList.add('busy'); b.setAttribute('aria-busy', 'true'); if (b.tagName === 'BUTTON') b.disabled = true; return b; }
    return null;
  }
  function busyEnd(quiet, b) {
    if (quiet) return;
    pending = Math.max(0, pending - 1); if (!pending) document.documentElement.classList.remove('loading');
    if (b) { b.classList.remove('busy'); b.removeAttribute('aria-busy'); if (b.tagName === 'BUTTON') b.disabled = false; }
  }
  async function rpc(action, data, url, opt) {
    let j; const quiet = !!(opt && opt.quiet), btnBusy = busyStart(quiet);
    try {
      const r = await fetch(url || PF.club.connector, { method: 'POST', body: JSON.stringify(Object.assign({ action, device: PF.dev ? { id: PF.dev.id, secret: PF.dev.secret } : null }, data || {})) });
      j = await r.json();
    } catch (e) { busyEnd(quiet, btnBusy); const x = new Error('연결기에 닿지 않아요. 인터넷이나 연결기 주소를 확인해 주세요'); x.code = 'network'; throw x; }
    busyEnd(quiet, btnBusy);
    if (j && !j.ok && (j.code === 'core' || j.code === 'core_perm')) { PF.connAuth = 'core'; const x = new Error(j.code === 'core_perm' || /permission|권한/i.test(j.message || '') ? '연결기에 외부 연결 권한이 없어요 · 설정 → 드라이브 연결의 안내대로 권한허용을 실행해 주세요' : (j.message || '연결기가 가지 본체를 받지 못했어요')); x.code = j.code; throw x; }
    if (!j || !j.ok) { const x = new Error(j && j.code === 'unknown' ? '연결기가 예전 판이라 이 기능이 없어요. 마스터가 연결기를 업데이트해야 해요 (설정 → 드라이브 연결)' : (j && j.message) || '연결기에서 문제가 생겼어요'); x.code = (j && j.code) || 'error'; throw x; }
    return j.data;
  }
  // 기기가 끊긴 경우 공통 처리
  function dropCacheOnly() { try { localStorage.removeItem(cacheKey()); } catch (x) {} }
  function deviceLost(e) {
    if (['no_device', 'blocked', 'member_off', 'expired'].includes(e.code)) { dropDev(); PF.mode = 'join'; PF.notice = e.message; render(); return true; }
    if (e.code === 'pending') { dropCacheOnly(); PF.mode = 'loading'; liveLoad(); return true; }
    return false;
  }
  async function startClub() {
    const c = PF.club; PF.notice = PF.notice || '';
    if (!c.connector) { PF.mode = PF.isMaster ? 'preview' : 'closed'; return render(); }
    let d = getDev(); if (d && d.url !== c.connector) { dropDev(); d = null; }
    if (!d) { PF.mode = 'join'; return render(); }
    PF.dev = d;
    const cached = getCache();
    if (cached) { applyLoad(cached.d); PF.refreshing = true; render(); }
    else { PF.mode = 'loading'; render(); }
    return liveLoad();
  }
  function pollPending() {
    clearTimeout(pollPending.t);
    pollPending.t = setTimeout(async () => {
      if (PF.mode !== 'pending') return;
      if (document.visibilityState === 'visible') {
        try { const st = await rpc('status', null, null, { quiet: true }); if (st.status === '승인') { toast('승인됐어요!'); return liveLoad(); } }
        catch (e) { if (deviceLost(e)) return; }
      }
      pollPending();
    }, 4000);
  }
  const fixNode = (n) => Object.assign(n, { equip: n.equip === true || n.equip === 'true', fans: +n.fans || 0, signal: +n.signal || 0, review: +n.review || 0, no: +n.no || 0, date: n.date || n.created || dstr(TODAY), created: n.created || dstr(TODAY), field: n.field || '공통', desc: n.desc || '' });
  const lkey = (l) => l.s + '|' + l.t + '|' + l.k;
  function snapshot() { const m = {}; db.nodes.forEach((n) => (m[n.id] = JSON.stringify(n))); return { nodes: m, links: new Set(db.links.map(lkey)), lines: JSON.stringify(db.lines) }; }
  function tidyLater() {
    const today = dstr(new Date()); if (prefs.tidyAt === today) return; prefs.tidyAt = today; savePrefs();
    setTimeout(() => rpc('tidy', null, null, { quiet: true }).then((r) => { if (r && r.moved) liveLoad(); }, () => {}), 4000);
  }
  function masterExtras() {   // 마스터: 연결기 판 확인 · 사용 현황 숫자 보내기 (뒤에서)
    if (PF.isMaster && !PF.connVer) rpc('ping', null, null, { quiet: true }).then((pg) => { PF.connVer = pg.version; PF.connShell = pg.shell || ''; render(); }, () => {});
    if (PF.isMaster && PF.api && !PF.statsSent) { PF.statsSent = true; rpc('stats', null, null, { quiet: true }).then((st) => PF.api.saveStats(st)).catch(() => {}); }
  }
  function applyLoad(d) {
    PF.me = d.me; PF.rev = d.rev; PF.rules = d.rules || null; PF.newDevices = (d.newDevices || []).filter((x) => !(prefs.seenDev || []).includes(x.id));
    db = { settings: db.settings, nodes: d.nodes.map(fixNode), links: d.links, lines: d.lines || {}, lastNo: d.lastNo || { exp: 0, q: 0, res: 0 }, comments: d.comments || [], files: d.files || [] }; PF.members = d.members || [];
    PF.base = snapshot(); PF.mode = 'live';
  }
  async function liveLoad() {
    try {
      if (PF.mode === 'live' && PF.base && dirty()) await doSync();
      const d = await rpc('load');
      if (PF.mode === 'live' && PF.base && dirty()) { await doSync(); return liveLoad(); }   // 기다리는 사이 고친 것이 있으면 먼저 보내고 다시
      applyLoad(d); putCache(d); PF.refreshing = false; PF.notice = ''; render(); pollRev(); tidyLater();
      masterExtras();
      if (PF.approveId) { const id = PF.approveId; PF.approveId = null; history.replaceState(null, '', location.pathname); openApprove(id); }
    } catch (e) {
      PF.refreshing = false;
      if (e.code === 'pending') {   // 아직 승인 전
        try { const st = await rpc('status'); PF.pending = st; PF.mode = 'pending'; render(); pollPending(); return; } catch (e2) { e = e2; }
      }
      if (deviceLost(e)) return;
      if (PF.mode === 'live') { render(); toast('최신 내용을 불러오지 못했어요 · 이 기기에 저장된 내용을 보여 줘요'); pollRev(); return; }
      PF.mode = 'error'; PF.error = e.message; render();
    }
  }
  /* 바꾼 것만 연결기로 보냄 → 번호는 연결기가 매김 */
  function dirty() {
    const nodes = db.nodes.filter((n) => PF.base.nodes[n.id] !== JSON.stringify(n)), links = db.links.filter((l) => !PF.base.links.has(lkey(l)));
    const now = new Set(db.links.map(lkey)), unlinks = [...PF.base.links].filter((k) => !now.has(k)).map((k) => { const [s, t, kk] = k.split('|'); return { s, t, k: kk, off: true }; });
    const lines = JSON.stringify(db.lines) !== PF.base.lines;
    return nodes.length || links.length || unlinks.length || lines ? { nodes, links, unlinks, lines } : null;
  }
  function scheduleSync() { clearTimeout(scheduleSync.t); scheduleSync.t = setTimeout(doSync, 300); }
  async function doSync() {
    if (PF.mode !== 'live') return; if (PF.busy) return scheduleSync();
    const d = dirty(); if (!d) return;
    const sent = d.nodes.map((n) => JSON.parse(JSON.stringify(n))), links = d.links.map((l) => ({ s: l.s, t: l.t, k: l.k })).concat(d.unlinks), lines = Object.assign({}, db.lines);
    PF.busy = true; applyBrand();
    try {
      const r = await rpc('sync', { nodes: sent, links, lines });
      PF.busy = false;
      if (r.rejected && r.rejected.length) { const rj = r.rejected.join(' '); toast(/:stage:teacher/.test(rj) ? '지도 선생님이 승인해야 준비를 시작할 수 있어요' : /:stage:plan/.test(rj) ? '계획서(목적 · 방법)를 먼저 다 써야 다음 단계로 갈 수 있어요' : /:stage:review/.test(rj) ? '다른 부원 2명이 승인해야 준비를 시작할 수 있어요' : /:stage:result/.test(rj) ? '결과와 결론을 기록해야 기록 완료가 돼요' : /:stage/.test(rj) ? '단계는 하나씩, 내용을 채운 뒤에 넘어갈 수 있어요' : /:team/.test(rj) ? '담당 · 함께하는 사람 · 기장 · 선생님만 고칠 수 있어요' : /:final/.test(rj) ? '확정된 보고서예요 · 관리자가 확정을 풀어야 고칠 수 있어요' : '결과 판정 · 취소 · 단계 되돌리기는 관리자만 할 수 있어요'); return liveLoad(); }
      sent.forEach((s) => { const no = r.assigned && r.assigned[s.id]; const n = byId(s.id); if (no) { s.no = no; if (n) n.no = no; } PF.base.nodes[s.id] = JSON.stringify(s); });
      links.forEach((l) => (l.off ? PF.base.links.delete(lkey(l)) : PF.base.links.add(lkey(l)))); PF.base.lines = JSON.stringify(lines);
      PF.rev = r.rev; render();
      if (dirty()) scheduleSync();
    } catch (e) { PF.busy = false; applyBrand(); if (!deviceLost(e)) { toast('저장하지 못했어요 · 잠시 뒤 다시 보낼게요'); clearTimeout(scheduleSync.t); scheduleSync.t = setTimeout(doSync, 8000); } }
  }
  // 다른 사람이 바꾼 것: 15초마다 번호(rev)만 확인
  function pollRev() {
    clearTimeout(pollRev.t);
    pollRev.t = setTimeout(async () => {
      if (PF.mode !== 'live') return;
      if (document.visibilityState === 'visible' && !PF.busy && !dirty() && $('#sheet').hidden) {
        try { const r = await rpc('rev', null, null, { quiet: true }); if (r.rev !== PF.rev) return liveLoad(); } catch (e) { if (deviceLost(e)) return; }
      }
      pollRev();
    }, 15000);
  }
  // 저장이 끝나기 전에 창을 닫으려 하면 붙잡기 (연결기 저장은 몇 초 걸림)
  // 체험: 누구로 써 볼지 고르기 (이름만 바뀜)
  $('#demoPill').addEventListener('click', () => { if (PF.mode !== 'demo') return; demoWho(); });
  function demoWho() {
    const ms = db.members || [{ name: '김기장', role: '마스터', note: '기장' }];
    openSheet('<h3>누구로 체험할까요?</h3><p class="muted" style="margin:0;font-size:13px">북일고등학교 실험 동아리는 체험용 가상 동아리예요. 바꾼 내용은 이 브라우저에만 저장되고 <b>매일 처음 상태로 돌아가요.</b></p><div class="move-list">' +
      ms.map((m) => '<button type="button" class="srow" data-act="demoMe" data-name="' + esc(m.name) + '"><span class="tx"><b>' + esc(m.name) + '</b><small>' + esc(m.note || (m.role === '부원' ? '부원' : m.role)) + '</small></span>' + (meName() === m.name ? '<span class="badge t-info">지금</span>' : '') + '</button>').join('') +
      '</div><div class="btn-row"><button type="button" class="btn" data-act="demoReset">처음 상태로 되돌리기</button><button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
  }
  window.addEventListener('beforeunload', (e) => { if (PF.mode === 'live' && (PF.busy || (PF.base && dirty()))) { e.preventDefault(); e.returnValue = '아직 저장 중이에요'; return '아직 저장 중이에요'; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && PF.mode === 'live' && PF.base && dirty()) doSync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && PF.mode === 'live') { clearTimeout(pollRev.t); pollRev.t = setTimeout(() => rpc('rev', null, null, { quiet: true }).then((r) => { if (r.rev !== PF.rev && !dirty()) liveLoad(); else pollRev(); }, (e) => { if (!deviceLost(e)) pollRev(); }), 50); } });

  /* ---------- 들어가기 화면 (탭 없이 한 장) ---------- */
  function gateCard(inner) { return '<div class="gate"><span class="logo gate-logo">' + logoInner() + '</span><b class="gate-name">' + esc(brand().clubName) + '</b>' + inner + '</div>'; }
  function viewGate() {
    const m = PF.mode;
    if (m === 'loading') return gateCard('<p class="muted loading-line">' + SPIN + '동아리 드라이브에 연결하는 중…</p>');
    if (m === 'error') {
      if (PF.isMaster) fetchGs();
      const core = PF.connAuth === 'core';
      return gateCard('<div class="card gate-box"><b>연결하지 못했어요</b><p class="muted">' + esc(PF.error) + '</p>' +
        (core ? (PF.isMaster
          ? '<div class="gate-note card" style="text-align:left;line-height:1.8;font-weight:400"><b>연결기 권한 허용이 필요해요 (마스터)</b><br>① 가지 데이터 시트 → 확장 프로그램 → <b>Apps Script</b><br>② 아래 <b>연결기 코드 복사</b> → 코드 전체 지우고 붙여 넣기 → <b>저장</b><br>③ 위쪽 <b>▷ 실행</b> 왼쪽 함수 목록에서 <b>권한허용</b> → <b>▷ 실행</b> → 권한 검토 → 고급 → 이동 → <b>허용</b><br>④ 아래 <b>실행 로그</b>에 ‘준비 완료’가 보이면 여기서 <b>다시 시도</b><br>빨간 오류가 보이면 그 화면을 캡처해 주세요.</div>' +
            '<button type="button" class="btn" data-act="copyGs">연결기 코드 복사</button><textarea id="gsCode" class="gs-code" readonly spellcheck="false" style="height:90px">' + esc(PF.gs || '불러오는 중…') + '</textarea>'
          : '<p class="muted" style="font-size:13px">동아리 마스터가 연결기를 손보는 중이에요. 잠시 뒤 다시 열어 주세요.</p>') : '') +
        '<button type="button" class="btn primary" data-act="retry">다시 시도</button></div>');
    }
    if (m === 'closed') return gateCard('<div class="card gate-box"><b>아직 준비 중이에요</b><p class="muted">동아리 마스터가 드라이브를 연결하면 이 주소에서 바로 쓸 수 있어요.</p><a class="btn" href="/c/demo">가지 체험해 보기</a>' + (PF.api ? '<button type="button" class="chipbtn" data-act="pfLogin">동아리 마스터라면 구글로 로그인</button>' : '') + '</div>');
    if (m === 'pending') {
      const p = PF.pending || {}, d = PF.dev || {};
      return gateCard('<div class="card gate-box"><b>승인 기다리는 중</b><p class="muted">' + esc(p.name || d.name || '') + ' · ' + esc(d.label || deviceLabel()) + '</p>' +
        '<div class="confirm-num" aria-label="확인 숫자">' + esc(p.confirm || '').split('').map((c) => '<span>' + c + '</span>').join('') + '</div><small class="muted">확인 숫자</small>' +
        '<button type="button" class="btn primary" data-act="askApprove">기장님께 승인 요청 보내기</button>' +
        '<p class="muted" style="font-size:13px">카톡 등으로 승인 링크를 보내요. 관리자가 승인하면 이 화면이 저절로 열려요.</p>' +
        '<button type="button" class="chipbtn" data-act="restartJoin">다른 학번으로 다시 하기</button></div>');
    }
    // join
    const mk = PF.isMaster && PF.club.masterKey;
    return gateCard((PF.notice ? '<div class="card gate-note">' + esc(PF.notice) + '</div>' : '') +
      '<form class="card gate-box" id="joinForm"><b>들어가기</b>' +
      '<label class="field">학번<input name="sid" inputmode="numeric" autocomplete="username" maxlength="12" required placeholder="예: 20315"></label>' +
      '<label class="field">개인 코드 <span class="muted" style="font-weight:400">관리자에게 받은 4자리</span><input name="code" inputmode="numeric" autocomplete="current-password" type="password" maxlength="4" pattern="[0-9]{4}" required placeholder="••••"></label>' +
      '<button type="submit" class="btn primary">들어가기</button>' +
      '<p class="muted" style="font-size:12px;line-height:1.6">처음 쓰는 기기는 기장님 승인 뒤에 열려요. 내 코드와 기기는 다른 사람에게 빌려주지 않아요.</p></form>' +
      (mk ? '<form class="card gate-box" id="masterJoinForm"><b>동아리 마스터로 이 기기 연결</b><p class="muted" style="font-size:13px">구글로 로그인한 마스터는 승인 없이 바로 연결돼요.</p>' +
        '<label class="field">내 학번<input name="sid" inputmode="numeric" maxlength="12" required></label>' +
        '<label class="field">내 이름 <span class="muted" style="font-weight:400">처음 쓰는 학번일 때만</span><input name="name" maxlength="20"></label>' +
        '<button type="submit" class="btn">마스터로 연결</button></form>'
        : (PF.api && !PF.isMaster ? '<button type="button" class="chipbtn" data-act="pfLogin">동아리 마스터라면 구글로 로그인</button>' : '')));
  }
  async function submitJoin(f) {
    const fd = new FormData(f), sid = String(fd.get('sid')).trim(), code = String(fd.get('code')).trim(), btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const label = deviceLabel(), r = await rpc('register', { studentId: sid, code, label });
      putDev({ id: r.device.id, secret: r.device.secret, url: PF.club.connector, name: r.name, studentId: sid, label });
      PF.pending = { status: '대기', name: r.name, confirm: r.confirm }; PF.mode = 'pending'; PF.notice = ''; render(); pollPending();
    } catch (e) { btn.disabled = false; toast(e.message); }
  }
  async function submitMasterJoin(f) {
    const fd = new FormData(f), sid = String(fd.get('sid')).trim(), name = String(fd.get('name') || '').trim(), btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const label = deviceLabel(), r = await rpc('masterRegister', { masterKey: PF.club.masterKey, studentId: sid, name, label, slug: PF.slug });
      putDev({ id: r.device.id, secret: r.device.secret, url: PF.club.connector, name: r.name, studentId: sid, label });
      if (r.code) showCode(r.name, r.code, true);
      liveLoad();
    } catch (e) { btn.disabled = false; toast(e.message); }
  }
  function askApprove() {
    const d = PF.dev || {}, p = PF.pending || {}, link = location.origin + '/c/' + PF.slug + '?approve=' + encodeURIComponent(d.id);
    const text = '기장님, 가지 새 기기 승인 부탁해요\n' + (p.name || d.name) + ' (' + (d.studentId || '') + ') · ' + (d.label || '') + ' · 확인 숫자 ' + (p.confirm || '');
    if (navigator.share) return navigator.share({ title: '가지 기기 승인', text, url: link }).catch(() => {});
    (navigator.clipboard ? navigator.clipboard.writeText(text + '\n' + link) : Promise.reject()).then(() => toast('메시지를 복사했어요 · 카톡에 붙여 넣어 주세요'), () => toast(link));
  }

  /* 내 개인 코드 보기. 예전 판에서 만든 마스터 코드는 꺼낼 수 없으니 새로 만들고 이 기기를 마스터 키로 다시 연결 */
  async function myCode() {
    try {
      const r = await rpc('myCode'); showCode(r.name, r.code, true);
      if (r.renewed) toast('예전 판 코드라 새 코드를 만들었어요 · 앞으로 이 코드를 써요');
    } catch (er) {
      if (deviceLost(er)) return;
      if (er.code === 'no_code' && PF.isMaster && PF.club.masterKey && PF.dev && PF.dev.studentId) {
        try {
          const rc = await rpc('resetCode', { id: PF.me.id });
          const mr = await rpc('masterRegister', { masterKey: PF.club.masterKey, studentId: PF.dev.studentId, label: PF.dev.label || deviceLabel(), slug: PF.slug });
          putDev(Object.assign({}, PF.dev, { id: mr.device.id, secret: mr.device.secret }));
          showCode(PF.me.name, rc.code, true); toast('예전 판 코드라 새 코드를 만들었어요 · 앞으로 이 코드를 써요');
        } catch (e2) { toast(e2.message); }
        return;
      }
      toast(er.code === 'no_code' ? '예전 판에서 만든 코드라 볼 수 없어요. 관리자에게 코드 다시 만들기를 부탁해 주세요' : er.message);
    }
  }

  /* ---------- 승인 (관리자) ---------- */
  async function openApprove(id) {
    if (!isAdmin()) return toast('기기 승인은 관리자만 할 수 있어요');
    openSheet('<h3>기기 승인</h3><p class="muted loading-line">' + SPIN + '불러오는 중…</p>');
    try {
      const d = await rpc('getDevice', { id });
      if (d.status !== '대기') return openSheet('<h3>기기 승인</h3><p>' + esc(d.member) + ' · ' + esc(d.label) + '</p><p class="muted">이미 처리된 요청이에요 (' + esc(d.status) + ').</p><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
      openSheet('<h3>기기 승인</h3><div class="approve-who"><b>' + esc(d.member) + '</b><span class="code muted">' + esc(d.studentId) + '</span></div>' +
        '<dl class="kv"><dt>기기</dt><dd>' + esc(d.label || '알 수 없음') + '</dd><dt>쓰는 기기</dt><dd>' + d.others + '대' + (d.others >= 5 ? ' <span class="badge t-warn">기기 많음</span>' : '') + '</dd><dt>요청</dt><dd>' + esc(String(d.createdAt).slice(0, 16).replace('T', ' ')) + '</dd></dl>' +
        '<div class="confirm-num">' + esc(d.confirm).split('').map((c) => '<span>' + c + '</span>').join('') + '</div>' +
        '<p class="muted" style="font-size:13px;text-align:center">받은 메시지의 확인 숫자와 같은지 보세요.</p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="denyDev" data-id="' + esc(d.id) + '">거절</button><button type="button" class="btn primary" data-act="approveDev" data-id="' + esc(d.id) + '">승인</button></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:4px"><input type="checkbox" id="sharedDev" style="width:18px;height:18px">동아리 공용 기기 (과학실 태블릿 등)</label>');
    } catch (e) { closeSheet(); if (!deviceLost(e)) toast(e.message); }
  }
  async function devAction(act, id) {
    try {
      if (act === 'approveDev') { await rpc('approve', { id, shared: !!($('#sharedDev') && $('#sharedDev').checked) }); toast('승인했어요'); }
      else { await rpc('block', { id }); toast('막았어요'); }
      closeSheet(); PF.people = null; render();
    } catch (e) { if (!deviceLost(e)) toast(e.message); }
  }

  /* ---------- 부원 · 기기 (관리자) ---------- */
  function loadPeople() {
    if (PF.peopleLoading) return; PF.peopleLoading = true;
    rpc('people').then((p) => { PF.people = p; }, (e) => { if (!deviceLost(e)) toast(e.message); }).finally(() => { PF.peopleLoading = false; render(); });
  }
  function viewPeople() {
    if (!isAdmin()) return '<div class="card empty">관리자만 볼 수 있어요.</div>';
    if (!PF.people) { loadPeople(); return '<div class="card empty loading-line">' + SPIN + '부원 명단을 불러오는 중…</div>'; }
    const p = PF.people, wait = p.devices.filter((d) => d.status === '대기'), act = p.members.filter((m) => m.status === '활동'), off = p.members.filter((m) => m.status !== '활동');
    const ROLE = { '마스터': 't-info', '관리자': 't-ok', '교사': 't-warn', '부원': 't-neutral' };
    return '<div class="btn-row"><button type="button" class="btn primary" data-act="addMember">부원 추가</button><button type="button" class="btn" data-act="refreshPeople">새로 고침</button></div>' +
      (wait.length ? '<h2 class="sec">승인 기다리는 기기 <small>' + wait.length + '</small></h2>' + wait.map((d) => '<button type="button" class="srow" data-act="openApprove" data-id="' + esc(d.id) + '"><span class="tx"><b>' + esc(d.member) + ' · ' + esc(d.label) + '</b><small class="code">' + esc(d.studentId) + ' · 확인 숫자 ' + esc(d.confirm) + '</small></span><span class="badge t-warn">승인</span></button>').join('') : '') +
      '<h2 class="sec">부원 <small>' + act.length + '명</small></h2>' +
      act.map((m) => '<button type="button" class="srow" data-act="member" data-id="' + esc(m.id) + '"><span class="tx"><b>' + esc(m.name) + '</b><small class="code">' + esc(m.studentId) + ' · 기기 ' + m.devices + '대' + (m.devices >= 6 ? ' · 기기 많음' : '') + '</small></span><span class="badge ' + ROLE[m.role] + '">' + esc(m.role) + '</span></button>').join('') +
      (off.length ? '<h2 class="sec">활동 중지 <small>' + off.length + '명</small></h2>' + off.map((m) => '<button type="button" class="srow" data-act="member" data-id="' + esc(m.id) + '"><span class="tx"><b>' + esc(m.name) + '</b><small class="code">' + esc(m.studentId) + '</small></span><span class="badge t-neutral">중지</span></button>').join('') : '') +
      '<div class="card" style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><b>긴급</b><span class="muted" style="font-size:13px">코드가 새어 나간 것 같을 때. 내 기기를 뺀 모든 기기가 다시 승인을 받아야 해요.</span><button type="button" class="btn danger" data-act="logoutAll">모든 기기 로그아웃</button></div>';
  }
  function memberSheet(id) {
    const m = PF.people && PF.people.members.find((x) => x.id === id); if (!m) return;
    const master = PF.me.role === '마스터';
    openSheet('<h3>' + esc(m.name) + ' <span class="code muted" style="font-size:14px">' + esc(m.studentId) + '</span></h3><p class="muted">' + esc(m.role) + ' · 승인된 기기 ' + m.devices + '대</p><div style="display:flex;flex-direction:column;gap:10px">' +
      (m.status === '활동' ? '<button type="button" class="btn" data-act="resetCode" data-id="' + esc(m.id) + '">개인 코드 다시 만들기</button><small class="muted">코드를 잊었거나 새어 나갔을 때. 이 부원의 기기는 모두 다시 승인받아야 해요.</small>' : '') +
      (master && m.role !== '마스터' && m.status === '활동' ? '<div class="field">역할<div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [['부원', '부원'], ['관리자', '관리자'], ['교사', '지도 선생님']].map(([r, l]) => '<button type="button" data-act="setRole" data-id="' + esc(m.id) + '" data-role="' + r + '" aria-pressed="' + (m.role === r) + '">' + l + '</button>').join('') + '</div><small class="muted">지도 선생님이 승인해야 실험 준비를 시작할 수 있어요.</small></div>' : '') +
      (m.role !== '마스터' ? '<button type="button" class="btn' + (m.status === '활동' ? ' danger' : '') + '" data-act="setStatus" data-id="' + esc(m.id) + '" data-status="' + (m.status === '활동' ? '중지' : '활동') + '">' + (m.status === '활동' ? '활동 중지 (기기 모두 차단)' : '다시 활동') + '</button>' : '') +
      '<button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
  }
  function showCode(name, code, self) {
    const text = (self ? '내' : name) + ' 가지 개인 코드: ' + code;
    openSheet('<h3>' + esc(name) + ' 개인 코드</h3><div class="confirm-num big">' + esc(code).split('').map((c) => '<span>' + c + '</span>').join('') + '</div>' +
      '<p class="muted" style="font-size:13px;text-align:center">' + (self ? '다른 기기에서 들어갈 때 학번과 함께 써요. 잘 적어 두세요.' : '이 코드는 지금만 보여요. 부원에게 직접 알려 주세요.') + '</p>' +
      '<div class="btn-row">' + (self ? '' : '<button type="button" class="btn" data-act="shareCode" data-text="' + esc(text + '\n' + location.origin + '/c/' + PF.slug) + '">보내기</button>') + '<button type="button" class="btn primary" data-act="closeSheet">확인</button></div>');
  }
  async function peopleAction(a) {
    const act = a.dataset.act, id = a.dataset.id;
    try {
      if (act === 'resetCode') { if (!confirm('코드를 다시 만들까요? 이 부원의 기기는 모두 다시 승인받아야 해요.')) return; const r = await rpc('resetCode', { id }); const m = PF.people.members.find((x) => x.id === id); PF.people = null; showCode(m ? m.name : '', r.code); render(); return; }
      if (act === 'setRole') { await rpc('setMember', { id, role: a.dataset.role }); toast('바꿨어요'); }
      if (act === 'setStatus') { if (a.dataset.status === '중지' && !confirm('활동을 멈추면 이 부원의 기기가 모두 막혀요. 계속할까요?')) return; await rpc('setMember', { id, status: a.dataset.status }); toast('바꿨어요'); }
      if (act === 'logoutAll') { if (!confirm('내 기기를 뺀 모든 기기를 로그아웃할까요?')) return; await rpc('logoutAll'); toast('모든 기기를 로그아웃했어요'); }
      closeSheet(); PF.people = null; render();
    } catch (e) { if (!deviceLost(e)) toast(e.message); }
  }

  /* ---------- 드라이브 연결 마법사 (마스터) ---------- */
  function connectCard() {
    const c = PF.club;
    if (c.connector && !PF.rewire) return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">드라이브 연결</b><span class="badge t-ok">● 연결됨</span></div>' +
      '<span class="code muted" style="font-size:12px;word-break:break-all">' + esc(c.connector) + '</span>' +
      (PF.connAuth === 'core' ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>연결기가 가지 본체를 받지 못해요 · 권한 허용이 필요해요</span><span style="font-weight:400;line-height:1.7">① Apps Script 화면 위쪽 <b>▷ 실행</b> 버튼 왼쪽의 함수 목록에서 <b>권한허용</b>(없으면 <b>doGet</b>) 고르기<br>② <b>▷ 실행</b> → <b>권한 검토</b> → 내 계정 → <b>고급 → 이동 → 허용</b><br>③ 여기서 <b>연결 시험</b> (다시 배포할 필요 없어요)</span></div>' : '') +
      (PF.connAuth === true ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>연결기가 응답하지 않아요 · 권한 허용이 필요할 수 있어요</span><span style="font-weight:400;line-height:1.7">① <b>연결기 권한 확인</b>을 눌러 새 창 열기<br>② ‘권한 필요’ 또는 ‘액세스 승인’이 나오면 → <b>권한 검토</b> → 내 계정 → <b>고급 → 이동 → 허용</b><br>③ 새 창에 <b>"gaji":true</b> 글자가 보이면 성공 → 여기서 <b>연결 시험</b></span></div>' : '') +
      (PF.connVer && !verOld(PF.connVer, LATEST_VER) && PF.connShell !== undefined && Number(PF.connShell || 0) < 6 ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>사진 올리기를 쓰려면 연결기를 한 번 더 배포해야 해요</span><span style="font-weight:400;line-height:1.7">① 아래 <b>연결기 코드 복사</b> → Apps Script에 덮어쓰고 저장<br>② 함수 목록에서 <b>권한허용</b> → ▷ 실행 → 허용<br>③ <b>배포 → 배포 관리</b> → 연필 모양 → 버전: <b>새 버전</b> → 배포 (주소는 그대로)<br>④ 여기서 <b>연결 시험</b></span></div>' : '') +
      (PF.connVer ? (verOld(PF.connVer)
        ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>연결기 업데이트 필요 · 지금 ' + esc(PF.connVer) + ' → 새 판 ' + NEED_VER + '</span><span style="font-weight:400;line-height:1.7">① 아래 <b>연결기 코드 복사</b> → Apps Script에 덮어쓰고 저장<br>② <b>배포 → 배포 관리</b> → 연필 모양(수정) → 버전: <b>새 버전</b> → 배포<br>③ 여기서 <b>연결 시험</b> → ' + NEED_VER + ' 확인</span></div>'
        : verOld(PF.connVer, LATEST_VER)
          ? '<div class="card" style="display:flex;flex-direction:column;gap:6px;background:var(--info-bg);border-color:transparent;font-size:13px;line-height:1.7"><b style="color:var(--info)">마지막 한 번만: 자동 업데이트 연결기로 바꾸기 (권장)</b><span>지금 연결기 ' + esc(PF.connVer) + '는 정상이에요. 한 번만 바꿔 두면 앞으로 기능이 추가돼도 <b>다시 배포할 일이 없어요.</b></span><span>① 아래 <b>연결기 코드 복사</b> (짧아졌어요) → Apps Script에서 전체 지우고 붙여 넣기 → 저장<br>② <b>배포 → 배포 관리</b> → 연필 모양 → 버전: <b>새 버전</b> → 배포<br>③ <b>연결기 권한 확인</b> → ‘권한 필요’가 나오면 권한 검토 → 고급 → 이동 → 허용 (외부 연결 권한이 하나 늘어요)<br>④ <b>연결 시험</b> → 연결기 ' + LATEST_VER + ' 확인</span></div>'
          : '<span class="muted" style="font-size:12px">● 연결기 ' + esc(PF.connVer) + ' · 자동 업데이트 중</span>') : '') +
      '<div class="btn-row"><button type="button" class="btn" data-act="testConn">연결 시험</button><a class="btn" href="' + esc(c.connector) + '" target="_blank" rel="noopener">연결기 권한 확인</a><button type="button" class="btn" data-act="copyGs">연결기 코드 복사</button></div>' +
      '<span class="muted" style="font-size:12px;line-height:1.6">새 기능은 가지에서 자동으로 받아요. 받는 본체는 <a href="/core.js" target="_blank" rel="noopener">누구나 볼 수 있게 공개</a>돼 있고, 멈추려면 시트 ‘설정’ 탭에 <span class="code">autoUpdate</span> · <span class="code">off</span> 를 넣으면 돼요.</span>' +
      '<span class="muted" style="font-size:12px;line-height:1.6">연결기를 새로 배포했거나 다른 시트로 옮길 때만 주소를 바꿔요.</span><button type="button" class="chipbtn" data-act="rewire">연결기 주소 바꾸기</button></div>';
    const step = (n, t, d, extra) => '<li class="wstep"><span class="wnum">' + n + '</span><div><b>' + t + '</b><span class="muted">' + d + '</span>' + (extra || '') + '</div></li>';
    const tpl = window.GAJI_TEMPLATE_ID || '';
    const codeBox = '<textarea id="gsCode" class="gs-code" readonly spellcheck="false" aria-label="연결기 코드">' + esc(PF.gs || '불러오는 중…') + '</textarea>' +
      '<span class="muted" style="font-size:12px">버튼이 안 되면 상자를 한 번 누르고 <b>Ctrl+C</b> (맥은 ⌘+C)</span>' +
      '<div class="btn-row"><button type="button" class="btn primary" data-act="copyGs">코드 전체 복사</button><a class="btn" href="/connector.gs?v=6" target="_blank" rel="noopener">새 창에서 보기</a></div>';
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">드라이브 연결</b><span class="badge t-warn">● 연결 전</span></div>' +
      '<span class="muted" style="font-size:13px;line-height:1.6">동아리 기록은 우리 드라이브의 시트에 저장돼요. <b>동아리마다 한 번만</b> 하면 되고, 부원들은 할 일이 없어요. 한 번 연결하면 새 기능은 자동으로 들어와요. 컴퓨터에서 하는 게 편해요 (5분).</span>' +
      '<ol class="wizard">' +
      (tpl
        ? step(1, '가지 데이터 시트 만들기', '버튼을 누르면 구글이 ‘사본을 만드시겠어요?’라고 물어요. <b>사본 만들기</b>를 눌러요. 연결기가 이미 들어 있는 시트가 내 드라이브에 생겨요.',
            '<a class="btn primary" href="https://docs.google.com/spreadsheets/d/' + esc(tpl) + '/copy?title=' + encodeURIComponent('가지 데이터') + '" target="_blank" rel="noopener">가지 데이터 시트 만들기</a>' +
            '<span class="muted" style="font-size:12px">학교 공유 드라이브에 두고 싶으면, 만든 뒤 드라이브에서 그 공유 드라이브로 옮기면 돼요.</span>') +
          step(2, 'Apps Script 열기', '방금 만든 시트에서 메뉴 <b>확장 프로그램 → Apps Script</b>. 코드가 이미 들어 있으니 <b>아무것도 고치지 않아요.</b> 그다음 위쪽 <b>▷ 실행</b> 왼쪽 함수 목록에서 <b>권한허용</b>을 고르고 <b>▷ 실행</b> → 권한 검토 → 고급 → 이동 → <b>허용</b>.')
        : step(1, '가지 데이터 시트 만들기', '새 구글 시트를 만들고 이름을 <b>가지 데이터</b>로 바꿔요.', '<a class="btn" href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noopener">새 시트 열기</a>') +
          step(2, '연결기 코드 붙여 넣기', '시트 메뉴 <b>확장 프로그램 → Apps Script</b>. 원래 있던 코드를 모두 지우고 붙여 넣은 뒤 <b>저장</b>(Ctrl+S)해요. 그다음 위쪽 <b>▷ 실행</b> 왼쪽 함수 목록에서 <b>권한허용</b>을 고르고 <b>▷ 실행</b> → 권한 검토 → 고급 → 이동 → <b>허용</b>.', codeBox)) +
      step(3, '배포 → 새 배포', 'Apps Script 화면 오른쪽 위 파란 <b>배포</b> 버튼 → <b>새 배포</b>.') +
      step(4, '유형: 웹 앱', '‘유형 선택’ 옆 <b>톱니바퀴</b> → <b>웹 앱</b>.') +
      step(5, '실행: 나 · 액세스: 모든 사용자', '두 칸을 그림처럼 고르고 <b>배포</b>. ‘모든 사용자’여야 부원 기기가 연결돼요 (로그인 없이 부원 기기용 · 코드와 승인으로 보호돼요).') +
      step(6, '권한 허용', '<b>액세스 승인</b>이 나오면 → 내 계정 → ‘확인하지 않은 앱’이 나오면 <b>고급</b> → <b>…(으)로 이동</b> → <b>허용</b>. 직접 만든 연결기라 나오는 정상 경고예요.') +
      step(7, '웹 앱 URL 복사해서 붙여 넣기', '마지막 창의 <b>웹 앱 URL</b> 옆 <b>복사</b>를 누르고 아래에 붙여 넣어요.',
        '<form id="connectForm" style="display:flex;flex-direction:column;gap:10px;margin-top:6px"><label class="field">웹 앱 URL<input name="url" required placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="grid2"><label class="field">내 학번<input name="sid" inputmode="numeric" maxlength="12" required></label><label class="field">내 이름<input name="name" maxlength="20" required></label></div>' +
        '<button type="submit" class="btn primary">연결하기</button>' + (PF.rewire ? '<button type="button" class="chipbtn" data-act="rewireCancel">취소</button>' : '') + '</form>') +
      '</ol>' + (tpl ? '<details class="wmore"><summary>코드를 직접 붙여 넣을래요 (원본 시트를 쓸 수 없을 때)</summary><span class="muted" style="font-size:13px">새 구글 시트 → 확장 프로그램 → Apps Script → 원래 코드를 지우고 붙여 넣기 → 저장. 그다음 3단계부터 똑같아요.</span>' + codeBox + '</details>' : '') + '</div>';
  }


  function fetchGs() {
    if (PF.gs || fetchGs.busy) return; fetchGs.busy = true;
    fetch('/connector.gs?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).then((t) => { PF.gs = t; const ta = $('#gsCode'); if (ta) ta.value = t; }).catch(() => {}).finally(() => { fetchGs.busy = false; });
  }
  // 복사: 클립보드 → 안 되면 글상자 선택 후 execCommand → 그래도 안 되면 선택된 채로 안내
  function copyGs() {
    dbg('복사', '누름 · 코드 ' + (PF.gs ? PF.gs.length + '자' : '없음'));
    try { copyGs2(); } catch (e) { dbg('복사', '오류 ' + e.message); toast('복사 오류: ' + e.message); }
  }
  function copyGs2() {
    const ta = $('#gsCode');
    if (!PF.gs) { fetchGs(); return toast('코드를 불러오는 중이에요 · 잠시 뒤 다시 눌러 주세요'); }
    const sel = () => { if (!ta) return false; ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); try { return document.execCommand('copy'); } catch (e) { return false; } };
    const fail = (er) => { dbg('복사', '클립보드 실패: ' + (er && er.message || '없음')); if (sel()) toast('연결기 코드를 복사했어요 · Apps Script에 붙여 넣어 주세요'); else toast('코드가 선택됐어요 · 길게 눌러 복사해 주세요'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(PF.gs).then(() => { dbg('복사', '성공 (클립보드)'); if (ta) { ta.focus(); ta.select(); ta.scrollTop = 0; } toast('연결기 코드를 복사했어요 · Apps Script에 붙여 넣어 주세요'); }, fail);
    else fail();
  }
  async function submitConnect(f) {
    const fd = new FormData(f), url = String(fd.get('url')).trim(), sid = String(fd.get('sid')).trim(), name = String(fd.get('name')).trim(), btn = f.querySelector('[type=submit]');
    if (!URL_RE.test(url)) return toast('웹 앱 주소는 https://script.google.com/…/exec 모양이에요');
    btn.disabled = true; btn.textContent = '연결하는 중…';
    const done = () => { btn.disabled = false; btn.textContent = '연결하기'; };
    try {
      PF.dev = null;
      const ping = await rpc('ping', {}, url), label = deviceLabel();
      let key = PF.club.masterKey || PF.api.newKey(), r;
      if (!ping.initialized) r = await rpc('init', { slug: PF.slug, name, studentId: sid, label, masterKey: key }, url);
      else {
        if (ping.slug && ping.slug !== PF.slug && !confirm('이 연결기는 다른 동아리 주소(' + ping.slug + ')로 쓰던 거예요. 이 동아리로 옮겨 올까요?')) return done();
        r = await rpc('masterRegister', { masterKey: key, studentId: sid, name, label, slug: PF.slug }, url);
      }
      await PF.api.saveConnector(url, key);
      putDev({ id: r.device.id, secret: r.device.secret, url, name, studentId: sid, label });
      PF.rewire = false; PF.statsSent = false;
      if (r.code) showCode(name, r.code, true); else toast('연결했어요');
      liveLoad();
    } catch (e) {
      done();
      if (e.code === 'wrong_key') return toast('다른 동아리의 연결기예요. 시트 주인이라면 시트의 설정 탭에서 masterKeyHash 값을 지우고 다시 해 보세요');
      toast(e.code === 'network' ? '연결기에 닿지 않아요. 배포 때 액세스를 ‘모든 사용자’로 했는지 확인해 주세요' : e.message);
    }
  }

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
  // 분야 뱃지: 제목 앞에 붙여 화학 · 물리 … 를 한눈에
  const fieldTag = (n, size) => n && n.field && n.type !== 'q' ? '<span class="ftag f-' + (FCODE[n.field] || 'GEN') + (size ? ' ' + size : '') + '">' + esc(n.field) + '</span>' : '';
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
    if (n.status === '준비 중') { const s = signalOf(n); return s >= 5 ? ['t-ok', '● GO'] : (days(n.date) <= 7 ? ['t-bad', '● 위험 ' + s + '/5'] : ['t-warn', '● 준비 ' + s + '/5']); }
    if (n.status === '검토 중') { const k = reviewCount(n), P = rules().peers; return reviewDone(n) ? ['t-ok', '승인 끝'] : k < P ? ['t-warn', '검토 ' + k + '/' + P] : ['t-warn', '선생님 승인 대기']; }
    if (n.status === '실험 완료') return ['t-warn', '기록 대기'];
    return ['t-neutral', n.status];
  }
  const nodeColor = (n) => n.type === 'exp' ? (n.status === '기록 완료' ? 'var(--done)' : n.status === '취소' ? 'var(--edge)' : 'var(--exp)') : TYPE[n.type].color;
  const svgIcon = (k, color) => '<svg viewBox="0 0 24 24" style="stroke:' + color + '" aria-hidden="true"><path d="' + ICON[k] + '"/></svg>';
  function ico(n) { const c = nodeColor(n); return n.type === 'idea' ? '<span class="ico" style="border:2px dashed ' + c + '">' + svgIcon('idea', c) + '</span>' : '<span class="ico" style="background:' + c + '">' + svgIcon(n.type, '#fff') + '</span>'; }
  const badge = (n) => { const t = tone(n); return '<span class="badge ' + t[0] + '">' + esc(t[1]) + '</span>'; };

  /* ---------- 계보 ---------- */
  function parentOf(n) { const l = db.links.find((l) => l.t === n.id && (l.k === 'follow' || l.k === 'next')); const p = l && byId(l.s); return isExpLike(p) && !isDel(p) ? p : null; }
  function lineage(n) { const c = [n]; let cur = n, g = 0; while (g++ < 40) { const p = parentOf(cur); if (!p || c.includes(p)) break; c.unshift(p); cur = p; } return c; }
  function childrenOf(n) { return db.links.filter((l) => l.s === n.id && (l.k === 'follow' || l.k === 'next')).map((l) => byId(l.t)).filter((x) => isExpLike(x) && !isDel(x)).sort((a, b) => a.date.localeCompare(b.date)); }
  function treeRows(roots) { const rows = [], seen = new Set(); (function walk(list, d, p) { list.forEach((x) => { if (seen.has(x.id)) return; seen.add(x.id); rows.push({ n: x, depth: d, parent: p }); walk(childrenOf(x), d + 1, x); }); })(roots, 0, null); return rows; }
  const familyRows = (n) => treeRows([lineage(n)[0]]);
  const after = (n) => treeRows([n]).length - 1;

  /* 줄기 = 같은 연구 주제(line)로 묶인 뿌리 실험들의 나무 */
  function computeLines() {
    const roots = alive().filter((n) => isExpLike(n) && !parentOf(n));
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
  /* 내가 할 일: 내 실험의 다음 할 일 + 나에게 온 검토 요청 + 내 질문에 달린 답 */
  function myTodos() {
    const out = [], me = meName();
    alive().forEach((n) => {
      const mine = inTeam(n), open = commentsOf(n.id).filter((c) => (c.kind === 'fix' || c.kind === 'change') && !c.resolved);
      if (n.type === 'exp' && mine) {
        if (n.status === '계획 작성') out.push({ n, why: planReady(n.plan) ? '계획서를 다 썼으면 검토를 요청해요' : '계획서를 써요', w: 2 });
        if (n.status === '검토 중') out.push({ n, why: open.length ? '고칠 곳 ' + open.length + '개가 남아 있어요' : reviewDone(n) ? '승인 끝 · 준비를 시작해요' : reviewCount(n) < rules().peers ? '부원 승인 기다리는 중 · ' + reviewCount(n) + '/' + rules().peers : '선생님 최종 승인 기다리는 중', w: open.length ? 1 : reviewDone(n) ? 0 : 6 });
        if (n.status === '준비 중') { const st = prepState(n); out.push({ n, why: '준비 ' + st.k + '/' + st.total + ' · 실험 ' + (days(n.date) >= 0 ? 'D-' + days(n.date) : '날짜 지남'), w: days(n.date) }); }
        if (n.status === '실험 완료') out.push({ n, why: '결과를 기록해요', w: 0 });
        if (n.status === '기록 완료' && !isFinal(n) && open.length) out.push({ n, why: '보고서 첨삭 ' + open.length + '개', w: 3 });
      }
      if (n.type === 'idea' && mine && ready(n).every(Boolean)) out.push({ n, why: '계획서로 바꿀 수 있어요', w: 5 });
      if (n.type === 'exp' && n.status === '검토 중' && planReady(n.plan) && n.owner !== me && n.createdBy !== me && !approvals(n).some((c) => c.by === me)) {
        const isT = teacherNames().includes(me), R = rules();
        if (isT && teacherNeeded() && reviewCount(n) >= R.peers) out.push({ n, why: '선생님 최종 승인 요청 · 부원 검토가 끝났어요', w: -1, req: true });
        else if (!isT && (R.team || !mine) && reviewCount(n) < R.peers) out.push({ n, why: '검토 요청 · 계획서를 읽고 승인하거나 고칠 곳을 남겨요', w: 4, req: true });
      }
      if (n.type === 'q' && n.createdBy === me && n.status !== '해결') { const a = commentsOf(n.id).filter((c) => c.kind === 'answer').length; if (a) out.push({ n, why: '답변 ' + a + '개가 달렸어요', w: 2 }); }
    });
    return out.sort((a, b) => a.w - b.w);
  }
  function todos() {
    const out = [];
    alive().forEach((n) => {
      if (n.type === 'exp' && n.status === '준비 중' && (n.signal || 0) < 5 && days(n.date) <= 14) out.push({ n, why: '실험 ' + (days(n.date) >= 0 ? 'D-' + days(n.date) : '날짜 지남') + ' · 출발 신호 ' + (n.signal || 0) + '/5', w: days(n.date) });
      if (n.type === 'exp' && n.status === '검토 중' && (n.review || 0) < 2) out.push({ n, why: '검토가 ' + (2 - (n.review || 0)) + '명 더 필요해요', w: days(n.date) - 3 });
      if (n.type === 'exp' && n.status === '실험 완료') out.push({ n, why: '결과 기록을 남겨 주세요', w: 1 });
      if (n.type === 'q' && n.status !== '해결') out.push({ n, why: '함께 답을 찾아 주세요', w: 10 });
      if (n.type === 'idea' && ready(n).every(Boolean)) out.push({ n, why: '계획서로 바꿀 수 있어요', w: 6 });
    });
    return out.sort((a, b) => a.w - b.w).slice(0, 3);
  }
  /* 명예의 전당: 쌓인 기록에서 저절로 뽑음 */
  function hallOfFame() {
    const ex = alive().filter((n) => n.type === 'exp' && n.status !== '취소'), all = alive().filter((n) => n.status !== '취소');
    const best = (list, f) => list.map((n) => [n, f(n)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
    const dd = (a, b) => Math.round((new Date(String(b).slice(0, 10)) - new Date(String(a).slice(0, 10))) / 864e5);
    const cards = [];
    const kids = best(all, (n) => childrenOf(n).length * 100 + (treeRows([n]).length - 1));
    if (kids) cards.push({ n: kids[0], k: '가장 많이 가지를 뻗은 실험', v: '가지 ' + childrenOf(kids[0]).length + '개', s: '후속 실험 · 아이디어 모두 ' + (treeRows([kids[0]]).length - 1) + '개', ic: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9' });
    const deep = best(all, (n) => lineage(n).length);
    if (deep && deep[1] > 1) cards.push({ n: deep[0], k: '가장 긴 가지', v: deep[1] + '세대', s: lineage(deep[0])[0].title + '에서 시작', ic: 'M12 22V8M12 8l-4-4M12 8l4-4M12 14l-5-3M12 17l5-3' });
    const long = best(ex.filter((n) => n.status === '기록 완료'), (n) => { const a = (n.plan && n.plan.at) || n.created, b = (n.report && n.report.at) || (n.run && n.run.ended) || n.date; return a && b ? dd(a, b) : 0; });
    if (long) cards.push({ n: long[0], k: '최장기 실험', v: long[1] + '일', s: '계획서부터 기록 완료까지', ic: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' });
    const fail = best(ex.filter((n) => (n.verdict || (n.report && n.report.claim)) === '가설 기각'), (n) => treeRows([n]).length - 1 + 0.5);
    if (fail) cards.push({ n: fail[0], k: '실패가 낳은 발견', v: '가설 기각', s: fail[1] >= 1 ? '그 뒤로 ' + Math.floor(fail[1]) + '개의 연구가 이어졌어요' : '실패도 기록으로 남았어요', ic: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v.5h5V16c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z' });
    const hot = best(all, (n) => commentsOf(n.id).filter((c) => c.kind !== 'approve').length);
    if (hot) cards.push({ n: hot[0], k: '가장 뜨거운 토론', v: '댓글 · 첨삭 ' + hot[1] + '개', s: '서로 묻고 고치며 다듬었어요', ic: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z' });
    const cnt = {}; ex.filter((n) => n.status === '기록 완료').forEach((n) => { teamOf(n).filter((x, i, a) => a.indexOf(x) === i).forEach((w) => { cnt[w] = (cnt[w] || 0) + 1; }); });
    const king = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (king) cards.push({ who: king[0], k: '연구왕', v: king[1] + '개 완성', s: '기록 완료까지 함께 해낸 실험 수', ic: 'M3 7l4 4 5-7 5 7 4-4-2 12H5z' });
    if (!cards.length) return '';
    return '<h2 class="sec">명예의 전당 <small>쌓인 기록에서 저절로 뽑아요</small></h2><div class="hof">' + cards.map((c, i) =>
      '<button type="button" class="hof-card" ' + (c.n ? 'data-item="' + esc(c.n.id) + '"' : 'data-act="findPerson" data-name="' + esc(c.who) + '"') + ' style="--i:' + i + '"><span class="hof-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + c.ic + '"/></svg></span>' +
      '<span class="hof-k">' + c.k + '</span><b class="hof-v">' + c.v + '</b>' + (c.n ? '<span class="hof-t">' + fieldTag(c.n) + esc(c.n.title) + '</span>' : '<span class="hof-t"><b>' + esc(c.who) + '</b></span>') + '<small class="muted">' + (c.n ? esc(c.s) : c.s) + '</small></button>').join('') + '</div>';
  }
  function viewHome() {
    const t = myTodos(), club = isAdmin() ? todos().filter((x) => !t.some((y) => y.n.id === x.n.id)) : [], lines = computeLines().sort((a, b) => b.rows.length - a.rows.length || (a.state === 'done') - (b.state === 'done')).slice(0, 4);
    const reps = alive().filter((n) => n.type === 'exp' && n.status === '기록 완료' && resultReady(n.report)).sort((a, b) => (isFinal(b) - isFinal(a)) || String(b.date).localeCompare(String(a.date))).slice(0, 4);
    const nd = PF.mode === 'live' ? PF.newDevices : [];
    return (nd.length ? '<div class="card notice"><b>내 이름으로 새 기기' + (nd.length > 1 ? ' ' + nd.length + '대가' : '가') + ' 승인됐어요</b><span class="muted" style="font-size:13px">내가 연 기기가 아니면 ‘내가 아님’을 눌러 바로 막으세요.</span>' +
      nd.map((d) => '<div class="nd-row"><span>' + esc(d.label || '기기') + ' · ' + esc(String(d.at).slice(5, 10).replace('-', '/')) + '</span><button type="button" class="chipbtn" data-act="notMe" data-id="' + esc(d.id) + '">내가 아님</button></div>').join('') +
      '<div class="btn-row"><button type="button" class="btn" data-act="seenAllDev">모두 내 기기예요 · 확인</button></div></div>' : '') +
      '<div class="home-grid"><div><div class="hello"><span class="muted">' + (TODAY.getMonth() + 1) + '월 ' + TODAY.getDate() + '일 ' + WD[TODAY.getDay()] + '요일 · ' + esc(meName()) + '</span><b>내가 할 일 ' + t.length + '개</b></div>' +
      '<div class="todo">' + (t.length ? t.slice(0, 6).map((x) => '<button type="button" class="todo-item' + (x.req ? ' req' : '') + '" data-item="' + x.n.id + '">' + ico(x.n) + '<span class="tx"><b>' + fieldTag(x.n) + esc(x.n.title) + '</b><small>' + esc(x.why) + '</small></span>' + (x.req ? '<span class="badge t-warn">검토 요청</span>' : badge(x.n)) + '</button>').join('') +
        (t.length > 6 ? '<button type="button" class="fold" data-act="findMine">내 것 모두 보기 (' + t.length + ') →</button>' : '')
        : '<div class="card empty">지금 할 일이 없어요. 새 실험을 만들거나, 아이디어에 담당 지원해 보세요.</div>') + '</div>' +
      (club.length ? '<h2 class="sec">동아리 챙길 것 <small>기장 · 선생님</small></h2><div class="todo">' + club.slice(0, 3).map((x) => '<button type="button" class="todo-item" data-item="' + x.n.id + '">' + ico(x.n) + '<span class="tx"><b>' + fieldTag(x.n) + esc(x.n.title) + '</b><small>' + esc(x.why) + (x.n.owner ? ' · ' + esc(x.n.owner) : '') + '</small></span>' + badge(x.n) + '</button>').join('') + '</div>' : '') +
      '<div class="quick">' +
        '<button type="button" data-new="exp" style="background:#2F6FDB">' + svgIcon('exp', '#fff') + '새 실험</button>' +
        '<button type="button" data-new="idea" style="background:#B86200">' + svgIcon('idea', '#fff') + '아이디어</button>' +
        '<button type="button" data-new="q" style="background:#6E4FE0">' + svgIcon('q', '#fff') + '질문</button></div>' +
      (reps.length ? '<h2 class="sec">완성된 보고서 <small>누르면 보고서가 열려요</small></h2><div class="rep-list">' + reps.map((n) => '<button type="button" class="rep-card" data-report="' + esc(n.id) + '"><span class="rep-ic">' + svgIcon('res', '#fff') + '</span><span class="tx"><small class="code">' + esc(code(n)) + ' · ' + esc(n.owner || '') + '</small><b>' + fieldTag(n) + esc(n.title) + '</b><small>' + esc(lineName(lineage(n)[0].line)) + ' · ' + fmt(n.date) + '</small></span>' + (isFinal(n) ? '<span class="badge t-ok">확정</span>' : badge(n)) + '</button>').join('') + '</div>' : '') + '</div>' +
      '<div><h2 class="sec">연구 줄기 <small>큰 가지부터 · 누르면 펼쳐져요</small></h2>' + lines.map(lineCard).join('') +
      '<button type="button" class="fold" data-tab-go="tree">가지 전체 보기 →</button>' +
'</div></div>' + hallOfFame();
  }

  /* ---------- 가지 ---------- */
  /* 전체 가지: 달을 가로로 놓고, 줄기마다 실험이 날짜 자리에서 가지를 침 (끌어서 옆으로 · 한 번 누르면 요약 · 두 번 누르면 상세) */
  // 그림 속 실험 제목: 작은 글씨로 두 줄까지 (띄어쓰기에서 나눔, 넘치면 …)
  function svgTitle(title, x, y, per, size) {
    const words = String(title).split(' '), lines = ['']; per = per || 15;
    words.forEach((w) => { const cur = lines[lines.length - 1]; if ((cur + ' ' + w).trim().length <= per || !cur) lines[lines.length - 1] = (cur + ' ' + w).trim(); else lines.push(w); });
    let out = lines.slice(0, 2); if (lines.length > 2) out[1] = out[1].slice(0, per - 1) + '…';
    out = out.map((l) => l.length > per + 3 ? l.slice(0, per + 2) + '…' : l);
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + (size || 11.5) + '" font-weight="700" fill="var(--fg)" style="paint-order:stroke;stroke:var(--surface);stroke-width:4px">' + out.map((l, i) => '<tspan x="' + x + '" dy="' + (i ? 1.25 : 0) + 'em">' + esc(l) + '</tspan>').join('') + '<title>' + esc(title) + '</title></text>';
  }
  function viewAllBranches() {
    const Ls = computeLines(); if (!Ls.length) return '<div class="card empty">아직 가지가 없어요. 홈에서 새 실험이나 아이디어를 올려 보세요.</div>';
    const D = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00');
    const all = Ls.flatMap((L) => L.rows.map((r) => r.n)), ds = all.map((n) => D(n.date).getTime()).filter((x) => !isNaN(x)).concat([TODAY.getTime()]);
    const s0 = new Date(Math.min(...ds)); s0.setDate(1); s0.setMonth(s0.getMonth() - 0); const e0 = new Date(Math.max(...ds)); e0.setMonth(e0.getMonth() + 1); e0.setDate(1);
    const PX = 3.4, LAB = 150, RH = 74, GAP = 26, TOP = 40, day = 864e5;
    const X = (d) => Math.round((D(d) - s0) / day * PX) + 40, W = Math.round((e0 - s0) / day * PX) + 120;
    let y = TOP, rowsOut = [], labels = '';
    Ls.forEach((L, gi) => {
      labels += '<div class="tl-lab" style="top:' + (y + 6) + 'px"><b>' + esc(L.name) + '</b><small>' + L.rows.length + '개 · ' + (Math.max(...L.rows.map((r) => r.depth)) + 1) + '세대</small></div>';
      L.rows.forEach((r, i) => { rowsOut.push({ r, y: y + 22 + i * RH, gi }); });
      y += L.rows.length * RH + GAP;
    });
    const H = y + 10, pos = {}; rowsOut.forEach((o) => { pos[o.r.n.id] = { x: X(o.r.n.date), y: o.y }; });
    let g = '';
    for (let m = new Date(s0); m <= e0; m.setMonth(m.getMonth() + 1)) {   // 달 눈금
      const x = X(m.toISOString().slice(0, 10)), lb = (m.getMonth() === 0 || +m === +s0 ? m.getFullYear() + '년 ' : '') + (m.getMonth() + 1) + '월';
      g += '<line x1="' + x + '" y1="' + (TOP - 14) + '" x2="' + x + '" y2="' + H + '" stroke="var(--line)" stroke-width="1"/><text x="' + (x + 6) + '" y="' + (TOP - 20) + '" font-size="12" font-weight="700" fill="var(--muted)">' + lb + '</text>';
    }
    let gy = TOP; Ls.forEach((L, gi) => { if (gi) g += '<line x1="0" y1="' + (gy - GAP / 2) + '" x2="' + W + '" y2="' + (gy - GAP / 2) + '" stroke="var(--line)" stroke-dasharray="2 4"/>'; gy += L.rows.length * RH + GAP; });
    const tx = X(dstr(TODAY)); g += '<line x1="' + tx + '" y1="' + (TOP - 14) + '" x2="' + tx + '" y2="' + H + '" stroke="var(--today)" stroke-width="2" stroke-dasharray="5 4"/><rect x="' + (tx - 34) + '" y="' + (H - 22) + '" width="68" height="20" rx="10" fill="var(--today)"/><text x="' + tx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">오늘 ' + (TODAY.getMonth() + 1) + '/' + TODAY.getDate() + '</text>';
    const sel = PF.tlSel, chain = new Set(sel && byId(sel) ? lineage(byId(sel)).concat(treeRows([byId(sel)]).map((r) => r.n)).map((x) => x.id) : []);
    rowsOut.forEach((o) => { const r = o.r; if (!r.parent || !pos[r.parent.id]) return; const p = pos[r.parent.id], q = pos[r.n.id], c = nodeColor(r.n), hot = chain.has(r.n.id) && chain.has(r.parent.id);
      const fut = r.n.type === 'idea' || (days(r.n.date) > 0 && r.n.status !== '기록 완료'), rr = 10, dx = q.x >= p.x ? 1 : -1;
      g += '<path d="M' + p.x + ' ' + (p.y + 16) + 'V' + (q.y - rr) + 'Q' + p.x + ' ' + q.y + ' ' + (p.x + rr * dx) + ' ' + q.y + 'H' + (q.x - 16 * dx) + '" fill="none" stroke="' + c + '" stroke-width="' + (hot ? 5 : 3) + '" stroke-linecap="round"' + (fut ? ' stroke-dasharray="7 6"' : '') + ' opacity="' + (chain.size && !hot ? .35 : .9) + '"/>'; });
    rowsOut.forEach((o) => { const n = o.r.n, p = pos[n.id], c = nodeColor(n), idea = n.type === 'idea', on = sel === n.id, dim = chain.size && !chain.has(n.id);
      g += '<g data-tnode="' + n.id + '" style="cursor:pointer" opacity="' + (dim ? .4 : 1) + '">' + (on ? '<circle cx="' + p.x + '" cy="' + p.y + '" r="25" fill="var(--halo)"/>' : '') +
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="15" fill="' + (idea ? 'var(--surface)' : c) + '" stroke="' + c + '" stroke-width="3"' + (idea ? ' stroke-dasharray="4 3"' : '') + '/>' +
        (n.status === '기록 완료' ? '<path d="m' + (p.x - 6) + ' ' + p.y + ' 4 4 8-9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
        svgTitle(n.title, p.x, p.y + 30, 15, 11.5) + '</g>'; });
    const sn = sel && byId(sel);
    setTimeout(() => { const sc = $('#tlScroll'); if (!sc) return; sc.scrollLeft = PF.tlScroll != null ? PF.tlScroll : Math.max(0, tx - sc.clientWidth * 0.6); }, 0);
    return '<p class="muted" style="margin:0 2px;font-size:13px">달을 따라 줄기마다 실험이 가지를 쳐요. <b>끌어서 옆으로</b> 움직이고, 원을 한 번 누르면 요약 · <b>두 번 누르면 상세</b>로 들어가요. <button type="button" class="chipbtn" data-go-screen="map">3D 전체 지도 보기</button></p>' +
      '<div class="tl-box"><div class="tl-scroll" id="tlScroll"><div class="tl-inner" style="width:' + (W + LAB) + 'px;height:' + H + 'px"><div class="tl-labels" style="height:' + H + 'px">' + labels + '</div>' +
      '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="margin-left:' + LAB + 'px">' + g + '</svg></div></div>' +
      (sn ? '<div class="map-tip"><span class="code muted">' + esc(code(sn)) + '</span><b>' + fieldTag(sn) + esc(sn.title) + '</b><span class="muted">' + esc([sn.status, sn.owner, md(sn.date)].filter(Boolean).join(' · ')) + '</span><div class="btn-row" style="margin-top:6px"><button type="button" class="btn primary" data-go="' + esc(sn.id) + '">상세 보기</button><button type="button" class="btn" data-tlclear>닫기</button></div></div>' : '') +
      '</div><div class="tl-legend muted"><span><i style="background:var(--done)"></i>끝난 실험</span><span><i style="background:var(--exp)"></i>진행 중</span><span><i class="ring"></i>아이디어</span><span>점선 = 아직 안 한 일 · 빨간 선 = 오늘</span></div>';
  }
  // 전체 가지 움직이기: 마우스로 끌면 옆으로 (손가락은 그냥 밀면 됨), 한 번 = 요약, 두 번 = 상세
  (function tlDrag() {
    let st = null, moved = false, last = { id: '', t: 0 };
    document.addEventListener('pointerdown', (e) => { const sc = e.target.closest && e.target.closest('#tlScroll'); if (!sc) return; st = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, sc, mouse: e.pointerType === 'mouse' }; moved = false; });
    document.addEventListener('pointermove', (e) => { if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.abs(dx) + Math.abs(dy) > 5) moved = true; if (st.mouse && moved) { st.sc.scrollLeft = st.l - dx; st.sc.classList.add('drag'); } });
    document.addEventListener('pointerup', (e) => {
      if (!st) return; const sc = st.sc; sc.classList.remove('drag'); PF.tlScroll = sc.scrollLeft; const was = moved; st = null; if (was) return;
      const nd = e.target.closest && e.target.closest('[data-tnode]'), now = Date.now(); if (!nd) return;
      const id = nd.dataset.tnode;
      if (last.id === id && now - last.t < 450) { last = { id: '', t: 0 }; return go('item', id); }
      last = { id, t: now }; PF.tlSel = id; render();
    });
    document.addEventListener('scroll', (e) => { if (e.target && e.target.id === 'tlScroll') PF.tlScroll = e.target.scrollLeft; }, true);
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-tlclear]')) { PF.tlSel = null; render(); } });
  })();
  function lineCard(L) {
    const st = { active: ['t-info', '진행 중'], idea: ['t-warn', '아이디어'], done: ['t-neutral', '끝남'] }[L.state];
    return '<button type="button" class="line-card" data-line="' + esc(L.key) + '"><span class="head"><b>' + esc(L.name) + '</b><span class="badge ' + st[0] + '">' + st[1] + '</span></span>' +
      '<span class="mini">' + miniLine(L.rows) + '</span><small class="muted line-meta">실험 ' + L.rows.length + '개 · ' + (Math.max(...L.rows.map((r) => r.depth)) + 1) + '세대' + (L.rows.length > 1 ? ' · ' + String(L.rows.map((r) => r.n.created).sort()[0]).slice(0, 4) + '년부터' : '') + '</small>' +
      '<span class="next">' + (L.state === 'done' ? '마지막 ' + fmt(L.last) + ' · 실험 ' + L.rows.length + '개' : '다음: <b>' + fmt(L.next.date) + ' ' + esc(L.next.title) + '</b> · ' + esc(tone(L.next)[1].replace('● ', ''))) + '</span></button>';
  }
  function viewTree() {
    const mode = prefs.treeMode || 'all';
    let h = '<div class="seg" role="group" aria-label="보기" style="grid-template-columns:repeat(3,1fr)"><button type="button" data-tmode="all" aria-pressed="' + (mode === 'all') + '">전체 가지</button><button type="button" data-tmode="line" aria-pressed="' + (mode === 'line') + '">줄기별</button><button type="button" data-tmode="date" aria-pressed="' + (mode === 'date') + '">날짜별</button></div>';
    if (mode === 'all') return h + viewAllBranches();
    if (mode === 'line') {
      const L = computeLines(), live = L.filter((l) => l.state !== 'done'), done = L.filter((l) => l.state === 'done');
      h += '<div class="grid2 wide3">' + live.map(lineCard).join('') + '</div>' || '<div class="card empty">아직 가지가 없어요. 홈에서 새 실험이나 아이디어를 올려 보세요.</div>';
      if (done.length) h += '<button type="button" class="fold" data-fold>' + (prefs.showDone ? '▾' : '▸') + ' 끝난 줄기 ' + done.length + '개</button>' + (prefs.showDone ? '<div class="grid2 wide3">' + done.map(lineCard).join('') + '</div>' : '');
    } else {
      const items = alive().filter(isExpLike).filter((n) => n.status !== '취소').sort((a, b) => a.date.localeCompare(b.date));
      let m = '', t = false; h += '<div class="day-list">';
      items.forEach((n) => { const d = new Date(n.date), mk = d.getFullYear() + '-' + d.getMonth();
        if (mk !== m) { m = mk; h += '<div class="month">' + (d.getFullYear() !== TODAY.getFullYear() ? d.getFullYear() + '년 ' : '') + (d.getMonth() + 1) + '월</div>'; }
        if (!t && d >= TODAY) { t = true; h += '<div class="todayline">오늘 ' + fmt(TODAY) + '</div>'; }
        const g = lineage(n).length, a = after(n);
        h += '<button type="button" class="srow' + (d < TODAY && n.status === '기록 완료' ? ' past' : '') + '" data-item="' + n.id + '"><span class="sdate"><b>' + d.getDate() + '</b><small>' + WD[d.getDay()] + '</small></span>' + ico(n) +
          '<span class="tx"><small class="code">' + esc(code(n)) + (g > 1 || a ? ' · ' + (g > 1 ? g + '세대' : '') + (g > 1 && a ? ' · ' : '') + (a ? '후속 ' + a : '') : '') + '</small><b>' + fieldTag(n) + esc(n.title) + '</b></span>' + badge(n) + '</button>'; });
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
    if (isArch(n) && PF.mode === 'live') { const head = '<div class="detail-head"><div class="idrow">' + ico(n) + '<span class="idchip">' + esc(code(n)) + '</span></div><h2>' + fieldTag(n, 'big') + esc(n.title) + '</h2><div class="idrow">' + badge(n) + '</div></div>'; return head + archWait(n); }
    if (isDel(n)) return '<div class="card empty">휴지통에 있는 항목이에요. <button type="button" class="chipbtn" data-act="restore" data-id="' + esc(n.id) + '">되살리기</button></div>';
    let h = '<div class="detail-head"><div class="idrow">' + ico(n) + '<span class="idchip">' + esc(code(n)) + '</span><button type="button" class="chipbtn" data-act="copy">번호 복사</button><span class="muted" style="font-size:12px">' + TYPE[n.type].label + ' · ' + esc(n.field) + (n.owner ? ' · ' + esc(n.owner) : '') + '</span><button type="button" class="chipbtn more-btn" data-act="itemMenu" aria-label="더 보기">⋯ 관리</button></div>' +
      '<h2>' + fieldTag(n, 'big') + esc(n.title) + '</h2><div class="idrow">' + badge(n) + (n.type === 'exp' && tone(n)[1] !== n.status ? '<span class="badge t-info">' + esc(n.status) + '</span>' : '') + (isFinal(n) ? '<span class="badge t-ok">보고서 확정</span>' : '') + (isPriv(n) ? '<span class="badge t-neutral">비공개</span>' : '') + (inTeam(n) ? '<span class="badge t-info">내 실험</span>' : '') + '</div></div>';
    h += nowCard(n);
    if (isExpLike(n)) { const rows = familyRows(n);
      h += '<div class="card"><div class="panel-title"><span>이 실험의 가지 · ' + lineage(n).length + '세대' + (after(n) ? ' · 후속 ' + after(n) + '개' : '') + '</span><span>' + esc(lineName(lineage(n)[0].line)) + '</span></div>' + branchSvg(rows, n.id) + '</div>'; }
    if (n.type === 'idea') { const r = ready(n); h += '<div class="card conds">' + cond(r[0], '같이 해요 3명 이상 (' + (n.fans || 0) + '명)') + cond(r[1], n.volunteer ? '담당 지원 · ' + esc(n.volunteer) : '담당 지원자 없음') + cond(r[2], '과학실 장비로 가능') + '</div>'; }
    const act = actions(n); if (act) h += '<div class="btn-row">' + act + '</div>';
    if (n.desc) h += '<div class="card"><p style="margin:0;font-size:14px;line-height:1.7">' + para(n.desc) + '</p></div>';
    const st = n.status, F = (key, label, html) => html ? fold(n, key, label, html) : '';
    const rec = n.report ? reportCard(n) : '';
    if (n.type !== 'exp' || st === '계획 작성' || st === '검토 중' || st === '취소') h += planCard(n) + prepCard(n) + runCard(n) + rec;
    else if (st === '준비 중') h += prepCard(n) + runCard(n) + F('plan', planSum(n), planCard(n)) + rec;
    else if (st === '실험 완료') h += runCard(n) + rec + F('prep', '준비 점검 ' + prepState(n).k + '/' + prepState(n).total, prepCard(n)) + F('plan', planSum(n), planCard(n));
    else h += rec + F('run', runSum(n), runCard(n)) + F('prep', '준비 점검 ' + prepState(n).k + '/' + prepState(n).total, prepCard(n)) + F('plan', planSum(n), planCard(n));
    h += filesCard(n);
    h += commentsCard(n);
    h += '<div class="card"><dl class="kv"><dt>고유번호</dt><dd><span class="code">' + esc(uid(n)) + '</span> <span class="muted" style="font-size:12px">바뀌지 않음</span></dd>' + (n.owner ? '<dt>담당</dt><dd>' + esc(n.owner) + '</dd>' : '') + (n.createdBy ? '<dt>만든 사람</dt><dd>' + esc(n.createdBy) + '</dd>' : '') + '<dt>' + (n.type === 'exp' ? '실험일' : '날짜') + '</dt><dd>' + fmt(n.date) + (isExpLike(n) && days(n.date) >= 0 && n.status !== '기록 완료' ? ' · D-' + days(n.date) : '') + '</dd></dl></div>';
    h += '<div class="card"><div class="panel-title"><span>관련된 것</span><span>누르면 이동</span></div>' + relationSvg(n) + '</div>';
    return h;
  }
  // 단계 되돌리기: 체험 모드는 누구나, 연결된 동아리는 관리자 또는 10분 안에 내가 옮긴 단계
  function canBack(n) {
    const i = STAGES.indexOf(n.status); if (n.type !== 'exp' || i < 2) return false;
    if (!canWork(n)) return false;
    if (PF.mode !== 'live') return true;
    return isAdmin() || (PF.myMoves[n.id] && Date.now() - PF.myMoves[n.id] < 10 * 60000);
  }
  function actions(n) {
    const B = (act, label, cls) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    if (n.type === 'idea') { const ok = ready(n).every(Boolean), w = canWork(n);
      return B('fan', '같이 해요 +1') + (!n.volunteer ? B('volunteer', '담당 지원') : w && !n.equip ? B('equip', '장비 확인') : '') + (ok && w ? B('convert', '계획서로 만들기', 'primary') : '') + B('branch', '이어서 가지 치기'); }
    if (n.type === 'exp' && n.status !== '취소') { const i = STAGES.indexOf(n.status);
      return (canBack(n) ? B('stageBack', '이전 단계로: ' + STAGES[i - 1]) : '') + B('branch', '이어서 가지 치기'); }
    if (n.type === 'q') return (n.status !== '해결' && (n.createdBy === meName() || isAdmin()) ? B('solve', '해결됨으로 표시', 'primary') : '') + B('toIdea', '실험 아이디어로');
    return '';
  }

  /* ---------- 결과 기록 ----------
   * 기록(report) = { summary, kind, unit, table: { cols: [...], rows: [[...]] }, observe, claim, next, by, at }
   * kind: rep(조건별 반복) · line(시간에 따른 변화) · xy(두 값의 관계) · free(자유 표) · obs(관찰 기록) */
  const CLAIMS = ['가설 지지', '가설 기각', '추가 실험 필요'];
  const KINDS = {
    rep: { label: '조건별 반복', hint: '조건마다 여러 번 잰 값 → 평균 · 표준편차 막대 그래프', cols: ['조건', '1회', '2회', '3회'], n: 3 },
    line: { label: '시간에 따른 변화', hint: '첫 열이 시간(가로축), 나머지 열이 잰 값 → 꺾은선 그래프', cols: ['시간(분)', '값'], n: 5 },
    xy: { label: '두 값의 관계', hint: '첫 열이 바꾼 값, 둘째 열이 잰 값 → 산점도 · 추세선 · R²', cols: ['바꾼 값', '잰 값'], n: 5 },
    free: { label: '자유 표', hint: '열 이름을 직접 정해 여러 항목을 기록 (그래프 없음)', cols: ['항목', '값', '메모'], n: 3 },
    obs: { label: '관찰 기록', hint: '색 변화 · 있음/없음처럼 글로 남기는 결과', cols: ['조건', '관찰한 것'], n: 3 }
  };
  const SERIES = ['var(--exp)', 'var(--idea)', 'var(--q)', 'var(--res)', 'var(--done)'];
  const num = (x) => { if (x === null || x === undefined || x === '') return null; const v = parseFloat(String(x).replace(',', '.')); return isFinite(v) && /^\s*[-+]?[\d.,]+(e[-+]?\d+)?\s*$/i.test(String(x)) ? v : null; };
  function stats(vals) { const v = vals.map(num).filter((x) => x !== null); if (!v.length) return null; const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1)) : 0; return { n: v.length, m, sd }; }
  const r3 = (x) => (Math.abs(x) >= 100 ? x.toFixed(1) : Math.abs(x) >= 1 ? x.toFixed(2) : x === 0 ? '0' : x.toPrecision(3)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const unitOf = (h) => { const m = String(h || '').match(/\(([^)]+)\)\s*$/); return m ? m[1] : ''; };
  // 예전 기록(rows: [{cond, v}]) → 표
  function tableOf(r) {
    if (r.table && r.table.cols) return r.table;
    const rows = (r.rows || []).map((x) => [x.cond || ''].concat((x.v || []).map(String)));
    const n = Math.max(3, ...rows.map((x) => x.length - 1));
    return { cols: ['조건'].concat(Array.from({ length: n }, (_, i) => i + 1 + '회')), rows: rows.map((x) => x.concat(Array(n + 1 - x.length).fill(''))) };
  }
  const kindOf = (r) => r.kind || 'rep';

  function gridHTML(t, kind) {
    const ph = t.photos || [], obs = kind === 'obs';
    return '<div class="grid-ed"><table><thead><tr>' + t.cols.map((c, j) => '<th><input data-h="' + j + '" value="' + esc(c) + '" aria-label="열 이름"></th>').join('') + (obs ? '<th class="ge-ph">사진</th>' : '') +
      '<th class="ge-add"><button type="button" class="chipbtn" data-act="gCol" aria-label="열 추가">+ 열</button></th></tr></thead><tbody>' +
      t.rows.map((row, i) => '<tr data-photo="' + esc(ph[i] || '') + '">' + t.cols.map((_, j) => '<td><input value="' + esc(row[j] ?? '') + '"' + (j ? ' inputmode="text"' : '') + '></td>').join('') + (obs ? '<td class="ge-ph">' + rowPhotoBtn(ph[i], i) + '</td>' : '') + '<td></td></tr>').join('') +
      '</tbody></table></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="chipbtn" data-act="gRow">+ 줄 추가</button><button type="button" class="chipbtn" data-act="gDelRow">마지막 줄 빼기</button><button type="button" class="chipbtn" data-act="gDelCol">마지막 열 빼기</button></div>';
  }
  function recPhotosHTML(n) {
    const list = filesOf(n.id);
    return '<span>사진 · 그래프 <span class="muted" style="font-weight:400">실험 장면이나 엑셀 그래프를 바로 올려요 · 보고서에 그림으로 들어가요</span></span>' +
      (list.length ? '<div class="ph-strip">' + list.map((f) => f.mime === 'application/pdf' ? '<span class="ph-pdf">PDF</span>' : thumbSrc(f) ? '<img src="' + thumbSrc(f) + '" alt="' + esc(f.caption || '') + '">' : '<img data-fid="' + esc(f.id) + '" alt="">').join('') + '</div>' : '') +
      '<label class="btn upl"><input type="file" accept="image/*,application/pdf" multiple data-upload-quick="' + esc(n.id) + '" hidden>사진 · 그래프 올리기</label>';
  }
  // 창을 닫지 않고 바로 올리기 (결과 기록 창 · 관찰 줄 사진)
  async function quickUpload(nodeId, file, caption, kind) {
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') { toast('사진(JPG · PNG)과 PDF만 올릴 수 있어요'); return null; }
    if (file.size > 15e6) { toast('15MB보다 큰 파일은 올릴 수 없어요'); return null; }
    let it;
    try { it = file.type === 'application/pdf' ? { name: file.name, mime: file.type, data: await readB64(file), thumb: '', preview: '' }
      : await (async () => { const full = await shrink(file, 1600, 0.82), th = await shrink(file, 480, 0.72); return { name: file.name, mime: 'image/jpeg', data: full.split(',')[1], thumb: th.split(',')[1], preview: th }; })(); }
    catch (e) { toast('사진을 읽지 못했어요'); return null; }
    if (PF.mode === 'live') {
      try { const r = await rpc('upload', { node: nodeId, name: it.name, mime: it.mime, data: it.data, thumb: it.thumb, caption, kind: kind || (it.mime === 'application/pdf' ? 'doc' : 'photo') });
        (db.files = db.files || []).push(r.file); if (it.preview) PF.thumbs[r.file.id] = it.preview; return r.file; }
      catch (e) { if (!deviceLost(e)) toast(e.message); return null; }
    }
    const f = { id: newCid(), node: nodeId, name: it.name, mime: it.mime, caption, kind: kind || 'photo', by: meName(), at: nowIso(), _data: it.preview || '' };
    (db.files = db.files || []).push(f); save(); return f;
  }
  async function quickMany(nodeId, files) {
    const list = Array.from(files).slice(0, 10); let k = 0;
    for (const f of list) { toast('올리는 중 ' + (k + 1) + '/' + list.length + '…'); if (await quickUpload(nodeId, f, '', '')) k++; }
    const box = $('#recPhotos'); const n = byId(nodeId); if (box && n) box.innerHTML = recPhotosHTML(n);
    if (k) toast(k + '개 올렸어요'); loadThumbs();
  }
  function rowPhoto(btn) {
    const fm = btn.closest('form'), tr = btn.closest('tr'), n = byId(fm.dataset.id); if (!n) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      if (!inp.files[0]) return; btn.innerHTML = SPIN; btn.disabled = true;
      const cond = (tr.querySelector('input') || {}).value || '', i = Array.from(tr.parentNode.children).indexOf(tr);
      const f = await quickUpload(n.id, inp.files[0], (cond ? cond + ' · ' : '') + '관찰 사진', 'photo');
      btn.disabled = false; if (f) { tr.dataset.photo = f.id; btn.outerHTML = rowPhotoBtn(f.id, i); const box = $('#recPhotos'); if (box) box.innerHTML = recPhotosHTML(n); toast('사진을 붙였어요'); } else btn.innerHTML = '+ 사진';
    };
    inp.click();
  }
  function rowPhotoBtn(fid, i) {
    const f = fid && (db.files || []).find((x) => x.id === fid), src = f ? thumbSrc(f) : '';
    return '<button type="button" class="rp-btn" data-act="rowPhoto" data-r="' + i + '">' + (f ? (src ? '<img src="' + src + '" alt="">' : '<img data-fid="' + esc(fid) + '" alt="">') : '+ 사진') + '</button>';
  }
  function readGrid(fm) {
    const cols = Array.from(fm.querySelectorAll('.grid-ed thead input')).map((i) => i.value.trim().slice(0, 30));
    const all = Array.from(fm.querySelectorAll('.grid-ed tbody tr')).map((tr) => ({ r: Array.from(tr.querySelectorAll('input')).map((i) => i.value.trim().slice(0, 60)), p: tr.dataset.photo || '' })).filter((x) => x.r.some((v) => v !== '') || x.p);
    const t = { cols, rows: all.map((x) => x.r) }; if (all.some((x) => x.p)) t.photos = all.map((x) => x.p); return t;
  }
  function recordForm(n) {
    const r = n.report || {}, kind = kindOf(r), t = r.table || r.rows ? tableOf(r) : { cols: KINDS[kind].cols.slice(), rows: Array.from({ length: KINDS[kind].n }, () => KINDS[kind].cols.map(() => '')) };
    openSheet('<h3>결과 기록 · ' + esc(code(n)) + '</h3><form id="recordForm" class="fgrid" data-id="' + esc(n.id) + '" style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="field">무엇을 했나요 (실험 요약)<textarea name="summary" maxlength="600" placeholder="예: 소금 농도 0 · 5 · 10%에서 물이 끓는 온도를 3번씩 쟀어요.">' + esc(r.summary || '') + '</textarea></label>' +
      '<div class="field">측정 방식<div class="kind-pick">' + Object.entries(KINDS).map(([k, v]) => '<button type="button" data-kind="' + k + '" aria-pressed="' + (k === kind) + '">' + v.label + '</button>').join('') + '</div>' +
        '<small class="muted" id="kindHint" style="font-weight:400">' + KINDS[kind].hint + '</small><input type="hidden" name="kind" value="' + kind + '"></div>' +
      '<div class="field">측정값 <span class="muted" style="font-weight:400">열 이름도 바꿀 수 있어요. 단위는 괄호 안에: 온도(℃)</span><div id="gridBox">' + gridHTML(t, kind) + '</div>' +
        '<label id="unitBox" style="display:' + (kind === 'rep' ? 'flex' : 'none') + ';gap:6px;align-items:center;font-weight:400">값의 단위<input name="unit" maxlength="12" value="' + esc(r.unit || '') + '" placeholder="예: ℃" style="width:100px;min-height:36px"></label></div>' +
      '<div class="field" id="recPhotos">' + recPhotosHTML(n) + '</div>' +
      '<label class="field half">관찰한 것<textarea rows="4" name="observe" maxlength="800" placeholder="예: 농도가 높을수록 끓는점이 올라갔어요.">' + esc(r.observe || '') + '</textarea></label>' +
      '<div class="field half">결론 <span class="muted" style="font-weight:400">최종 판정은 관리자가 해요</span><div class="seg" style="grid-template-columns:repeat(3,1fr)">' + CLAIMS.map((c) => '<button type="button" data-claim="' + c + '" aria-pressed="' + (r.claim === c) + '">' + c + '</button>').join('') + '</div><input type="hidden" name="claim" value="' + esc(r.claim || '') + '"></div>' +
      '<label class="field">고찰 <span class="muted" style="font-weight:400">결과가 왜 이렇게 나왔는지 · 오차 원인 · 고칠 점</span><textarea name="discuss" rows="4" maxlength="2000" placeholder="예: 구리-아연 조합이 가장 높았던 것은 두 금속의 반응성 차이가 가장 크기 때문이다. 3회째 값이 낮은 것은 레몬 즙이 줄었기 때문으로 보인다.">' + esc(r.discuss || '') + '</textarea></label>' +
      '<label class="field half">결론 (한두 문장)<textarea name="conclusion" rows="2" maxlength="600" placeholder="예: 전극 금속의 반응성 차이가 클수록 레몬 전지의 전압이 높았다.">' + esc(r.conclusion || '') + '</textarea></label>' +
      '<label class="field half">다음에 해 볼 것<textarea rows="2" name="next" maxlength="400" placeholder="예: 설탕으로도 같은 실험">' + esc(r.next || '') + '</textarea></label>' +
      '<div class="btn-row"><button type="submit" class="btn" name="mode" value="draft">임시 저장</button><button type="submit" class="btn primary" name="mode" value="done">' + (n.status === '기록 완료' ? '고친 기록 저장' : '기록 완료로 제출') + '</button></div></form>', true);
  }
  // 측정 방식 바꾸기: 표가 비어 있으면 그 방식의 기본 표로, 값이 있으면 그대로 두고 그래프만 바뀜
  function pickKind(k) {
    const fm = $('#recordForm'); if (!fm) return;
    fm.querySelector('[name=kind]').value = k; $('#kindHint').textContent = KINDS[k].hint; $('#unitBox').style.display = k === 'rep' ? 'flex' : 'none';
    fm.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
    const t = readGrid(fm);
    $('#gridBox').innerHTML = t.rows.length ? gridHTML(t, k) : gridHTML({ cols: KINDS[k].cols.slice(), rows: Array.from({ length: KINDS[k].n }, () => KINDS[k].cols.map(() => '')) }, k);
  }
  function gridAct(act) {
    const fm = $('#recordForm'); if (!fm) return; const t = readGrid(fm), trs = Array.from(fm.querySelectorAll('.grid-ed tbody tr')), all = trs.map((tr) => Array.from(tr.querySelectorAll('input')).map((i) => i.value)), photos = trs.map((tr) => tr.dataset.photo || '');
    if (act === 'gRow') { all.push(t.cols.map(() => '')); photos.push(''); }
    if (act === 'gDelRow' && all.length > 1) { all.pop(); photos.pop(); }
    if (act === 'gCol' && t.cols.length < 12) { const k = fm.querySelector('[name=kind]').value; t.cols.push(k === 'rep' ? t.cols.length + '회' : '열 ' + (t.cols.length + 1)); all.forEach((r) => r.push('')); }
    if (act === 'gDelCol' && t.cols.length > 1) { t.cols.pop(); all.forEach((r) => r.pop()); }
    $('#gridBox').innerHTML = gridHTML({ cols: t.cols, rows: all, photos }, fm.querySelector('[name=kind]').value);
  }
  function saveRecord(fm, submitter) {
    const n = byId(fm.dataset.id); if (!n) return;
    const fd = new FormData(fm), table = readGrid(fm), done = submitter && submitter.value === 'done';
    const rep = { summary: String(fd.get('summary') || '').trim(), kind: String(fd.get('kind') || 'rep'), unit: String(fd.get('unit') || '').trim(), table, observe: String(fd.get('observe') || '').trim(), discuss: String(fd.get('discuss') || '').trim(), conclusion: String(fd.get('conclusion') || '').trim(), claim: String(fd.get('claim') || ''), next: String(fd.get('next') || '').trim(), by: meName(), at: dstr(TODAY) };
    if (done && !rep.summary && !table.rows.length && !rep.observe) return toast('요약 · 측정값 · 관찰 중 하나는 넣어 주세요');
    if (done && !rep.claim) return toast('결론을 골라 주세요');
    if (n.report && n.report.final) rep.final = n.report.final;
    n.report = rep;
    if (done && n.status === '실험 완료') { n.status = '기록 완료'; if (isAdmin()) n.verdict = rep.claim; PF.myMoves[n.id] = Date.now(); }
    save(); closeSheet(); render();
    toast(!done ? '임시 저장했어요' : (n.verdict ? '기록을 완료했어요' : '기록을 냈어요 · 관리자가 판정하면 확정돼요'));
  }

  function reportCard(n) {
    const r = n.report, kind = kindOf(r), t = tableOf(r);
    let h = '<div class="card rec-card"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">결과 기록</b><span>' + esc(KINDS[kind] ? KINDS[kind].label : '') + ' · ' + esc(r.by || '') + (r.at ? ' · ' + fmt(r.at) : '') + '</span></div>';
    if (r.summary) h += '<p>' + esc(r.summary) + '</p>';
    if (t.rows.length) {
      if (kind === 'rep') {
        const st = t.rows.map((row) => ({ cond: row[0], v: row.slice(1).filter((x) => x !== ''), s: stats(row.slice(1)) }));
        if (st.some((x) => x.s)) h += barChart(st.filter((x) => x.s), r.unit);
        h += tableHTML(t.cols.concat(['평균', '표준편차']), t.rows.map((row, i) => row.concat([st[i].s ? '<b>' + r3(st[i].s.m) + '</b>' + (r.unit ? ' ' + esc(r.unit) : '') : '-', st[i].s && st[i].s.n > 1 ? '±' + r3(st[i].s.sd) : '-'])), 2);
      } else {
        if (kind === 'line') h += lineChart(t); else if (kind === 'xy') h += xyChart(t);
        h += tableHTML(t.cols, t.rows, 0, t.photos);
      }
    }
    if (r.observe) h += '<div><small class="muted">관찰한 것</small><p>' + esc(r.observe) + '</p></div>';
    if (r.discuss) h += '<div><small class="muted">고찰</small><p>' + para(r.discuss) + '</p></div>';
    if (r.conclusion) h += '<div><small class="muted">결론</small><p><b>' + para(r.conclusion) + '</b></p></div>';
    h += '<div class="rec-claim"><span>결론 제안 <b>' + esc(r.claim || '-') + '</b></span><span>판정 ' + (n.verdict ? '<span class="badge ' + (n.verdict === '가설 기각' ? 't-bad' : n.verdict === '가설 지지' ? 't-ok' : 't-warn') + '">' + esc(n.verdict) + '</span>' : '<span class="badge t-neutral">판정 대기</span>') + '</span></div>';
    if (n.status === '기록 완료' && isAdmin()) h += '<div class="seg" style="grid-template-columns:repeat(3,1fr)" aria-label="판정 (관리자)">' + CLAIMS.map((c) => '<button type="button" data-verdict="' + c + '" aria-pressed="' + (n.verdict === c) + '">' + c + '</button>').join('') + '</div>';
    if (r.next) h += '<div><small class="muted">다음에 해 볼 것</small><p>' + esc(r.next) + '</p><button type="button" class="chipbtn" data-act="nextIdea">이걸로 아이디어 만들기</button></div>';
    return h + '</div>';
  }
  // 표: rawTail = 끝에서 몇 열은 이미 HTML (평균 · 표준편차)
  function tableHTML(cols, rows, rawTail, photos) {
    const ph = photos && photos.some(Boolean) ? photos : null;
    const pc = (fid) => { const f = fid && (db.files || []).find((x) => x.id === fid); if (!f) return '<td></td>'; const src = thumbSrc(f);
      return '<td class="t-ph"><button type="button" class="ph-mini" data-act="fileView" data-fid="' + esc(f.id) + '">' + (src ? '<img src="' + src + '" alt="' + esc(f.caption || '') + '">' : '<img data-fid="' + esc(f.id) + '" alt="">') + '</button></td>'; };
    return '<div style="overflow-x:auto"><table class="rec-table"><thead><tr>' + cols.map((c) => '<th>' + esc(c) + '</th>').join('') + (ph ? '<th>사진</th>' : '') + '</tr></thead><tbody>' +
      rows.map((row, i) => '<tr>' + row.map((v, j) => '<td' + (num(v) !== null || j >= row.length - rawTail ? ' class="code"' : '') + '>' + (j >= row.length - rawTail ? v : esc(v)) + '</td>').join('') + (ph ? pc(ph[i]) : '') + '</tr>').join('') + '</tbody></table></div>';
  }

  /* ---------- 그래프 ---------- */
  const CW = 320, CH = 180, CL = 42, CB = 144, CT = 14, CR = 10;
  const niceStep = (span) => { const raw = (span || 1) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), k = raw / mag; return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * mag; };
  const axisY = (min, max, y) => { const st = niceStep(max - min), out = []; for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-6 ? 0 : v);
    return out.map((v) => '<text x="' + (CL - 6) + '" y="' + (y(v) + 4) + '" font-size="10" text-anchor="end" fill="var(--muted)">' + r3(v) + '</text><line x1="' + CL + '" x2="' + (CW - CR) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-dasharray="3 4"/>').join(''); };
  const svgWrap = (g, label, note) => '<svg viewBox="0 0 ' + CW + ' ' + CH + '" class="rec-chart" role="img" aria-label="' + esc(label) + '">' + g + '</svg>' + (note ? '<small class="muted" style="margin-top:-6px">' + note + '</small>' : '');
  function range(vals, zero) {
    let lo = Math.min(...vals), hi = Math.max(...vals); if (zero) lo = Math.min(0, lo); if (hi === lo) { hi += Math.abs(hi) * 0.1 || 1; if (!zero) lo -= Math.abs(lo) * 0.1 || 1; }
    const st = niceStep((hi - lo) * 1.1); return [zero && lo >= 0 ? 0 : Math.floor(lo / st) * st, Math.ceil(hi / st + 0.05) * st];
  }
  // 조건별 반복: 막대 + 오차 막대(±표준편차)
  function barChart(st, unit) {
    const [min, max] = range(st.flatMap((x) => [x.s.m + x.s.sd, x.s.m - x.s.sd]), true);
    const y = (v) => CB - (v - min) / (max - min) * (CB - CT), step = (CW - CL - CR) / st.length, bw = Math.min(46, step * 0.6);
    let g = axisY(min, max, y) + '<line x1="' + CL + '" y1="' + y(Math.max(min, 0)) + '" x2="' + (CW - CR) + '" y2="' + y(Math.max(min, 0)) + '" stroke="var(--edge)"/>';
    st.forEach((x, i) => { const cx = CL + step * i + step / 2, top = y(x.s.m), base = y(Math.max(min, 0));
      g += '<rect x="' + (cx - bw / 2) + '" y="' + Math.min(top, base) + '" width="' + bw + '" height="' + Math.abs(base - top) + '" rx="4" fill="var(--exp)" opacity=".85"/>';
      if (x.s.sd) g += '<path d="M' + cx + ' ' + y(x.s.m + x.s.sd) + 'V' + y(x.s.m - x.s.sd) + 'M' + (cx - 7) + ' ' + y(x.s.m + x.s.sd) + 'h14M' + (cx - 7) + ' ' + y(x.s.m - x.s.sd) + 'h14" stroke="var(--fg)" stroke-width="1.6"/>';
      g += '<text x="' + cx + '" y="' + (Math.min(top, y(x.s.m + x.s.sd)) - 5) + '" font-size="10.5" font-weight="700" text-anchor="middle" fill="var(--fg)">' + r3(x.s.m) + '</text>';
      g += '<text x="' + cx + '" y="' + (CB + 16) + '" font-size="11" text-anchor="middle" fill="var(--muted)">' + esc(String(x.cond || '').slice(0, 8)) + '</text>'; });
    if (unit) g += '<text x="4" y="11" font-size="10" fill="var(--muted)">' + esc(unit) + '</text>';
    return svgWrap(g, '조건별 평균 막대 그래프', '막대: 평균 · 세로선: ±표준편차');
  }
  // 숫자로 읽을 수 있는 (x, 열들) 모으기
  function xyData(t) {
    const xs = t.rows.map((r) => num(r[0])), numericX = xs.filter((x) => x !== null).length >= Math.max(2, t.rows.length * 0.6);
    const series = t.cols.slice(1).map((name, k) => ({ name, pts: t.rows.map((r, i) => ({ x: numericX ? xs[i] : i, lab: r[0], y: num(r[k + 1]) })).filter((p) => p.y !== null && (numericX ? p.x !== null : true)) })).filter((s) => s.pts.length >= 2);
    return { numericX, series };
  }
  function lineChart(t) {
    const d = xyData(t); if (!d.series.length) return '';
    const allX = d.series.flatMap((s) => s.pts.map((p) => p.x)), allY = d.series.flatMap((s) => s.pts.map((p) => p.y));
    const [x0, x1] = d.numericX ? [Math.min(...allX), Math.max(...allX)] : [0, Math.max(1, t.rows.length - 1)], [y0, y1] = range(allY, false);
    const X = (v) => CL + (v - x0) / ((x1 - x0) || 1) * (CW - CL - CR), Y = (v) => CB - (v - y0) / (y1 - y0) * (CB - CT);
    let g = axisY(y0, y1, Y);
    (d.numericX ? [x0, (x0 + x1) / 2, x1] : [0, x1]).forEach((v) => { g += '<text x="' + X(v) + '" y="' + (CB + 16) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + (d.numericX ? r3(v) : esc(String(t.rows[Math.round(v)][0]).slice(0, 8))) + '</text>'; });
    d.series.forEach((s, k) => { const c = SERIES[k % SERIES.length], pts = s.pts.slice().sort((a, b) => a.x - b.x);
      g += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y)).join('') + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linejoin="round"/>' + pts.map((p) => '<circle cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="3.5" fill="' + c + '"/>').join(''); });
    g += '<text x="' + (CW - CR) + '" y="' + (CH - 4) + '" font-size="10" text-anchor="end" fill="var(--muted)">' + esc(t.cols[0]) + '</text>';
    const legend = d.series.length > 1 ? d.series.map((s, k) => '<span class="lg"><i style="background:' + SERIES[k % SERIES.length] + '"></i>' + esc(s.name) + '</span>').join('') : esc(d.series[0].name);
    return svgWrap(g, '시간에 따른 변화 꺾은선 그래프', legend);
  }
  function xyChart(t) {
    const d = xyData(t); if (!d.numericX || !d.series.length) return lineChart(t);
    const s = d.series[0], pts = s.pts, n = pts.length;
    const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
    const b = sxx ? sxy / sxx : 0, a = my - b * mx, r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    const [x0, x1] = range(pts.map((p) => p.x), false), [y0, y1] = range(pts.map((p) => p.y).concat([a + b * x0, a + b * x1]), false);
    const X = (v) => CL + (v - x0) / (x1 - x0) * (CW - CL - CR), Y = (v) => CB - (v - y0) / (y1 - y0) * (CB - CT);
    let g = axisY(y0, y1, Y);
    [x0, (x0 + x1) / 2, x1].forEach((v) => { g += '<text x="' + X(v) + '" y="' + (CB + 16) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + r3(v) + '</text>'; });
    g += '<line x1="' + X(x0) + '" y1="' + Y(a + b * x0) + '" x2="' + X(x1) + '" y2="' + Y(a + b * x1) + '" stroke="var(--idea)" stroke-width="2" stroke-dasharray="6 4"/>';
    g += pts.map((p) => '<circle cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="4" fill="var(--exp)" opacity=".9"/>').join('');
    g += '<text x="' + (CW - CR) + '" y="' + (CH - 4) + '" font-size="10" text-anchor="end" fill="var(--muted)">' + esc(t.cols[0]) + '</text><text x="4" y="11" font-size="10" fill="var(--muted)">' + esc(s.name) + '</text>';
    const eq = 'y = ' + r3(b) + 'x ' + (a < 0 ? '− ' : '+ ') + r3(Math.abs(a));
    return svgWrap(g, '두 값의 관계 산점도', '점: 측정값 · 점선: 추세선 <span class="code">' + eq + '</span> · <b>R² = ' + r2.toFixed(3) + '</b>' + (r2 >= 0.9 ? ' (아주 강한 관계)' : r2 >= 0.6 ? ' (뚜렷한 관계)' : r2 >= 0.3 ? ' (약한 관계)' : ' (관계가 거의 없음)'));
  }

  /* ================= 실험 과정: 계획서 · 검토 · 준비 · 진행 · 보고서 · 댓글 =================
   * 노드에 더 붙는 값
   *   plan = { purpose, hypo, ind, dep, ctrl, materials: [], steps: [], safety, roles, expect, refs, by, at }
   *   prep = { done: { 항목: 시각 }, extra: [] }
   *   run  = { started, ended, done: { 단계번호: 시각 }, notes: [{ id, at, by, kind, text }] }
   *   report += { discuss, conclusion, final: { by, at } }
   *   deleted = 'true' 이면 휴지통 */
  const isDel = (n) => !!n && (n.deleted === true || n.deleted === 'true');
  const alive = () => db.nodes.filter((n) => !isDel(n) && !(PF.mode !== 'live' && isPriv(n) && !canWork(n)));   // 체험에서도 비공개는 팀 · 관리자만
  const allComments = () => db.comments || (db.comments = []);
  const commentsOf = (id, sec) => allComments().filter((c) => c.node === id && (sec === undefined || c.sec === sec));
  const approvals = (n) => commentsOf(n.id).filter((c) => c.kind === 'approve' && c.by !== n.owner && c.by !== n.createdBy);   // 담당 · 만든 사람 승인은 안 셈 (함께하는 사람은 됨)
  // 지도 선생님: 역할 '교사'. 있으면 선생님 승인이 꼭 있어야 준비 시작
  const teacherNames = () => ((PF.mode === 'live' ? PF.members : db.members) || []).filter((m) => m.role === '교사').map((m) => m.name);
  // 승인 규칙 (동아리마다 설정 → 실험 승인 규칙). 기본: 팀 밖 부원 2명 → 선생님 최종 승인
  const RULES0 = { peers: 2, team: false, teacher: 'final', skip: false };
  const rules = () => Object.assign({}, RULES0, (PF.mode === 'live' ? PF.rules : db.rules) || {});
  const teacherNeeded = () => rules().teacher === 'final' && teacherNames().length > 0;
  const teacherOk = (n) => { const t = teacherNames(); return !teacherNeeded() || approvals(n).some((c) => t.includes(c.by)); };
  const peerApprovals = (n) => { const R = rules(), t = teacherNames(); return approvals(n).filter((c) => !t.includes(c.by) && (R.team || !teamOf(n).includes(c.by))); };
  const reviewCount = (n) => Math.max(+n.review || 0, peerApprovals(n).length);
  const reviewDone = (n) => reviewCount(n) >= rules().peers && teacherOk(n);
  // 이 실험의 사람들: 담당 · 만든 사람 · 함께하는 사람 (아이디어는 담당 지원자도). 이 사람들과 기장 · 선생님만 고칠 수 있어요
  const teamOf = (n) => [n.owner, n.createdBy].concat(Array.isArray(n.team) ? n.team : []).concat(n.type === 'idea' && n.volunteer ? [n.volunteer] : []).filter(Boolean);
  const inTeam = (n) => !!n && teamOf(n).includes(meName());
  const canWork = (n) => isAdmin() || inTeam(n);
  const isMine = inTeam;
  const isPriv = (n) => n.private === true || n.private === 'true';
  const isFinal = (n) => !!(n.report && n.report.final);
  const canEdit = (n) => canWork(n) && (!isFinal(n) || isAdmin());
  const canDelete = (n) => isAdmin() || n.owner === meName() || n.createdBy === meName();
  const nowIso = () => new Date().toISOString();
  const hm = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const md = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate(); };
  const lines = (t) => String(t || '').split('\n').map((x) => x.replace(/^\s*(\d+[.)]|[-*•·])\s*/, '').trim()).filter(Boolean);
  const para = (t) => esc(t).replace(/\n/g, '<br>');
  const newCid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const PLAN = [
    ['purpose', '연구 동기와 목적', '왜 이 실험을 하나요? 무엇을 알고 싶나요?'],
    ['hypo', '가설', '예: 두 전극 금속의 반응성 차이가 클수록 전압이 높을 것이다.'],
    ['ind', '조작 변인 (바꾸는 것)', '예: 전극 금속 조합 (구리-아연, 구리-철, 구리-알루미늄)'],
    ['dep', '종속 변인 (재는 것)', '예: 전압(V) · 멀티미터로 측정'],
    ['ctrl', '통제 변인 (똑같이 둘 것)', '예: 레몬 크기, 전극 간격 2cm, 꽂는 깊이 3cm'],
    ['materials', '준비물 (한 줄에 하나)', '멀티미터 1개\n구리판 3장\n아연판 3장'],
    ['steps', '실험 방법 (한 줄에 한 단계)', '레몬을 굴려 즙이 잘 나오게 한다\n전극 두 개를 2cm 간격으로 꽂는다\n멀티미터로 전압을 잰다'],
    ['safety', '안전 주의', '예: 금속판 모서리에 손 베지 않게 장갑'],
    ['roles', '역할 분담', '예: 측정 - 김성수 · 기록 - 이하늘'],
    ['expect', '예상 결과', '예: 구리-아연이 가장 높고 구리-철이 가장 낮을 것'],
    ['refs', '참고 자료', '교과서 쪽수, 논문, 사이트 주소']
  ];
  const LISTS = { materials: 1, steps: 1 };
  const planReady = (p) => !!(p && p.purpose && p.steps && p.steps.length);
  const resultReady = (r) => !!(r && (r.summary || (r.table && r.table.rows && r.table.rows.length) || r.observe) && r.claim);
  // 단계 규칙 (연결기와 같음): 내용 없이 앞으로 못 감
  function stageGap(n) { const i = STAGES.indexOf(n.status); if (n.type !== 'exp' || i < 0) return ''; if (i >= 2 && !planReady(n.plan)) return 'plan'; if (i >= 5 && !resultReady(n.report)) return 'result'; return ''; }
  function moveBlock(n, to) {
    const a = STAGES.indexOf(n.status), b = STAGES.indexOf(to);
    if (b <= a) return '';
    if (b >= 2 && !planReady(n.plan)) return '계획서(목적 · 방법)를 먼저 다 써야 해요';
    if (b >= 3 && a < 3 && !(isAdmin() && rules().skip)) {
      if (reviewCount(n) < rules().peers) return '부원 ' + rules().peers + '명이 승인해야 준비를 시작할 수 있어요';
      if (!teacherOk(n)) return '지도 선생님의 최종 승인이 있어야 준비를 시작할 수 있어요';
    }
    if (b >= 5 && !resultReady(n.report)) return '결과(측정값 · 관찰)와 결론을 기록해야 기록 완료가 돼요';
    return '';
  }
  const PREP_BASE = ['실험 장소 · 시간 정하기', '안전 장비 (보안경 · 장갑)', '결과 기록 표 미리 만들기', '역할 나누기', '선생님께 알리기'];
  function prepItems(n) { const p = n.plan || {}, x = n.prep || {}; return (p.materials || []).map((m) => '준비물: ' + m).concat(PREP_BASE, x.extra || []); }
  function prepState(n) { const items = prepItems(n), done = (n.prep && n.prep.done) || {}; const k = items.filter((i) => done[i]).length; return { items, done, k, total: items.length }; }
  const signalOf = (n) => { if (!n.plan) return +n.signal || 0; const s = prepState(n); return s.total ? Math.round(5 * s.k / s.total) : 0; };

  /* ---------- 단계 표시줄 + 지금 할 일 ---------- */
  const FLOW = [['계획 작성', '계획'], ['검토 중', '검토'], ['준비 중', '준비'], ['실험 완료', '기록'], ['기록 완료', '보고서']];
  function stepper(n) {
    const i = isFinal(n) ? FLOW.length : FLOW.findIndex((f) => f[0] === n.status);
    return '<ol class="stepper" aria-label="실험 단계">' + FLOW.map((f, k) => '<li class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"><span>' + (k < i ? '✓' : k + 1) + '</span>' + f[1] + '</li>').join('') + '</ol>';
  }
  function nowCard(n) {
    if (n.type !== 'exp' || n.status === '취소') return '';
    const gap = stageGap(n);
    if (gap) {
      const bb = (act, label, cls) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>', w = canWork(n) && canEdit(n);
      const t = gap === 'plan' ? '계획서가 아직 없어요' : '결과 기록이 아직 없어요';
      const body = gap === 'plan' ? '‘' + esc(n.status) + '’로 표시돼 있지만 계획서(목적 · 방법)가 비어 있어요. 계획서를 써야 검토 · 승인 · 준비를 할 수 있어요.' : '‘기록 완료’로 표시돼 있지만 측정값 · 관찰 · 결론이 없어요. 결과를 기록해야 보고서가 만들어져요.';
      return '<div class="card now-card">' + stepper(n) + '<b class="now-t">' + t + '</b><span class="muted now-b">' + body + (w ? '' : ' 담당 · 함께하는 사람이 채울 때까지 기다려 주세요.') + '</span><div class="btn-row">' +
        (w ? (gap === 'plan' ? bb('plan', '계획서 쓰기', 'primary') : bb('record', '결과 기록하기', 'primary')) : '') + '</div></div>';
    }
    if (!canWork(n) && n.status !== '검토 중') {
      const who = teamOf(n).filter((x, i, a) => a.indexOf(x) === i).join(' · ') || '다른 부원';
      const vb = (act, label, cls) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
      return '<div class="card now-card">' + stepper(n) + '<b class="now-t">' + esc(who) + '의 실험이에요</b><span class="muted now-b">읽고 댓글 · 첨삭으로 도와줄 수 있어요. 고치기는 담당 · 함께하는 사람 · 기장 · 선생님만 할 수 있어요.</span><div class="btn-row">' +
        (n.status === '기록 완료' ? vb('report', '보고서 보기', 'primary') : '') + (n.run && (n.run.started || (n.run.notes || []).length) ? vb('runOpen', '진행 노트 보기') : '') + '</div></div>';
    }
    const b = (act, label, cls) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    let title = '', body = '', btns = '';
    const lock = !canEdit(n);
    if (n.status === '계획 작성') {
      if (!planReady(n.plan)) { title = '계획서를 써요'; body = '목적 · 가설 · 변인 · 준비물 · 방법을 정리하면 검토를 요청할 수 있어요.'; btns = b('plan', n.plan ? '계획서 이어 쓰기' : '계획서 쓰기', 'primary'); }
      else { title = '검토를 요청해요'; body = '계획서를 다 썼어요. 다른 부원 2명이 읽고 승인하면 준비를 시작해요.'; btns = b('askReview', '검토 요청하기', 'primary') + b('plan', '계획서 고치기'); }
    } else if (n.status === '검토 중') {
      const R = rules(), ap = approvals(n), k = reviewCount(n), tn = teacherNames(), tNeed = teacherNeeded(), tOk = teacherOk(n), open = commentsOf(n.id).filter((c) => (c.kind === 'fix' || c.kind === 'change') && !c.resolved).length;
      const mineOwn = n.owner === meName() || n.createdBy === meName(), iAmT = tn.includes(meName()), done = reviewDone(n);
      title = '검토 중 · 부원 ' + Math.min(k, R.peers) + '/' + R.peers + (tNeed ? ' · 선생님 ' + (tOk ? '✓' : '대기') : '');
      body = (ap.length ? '승인: ' + ap.map((c) => esc(c.by) + (tn.includes(c.by) ? '(선생님)' : '')).join(', ') + '. ' : '') + (open ? '고칠 곳 ' + open + '개가 남아 있어요. ' : '') +
        (done ? '승인이 끝났어요. 준비를 시작해요.' : k < R.peers ? (R.team ? '' : '팀 밖의 ') + '부원 ' + (R.peers - k) + '명이 더 승인해야 해요' + (tNeed ? ', 그다음 선생님(' + tn.map(esc).join(' · ') + ')이 최종 승인해요.' : '.') : '이제 선생님(' + tn.map(esc).join(' · ') + ')의 최종 승인만 남았어요.');
      const canApprove = !mineOwn && (iAmT ? tNeed : (R.team || !inTeam(n)));
      if (canApprove) btns += b('approve', approvals(n).some((c) => c.by === meName()) ? '승인함 ✓' : (iAmT ? '최종 승인' : '승인'), 'primary') + b('fixNote', '고칠 곳 남기기');
      else if (!mineOwn && !iAmT) btns += b('fixNote', '고칠 곳 남기기');
      if (canEdit(n)) btns += b('plan', '계획서 고치기');
      if (canWork(n)) { if (done) btns += b('advance', '준비 시작', 'blue'); else if (isAdmin() && R.skip) btns += b('advance', '검토 없이 준비 시작'); }
    } else if (n.status === '준비 중') {
      const s = prepState(n), go = s.total && s.k === s.total;
      title = go ? '준비 끝 · 실험을 시작해요' : '준비물을 챙겨요 · ' + s.k + '/' + s.total; body = go ? '진행 도우미가 방법을 한 단계씩 보여 줘요.' : '아래 준비 점검을 하나씩 체크하세요. 덜 됐어도 시작할 수는 있어요.';
      btns = b('runOpen', n.run && n.run.started ? '진행 도우미 이어서' : '실험 시작 · 진행 도우미', go ? 'primary' : '') ;
    } else if (n.status === '실험 완료') {
      title = '결과를 기록해요'; body = '측정값 · 관찰 · 고찰 · 결론을 남기면 보고서가 만들어져요.'; btns = b('record', n.report ? '결과 기록 이어 쓰기' : '결과 기록하기', 'primary') + (n.run ? b('runOpen', '진행 노트 보기') : '');
    } else if (n.status === '기록 완료') {
      title = isFinal(n) ? '보고서 확정됨' : '보고서를 다듬어요'; body = isFinal(n) ? esc(n.report.final.by) + ' · ' + md(n.report.final.at) + ' 확정. 고치려면 관리자가 확정을 풀어야 해요.' : '보고서를 보고 첨삭을 받아 고친 뒤 관리자가 확정해요.';
      btns = b('report', '보고서 보기', 'primary') + (lock ? '' : b('record', '기록 고치기'));
    }
    return '<div class="card now-card">' + stepper(n) + '<b class="now-t">' + title + '</b><span class="muted now-b">' + body + '</span><div class="btn-row">' + btns + '</div></div>';
  }

  /* 자동 보관된 항목: 열 때 연결기에서 내용을 받아 합침 (쓰는 사람은 모름) */
  const isArch = (n) => !!(n && n.arch && !n._full);
  function fetchArchived(id) {
    PF.archLoading = PF.archLoading || {}; if (PF.archLoading[id]) return; PF.archLoading[id] = 1;
    rpc('archived', { ids: [id] }, null, { quiet: true }).then((r) => {
      const it = r.items && r.items[id], n = byId(id); if (!n) return;
      if (it) { Object.assign(n, it.data || {}); const have = new Set(allComments().map((c) => c.id)); (it.comments || []).forEach((c) => { if (!have.has(c.id)) allComments().push(c); }); }
      delete n.arch; n._full = true; if (PF.base) PF.base.nodes[id] = JSON.stringify(n); render();
    }, (e) => { if (!deviceLost(e)) toast('보관된 기록을 불러오지 못했어요'); }).finally(() => { delete PF.archLoading[id]; });
  }
  const archWait = (n) => { fetchArchived(n.id); return '<div class="card empty loading-line">' + SPIN + '지난 기록을 불러오는 중…</div>'; };

  /* 지난 단계 칸 접기 (펼친 상태는 기억) */
  function fold(n, key, label, html) { const k = n.id + ':' + key; return '<details class="fold" data-fk="' + esc(k) + '"' + (PF.unfold && PF.unfold[k] ? ' open' : '') + '><summary><span>' + esc(label) + '</span><small>펼치기</small></summary>' + html + '</details>'; }
  const planSum = (n) => '계획서' + (n.plan && n.plan.purpose ? ' · ' + n.plan.purpose.slice(0, 26) + (n.plan.purpose.length > 26 ? '…' : '') : '');
  const runSum = (n) => '진행 노트 · 단계 ' + Object.keys((n.run && n.run.done) || {}).length + '/' + ((n.plan && n.plan.steps) || []).length + ' · 메모 ' + ((n.run && n.run.notes) || []).length;
  document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.matches && d.matches('details[data-fk]')) { PF.unfold = PF.unfold || {}; PF.unfold[d.dataset.fk] = d.open; } }, true);

  /* ---------- 계획서 ---------- */
  function secChip(n, sec) {
    const all = commentsOf(n.id, sec), open = all.filter((c) => !c.resolved && c.kind !== 'approve').length;
    return '<button type="button" class="chipbtn sec-chip' + (open ? ' has' : '') + '" data-act="secNotes" data-sec="' + sec + '">' + (all.length ? '첨삭 ' + (open ? open : '✓') : '첨삭') + '</button>';
  }
  function planCard(n) {
    const p = n.plan;
    if (!p) return n.type === 'exp' && n.status !== '취소' ? '<div class="card sec-card"><div class="sec-head"><b>계획서</b></div><span class="muted">아직 계획서가 없어요.</span>' + (canEdit(n) ? '<div class="btn-row"><button type="button" class="btn" data-act="plan">계획서 쓰기</button></div>' : '') + '</div>' : '';
    let h = '<div class="card sec-card"><div class="sec-head"><b>계획서</b><span class="muted">' + esc(p.by || '') + (p.at ? ' · ' + md(p.at) : '') + '</span>' + (canEdit(n) ? '<button type="button" class="chipbtn" data-act="plan">고치기</button>' : '') + '</div>';
    PLAN.forEach(([k, label]) => {
      const v = p[k]; if (!v || (Array.isArray(v) && !v.length)) return;
      h += '<div class="pl"><div class="pl-h"><small>' + label.replace(/ \(.*\)$/, '') + '</small>' + secChip(n, 'plan.' + k) + '</div>' +
        (LISTS[k] ? (k === 'steps' ? '<ol>' : '<ul>') + v.map((x) => '<li>' + esc(x) + '</li>').join('') + (k === 'steps' ? '</ol>' : '</ul>') : '<p>' + para(v) + '</p>') + '</div>';
    });
    return h + '</div>';
  }
  function planForm(n) {
    const p = n.plan || {};
    openSheet('<h3>계획서 · ' + esc(code(n)) + '</h3><form id="planForm" class="fgrid" data-id="' + esc(n.id) + '" style="display:flex;flex-direction:column;gap:12px">' +
      PLAN.map(([k, label, ph]) => '<label class="field ' + ({ purpose: 'full', hypo: 'full', ind: 'third', dep: 'third', ctrl: 'third' }[k] || 'half') + '">' + label + '<textarea name="' + k + '" rows="' + (LISTS[k] ? 5 : 3) + '" maxlength="1500" placeholder="' + esc(ph) + '">' + esc(LISTS[k] ? (p[k] || []).join('\n') : p[k] || '') + '</textarea></label>').join('') +
      '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button><button type="submit" class="btn primary">저장</button></div></form>', true);
  }
  function savePlan(fm) {
    const n = byId(fm.dataset.id); if (!n) return; const fd = new FormData(fm), p = {};
    PLAN.forEach(([k]) => { const v = String(fd.get(k) || '').trim(); p[k] = LISTS[k] ? lines(v) : v; });
    p.by = meName(); p.at = nowIso(); n.plan = p; save(); closeSheet(); render();
    toast(planReady(p) ? (n.status === '계획 작성' ? '저장했어요 · 이제 검토를 요청할 수 있어요' : '계획서를 고쳤어요') : '저장했어요 · 목적과 방법을 채우면 검토를 요청할 수 있어요');
  }

  /* ---------- 준비 점검 ---------- */
  function prepCard(n) {
    if (n.type !== 'exp' || !['준비 중', '실험 완료', '기록 완료'].includes(n.status)) return '';
    const s = prepState(n), edit = n.status === '준비 중' && canEdit(n);
    return '<div class="card sec-card"><div class="sec-head"><b>준비 점검</b><span class="muted">' + s.k + '/' + s.total + ' · 출발 신호 ' + signalOf(n) + '/5</span></div>' +
      '<div class="meter"><i style="width:' + (s.total ? Math.round(100 * s.k / s.total) : 0) + '%"></i></div>' +
      '<div class="checks">' + s.items.map((it) => '<button type="button" class="ck' + (s.done[it] ? ' on' : '') + '" data-act="prepToggle" data-pi="' + esc(it) + '"' + (edit ? '' : ' disabled') + '><span class="box">' + (s.done[it] ? '✓' : '') + '</span><span>' + esc(it) + '</span>' + (s.done[it] && s.done[it] !== true ? '<small>' + md(s.done[it]) + '</small>' : '') + '</button>').join('') + '</div>' +
      (edit ? '<form id="prepAdd" class="inline-add"><input name="t" maxlength="60" placeholder="챙길 것 추가 (예: 여분 전선)"><button type="submit" class="chipbtn">추가</button></form>' : '') + '</div>';
  }
  function prepToggle(n, item) {
    if (!canEdit(n) || n.status !== '준비 중') return;
    n.prep = n.prep || { done: {}, extra: [] }; n.prep.done = n.prep.done || {};
    if (n.prep.done[item]) delete n.prep.done[item]; else n.prep.done[item] = nowIso();
    n.signal = signalOf(n); save(); render();
    const s = prepState(n); if (s.k === s.total) toast('준비 끝! 실험을 시작할 수 있어요');
  }

  /* ---------- 진행 도우미 (실험 당일) ---------- */
  const NOTE_KIND = { obs: '관찰', change: '바꾼 점', problem: '문제' };
  function viewRun(id) {
    const n = byId(id); if (!n) return '<div class="card empty">항목을 찾지 못했어요.</div>';
    const steps = (n.plan && n.plan.steps) || [], r = n.run || {}, done = r.done || {}, curI = steps.findIndex((_, i) => !done[i]), ended = !!r.ended;
    const rw = canWork(n);
    let h = '<div class="run-head"><span class="idchip">' + esc(code(n)) + '</span><b>' + fieldTag(n) + esc(n.title) + '</b><span class="muted">' + (r.started ? '시작 ' + md(r.started) + ' ' + hm(r.started) : '아직 시작 전') + (ended ? ' · 끝 ' + hm(r.ended) : '') + '</span></div>';
    if (!steps.length) h += '<div class="card muted">계획서에 실험 방법이 없어요. 계획서에 단계를 적으면 여기서 하나씩 체크할 수 있어요. <button type="button" class="chipbtn" data-act="plan">계획서 고치기</button></div>';
    else h += '<div class="card run-steps">' + steps.map((s, i) => '<button type="button" class="rs' + (done[i] ? ' on' : '') + (i === curI && !ended ? ' cur' : '') + '" data-act="stepToggle" data-i="' + i + '"' + ((ended && !isAdmin()) || !rw ? ' disabled' : '') + '><span class="rs-n">' + (done[i] ? '✓' : i + 1) + '</span><span class="rs-t">' + esc(s) + '</span>' + (done[i] ? '<small>' + hm(done[i]) + '</small>' : '') + '</button>').join('') + '</div>';
    if (!rw) h += '<div class="card muted" style="font-size:13px">' + esc(teamOf(n).join(' · ')) + '의 실험이에요. 진행 노트는 읽기만 할 수 있어요.</div>';
    if (rw) h += '<form id="noteForm" class="card note-form"><b>메모 남기기</b><div class="seg" style="grid-template-columns:repeat(3,1fr)">' + Object.entries(NOTE_KIND).map(([k, l], i) => '<button type="button" data-nk="' + k + '" aria-pressed="' + (i === 0) + '">' + l + '</button>').join('') + '</div><input type="hidden" name="kind" value="obs">' +
      '<textarea name="text" rows="2" maxlength="500" placeholder="예: 3번째 레몬은 즙이 적어 전압이 낮게 나옴"></textarea><div class="btn-row"><button type="submit" class="btn">메모 남기기</button><button type="button" class="btn" data-act="record">측정값 넣기</button></div></form>';
    h += filesCard(n, true);
    const notes = (r.notes || []).slice().reverse();
    if (notes.length) h += '<div class="card sec-card"><div class="sec-head"><b>진행 노트</b><span class="muted">' + notes.length + '개</span></div>' + notes.map((x) => '<div class="nt"><span class="badge ' + (x.kind === 'problem' ? 't-bad' : x.kind === 'change' ? 't-warn' : 't-info') + '">' + (NOTE_KIND[x.kind] || '메모') + '</span><span class="nt-t">' + para(x.text) + '<small class="muted">' + esc(x.by || '') + ' · ' + hm(x.at) + '</small></span>' + (canWork(n) && (x.by === meName() || isAdmin()) ? '<button type="button" class="chipbtn" data-act="noteDel" data-nid="' + esc(x.id) + '">지우기</button>' : '') + '</div>').join('') + '</div>';
    if (n.status === '준비 중' && rw) h += '<div class="btn-row"><button type="button" class="btn primary" data-act="runEnd">실험 끝내기 · 결과 기록으로</button></div>';
    return h;
  }
  function runStart(n) { if (n.run && n.run.started) return; n.run = Object.assign({ done: {}, notes: [] }, n.run || {}, { started: nowIso() }); save(); }
  function runCard(n) {
    const r = n.run; if (!r || (!r.started && !(r.notes || []).length)) return '';
    const steps = (n.plan && n.plan.steps) || [], k = Object.keys(r.done || {}).length;
    return '<div class="card sec-card"><div class="sec-head"><b>진행 노트</b><span class="muted">' + (r.started ? md(r.started) + ' ' + hm(r.started) : '') + (r.ended ? '~' + hm(r.ended) : '') + ' · 단계 ' + k + '/' + steps.length + ' · 메모 ' + (r.notes || []).length + '</span><button type="button" class="chipbtn" data-act="runOpen">열기</button></div>' +
      (r.notes || []).slice(-3).map((x) => '<div class="nt"><span class="badge ' + (x.kind === 'problem' ? 't-bad' : x.kind === 'change' ? 't-warn' : 't-info') + '">' + (NOTE_KIND[x.kind] || '메모') + '</span><span class="nt-t">' + para(x.text) + '<small class="muted">' + hm(x.at) + '</small></span></div>').join('') + '</div>';
  }

  /* ---------- 댓글 · 첨삭 ---------- */
  const CKIND = { note: ['댓글', 't-neutral'], fix: ['첨삭', 't-warn'], approve: ['승인', 't-ok'], change: ['수정 요청', 't-bad'], answer: ['답변', 't-info'] };
  function secLabel(sec) {
    if (!sec) return '';
    const [a, b] = sec.split('.'); if (a === 'plan') { const f = PLAN.find((x) => x[0] === b); return '계획서 · ' + (f ? f[1].replace(/ \(.*\)$/, '') : b); }
    if (a === 'report') { const f = REPORT_SECS.find((x) => x[0] === b); return '보고서 · ' + (f ? f[1] : b); }
    return sec;
  }
  function commentHTML(c) {
    const mine = c.by === meName(), k = CKIND[c.kind] || CKIND.note, nn = byId(c.node), canRes = mine || isAdmin() || (nn && inTeam(nn));
    return '<div class="cm' + (c.resolved ? ' done' : '') + '"><div class="cm-h"><span class="badge ' + k[1] + '">' + k[0] + '</span><b>' + esc(c.by) + '</b>' + (c.role && c.role !== '부원' ? '<small class="muted">' + esc(c.role) + '</small>' : '') + '<small class="muted">' + md(c.at) + ' ' + hm(c.at) + (c.editedAt ? ' · 고침' : '') + '</small>' + (c.sec ? '<small class="cm-sec">' + esc(secLabel(c.sec)) + '</small>' : '') + '</div>' +
      (c.text ? '<p>' + para(c.text) + '</p>' : '') + '<div class="cm-a">' +
      (c.kind !== 'approve' && c.kind !== 'note' && c.kind !== 'answer' && canRes ? '<button type="button" class="chipbtn" data-act="cmResolve" data-cid="' + esc(c.id) + '">' + (c.resolved ? '다시 열기' : '고쳤어요') + '</button>' : '') +
      (mine && c.kind !== 'approve' ? '<button type="button" class="chipbtn" data-act="cmEdit" data-cid="' + esc(c.id) + '">고치기</button>' : '') +
      (mine || isAdmin() ? '<button type="button" class="chipbtn" data-act="cmDel" data-cid="' + esc(c.id) + '">지우기</button>' : '') + '</div></div>';
  }
  function commentsCard(n) {
    const list = commentsOf(n.id).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const q = n.type === 'q';
    return '<div class="card sec-card" id="comments"><div class="sec-head"><b>' + (q ? '답변 · 댓글' : '댓글 · 첨삭') + '</b><span class="muted">' + list.length + '개</span></div>' + list.map(commentHTML).join('') +
      '<form class="cm-add" data-node="' + esc(n.id) + '"><textarea name="text" rows="2" maxlength="1000" placeholder="' + (q ? '아는 만큼 답해 주세요' : '의견 · 질문 · 고칠 곳을 남겨요') + '"></textarea><input type="hidden" name="sec" value=""><div class="btn-row">' +
      (q ? '<button type="submit" class="btn primary" name="kind" value="answer">답변 남기기</button><button type="submit" class="btn" name="kind" value="note">댓글</button>'
        : '<button type="submit" class="btn" name="kind" value="note">댓글 남기기</button>' + (n.type === 'exp' ? '<button type="submit" class="btn" name="kind" value="fix">첨삭으로 남기기</button>' : '')) + '</div></form></div>';
  }
  function secSheet(n, sec) {
    const list = commentsOf(n.id, sec);
    openSheet('<h3>첨삭 · ' + esc(secLabel(sec)) + '</h3>' + (list.length ? list.map(commentHTML).join('') : '<p class="muted">아직 첨삭이 없어요.</p>') +
      '<form class="cm-add" data-node="' + esc(n.id) + '"><textarea name="text" rows="3" maxlength="1000" placeholder="이 부분에서 고칠 점 · 좋은 점"></textarea><input type="hidden" name="sec" value="' + esc(sec) + '"><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button><button type="submit" class="btn primary" name="kind" value="fix">첨삭 남기기</button></div></form>');
  }
  function fixSheet(n) {
    const opts = PLAN.filter(([k]) => n.plan && n.plan[k] && (!Array.isArray(n.plan[k]) || n.plan[k].length)).map(([k, l]) => '<option value="plan.' + k + '">계획서 · ' + l.replace(/ \(.*\)$/, '') + '</option>').join('');
    openSheet('<h3>고칠 곳 남기기</h3><form class="cm-add" data-node="' + esc(n.id) + '"><label class="field">어느 부분<select name="sec"><option value="">전체</option>' + opts + '</select></label><textarea name="text" rows="4" maxlength="1000" placeholder="예: 통제 변인에 전극 간격도 넣어 주세요"></textarea><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button><button type="submit" class="btn primary" name="kind" value="change">수정 요청 남기기</button></div></form>');
  }
  async function addComment(nodeId, kind, sec, text) {
    text = String(text || '').trim(); if (!text && kind !== 'approve') { toast('내용을 써 주세요'); return false; }
    if (kind === 'approve') { const an = byId(nodeId); if (!an || an.status !== '검토 중' || !planReady(an.plan)) { toast('계획서를 다 쓰고 검토를 요청한 실험만 승인할 수 있어요'); return false; }
      const isT = teacherNames().includes(meName());
      if (an.owner === meName() || an.createdBy === meName()) { toast('내 실험은 내가 승인할 수 없어요'); return false; }
      if (!isT && !rules().team && inTeam(an)) { toast('함께하는 사람은 승인할 수 없어요 · 팀 밖의 부원이 검토해요'); return false; }
      if (isT && teacherNeeded() && reviewCount(an) < rules().peers) { toast('부원 ' + rules().peers + '명이 먼저 승인해야 선생님이 최종 승인할 수 있어요'); return false; } }
    if (PF.mode === 'live') {
      try { const r = await rpc('comment', { node: nodeId, kind, sec, text }); if (kind === 'approve') db.comments = allComments().filter((c) => !(c.node === nodeId && c.kind === 'approve' && c.by === meName())); allComments().push(r.comment); }
      catch (e) { if (!deviceLost(e)) toast(e.message); return false; }
    } else {
      if (kind === 'approve') db.comments = allComments().filter((c) => !(c.node === nodeId && c.kind === 'approve' && c.by === meName()));
      allComments().push({ id: newCid(), node: nodeId, sec: sec || '', kind, text, by: meName(), role: myRole(), at: nowIso(), resolved: false }); save();
    }
    render(); return true;
  }
  async function commentOp(op, cid, text) {
    const c = allComments().find((x) => x.id === cid); if (!c) return;
    if (PF.mode === 'live') { try { await rpc('comment', { op, id: cid, text }); } catch (e) { if (!deviceLost(e)) toast(e.message); return; } }
    if (op === 'delete') db.comments = allComments().filter((x) => x.id !== cid);
    if (op === 'edit') { c.text = text; c.editedAt = nowIso(); }
    if (op === 'resolve' || op === 'reopen') c.resolved = op === 'resolve';
    if (PF.mode !== 'live') save();
    render();
  }

  /* ---------- 고치기 · 가지 옮기기 · 휴지통 ---------- */
  function itemMenu(n) {
    const b = (act, label, cls) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    if (!canWork(n) && !canDelete(n)) return toast('담당 · 함께하는 사람 · 기장 · 선생님만 관리할 수 있어요');
    openSheet('<h3>' + esc(n.title) + '</h3><div style="display:flex;flex-direction:column;gap:10px">' +
      (canEdit(n) ? b('editItem', '제목 · 날짜 · 담당 · 함께하는 사람') : '') + (isExpLike(n) && canWork(n) ? b('moveItem', '가지 옮기기') : '') +
      (n.type === 'exp' && (isAdmin() || n.owner === meName() || n.createdBy === meName()) ? b('togglePrivate', isPriv(n) ? '공개로 바꾸기 (동아리 모두 보기)' : '비공개로 (팀 · 기장 · 선생님만)') : '') +
      (n.type === 'exp' && n.status !== '취소' && isAdmin() ? b('cancelExp', '실험 취소 (기록은 남김)') : '') +
      (canDelete(n) ? b('trashItem', '휴지통으로', 'danger') : '') + b('closeSheet', '닫기') + '</div>');
  }
  function editForm(n) {
    const mem = (PF.mode === 'live' ? PF.members || [] : db.members || []).map((m) => m.name), owners = mem.length ? mem : [];
    openSheet('<h3>고치기 · ' + esc(code(n)) + '</h3><form id="editForm" data-id="' + esc(n.id) + '" style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="field">제목<input name="title" maxlength="60" required value="' + esc(n.title) + '"></label>' +
      '<label class="field">분야<select name="field">' + Object.keys(FCODE).map((f) => '<option' + (n.field === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></label>' +
      '<label class="field">' + (n.type === 'exp' ? '실험 예정일' : '날짜') + '<input type="date" name="date" value="' + esc(n.date || '') + '"></label>' +
      (n.type !== 'q' ? '<label class="field">담당' + (owners.length ? '<select name="owner"><option value="">없음</option>' + owners.map((o) => '<option' + (n.owner === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' : '<input name="owner" maxlength="20" value="' + esc(n.owner || '') + '">') + '</label>' : '') +
      (isExpLike(n) && !parentOf(n) ? lineFields([...new Set(alive().map((x) => x.line).filter(Boolean))], n.line || '__new', '') + '<label class="field">이 줄기 이름 바꾸기<input name="lineName" maxlength="20" value="' + esc(lineName(n.line)) + '"></label>' : '') +
      (n.type === 'exp' && (isAdmin() || n.owner === meName() || n.createdBy === meName()) && mem.length ? '<div class="field">함께하는 사람 <span class="muted" style="font-weight:400">이 실험을 같이 고칠 수 있어요</span><div class="team-pick">' + mem.filter((m) => m !== n.owner).map((m) => '<label><input type="checkbox" name="team" value="' + esc(m) + '"' + ((n.team || []).includes(m) ? ' checked' : '') + '>' + esc(m) + '</label>').join('') + '</div></div>' : '') +
      '<label class="field">설명<textarea name="desc" rows="3" maxlength="600">' + esc(n.desc || '') + '</textarea></label>' +
      '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">저장</button></div></form>');
  }
  function saveEdit(fm) {
    const n = byId(fm.dataset.id); if (!n) return; const fd = new FormData(fm);
    n.title = String(fd.get('title')).trim().slice(0, 60) || n.title; n.field = String(fd.get('field') || n.field); if (fd.get('date')) n.date = String(fd.get('date'));
    if (fd.has('owner')) n.owner = String(fd.get('owner') || '').trim(); n.desc = String(fd.get('desc') || '').trim();
    if (fm.querySelector('[name=team]')) n.team = fd.getAll('team').map(String).filter((x) => x !== n.owner);
    if (fd.has('line') && fd.get('line') !== n.line) { const ln = pickLine(fd, n.title); descendants(n).forEach((id) => { const x = byId(id); if (x) x.line = ln; }); }
    else if (fd.has('lineName') && n.line) { const ln = String(fd.get('lineName')).trim().slice(0, 20); if (ln) db.lines[n.line] = ln; }
    save(); closeSheet(); render(); toast('고쳤어요');
  }
  function descendants(n) { return treeRows([n]).map((r) => r.n.id); }
  function moveSheet(n) {
    const bad = new Set(descendants(n)), cur = parentOf(n);
    const cands = alive().filter((x) => isExpLike(x) && !bad.has(x.id) && x.status !== '취소').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    openSheet('<h3>가지 옮기기</h3><p class="muted" style="margin:0 0 8px">' + esc(n.title) + '을(를) 어느 실험에서 이어지게 할까요? 이 실험 뒤에 이어진 실험도 함께 옮겨져요.</p><div class="move-list">' +
      '<button type="button" class="srow" data-act="moveTo" data-id=""><span class="tx"><b>뿌리로 (새 줄기의 시작)</b><small>어느 실험에도 이어지지 않음</small></span>' + (!cur ? '<span class="badge t-info">지금</span>' : '') + '</button>' +
      cands.map((x) => '<button type="button" class="srow" data-act="moveTo" data-id="' + esc(x.id) + '">' + ico(x) + '<span class="tx"><small class="code">' + esc(code(x)) + ' · ' + esc(lineName(lineage(x)[0].line)) + '</small><b>' + fieldTag(x) + esc(x.title) + '</b></span>' + (cur && cur.id === x.id ? '<span class="badge t-info">지금</span>' : '') + '</button>').join('') +
      '</div><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
    PF.moving = n.id;
  }
  function moveTo(targetId) {
    const n = byId(PF.moving); if (!n) return; const cur = parentOf(n);
    if ((cur ? cur.id : '') === targetId) { closeSheet(); return; }
    db.links = db.links.filter((l) => !(l.t === n.id && (l.k === 'follow' || l.k === 'next')));
    if (targetId) { db.links.push({ s: targetId, t: n.id, k: 'next' }); const t = byId(targetId); descendants(n).forEach((id) => { const x = byId(id); if (x) x.line = lineage(t)[0].line; }); }
    else if (!n.line || alive().some((x) => x.id !== n.id && x.line === n.line && !parentOf(x))) { const ln = 'L' + Date.now().toString(36); db.lines[ln] = n.title.slice(0, 12); descendants(n).forEach((id) => { const x = byId(id); if (x) x.line = ln; }); }
    save(); closeSheet(); render(); toast(targetId ? byId(targetId).title + ' 뒤로 옮겼어요' : '새 줄기의 뿌리로 옮겼어요');
  }
  function trashItem(n) {
    const kids = childrenOf(n).length;
    if (!confirm('휴지통으로 옮길까요?' + (kids ? ' 이어진 실험 ' + kids + '개는 그대로 남아요.' : '') + ' 휴지통에서 되살릴 수 있어요.')) return;
    n.deleted = 'true'; save(); closeSheet(); back(); toast('휴지통으로 옮겼어요', { label: '되돌리기', fn: () => { const x = byId(n.id); if (x) { x.deleted = ''; save(); render(); toast('되살렸어요'); } } });
  }
  function viewTrash() {
    const list = db.nodes.filter(isDel);
    return '<p class="muted" style="margin:0 2px;font-size:13px">지운 항목은 여기에 남아요. 만든 사람이나 관리자가 되살릴 수 있어요.</p>' +
      (list.length ? list.map((n) => '<div class="srow">' + ico(n) + '<span class="tx"><small class="code">' + esc(code(n)) + '</small><b>' + fieldTag(n) + esc(n.title) + '</b></span>' + (canDelete(n) ? '<button type="button" class="chipbtn" data-act="restore" data-id="' + esc(n.id) + '">되살리기</button>' : '') + '</div>').join('') : '<div class="card empty">휴지통이 비어 있어요.</div>');
  }

  /* ---------- 보고서 ---------- */
  const REPORT_SECS = [['purpose', '연구 동기와 목적'], ['hypo', '가설'], ['vars', '변인'], ['materials', '준비물'], ['steps', '실험 방법'], ['process', '실험 과정'], ['result', '실험 결과'], ['discuss', '고찰'], ['conclusion', '결론'], ['next', '더 해 볼 것'], ['refs', '참고 자료']];
  function period(n) {
    const ds = [n.created, n.date, n.run && n.run.started && dstr(new Date(n.run.started)), n.run && n.run.ended && dstr(new Date(n.run.ended))].filter((x) => x && /^\d{4}-\d\d-\d\d/.test(x)).map((x) => String(x).slice(0, 10)).sort();
    return ds.length ? (ds[0] === ds[ds.length - 1] ? ds[0] : ds[0] + ' ~ ' + ds[ds.length - 1]) : '';
  }
  function viewReport(id) {
    const n = byId(id); if (!n) return '<div class="card empty">항목을 찾지 못했어요.</div>';
    if (isArch(n) && PF.mode === 'live') return archWait(n);
    const p = n.plan || {}, r = n.report || {}, run = n.run || {}, miss = (t) => '<p class="miss">(아직 안 씀)</p>';
    const sec = (key, i, inner) => '<section class="rp-sec"><div class="rp-h"><span class="rp-no">' + String(i + 1).padStart(2, '0') + '</span><h3>' + REPORT_SECS[i][1] + '</h3><span class="no-print">' + secChip(n, 'report.' + key) + '</span></div><div class="rp-body">' + inner + '</div></section>';
    const L = (arr, ol) => arr && arr.length ? (ol ? '<ol>' : '<ul>') + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + (ol ? '</ol>' : '</ul>') : miss();
    const T = (v) => v ? '<p>' + para(v) + '</p>' : miss();
    const lin = lineage(n), kids = childrenOf(n);
    let body = '';
    body += sec('purpose', 0, T(p.purpose));
    body += sec('hypo', 1, T(p.hypo));
    body += sec('vars', 2, p.ind || p.dep || p.ctrl ? '<table class="rp-t"><tr><th>조작 변인</th><td>' + para(p.ind || '-') + '</td></tr><tr><th>종속 변인</th><td>' + para(p.dep || '-') + '</td></tr><tr><th>통제 변인</th><td>' + para(p.ctrl || '-') + '</td></tr></table>' : miss());
    body += sec('materials', 3, L(p.materials) + (p.safety ? '<p class="rp-note"><b>안전</b> ' + para(p.safety) + '</p>' : ''));
    body += sec('steps', 4, L(p.steps, true) + (p.roles ? '<p class="rp-note"><b>역할</b> ' + para(p.roles) + '</p>' : ''));
    const notes = run.notes || [];
    body += sec('process', 5, run.started || notes.length ? '<p>' + (run.started ? md(run.started) + ' ' + hm(run.started) + ' 시작' : '') + (run.ended ? ' · ' + hm(run.ended) + ' 끝' : '') + (p.steps && p.steps.length ? ' · 방법 ' + Object.keys(run.done || {}).length + '/' + p.steps.length + '단계 진행' : '') + '</p>' +
      (notes.length ? '<ul class="rp-notes">' + notes.map((x) => '<li><b>[' + (NOTE_KIND[x.kind] || '메모') + ' ' + hm(x.at) + ']</b> ' + esc(x.text) + '</li>').join('') + '</ul>' : '') : miss());
    const figs = filesOf(n.id).filter((f) => f.mime !== 'application/pdf');
    body += sec('result', 6, n.report || figs.length ? (r.summary ? '<p>' + para(r.summary) + '</p>' : '') + (n.report ? resultBlock(n) : '') + (r.observe ? '<p><b>관찰</b> ' + para(r.observe) + '</p>' : '') +
      (figs.length ? '<div class="rp-figs">' + figs.map((f, i) => fileTile(f, i)).join('') + '</div>' : '') : miss());
    body += sec('discuss', 7, T(r.discuss));
    body += sec('conclusion', 8, (r.conclusion ? '<p>' + para(r.conclusion) + '</p>' : '') + (r.claim || n.verdict ? '<p class="rp-note">결론 제안 <b>' + esc(r.claim || '-') + '</b> · 판정 <b>' + esc(n.verdict || '대기') + '</b></p>' : '') + (!r.conclusion && !r.claim ? miss() : ''));
    body += sec('next', 9, (r.next ? '<p>' + para(r.next) + '</p>' : '') + (kids.length ? '<p class="rp-note">이어진 실험: ' + kids.map((k) => esc(code(k) + ' ' + k.title)).join(', ') + '</p>' : '') + (!r.next && !kids.length ? miss() : ''));
    body += sec('refs', 10, T(p.refs));
    const people = [...new Set([n.owner, p.by, r.by].concat(notes.map((x) => x.by)).filter(Boolean))];
    const missing = REPORT_SECS.length - (body.match(/class="rp-sec"/g) || []).length + (body.match(/class="miss"/g) || []).length;
    return '<div class="rp-bar no-print"><button type="button" class="btn" data-act="printReport">인쇄 · PDF 저장</button>' + (canEdit(n) ? '<button type="button" class="btn" data-act="record">결과 · 고찰 고치기</button><button type="button" class="btn" data-act="plan">계획서 고치기</button>' : '') +
      (isAdmin() && n.status === '기록 완료' ? (isFinal(n) ? '<button type="button" class="btn" data-act="unfinal">확정 풀기</button>' : '<button type="button" class="btn primary" data-act="final">보고서 확정</button>') : '') + '</div>' +
      (missing ? '<div class="card gate-note no-print" style="font-weight:400">아직 안 쓴 칸이 ' + missing + '개 있어요. ‘(아직 안 씀)’ 부분을 채우면 보고서가 완성돼요.</div>' : '') +
      '<article class="report"><header class="rp-cover">' +
      '<div class="rp-top"><span class="logo rp-logo">' + logoInner() + '</span><div class="rp-club"><b>' + esc(brand().clubName) + '</b><small>실험 보고서</small></div><span class="rp-state' + (isFinal(n) ? ' final' : '') + '">' + (isFinal(n) ? '확정' : '초안') + '</span></div>' +
      '<p class="rp-code">' + fieldTag(n) + esc(code(n)) + '</p><h2>' + esc(n.title) + '</h2>' +
      '<dl class="rp-meta"><div><dt>실험 번호</dt><dd class="code">' + esc(code(n)) + ' (' + esc(uid(n)) + ')</dd></div><div><dt>분야</dt><dd>' + esc(n.field || '-') + '</dd></div>' +
      '<div><dt>연구 줄기</dt><dd>' + esc(lineName(lin[0].line)) + (lin.length > 1 ? ' · ' + lin.length + '세대 (' + esc(code(lin[lin.length - 2])) + '에서 이어짐)' : '') + '</dd></div><div><dt>기간</dt><dd>' + esc(period(n) || '-') + '</dd></div>' +
      '<div><dt>참여</dt><dd>' + esc(people.join(', ') || '-') + '</dd></div><div><dt>판정</dt><dd>' + esc(n.verdict || r.claim || '대기') + '</dd></div></dl></header>' + body + signBlock(n) +
      '<footer class="rp-foot"><span class="logo rp-logo sm">' + logoInner() + '</span><span>' + esc(brand().clubName) + ' · ' + esc(code(n)) + (isFinal(n) ? ' · ' + esc(n.report.final.by) + ' 확정 ' + esc(String(n.report.final.at).slice(0, 10)) : ' · 초안') + '</span><span class="rp-made">가지로 만든 보고서</span></footer></article>' +
      '<div class="no-print">' + commentsCard(n) + '</div>';
  }
  // 보고서 끝: 작성 · 검토 · 승인 · 확정 (서명란처럼)
  function signBlock(n) {
    const ap = approvals(n), tn = teacherNames(), peers = ap.filter((c) => !tn.includes(c.by) && (rules().team || !teamOf(n).includes(c.by))), tch = ap.filter((c) => tn.includes(c.by));
    const box = (label, who, when) => '<div class="rp-sbox"><small>' + label + '</small><b>' + (who ? esc(who) : '<span class="muted">-</span>') + '</b><span>' + (when ? esc(md(when)) : '&nbsp;') + '</span></div>';
    const f = n.report && n.report.final;
    return '<section class="rp-sign">' + box('작성', n.owner || (n.plan && n.plan.by) || '', n.plan && n.plan.at) +
      box('부원 검토', peers.map((c) => c.by).join(' · '), peers.length ? peers[peers.length - 1].at : '') +
      box('지도교사 승인', tch.map((c) => c.by).join(' · '), tch.length ? tch[0].at : '') +
      box('보고서 확정', f ? f.by : '', f ? f.at : '') + '</section>';
  }
  // 보고서용 결과(표 + 그래프): reportCard의 표 · 그래프 부분만
  function resultBlock(n) {
    const r = n.report, kind = kindOf(r), t = tableOf(r); if (!t.rows.length) return '';
    if (kind === 'rep') { const st = t.rows.map((row) => ({ cond: row[0], v: row.slice(1).filter((x) => x !== ''), s: stats(row.slice(1)) }));
      return (st.some((x) => x.s) ? barChart(st.filter((x) => x.s), r.unit) : '') + tableHTML(t.cols.concat(['평균', '표준편차']), t.rows.map((row, i) => row.concat([st[i].s ? '<b>' + r3(st[i].s.m) + '</b>' + (r.unit ? ' ' + esc(r.unit) : '') : '-', st[i].s && st[i].s.n > 1 ? '±' + r3(st[i].s.sd) : '-'])), 2); }
    return (kind === 'line' ? lineChart(t) : kind === 'xy' ? xyChart(t) : '') + tableHTML(t.cols, t.rows, 0, t.photos);
  }


  /* 과정 버튼 · 제출 처리 (화면 · 아래 창 공통) */
  function flowAct(act, a, n) {
    const id = a.dataset.id;
    if (act === 'restore') { const x = byId(id); if (x) { x.deleted = ''; save(); render(); toast('되살렸어요'); } return true; }
    if (act === 'moveTo') { moveTo(id); return true; }
    if (act === 'cmResolve' || act === 'cmEdit' || act === 'cmDel') {
      const c = allComments().find((x) => x.id === a.dataset.cid); if (!c) return true;
      if (act === 'cmResolve') commentOp(c.resolved ? 'reopen' : 'resolve', c.id);
      if (act === 'cmDel' && confirm('이 댓글을 지울까요?')) { if (!$('#sheet').hidden) closeSheet(); commentOp('delete', c.id); }
      if (act === 'cmEdit') openSheet('<h3>댓글 고치기</h3><form id="cmEditForm" data-cid="' + esc(c.id) + '" style="display:flex;flex-direction:column;gap:12px"><textarea name="text" rows="4" maxlength="1000">' + esc(c.text) + '</textarea><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">저장</button></div></form>');
      return true;
    }
    if (!n) return false;
    switch (act) {
      case 'plan': if (!canEdit(n)) toast('확정된 보고서예요 · 관리자가 확정을 풀어야 고칠 수 있어요'); else planForm(n); return true;
      case 'approve': addComment(n.id, 'approve', '', '').then((ok) => { if (ok) toast(reviewDone(n) ? '승인했어요 · 이제 준비를 시작할 수 있어요' : '승인했어요'); }); return true;
      case 'fixNote': fixSheet(n); return true;
      case 'secNotes': secSheet(n, a.dataset.sec); return true;
      case 'prepToggle': prepToggle(n, a.dataset.pi); return true;
      case 'runOpen': if (n.status === '준비 중') runStart(n); go('run', n.id, 'main'); return true;
      case 'stepToggle': { const i = a.dataset.i; n.run = n.run || { done: {}, notes: [] }; n.run.done = n.run.done || {}; if (!n.run.started) n.run.started = nowIso();
        if (n.run.done[i]) delete n.run.done[i]; else n.run.done[i] = nowIso(); save(); render();
        const steps = (n.plan && n.plan.steps) || []; if (steps.length && Object.keys(n.run.done).length === steps.length) toast('모든 단계 끝! 측정값을 넣고 실험을 끝내요'); return true; }
      case 'noteDel': if (n.run) { n.run.notes = (n.run.notes || []).filter((x) => x.id !== a.dataset.nid); save(); render(); } return true;
      case 'runEnd': if (!confirm('실험을 끝내고 결과 기록으로 넘어갈까요?')) return true;
        n.run = n.run || { done: {}, notes: [] }; n.run.ended = nowIso(); if (!n.run.started) n.run.started = n.run.ended; n.date = dstr(new Date(n.run.started)); n.status = '실험 완료'; PF.myMoves[n.id] = Date.now(); save(); back(); recordForm(n); return true;
      case 'itemMenu': itemMenu(n); return true;
      case 'editItem': editForm(n); return true;
      case 'togglePrivate': n.private = isPriv(n) ? '' : 'true'; save(); closeSheet(); render(); toast(isPriv(n) ? '비공개로 바꿨어요 · 팀 · 기장 · 선생님만 볼 수 있어요' : '동아리 모두가 볼 수 있어요'); return true;
      case 'moveItem': moveSheet(n); return true;
      case 'trashItem': trashItem(n); return true;
      case 'cancelExp': if (confirm('이 실험을 취소할까요? 기록은 남아요.')) { n.status = '취소'; save(); closeSheet(); render(); toast('취소했어요'); } return true;
      case 'report': go('report', n.id, 'main'); return true;
      case 'printReport': loadThumbs().then(() => setTimeout(() => window.print(), 250)); return true;
      case 'final': n.report = Object.assign({}, n.report, { final: { by: meName(), at: nowIso() } }); save(); render(); toast('보고서를 확정했어요'); return true;
      case 'unfinal': if (n.report) { const r = Object.assign({}, n.report); delete r.final; n.report = r; } save(); render(); toast('확정을 풀었어요'); return true;
    }
    return false;
  }
  function flowSubmit(e) {
    const f = e.target, n = ['item', 'run', 'report'].includes(cur().s) ? byId(cur().arg) : null;
    if (f.id === 'planForm') { e.preventDefault(); savePlan(f); return true; }
    if (f.id === 'editForm') { e.preventDefault(); saveEdit(f); return true; }
    if (f.id === 'cmEditForm') { e.preventDefault(); const t = String(new FormData(f).get('text') || '').trim(); if (!t) return true; closeSheet(); commentOp('edit', f.dataset.cid, t); return true; }
    if (f.classList && f.classList.contains('cm-add')) {
      e.preventDefault(); const fd = new FormData(f), kind = (e.submitter && e.submitter.value) || 'note', sec = String(fd.get('sec') || ''), inSheet = !!f.closest('#sheet'), node = f.dataset.node;
      const txt = String(fd.get('text') || ''); f.reset();
      addComment(node, kind, sec, txt).then((ok) => { if (!ok) { const ta = document.querySelector('.cm-add[data-node="' + node + '"] [name=text]'); if (ta) ta.value = txt; return; }
        if (inSheet) { if (sec && kind === 'fix') secSheet(byId(node), sec); else closeSheet(); }
        toast({ fix: '첨삭을 남겼어요', change: '수정 요청을 남겼어요', answer: '답변을 남겼어요' }[kind] || '댓글을 남겼어요'); });
      return true;
    }
    if (f.id === 'prepAdd' && n) { e.preventDefault(); const t = String(new FormData(f).get('t') || '').trim().slice(0, 60); if (!t) return true; f.reset(); n.prep = n.prep || { done: {}, extra: [] }; n.prep.extra = (n.prep.extra || []).concat(t); n.signal = signalOf(n); save(); render(); return true; }
    if (f.id === 'noteForm' && n) { e.preventDefault(); const fd = new FormData(f), t = String(fd.get('text') || '').trim(); if (!t) return true; f.querySelector('[name=text]').value = '';
      n.run = n.run || { done: {}, notes: [] }; if (!n.run.started) n.run.started = nowIso();
      n.run.notes = (n.run.notes || []).concat({ id: newCid(), at: nowIso(), by: meName(), kind: String(fd.get('kind') || 'obs'), text: t.slice(0, 500) }); save(); render(); toast('메모를 남겼어요'); return true; }
    return false;
  }
  /* ---------- 찾기 ---------- */

  /* ================= 사진 · 그래프 · 자료 파일 =================
   * 연결된 동아리: 연결기가 동아리 드라이브 '가지 실험 파일/<번호 제목>/'에 저장, 시트 '파일' 탭이 장부
   * 체험 모드: 작은 사진만 이 브라우저에 */
  const FKIND = { photo: '사진', graph: '그래프', doc: '자료' };
  const filesOf = (id) => (db.files || []).filter((f) => f.node === id);
  PF.thumbs = PF.thumbs || {}; PF.fulls = PF.fulls || {};
  const thumbSrc = (f) => f._data || PF.thumbs[f.id] || '';
  function fileTile(f, i) {
    const src = thumbSrc(f), pdf = f.mime === 'application/pdf';
    return '<button type="button" class="ph" data-act="fileView" data-fid="' + esc(f.id) + '">' +
      (pdf ? '<span class="ph-pdf">PDF</span>' : src ? '<img alt="' + esc(f.caption || f.name) + '" src="' + src + '" data-fid="' + esc(f.id) + '">' : '<img alt="' + esc(f.caption || f.name) + '" data-fid="' + esc(f.id) + '"><span class="spin ph-spin"></span>') +
      '<span class="ph-cap">' + (i !== undefined ? '<b>그림 ' + (i + 1) + '</b> ' : '') + esc(f.caption || FKIND[f.kind] || '') + '</span></button>';
  }
  function filesCard(n, compact) {
    const list = filesOf(n.id), can = canEdit(n);
    return '<div class="card sec-card"><div class="sec-head"><b>사진 · 그래프 · 자료</b><span class="muted">' + list.length + '개</span></div>' +
      (list.length ? '<div class="ph-grid">' + list.map((f) => fileTile(f)).join('') + '</div>' : (compact ? '' : '<span class="muted" style="font-size:13px">실험 장면, 장치, 결과 그래프(엑셀 등) 사진을 올려 두면 보고서에 그림으로 들어가요.</span>')) +
      (can ? '<label class="btn upl"><input type="file" accept="image/*,application/pdf" multiple data-upload="' + esc(n.id) + '" hidden>' + (compact ? '사진 찍기 · 올리기' : '사진 · 파일 올리기') + '</label>' : '') + '</div>';
  }
  // 고른 파일 → 미리 보기 · 설명 · 종류 → 올리기
  async function pickFiles(nodeId, list) {
    const files = Array.from(list || []).slice(0, 10), bad = files.filter((f) => !/^image\//.test(f.type) && f.type !== 'application/pdf');
    if (bad.length) toast('사진(JPG · PNG)과 PDF만 올릴 수 있어요');
    const ok = files.filter((f) => !bad.includes(f) && f.size <= 15e6); if (files.some((f) => f.size > 15e6)) toast('15MB보다 큰 파일은 빼고 올려요');
    if (!ok.length) return;
    openSheet('<h3>올릴 준비 중…</h3><p class="muted loading-line">' + SPIN + '사진을 줄이는 중</p>');
    const items = [];
    for (const f of ok) {
      try {
        if (f.type === 'application/pdf') items.push({ name: f.name, mime: f.type, data: await readB64(f), thumb: '', preview: '' });
        else { const full = await shrink(f, 1600, 0.82), th = await shrink(f, 480, 0.72); items.push({ name: f.name, mime: 'image/jpeg', data: full.split(',')[1], thumb: th.split(',')[1], preview: th }); }
      } catch (e) { toast(f.name + '을(를) 읽지 못했어요'); }
    }
    if (!items.length) return closeSheet();
    PF.pendingUp = { node: nodeId, items };
    openSheet('<h3>사진 · 파일 올리기 · ' + items.length + '개</h3><form id="uploadForm" class="fgrid" style="display:flex;flex-direction:column;gap:12px">' +
      items.map((it, i) => '<div class="up-row half">' + (it.preview ? '<img src="' + it.preview + '" alt="">' : '<span class="ph-pdf">PDF</span>') +
        '<div><input name="cap' + i + '" maxlength="200" placeholder="설명 (예: 구리-아연 레몬 전지 연결)"><div class="seg" style="grid-template-columns:repeat(3,1fr)">' +
        Object.entries(FKIND).map(([k, l]) => '<button type="button" data-ukind="' + k + '" data-i="' + i + '" aria-pressed="' + ((it.mime === 'application/pdf' ? 'doc' : 'photo') === k) + '">' + l + '</button>').join('') + '</div><input type="hidden" name="kind' + i + '" value="' + (it.mime === 'application/pdf' ? 'doc' : 'photo') + '"></div></div>').join('') +
      '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">올리기</button></div></form>', items.length > 1);
  }
  function readB64(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); }); }
  async function shrink(file, max, q) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    } finally { URL.revokeObjectURL(url); }
  }
  async function doUpload(fm) {
    const up = PF.pendingUp; if (!up) return; const fd = new FormData(fm), btn = fm.querySelector('[type=submit]'); btn.disabled = true;
    let done = 0;
    for (let i = 0; i < up.items.length; i++) {
      const it = up.items[i], caption = String(fd.get('cap' + i) || '').trim(), kind = String(fd.get('kind' + i) || 'photo');
      btn.textContent = '올리는 중 ' + (i + 1) + '/' + up.items.length + '…';
      if (PF.mode === 'live') {
        try { const r = await rpc('upload', { node: up.node, name: it.name, mime: it.mime, data: it.data, thumb: it.thumb, caption, kind });
          (db.files = db.files || []).push(r.file); if (it.preview) PF.thumbs[r.file.id] = it.preview; done++; }
        catch (e) { if (deviceLost(e)) return; toast(e.message); if (e.code === 'drive_perm' || e.code === 'no_drive') break; }
      } else {
        (db.files = db.files || []).push({ id: newCid(), node: up.node, name: it.name, mime: it.mime, caption, kind, by: meName(), at: nowIso(), _data: it.preview || '' }); done++;
        try { save(); } catch (e) {}
      }
    }
    PF.pendingUp = null; closeSheet(); render(); if (done) toast(done + '개 올렸어요' + (PF.mode === 'live' ? ' · 동아리 드라이브에 저장됐어요' : ''));
  }
  // 화면에 보이는 사진 중 아직 안 받은 것을 한 번에 받기
  function loadThumbs() {
    if (PF.mode !== 'live') return Promise.resolve();
    const want = [...new Set(Array.from(document.querySelectorAll('img[data-fid]:not([src])')).map((i) => i.dataset.fid))].filter((id) => !PF.thumbs[id] && !(PF.thumbLoading || {})[id]);
    if (!want.length) return PF.thumbWait || Promise.resolve();
    PF.thumbLoading = PF.thumbLoading || {}; want.forEach((id) => (PF.thumbLoading[id] = 1));
    PF.thumbWait = rpc('fileGet', { ids: want.slice(0, 24) }, null, { quiet: true }).then((r) => {
      Object.entries(r.files || {}).forEach(([id, f]) => { if (f) PF.thumbs[id] = 'data:' + f.mime + ';base64,' + f.data; });
    }, () => {}).then(() => { want.forEach((id) => delete PF.thumbLoading[id]); fillThumbs(); });
    return PF.thumbWait;
  }
  function fillThumbs() { document.querySelectorAll('img[data-fid]:not([src])').forEach((img) => { const s = PF.thumbs[img.dataset.fid]; if (s) { img.src = s; const sp = img.parentNode.querySelector('.ph-spin'); if (sp) sp.remove(); } }); }
  function fileView(fid) {
    const f = (db.files || []).find((x) => x.id === fid); if (!f) return;
    const n = byId(f.node), mine = f.by === meName() || isAdmin() || (n && inTeam(n)), src = PF.fulls[fid] || thumbSrc(f);
    openSheet('<h3>' + esc(f.caption || FKIND[f.kind] || '사진') + '</h3>' +
      (f.mime === 'application/pdf' ? '<p class="muted">PDF 파일 · ' + esc(f.name) + '</p>' : '<img class="ph-big" alt="' + esc(f.caption || f.name) + '"' + (src ? ' src="' + src + '"' : '') + ' data-fid="' + esc(f.id) + '">') +
      '<p class="muted" style="font-size:12px;margin:6px 0">' + esc(FKIND[f.kind] || '') + ' · ' + esc(f.by || '') + ' · ' + md(f.at) + (f.size ? ' · ' + Math.round(f.size / 1024) + 'KB' : '') + '</p>' +
      '<div class="btn-row">' + (PF.mode === 'live' ? '<button type="button" class="btn" data-act="fileFull" data-fid="' + esc(f.id) + '">' + (f.mime === 'application/pdf' ? 'PDF 받기' : '원본 보기 · 저장') + '</button>' : '') +
      (mine ? '<button type="button" class="btn" data-act="fileCap" data-fid="' + esc(f.id) + '">설명 고치기</button><button type="button" class="btn danger" data-act="fileDel" data-fid="' + esc(f.id) + '">지우기</button>' : '') +
      '<button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
    if (!src && f.mime !== 'application/pdf') loadThumbs();
  }
  async function fileAct(act, fid) {
    const f = (db.files || []).find((x) => x.id === fid); if (!f) return;
    if (act === 'fileFull') {
      try { const r = await rpc('fileGet', { ids: [fid], full: true }); const x = r.files[fid]; if (!x) return toast('파일을 찾을 수 없어요');
        const url = 'data:' + x.mime + ';base64,' + x.data; PF.fulls[fid] = url; const a = document.createElement('a'); a.href = url; a.download = f.name || 'gaji'; document.body.appendChild(a); a.click(); a.remove();
        const big = document.querySelector('#sheet .ph-big'); if (big && f.mime !== 'application/pdf') big.src = url; toast('원본을 받았어요'); }
      catch (e) { if (!deviceLost(e)) toast(e.message); }
    }
    if (act === 'fileDel') {
      if (!confirm('이 파일을 지울까요? 동아리 드라이브에서도 휴지통으로 가요.')) return;
      if (PF.mode === 'live') { try { await rpc('fileEdit', { id: fid, op: 'delete' }); } catch (e) { if (!deviceLost(e)) toast(e.message); return; } }
      db.files = db.files.filter((x) => x.id !== fid); if (PF.mode !== 'live') save(); closeSheet(); render(); toast('지웠어요');
    }
    if (act === 'fileCap') {
      const c = prompt('설명', f.caption || ''); if (c === null) return;
      if (PF.mode === 'live') { try { await rpc('fileEdit', { id: fid, caption: c.trim() }); } catch (e) { if (!deviceLost(e)) toast(e.message); return; } }
      f.caption = c.trim().slice(0, 200); if (PF.mode !== 'live') save(); fileView(fid); render();
    }
  }

  /* 찾기: 제목 · 번호뿐 아니라 계획서 · 진행 메모 · 결과 · 고찰 · 댓글 내용까지. 연도 · 분야 · 사람 · 단계로 좁히기 */
  function searchParts(n) {
    const p = n.plan || {}, r = n.report || {}, run = n.run || {}, out = [['제목', n.title], ['번호', code(n) + ' ' + uid(n)], ['설명', n.desc]];
    PLAN.forEach(([k, l]) => { const v = p[k]; if (v && v.length) out.push(['계획서 · ' + l.replace(/ \(.*\)$/, ''), Array.isArray(v) ? v.join(' / ') : v]); });
    (run.notes || []).forEach((x) => out.push(['진행 메모', x.text]));
    [['summary', '결과 요약'], ['observe', '관찰'], ['discuss', '고찰'], ['conclusion', '결론'], ['next', '더 해 볼 것']].forEach(([k, l]) => { if (r[k]) out.push([l, r[k]]); });
    if (r.table || r.rows) { const t = tableOf(r); out.push(['측정값', t.cols.join(' ') + ' ' + t.rows.map((x) => x.join(' ')).join(' / ')]); }
    commentsOf(n.id).forEach((c) => { if (c.text) out.push([(CKIND[c.kind] || CKIND.note)[0] + ' · ' + c.by, c.text]); });
    filesOf(n.id).forEach((f) => { if (f.caption) out.push([FKIND[f.kind] || '사진', f.caption]); });
    return out.filter((x) => x[1]);
  }
  const peopleOf = (n) => [...new Set([n.owner, n.createdBy, n.volunteer, n.plan && n.plan.by, n.report && n.report.by].concat(((n.run && n.run.notes) || []).map((x) => x.by)).filter((x) => x && x !== '나'))];
  const yearOf = (n) => String(n.created || n.date || '').slice(0, 4);
  const stageOf = (n) => n.type === 'idea' ? '아이디어' : n.type === 'q' ? (n.status === '해결' ? '해결된 질문' : '미해결 질문') : n.type === 'res' ? '자료' : n.status === '실험 완료' ? '기록 대기' : n.status;
  function hiSnip(text, q) {
    const t = String(text), i = t.toLowerCase().indexOf(q); if (i < 0) return esc(t.slice(0, 60));
    const a = Math.max(0, i - 22), b = Math.min(t.length, i + q.length + 30);
    return (a ? '…' : '') + esc(t.slice(a, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length, b)) + (b < t.length ? '…' : '');
  }
  function archSearch(q) {
    clearTimeout(archSearch.t); archSearch.t = setTimeout(() => {
      rpc('search', { q }, null, { quiet: true }).then((r) => { PF.archHits = PF.archHits || {}; PF.archHits[q] = r.hits || []; if (cur().s === 'find' || nav[0].s === 'find') render(); }, () => {});
    }, 500);
  }
  function viewFind() {
    const q = (prefs.q || '').trim().toLowerCase(), ty = prefs.ty || 'all', all = alive();
    const F = { fy: prefs.fy || '', ff: prefs.ff || '', fp: prefs.fp || '', fs: prefs.fs || '' };
    const list = [];
    all.forEach((n) => {
      if (ty === 'mine' ? !(inTeam(n) || (n.type === 'q' && n.createdBy === meName())) : !(ty === 'all' || n.type === ty || (ty === 'exp' && n.type === 'idea'))) return;
      if (F.fy && yearOf(n) !== F.fy) return; if (F.ff && n.field !== F.ff) return; if (F.fp && !peopleOf(n).includes(F.fp)) return; if (F.fs && stageOf(n) !== F.fs) return;
      if (!q) return list.push({ n, hit: null });
      const terms = q.split(/\s+/).filter(Boolean), parts = searchParts(n), blob = parts.map((x) => x[1]).join(' ').toLowerCase();
      if (!terms.every((w) => blob.includes(w))) return;
      const hit = parts.find((x) => String(x[1]).toLowerCase().includes(q)) || parts.find((x) => String(x[1]).toLowerCase().includes(terms[0]));
      list.push({ n, hit: hit && hit[0] !== '제목' && hit[0] !== '번호' ? hit : null, score: parts[0][1].toLowerCase().includes(terms[0]) ? 0 : 1 });
    });
    if (q && PF.mode === 'live' && all.some((n) => n.arch)) {
      const hits = (PF.archHits || {})[q];
      if (!hits) archSearch(q);
      else hits.forEach((h) => { const n = byId(h.id); if (!n || isDel(n) || list.some((x) => x.n.id === h.id)) return;
        if (ty === 'mine' ? !(inTeam(n) || (n.type === 'q' && n.createdBy === meName())) : !(ty === 'all' || n.type === ty || (ty === 'exp' && n.type === 'idea'))) return; if (F.fy && yearOf(n) !== F.fy) return; if (F.ff && n.field !== F.ff) return; if (F.fs && stageOf(n) !== F.fs) return;
        list.push({ n, hit: ['지난 기록', h.snip], score: 2 }); });
    }
    list.sort((a, b) => (a.score || 0) - (b.score || 0) || String(b.n.date).localeCompare(String(a.n.date)));
    const opts = (id, label, values, cur) => '<label class="fsel"><span>' + label + '</span><select id="' + id + '"><option value="">전체</option>' + values.map((v) => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label>';
    const years = [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse(), fields = Object.keys(FCODE).filter((f) => all.some((n) => n.field === f));
    const people = [...new Set(all.flatMap(peopleOf))].sort(), stages = [...new Set(all.map(stageOf))];
    const chip = (k, label, c) => '<button type="button" class="chip" data-ty="' + k + '" aria-pressed="' + (ty === k) + '">' + (c ? '<i style="background:' + c + '"></i>' : '') + label + '</button>';
    const filtered = F.fy || F.ff || F.fp || F.fs;
    return '<label for="q" class="muted" style="font-size:13px;font-weight:700;margin:4px 2px -10px">제목 · 번호 · 내용으로 찾기</label><input id="q" class="search" type="search" placeholder="예: 전압, 레몬, CHE-019, 산화막" value="' + esc(prefs.q || '') + '">' +
      '<div class="chips" role="group" aria-label="종류">' + chip('all', '전체') + chip('mine', '내 것') + chip('exp', '실험 · 아이디어', 'var(--exp)') + chip('q', '질문', 'var(--q)') + chip('res', '자료', 'var(--res)') + '</div>' +
      '<div class="fsels">' + opts('fy', '연도', years, F.fy) + opts('ff', '분야', fields, F.ff) + opts('fp', '사람', people, F.fp) + opts('fs', '단계', stages, F.fs) + '</div>' +
      '<div class="find-count muted">' + list.length + '개' + (q ? ' · ‘' + esc(prefs.q.trim()) + '’' : '') + (filtered ? ' <button type="button" class="chipbtn" data-act="clearFilters">거르기 풀기</button>' : '') + '</div>' +
      '<div class="day-list">' + (list.length ? list.map(({ n, hit }) => '<button type="button" class="srow" data-item="' + n.id + '">' + ico(n) + '<span class="tx"><small class="code">' + esc(code(n)) + ' · ' + esc(yearOf(n)) + (n.owner ? ' · ' + esc(n.owner) : '') + '</small><b>' + fieldTag(n) + (q ? hiSnip(n.title, q.split(/\s+/)[0]) : esc(n.title)) + '</b>' +
        (inTeam(n) ? '<small class="mine-tag">내 실험</small>' : '') + (hit ? '<small class="snip"><em>' + esc(hit[0]) + '</em> ' + hiSnip(hit[1], String(hit[1]).toLowerCase().includes(q) ? q : q.split(/\s+/)[0]) + '</small>' : '') + '</span>' + badge(n) + '</button>').join('') : '<div class="card empty">찾는 항목이 없어요.</div>') + '</div>';
  }

  /* ---------- 더 보기 ---------- */
  function viewMore() {
    const mi = (s, c, path, t, d) => '<button type="button" class="menu-item" data-go-screen="' + s + '"><span class="mi" style="background:' + c + '"><svg viewBox="0 0 24 24"><path d="' + path + '"/></svg></span><span class="tx"><b>' + t + '</b><small>' + d + '</small></span></button>';
    return '<div class="menu">' +
      (PF.isMaster ? mi('club', 'var(--brand)', 'M8 15a4 4 0 1 0 0-.01zM11 12l8.5-8.5M16.5 6.5l3 3M14 9l2 2', '동아리 관리', '동아리 주소 · 학교 계정 · 마스터 넘기기') : '') +
      (PF.mode === 'live' && isAdmin() ? mi('people', 'var(--done)', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 11l2 2 4-4', '부원 · 기기', '부원 추가 · 개인 코드 · 기기 승인') : '') +
      mi('settings', 'var(--club)', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z', '설정', (PF.isMaster ? '드라이브 연결 · ' : '') + '동아리 이름 · 로고 · 색 · 화면 밝기') +
      mi('board', 'var(--exp)', 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z', '보드', '단계별로 실험 카드 보기 (관리자용)') +
      mi('map', 'var(--q)', 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M10.2 10.2L6.4 6.4M13.8 11l3.6-3.6M10.3 13.8L7.4 17.4', '전체 지도', '동아리 연구 전체를 한 장으로 (발표용)') +
      (db.nodes.some(isDel) ? mi('trash', 'var(--muted)', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', '휴지통', '지운 항목 ' + db.nodes.filter(isDel).length + '개 · 되살리기') : '') +
      mi('about', 'var(--idea)', 'M6 7v10M18 11c0 4-6 3-12 6', '가지 소개', '소개 영상 · 기능 · 기록을 지키는 방법') +
      '</div>';
  }
  function viewBoard() {
    const items = alive().filter(isExpLike);
    return '<p class="muted" style="margin:0 2px;font-size:13px">카드를 누르면 상세로 들어가요. 단계는 상세의 버튼으로 바꿉니다.</p><div class="board">' + STAGES.map((st) => { const l = items.filter((n) => n.status === st);
      return '<div class="col"><h3>' + st + '<span class="badge t-neutral">' + l.length + '</span></h3>' + l.map((n) => '<button type="button" class="bcard' + (n.type === 'idea' ? ' idea' : '') + '" data-item="' + n.id + '"><span class="code">' + esc(code(n)) + '</span><b>' + fieldTag(n) + esc(n.title) + '</b>' + badge(n) + '</button>').join('') + '</div>'; }).join('') + '</div>';
  }
  /* 전체 지도 (3D): 분야마다 별무리처럼 모인 실험들, 끌어서 돌리기 · 휠/두 손가락 확대 · 한 번=요약 · 두 번=상세 */
  function viewMap() {
    const sel = PF.m3 && PF.m3.sel && byId(PF.m3.sel);
    setTimeout(map3dStart, 0);
    return '<p class="muted" style="margin:0 2px;font-size:13px">동아리 연구 전체를 3D로 봐요. <b>끌어서 돌리고</b>, 휠이나 두 손가락으로 확대해요. 별을 한 번 누르면 요약, <b>두 번 누르면 상세</b>로 들어가요.</p>' +
      '<div class="map3d" id="map3dBox"><canvas id="map3d"></canvas>' +
      '<div class="map-ctl"><button type="button" data-m3="in" aria-label="크게">+</button><button type="button" data-m3="out" aria-label="작게">−</button><button type="button" data-m3="spin" aria-pressed="' + !(PF.m3 && PF.m3.still) + '">회전</button><button type="button" data-m3="fit">처음</button></div>' +
      '<div class="m3-legend"><span><i style="background:#3DDC97"></i>끝난 실험</span><span><i style="background:#5B9BFF"></i>진행 중</span><span><i class="ring"></i>아이디어</span><span><i style="background:#B58CFF"></i>질문 · 자료</span></div>' +
      (sel ? '<div class="map-tip"><span class="code muted">' + esc(code(sel)) + '</span><b>' + fieldTag(sel) + esc(sel.title) + '</b><span class="muted">' + esc([sel.status, sel.owner, lineName(sel.line)].filter(Boolean).join(' · ')) + '</span><div class="btn-row" style="margin-top:6px"><button type="button" class="btn primary" data-go="' + esc(sel.id) + '">상세 보기</button><button type="button" class="btn" data-m3="close">닫기</button></div></div>' : '') + '</div>';
  }
  // 3D 배치 (데이터가 바뀔 때만 다시 계산)
  function map3dLayout() {
    const ns = alive().filter((n) => n.status !== '취소'), key = ns.map((n) => n.id).join(',') + '|' + db.links.length;
    if (PF.m3L && PF.m3L.key === key) return PF.m3L;
    const F = ['생명', '화학', '물리', '지구', '융합', '공통'], C = {};
    F.forEach((f, i) => { const a = i / F.length * Math.PI * 2; C[f] = [Math.cos(a) * 320, (i % 2 ? 90 : -90), Math.sin(a) * 320]; });
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
    const P = {}; ns.forEach((n) => { const c = C[n.field] || [0, 0, 0]; P[n.id] = [c[0] + rnd() * 120, c[1] + rnd() * 120, c[2] + rnd() * 120]; });
    const L = db.links.filter((l) => P[l.s] && P[l.t]);
    for (let it = 0; it < 180; it++) {
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const p = P[ns[i].id], q = P[ns[j].id], d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] + .01, f = 2600 / d2; for (let k = 0; k < 3; k++) { p[k] += d[k] * f * .02; q[k] -= d[k] * f * .02; } }
      L.forEach((l) => { const p = P[l.s], q = P[l.t], d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], len = Math.hypot(...d) + .01, f = (len - 70) * .03 / len; for (let k = 0; k < 3; k++) { p[k] += d[k] * f; q[k] -= d[k] * f; } });
      ns.forEach((n) => { const c = C[n.field] || [0, 0, 0], p = P[n.id]; for (let k = 0; k < 3; k++) p[k] += (c[k] - p[k]) * .03; });
    }
    return (PF.m3L = { key, ns, P, L, C, F });
  }
  function map3dStart() {
    const cv = $('#map3d'); if (!cv || cv.dataset.on) return; cv.dataset.on = '1';
    const M = map3dLayout(), S = (PF.m3 = PF.m3 || { yaw: .6, pitch: -.35, dist: 720, sel: null, still: false, idle: 0 });
    const ctx = cv.getContext('2d'), stars = Array.from({ length: 160 }, (_, i) => [((i * 97) % 1000) / 1000, ((i * 61 + 13) % 1000) / 1000, ((i * 37) % 10) / 10]);
    const col = (n) => n.type === 'idea' ? '#FFB547' : n.type === 'q' || n.type === 'res' ? '#B58CFF' : n.status === '기록 완료' ? '#3DDC97' : '#5B9BFF';
    let W = 0, H = 0, dpr = 1, proj = [];
    const wrap = (t, per) => { const w = String(t).split(' '), out = ['']; w.forEach((x) => { const c = out[out.length - 1]; if ((c + ' ' + x).trim().length <= per || !c) out[out.length - 1] = (c + ' ' + x).trim(); else out.push(x); }); const r = out.slice(0, 2); if (out.length > 2) r[1] = r[1].slice(0, per - 1) + '…'; return r; };
    function frame() {
      if (!cv.isConnected) return;   // 화면을 떠나면 멈춤
      const rw = cv.clientWidth, rh = cv.clientHeight; dpr = window.devicePixelRatio || 1;
      if (rw !== W || rh !== H) { W = rw; H = rh; cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!S.still && !S.drag && Date.now() > S.idle) S.yaw += .0025;
      const g = ctx.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .75); g.addColorStop(0, '#13233A'); g.addColorStop(1, '#05080F');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stars.forEach((s, i) => { const x = ((s[0] * W + S.yaw * 30 * (s[2] + .3)) % W + W) % W, y = s[1] * H; ctx.fillStyle = 'rgba(255,255,255,' + (.15 + s[2] * .5) + ')'; ctx.fillRect(x, y, s[2] > .7 ? 1.6 : 1, s[2] > .7 ? 1.6 : 1); });
      const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch), fl = Math.min(W, H) * 1.1;
      const pj = (v) => { const x = v[0] * cy - v[2] * sy, z0 = v[0] * sy + v[2] * cy, y = v[1] * cp - z0 * sp, z = v[1] * sp + z0 * cp + S.dist; const k = fl / Math.max(60, z); return { x: W / 2 + x * k, y: H / 2 + y * k, k, z }; };
      // 분야 이름 (떠 있는 큰 글자)
      ctx.textAlign = 'center';
      M.F.forEach((f) => { if (!M.ns.some((n) => n.field === f)) return; const p = pj([M.C[f][0], M.C[f][1] - 150, M.C[f][2]]); ctx.font = '900 ' + Math.round(26 * p.k) + 'px "Noto Sans KR", sans-serif'; ctx.fillStyle = 'rgba(160,190,255,' + Math.min(.32, .5 * p.k) + ')'; ctx.fillText(f, p.x, p.y); });
      const hot = new Set(S.sel && byId(S.sel) ? lineage(byId(S.sel)).concat(treeRows([byId(S.sel)]).map((r) => r.n)).map((x) => x.id) : []);
      proj = M.ns.map((n) => Object.assign(pj(M.P[n.id]), { n })); const pm = {}; proj.forEach((p) => { pm[p.n.id] = p; });
      M.L.forEach((l) => { const a = pm[l.s], b = pm[l.t]; if (!a || !b) return; const on = hot.has(l.s) && hot.has(l.t), al = Math.max(.08, Math.min(.6, 1.6 * (a.k + b.k) / 2 - .35));
        ctx.strokeStyle = on ? 'rgba(255,230,140,.95)' : 'rgba(140,180,255,' + (hot.size ? al * .35 : al) + ')'; ctx.lineWidth = on ? 2.4 : 1.1; ctx.setLineDash(l.k === 'next' ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      ctx.setLineDash([]);
      proj.sort((a, b) => b.z - a.z); const near = proj.length ? proj[Math.floor(proj.length * .5)].z : 0; cv._proj = proj;
      proj.forEach((p) => {
        const n = p.n, c = col(n), r = Math.max(3, 9 * p.k), dim = hot.size && !hot.has(n.id), on = S.sel === n.id;
        ctx.globalAlpha = dim ? .25 : Math.min(1, .35 + p.k);
        const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2); gl.addColorStop(0, c + 'AA'); gl.addColorStop(1, c + '00'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.2, 0, 7); ctx.fill();
        if (n.type === 'idea') { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        else { const b = ctx.createRadialGradient(p.x - r * .35, p.y - r * .35, r * .1, p.x, p.y, r); b.addColorStop(0, '#FFFFFF'); b.addColorStop(.35, c); b.addColorStop(1, c); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
        if (on) { ctx.strokeStyle = '#FFE68C'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, 7); ctx.stroke(); }
        if ((p.z <= near || on || hot.has(n.id)) && !dim) {   // 앞쪽 절반 · 고른 계보만 이름
          const fs = Math.max(10, Math.min(13, 11 * p.k)); ctx.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif';
          wrap(n.title, 16).forEach((t, i) => { const yy = p.y + r + 13 + i * (fs + 3); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)'; ctx.strokeText(t, p.x, yy); ctx.fillStyle = on ? '#FFE68C' : 'rgba(235,242,255,.95)'; ctx.fillText(t, p.x, yy); });
        }
        ctx.globalAlpha = 1;
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // 손으로 움직이기
    const ptr = new Map(); let st = null, moved = false; const last = S.last || (S.last = { id: '', t: 0 });   // 다시 그려져도 첫 번째 누름을 기억
    const pick = (e) => { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; let best = null, bd = 26; proj.forEach((p) => { const d = Math.hypot(p.x - x, p.y - y); if (d < Math.max(bd, 9 * p.k + 6) && (!best || p.z < best.z || d < bd)) { best = p; bd = d; } }); return best && best.n; };
    cv.addEventListener('pointerdown', (e) => { ptr.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); moved = false; S.drag = true;
      st = ptr.size === 2 ? { pinch: Math.hypot(...[...ptr.values()].reduce((a, b) => [a[0] - b[0], a[1] - b[1]])), dist: S.dist } : { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch }; });
    cv.addEventListener('pointermove', (e) => { if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2 && st.pinch) { const d = Math.hypot(...[...ptr.values()].reduce((a, b) => [a[0] - b[0], a[1] - b[1]])); S.dist = Math.min(2200, Math.max(300, st.dist * st.pinch / d)); moved = true; return; }
      if (st && st.x != null) { const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.abs(dx) + Math.abs(dy) > 5) moved = true; S.yaw = st.yaw + dx * .008; S.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + dy * .006)); } });
    const end = (e) => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); S.idle = Date.now() + 4000; if (ptr.size) return; S.drag = false; if (moved) return;
      const n = pick(e), now = Date.now();
      if (!n) { if (S.sel) { S.sel = null; render(); } return; }
      if (last.id === n.id && now - last.t < 450) { last.id = ''; last.t = 0; S.sel = null; return go('item', n.id); }
      last.id = n.id; last.t = now; S.sel = n.id; render(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', (e) => { ptr.delete(e.pointerId); S.drag = false; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); S.dist = Math.min(2200, Math.max(300, S.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12))); S.idle = Date.now() + 4000; }, { passive: false });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-m3]'); if (!b || !PF.m3) return; const S = PF.m3, a = b.dataset.m3;
    if (a === 'in') S.dist = Math.max(300, S.dist / 1.25); if (a === 'out') S.dist = Math.min(2200, S.dist * 1.25);
    if (a === 'fit') { S.yaw = .6; S.pitch = -.35; S.dist = 720; } if (a === 'spin') { S.still = !S.still; b.setAttribute('aria-pressed', String(!S.still)); }
    if (a === 'close') { S.sel = null; render(); } });
  const COLORS = ['#1F8F5A', '#7D1029', '#2F6FDB', '#1D3A8A', '#C26A00', '#6E4FE0', '#D2394B', '#0E7C7B', '#475467'];
  const LIGHTS = ['#FFFFFF', '#FFFFCC', '#E6F4EC', '#E8F0FD', '#FFF3E3', '#F6E8F0', '#EEE9FD', '#E0F5F2'];
  const PAIRS = [['녹색 & 흰색', '#1F8F5A', '#FFFFFF'], ['버건디 & 연노랑', '#7D1029', '#FFFFCC'], ['남색 & 하늘', '#1D3A8A', '#E8F0FD'], ['주황 & 크림', '#C26A00', '#FFF3E3'], ['보라 & 연보라', '#6E4FE0', '#EEE9FD'], ['청록 & 민트', '#0E7C7B', '#E0F5F2']];
  function colorFields(st, dis) {
    const main = (st.color || '#C26A00').toUpperCase(), light = (st.color2 || '').toUpperCase(), C = brandColors(main, light);
    const sw = (list, key, cur) => list.map((c) => '<button type="button" data-' + key + '="' + c + '" aria-label="색 ' + c + '" aria-pressed="' + (cur === c) + '" style="background:' + c + (c === '#FFFFFF' ? ';box-shadow:inset 0 0 0 1px var(--line)' : '') + '"' + dis + '></button>').join('');
    const pick = (key, cur) => '<label class="color-own"><input type="color" data-color-input="' + key + '" value="' + (cur || '#FFFFFF').toLowerCase() + '"' + dis + '><span>직접 고르기</span><span class="code muted">' + esc(cur || '없음') + '</span></label>';
    const warn = contrast(main, '#FFFFFF') < 3 ? '<span class="color-warn">주도 색이 너무 밝아 흰 글자가 잘 안 보여요. 더 진한 색을 골라 주세요.</span>' : light && lum(light) < 0.55 ? '<span class="color-warn">밝은 색은 연한 색이 좋아요. 지금은 너무 진해서 글자 · 바탕으로 쓰지 않아요.</span>' : '';
    return '<div class="field">추천 조합<div class="pair-row">' + PAIRS.map((p) => '<button type="button" class="pair" data-pair="' + p[1] + ',' + p[2] + '" aria-pressed="' + (main === p[1] && light === p[2]) + '"' + dis + '><span class="pair-dot" style="background:' + p[1] + ';color:' + p[2] + '">가</span>' + p[0] + '</button>').join('') + '</div></div>' +
      '<div class="field">주도 색 <span class="muted" style="font-weight:400">버튼 · 로고 · 강조</span><div class="swatches">' + sw(COLORS, 'color', main) + '</div>' + pick('color', main) + '</div>' +
      '<div class="field">밝은 색 <span class="muted" style="font-weight:400">주도 색 위의 글자 · 선택 바탕</span><div class="swatches">' + sw(LIGHTS, 'color2', light) + '</div>' + pick('color2', light) + '</div>' +
      '<div class="color-preview" style="--p-main:' + C.main + ';--p-on:' + C.on + ';--p-soft:' + C.soft + '"><span class="logo" style="background:' + C.main + ';color:' + C.on + '">' + GAJI_MARK + '</span><span class="cp-btn">주도 색 버튼</span><span class="cp-tab">선택된 탭</span><span class="cp-text">강조 글자</span></div>' + warn;
  }
  function viewSettings() {
    const st = brand(), th = prefs.theme || 'system', ed = canEditBrand(), dis = ed ? '' : ' disabled';
    return driveCard() + rulesCard() + (ed ? '' : '<div class="card muted" style="font-size:13px">동아리 이름 · 로고 · 색은 동아리 마스터만 바꿀 수 있어요. 화면 밝기는 이 기기에서 바로 바뀝니다.</div>') +
      '<div class="card" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="logo-edit"><span class="logo" id="logoPreview">' + logoInner() + '</span><div style="display:flex;flex-direction:column;gap:6px">' + (ed ? '<label class="btn" for="logoFile" style="min-height:40px">로고 바꾸기</label><input id="logoFile" type="file" accept="image/*" hidden>' : '') + (ed && st.logo ? '<button type="button" class="chipbtn" data-act="logoClear">기본 로고로</button>' : '') + '</div></div>' +
      '<label class="field">동아리 이름<input id="clubInput" maxlength="30" value="' + esc(st.clubName) + '"' + dis + '></label>' +
      colorFields(st, dis) +
      '<div class="field">화면 밝기<div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => '<button type="button" data-theme="' + k + '" aria-pressed="' + (th === k) + '">' + l + '</button>').join('') + '</div></div>' +
      '</div>' +
      (PF.mode === 'live' ? '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>내 계정</b><span class="muted" style="font-size:13px">' + esc(PF.me.name) + ' · ' + esc(PF.me.role) + ' · 이 기기: ' + esc((PF.dev && PF.dev.label) || deviceLabel()) + '<br>개인 코드는 다른 기기에서 들어갈 때 학번과 함께 써요.</span><div class="btn-row"><button type="button" class="btn primary" data-act="myCode">내 개인 코드 보기</button><button type="button" class="btn" data-act="leaveDevice">이 기기에서 나가기</button></div></div>' :
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>체험 데이터</b><span class="muted" style="font-size:13px">' + (PF.club ? '동아리 드라이브 연결 전까지 실험 목록은 예시 데이터로 보여요. 이 기기에만 저장됩니다.' : '북일고등학교 실험 동아리(가상)로 마음껏 만들고 고쳐 보세요. 이 브라우저에만 저장되고 매일 처음 상태로 돌아가요. 지금: ' + esc(meName()) + '') + '</span><button type="button" class="btn" data-act="reset">예시로 되돌리기</button></div>');
  }
  /* 설정 맨 위: 드라이브 연결 (동아리마다 따로) */
  function driveCard() {
    const box = (badge, body) => '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">드라이브 연결</b>' + badge + '</div>' + body + '</div>';
    if (!PF.club) return box('<span class="badge t-neutral">체험</span>', '<span class="muted" style="font-size:13px;line-height:1.7">지금은 <b>체험용 가상 동아리(북일고등학교 실험 동아리)</b>예요. 드라이브 연결 없이 바로 써 볼 수 있어요. 바꾼 내용은 이 브라우저에만 저장되고 <b>매일 처음 상태로 돌아가요.</b></span><button type="button" class="btn" data-act="demoWho" style="align-self:flex-start">누구로 체험할지 바꾸기 · 처음 상태로</button>');
    if (PF.isMaster) { fetchGs(); return linksCard() + backupCard() + connectCard(); }
    return linksCard() + backupCard();   // 관리자: 바로 열기만 · 부원에게는 보이지 않음
  }
  // 관리자: 동아리 데이터 바로 열기 (주소는 연결기가 알려 줌)
  function linksCard() {
    if (PF.mode !== 'live' || !isAdmin()) return '';
    if ((!PF.links || (PF.links.err && Date.now() - PF.links.at > 60000)) && !PF.linksLoading) {
      PF.linksLoading = true;
      rpc('links', null, null, { quiet: true }).then((l) => { PF.links = l || {}; }, () => { PF.links = { err: true, at: Date.now() }; }).finally(() => { PF.linksLoading = false; render(); });
    }
    const L = PF.links || {}, a = (href, label) => href ? '<a class="btn" href="' + esc(href) + '" target="_blank" rel="noopener">' + label + '</a>' : '';
    return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">동아리 데이터 바로 열기</b><span class="badge t-info">관리자</span></div>' +
      (PF.links && !L.sheet ? '<span class="muted" style="font-size:13px;line-height:1.6">연결기가 아직 이 기능을 몰라요. 새 본체는 10분 안에 저절로 들어와요. 잠시 뒤 다시 열어 보세요.</span>' :
       PF.links ? '<div class="btn-row">' + a(L.sheet, '가지 데이터 시트 열기') + a(L.script, '연결기(Apps Script) 열기') + a(L.folder || L.home, L.folder ? '사진 폴더 열기' : '동아리 폴더 열기') + '</div>' +
        '<span class="muted" style="font-size:12px;line-height:1.6">구글 계정에 이 시트 · 폴더의 편집 권한이 있어야 열려요. 시트를 직접 고치면 가지가 헷갈릴 수 있으니 보기만 하세요.</span>'
        : '<span class="muted loading-line">' + SPIN + '주소를 받는 중…</span>') + '</div>';
  }
  // 실험 승인 규칙: 학교마다 다름. 관리자는 보고, 마스터 · 지도 선생님이 바꿈
  function rulesCard() {
    if (PF.mode === 'live' ? !isAdmin() : !!PF.club) return '';
    const R = rules(), ed = ['마스터', '교사'].includes(myRole()), dis = ed ? '' : ' disabled', tn = teacherNames();
    const ck = (k, on, label) => '<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.5"><input type="checkbox" data-rule="' + k + '"' + (on ? ' checked' : '') + dis + ' style="margin-top:3px"> <span>' + label + '</span></label>';
    const sum = (R.peers ? (R.team ? '' : '팀 밖의 ') + '부원 ' + R.peers + '명 승인' : '부원 승인 없음') + (R.teacher === 'final' ? ' → 지도 선생님 최종 승인' : '') + ' → 준비 시작';
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">실험 승인 규칙</b><span class="badge t-info">' + (ed ? '바꿀 수 있음' : '보기만') + '</span></div>' +
      '<span style="font-size:14px;line-height:1.6;background:var(--surface-2);padding:10px 12px;border-radius:10px"><b>지금 규칙:</b> 계획서 → ' + esc(sum) + '</span>' +
      '<div class="field">부원 승인<div class="seg" style="grid-template-columns:repeat(4,1fr)">' + [0, 1, 2, 3].map((k) => '<button type="button" data-rule-peers="' + k + '" aria-pressed="' + (R.peers === k) + '"' + dis + '>' + (k ? k + '명' : '없음') + '</button>').join('') + '</div></div>' +
      ck('team', R.team, '함께하는 사람(팀원)의 승인도 인정 <small class="muted">끄면 팀 밖의 부원만 승인할 수 있어요 (교차 검토)</small>') +
      ck('teacher', R.teacher === 'final', '부원 승인 뒤 <b>지도 선생님의 최종 승인</b>이 꼭 있어야 함' + (tn.length ? ' <small class="muted">선생님: ' + tn.map(esc).join(' · ') + '</small>' : ' <small class="muted" style="color:var(--warn-fg,#9A5B00)">지도 선생님이 아직 지정되지 않아 지금은 적용되지 않아요. 더 보기 → 부원 · 기기에서 역할을 ‘지도 선생님’으로 바꿔 주세요.</small>')) +
      ck('skip', R.skip, '급할 때 기장 · 관리자 · 선생님이 검토 없이 준비를 시작할 수 있음') +
      (ed ? '' : '<span class="muted" style="font-size:12px">동아리 마스터나 지도 선생님만 바꿀 수 있어요.</span>') +
      '<span class="muted" style="font-size:12px;line-height:1.6">어떤 규칙이든 계획서(목적 · 방법)가 없으면 검토를 요청할 수 없고, 결과 · 결론이 없으면 기록 완료가 되지 않아요. 내 실험은 내가 승인할 수 없어요.</span></div>';
  }
  async function setRule(o) {
    if (PF.mode === 'live') { try { PF.rules = await rpc('rulesSet', o); toast('승인 규칙을 바꿨어요'); } catch (e) { if (!deviceLost(e)) toast(e.message); } return render(); }
    db.rules = Object.assign({}, rules(), o.teacher ? { teacher: o.teacher } : {}, 'peers' in o ? { peers: o.peers } : {}, 'team' in o ? { team: o.team } : {}, 'skip' in o ? { skip: o.skip } : {});
    save(); render(); toast('승인 규칙을 바꿨어요');
  }
  // 관리자: 자동 백업 (일주일에 한 번 '가지 백업' 폴더 + 메일)
  function backupCard() {
    if (PF.mode !== 'live' || !isAdmin()) return '';
    if ((!PF.bk || (PF.bk.err0 && Date.now() - PF.bk.t > 60000)) && !PF.bkLoading) {
      PF.bkLoading = true;
      rpc('backupInfo', null, null, { quiet: true }).then((b) => { PF.bk = b || {}; }, () => { PF.bk = { err0: true, t: Date.now() }; }).finally(() => { PF.bkLoading = false; render(); });
    }
    const B = PF.bk, head = '<div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">자동 백업</b><span class="badge t-info">관리자</span></div>';
    const wrap = (b) => '<div class="card" style="display:flex;flex-direction:column;gap:10px">' + head + b + '</div>';
    if (!B) return wrap('<span class="muted loading-line">' + SPIN + '백업 상태를 보는 중…</span>');
    if (B.err0 || !('mail' in B)) return wrap('<span class="muted" style="font-size:13px;line-height:1.6">연결기가 아직 이 기능을 몰라요. 새 본체는 10분 안에 저절로 들어와요. 잠시 뒤 다시 열어 보세요.</span>');
    let when = '아직 없어요 · 오늘 안에 첫 백업을 해요';
    if (B.at) { const d = new Date(B.at), n = Math.floor((Date.now() - d) / 864e5); when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' (' + (n < 1 ? '오늘' : n + '일 전') + ')'; }
    return wrap('<span style="font-size:14px;line-height:1.7">마지막 백업: <b>' + esc(when) + '</b></span>' +
      (B.err ? '<span class="badge t-warn" style="align-self:flex-start;white-space:normal;line-height:1.5">지난번 문제: ' + esc(B.err.replace(/^\S+\s/, '')) + '</span>' : '') +
      '<span class="muted" style="font-size:13px;line-height:1.7">일주일에 한 번, 바뀐 것이 있으면 저절로 시트 옆 <b>‘가지 백업’ 폴더</b>에 사본을 저장해요. 최근 8개와 달마다 1개(1년)만 남기고 오래된 건 알아서 지워요.</span>' +
      '<label class="check-line" style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-bk-mail' + (B.mail ? ' checked' : '') + '> 백업할 때 엑셀 파일과 한 주 요약을 메일로도 받기</label>' +
      (B.mail ? '<span class="muted" style="font-size:13px">받는 곳: <b>' + esc(B.to || '연결기를 만든 구글 계정') + '</b> <button type="button" class="chipbtn" data-act="backupTo">바꾸기</button></span>' : '') +
      '<div class="btn-row"><button type="button" class="btn primary" data-act="backupNow">지금 백업</button>' + (B.folder ? '<a class="btn" href="' + esc(B.folder) + '" target="_blank" rel="noopener">백업 폴더 열기</a>' : '') + '</div>' +
      (B.at ? '<button type="button" class="chipbtn" data-act="restoreOpen" style="align-self:flex-start">백업에서 되살리기…</button>' : ''));
  }
  async function backupNow() {
    try { const r = await rpc('backupNow'); if (r.ok) { toast('백업했어요' + (r.mailed ? ' · 메일도 보냈어요' : '')); } else toast('백업하지 못했어요: ' + (r.error || '')); }
    catch (e) { if (!deviceLost(e)) toast(e.message); }
    PF.bk = null; render();
  }
  async function backupSet(o) {
    try { PF.bk = await rpc('backupSet', o); toast('바꿨어요'); } catch (e) { if (!deviceLost(e)) toast(e.message); PF.bk = null; }
    render();
  }
  // 백업에서 되살리기: 백업 고르기 → 확인 코드를 직접 쳐서 → 되살리기
  const bkDate = (b) => { const d = new Date(b.at); return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '년 ' : '') + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  async function restoreOpen() {
    openSheet('<h3>백업에서 되살리기</h3><p class="muted loading-line">' + SPIN + '백업 목록을 보는 중…</p>');
    try {
      const r = await rpc('backupList', null, null, { quiet: true });
      if (!r.list.length) return openSheet('<h3>백업에서 되살리기</h3><p class="muted">아직 백업이 없어요.</p><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">닫기</button></div>');
      openSheet('<h3>백업에서 되살리기</h3><p class="muted" style="font-size:13px;line-height:1.7;margin:0 0 10px">실수로 지웠거나 망가졌을 때만 쓰세요. 고른 날의 <b>실험 · 연결 · 댓글 · 사진 목록</b>으로 돌아가요. 부원 · 기기 · 설정은 지금 그대로예요. 지금 항목: <b>' + r.now.exp + '개</b></p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow:auto">' + r.list.map((b, i) => '<button type="button" class="btn" data-act="restorePick" data-id="' + esc(b.id) + '" style="justify-content:space-between"><span>' + esc(bkDate(b)) + '</span>' + (i === 0 ? '<span class="badge t-info">가장 최근</span>' : '') + '</button>').join('') + '</div>' +
        '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn" data-act="closeSheet">취소</button></div>');
    } catch (e) { closeSheet(); if (!deviceLost(e)) toast(e.message); }
  }
  async function restorePick(id) {
    openSheet('<h3>백업에서 되살리기</h3><p class="muted loading-line">' + SPIN + '백업 내용을 확인하는 중…</p>');
    try {
      const r = await rpc('restorePrep', { id }, null, { quiet: true });
      openSheet('<h3>정말 되살릴까요?</h3><form id="restoreForm" data-id="' + esc(r.id) + '" style="display:flex;flex-direction:column;gap:12px" autocomplete="off">' +
        '<div class="card" style="background:var(--warn-bg,#FEF3C7);color:var(--warn-fg,#7A4B00);border:0;line-height:1.7;font-size:14px"><b>' + esc(bkDate(r)) + ' 백업</b>으로 돌아가요.<br>항목 수: 지금 <b>' + r.now.exp + '개</b> → 백업 <b>' + r.backup.exp + '개</b><br>그 뒤에 만들거나 고친 실험 · 댓글은 사라져요. 대신 <b>되살리기 직전에 지금 상태를 먼저 백업</b>해서 다시 되돌릴 수 있어요.</div>' +
        '<div style="text-align:center"><div class="muted" style="font-size:13px">아래 확인 코드를 <b>직접</b> 똑같이 쳐 주세요 (' + r.minutes + '분 안 · 3번 틀리면 취소)</div>' +
        '<div class="restore-code" style="font:800 28px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:4px;margin:8px 0;user-select:none;-webkit-user-select:none" aria-label="확인 코드">' + esc(r.code).split('').map((c) => '<span>' + c + '</span>').join('') + '</div></div>' +
        '<label class="field">확인 코드<input name="code" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" data-nopaste placeholder="예: ABCD-EF23" style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:2px;text-transform:uppercase" required></label>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn danger">되살리기</button></div></form>');
    } catch (e) { closeSheet(); if (!deviceLost(e)) toast(e.message); }
  }
  async function restoreDo(f) {
    const btn = f.querySelector('[type=submit]'), code = String(new FormData(f).get('code') || '').trim();
    if (!code) return; btn.disabled = true;
    try {
      if (dirty()) await doSync();
      const r = await rpc('restore', { id: f.dataset.id, code });
      closeSheet(); toast('되살렸어요 · 항목 ' + r.exp + '개'); PF.bk = null; await liveLoad();
    } catch (e) {
      btn.disabled = false; if (deviceLost(e)) return;
      if (e.code === 'bad_code' && !/취소/.test(e.message)) { toast(e.message); const i = f.querySelector('[name=code]'); i.value = ''; i.focus(); return; }
      closeSheet(); toast(e.message);
    }
  }
  function viewClub() {
    if (!PF.isMaster) return '<div class="card empty">동아리 마스터만 볼 수 있어요.</div>';
    const url = location.origin + '/c/' + PF.slug, h = PF.handover; fetchGs();
    return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>동아리 주소</b><span class="code" style="font-size:15px;word-break:break-all;user-select:all">' + esc(url) + '</span>' +
      '<div class="btn-row"><button type="button" class="btn" data-act="copyAddr">주소 복사</button><button type="button" class="btn" data-act="shareAddr">부원에게 보내기</button></div>' +
      '<span class="muted" style="font-size:13px">부원은 이 주소로 들어와 학번과 개인 코드로 씁니다. 개인 코드는 더 보기 → 부원 · 기기에서 만들어요.</span></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>학교 계정 제한 (선택)</b><label class="field">관리자 구글 로그인에 허용할 도메인<input id="domainInput" placeholder="예: school.hs.kr" value="' + esc(PF.club.domain || '') + '"></label><span class="muted" style="font-size:12px">비워 두면 제한하지 않아요.</span></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>마스터 넘기기</b><span class="muted" style="font-size:13px;line-height:1.6">새 마스터에게 보낼 일회용 링크를 만듭니다. 24시간 동안만 쓸 수 있고, 새 마스터가 구글로 로그인하면 바로 넘어갑니다. 넘긴 뒤 나는 이 화면을 볼 수 없어요.</span>' +
      (h ? '<span class="code" style="font-size:13px;word-break:break-all;user-select:all;background:var(--surface-2);padding:10px;border-radius:10px">' + esc(h.link) + '</span><span class="muted" style="font-size:12px">' + esc(h.until) + '까지 유효</span><div class="btn-row"><button type="button" class="btn" data-act="copyHandover">링크 복사</button><button type="button" class="btn primary" data-act="shareHandover">새 마스터에게 보내기</button></div>'
         : '<button type="button" class="btn primary" data-act="handover">넘기기 링크 만들기</button>') + '</div>' +
      '<div class="card muted" style="font-size:12px;line-height:1.7">가지 서버(Firebase)에는 이 동아리의 이름 · 로고 · 색과 <b>마스터 계정 ID 하나</b>, 사용 현황 숫자만 저장돼요. 부원 이름 · 학번 · 실험 내용은 동아리 드라이브에만 있어요.</div>';
  }
  function viewAbout() {
    const card = (title, body) => '<div class="card about-card"><b class="about-h">' + title + '</b>' + body + '</div>';
    const steps = [['계획서', '목적 · 가설 · 변인 · 준비물 · 방법'], ['교차 검토', '다른 부원이 읽고 승인하거나 고칠 곳을 남겨요'], ['선생님 승인', '동아리 규칙에 따라 지도 선생님이 최종 승인'], ['준비', '준비물 · 안전 점검표'], ['실험', '진행 도우미로 단계마다 체크 · 메모 · 사진'], ['결과 기록', '측정값 · 관찰 · 결론, 그래프는 저절로'], ['보고서', '모든 기록이 보고서 한 편으로 · 인쇄 · PDF'], ['다음 실험', '결과에서 나온 질문이 새 가지가 돼요']];
    const feats = [['연구 가지', '실험이 어디서 시작해 어디로 이어졌는지 계보로 보여요'], ['내가 할 일', '홈에 지금 챙길 실험 · 검토 요청이 모여요'], ['아이디어 · 같이 해요', '누구나 제안하고, 관심 있는 사람끼리 팀을 꾸려요'], ['자동 보고서', '측정값을 넣으면 표 · 그래프 · 보고서가 완성돼요'], ['10년 검색', '제목 · 내용 · 사람 · 연도로 선배의 실험을 찾아요'], ['사진 · 관찰', '실험 사진과 관찰 기록을 바로 올려요']];
    const safe = [['우리 드라이브에만', '기록은 동아리 구글 드라이브에만 저장돼요. 가지 제작자도 볼 수 없어요.'], ['매주 자동 백업', '바뀐 것이 있으면 일주일에 한 번 저절로 백업하고, 실수하면 백업에서 되살려요.'], ['기기 승인', '처음 쓰는 기기는 기장 · 선생님이 승인해야 들어올 수 있어요.'], ['오래 써도 가볍게', '오래된 기록은 저절로 정리돼서 몇 년이 지나도 빨라요.']];
    return '<div class="card about-hero"><video class="about-video" controls playsinline preload="metadata" poster="/intro/gaji-intro.jpg"><source src="/intro/gaji-intro.mp4" type="video/mp4"></video>' +
      '<div class="about-tag"><b>가지 · 실험이 가지를 치며 자라는 곳</b><span class="muted">한 번 하고 끝나는 실험 말고, 가지를 치며 자라는 연구. 계획부터 보고서, 그리고 다음 실험까지 한 줄기로 이어서 기록하는 동아리 연구 관리 도구예요.</span>' +
      '<a class="chipbtn" href="/intro/gaji-shorts.mp4" target="_blank" rel="noopener" style="align-self:flex-start">세로 영상(쇼츠) 보기</a></div></div>' +
      card('실험이 자라는 과정', '<ol class="about-steps">' + steps.map((x, i) => '<li><span class="about-n">' + (i + 1) + '</span><span><b>' + x[0] + '</b><small>' + x[1] + '</small></span></li>').join('') + '</ol>' +
        '<span class="muted" style="font-size:13px;line-height:1.6">계획서 없이는 검토를 요청할 수 없고, 결과 · 결론 없이는 기록 완료가 되지 않아요. 몇 명이 승인할지, 선생님 승인이 필요한지는 <b>동아리마다 설정</b>에서 정해요.</span>') +
      card('할 수 있는 것', '<div class="about-grid">' + feats.map((x) => '<div><b>' + x[0] + '</b><small>' + x[1] + '</small></div>').join('') + '</div>') +
      card('기록을 지키는 방법', '<div class="about-grid">' + safe.map((x) => '<div><b>' + x[0] + '</b><small>' + x[1] + '</small></div>').join('') + '</div>') +
      (PF.mode === 'live' ? '' : card('시작하기', '<span style="line-height:1.7">' + (PF.club ? '드라이브를 연결하면 실제 동아리 기록으로 바뀌어요. 설정 → 드라이브 연결에서 할 수 있어요.' : '지금은 <b>체험용 가상 동아리</b>예요. 마음껏 눌러 보고 고쳐 보세요. 매일 처음 상태로 돌아가요.') + '</span>' +
        (PF.club ? '' : '<a class="btn primary" href="/new" style="align-self:flex-start">우리 동아리 만들기</a>')));
  }

  /* ---------- 새로 만들기 (아래에서 올라오는 창) ---------- */
  function openSheet(html, wide) { $('#sheet').classList.toggle('wide', !!wide); $('#sheet').innerHTML = html; $('#sheet').hidden = false; $('#sheetBg').hidden = false; const f = $('#sheet input,#sheet select'); if (f) f.focus(); }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; }
  function newForm(type, parent) {
    const lines = [...new Set(alive().map((n) => n.line).filter(Boolean))];
    const d = new Date(TODAY); d.setDate(d.getDate() + 14);
    const label = { exp: '새 실험', idea: '새 아이디어', q: '새 질문' }[type];
    openSheet('<h3>' + label + (parent ? ' · ' + esc(code(parent)) + '에서 이어서' : '') + '</h3><form id="newForm" data-type="' + type + '" data-parent="' + (parent ? parent.id : '') + '" style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="field">' + (type === 'q' ? '궁금한 것' : '제목') + '<input name="title" maxlength="60" required placeholder="' + (type === 'q' ? '예: 몰 농도는 언제 써요?' : '예: 소금 농도와 끓는점') + '"></label>' +
      '<label class="field">분야<select name="field">' + Object.keys(FCODE).map((f) => '<option' + (parent && parent.field === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></label>' +
      (type !== 'q' ? '<label class="field">' + (type === 'exp' ? '실험 예정일' : '해 보고 싶은 때') + '<input type="date" name="date" value="' + dstr(d) + '" required></label>' +
        (parent ? '' : lineFields(lines, prefs.lastLine && lines.includes(prefs.lastLine) ? prefs.lastLine : '__new', '')) : '') +
      '<div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">만들기</button></div></form>');
  }
  // 연구 줄기: 같은 주제의 실험을 묶는 이름. 고르거나 새로 짓기
  function lineFields(lines, cur, newName) {
    return '<label class="field">연구 줄기 <span class="muted" style="font-weight:400">같은 주제끼리 묶여요 (예: 전지 연구)</span><select name="line" data-line-pick>' +
      lines.map((l) => '<option value="' + esc(l) + '"' + (l === cur ? ' selected' : '') + '>' + esc(lineName(l)) + '</option>').join('') + '<option value="__new"' + (cur === '__new' ? ' selected' : '') + '>+ 새 줄기 만들기</option></select></label>' +
      '<label class="field" data-new-line' + (cur === '__new' ? '' : ' hidden') + '>새 줄기 이름<input name="newLine" maxlength="20" value="' + esc(newName || '') + '" placeholder="예: 전지 연구"></label>';
  }
  const suggestLine = (title) => String(title || '').split(/[:：·\-—(]/)[0].trim().slice(0, 20);
  function pickLine(fd, title) {
    let ln = fd.get('line');
    if (!ln || ln === '__new') { const name = String(fd.get('newLine') || '').trim().slice(0, 20) || suggestLine(title) || title.slice(0, 12);
      ln = Object.keys(db.lines).find((k) => db.lines[k] === name) || 'L' + Date.now().toString(36); db.lines[ln] = name; }
    prefs.lastLine = ln; savePrefs(); return ln;
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
  const TITLES = { line: '', item: '', board: '보드', map: '전체 지도', settings: '설정', about: '가지 소개', club: '동아리 관리', people: '부원 · 기기', run: '진행 도우미', report: '보고서', trash: '휴지통' };
  const GAJI_MARK = '<svg viewBox="96 56 340 396" class="gaji-mark"><g fill="currentColor" fill-opacity=".72" stroke="none"><path d="M0 0C26-30 74-34 104-6C74 22 28 26 0 0Z" transform="translate(138 222) rotate(-132)"/><path d="M0 0C26-30 74-34 104-6C74 22 28 26 0 0Z" transform="translate(402 290) rotate(28)"/><path d="M0 0C22-26 62-28 88-6C62 18 24 22 0 0Z" transform="translate(330 182) rotate(-12)"/></g><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M164 432C190 356 228 304 284 254C326 216 356 176 368 128" stroke-width="42"/><path d="M232 318C196 292 164 262 140 222" stroke-width="30"/><path d="M298 240C334 246 368 262 400 288" stroke-width="28"/></g><g fill="#E9FF8F" stroke="none"><path d="M0 0C16-20 48-24 68-6C48 12 18 16 0 0Z" transform="translate(366 122) rotate(-128)"/><path d="M0 0C16-20 48-24 68-6C48 12 18 16 0 0Z" transform="translate(370 122) rotate(-58)"/></g></svg>';
  function logoInner() { const st = brand(); return st.logo ? '<img src="' + esc(st.logo) + '" alt="">' : GAJI_MARK; }
  /* 동아리 색 두 가지: 주도 색(main) + 밝은 색(light). 예: 녹색 & 흰색, 버건디 & 연노랑
     on = 주도 색 위의 글자 · 아이콘 (밝은 색이 충분히 대비되면 그 색, 아니면 흰색), soft = 선택된 탭 · 칩 바탕 */
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgbHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lum = (h) => { const c = hexRgb(h) || [0, 0, 0]; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const isDark = () => (prefs.theme || 'system') === 'dark' || ((prefs.theme || 'system') === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  function brandColors(main, light) {
    main = hexRgb(main) ? main.toUpperCase() : '#C26A00';
    light = hexRgb(light) ? light.toUpperCase() : '';
    const on = light && contrast(light, main) >= 3 ? light : '#FFFFFF';
    const soft = light && lum(light) > 0.55 && lum(light) < 0.995 ? (lum(light) < 0.85 ? mix(light, '#FFFFFF', 0.4) : light) : mix(main, '#FFFFFF', 0.88);
    return { main, light: light || '#FFFFFF', on, soft, softDark: mix(main, '#14171C', 0.72) };
  }
  function applyBrand() {
    if (window.GAJI_PORTAL && $('.app').hidden) return;   // 가지 첫 화면이 떠 있으면 동아리 색을 칠하지 않음
    const st = brand();
    const pill = $('#demoPill');
    pill.hidden = GATE.has(PF.mode);
    pill.textContent = PF.mode === 'live' ? (PF.busy ? '저장 중…' : PF.refreshing ? '최신으로 맞추는 중…' : PF.me.name + (PF.me.role !== '부원' ? ' · ' + PF.me.role : '')) : PF.club ? '드라이브 연결 전' : '체험 · ' + meName() + ' ▾';
    pill.classList.toggle('live', PF.mode === 'live');
    const C = brandColors(st.color || '#C26A00', st.color2 || ''), R = document.documentElement.style, dark = isDark();
    R.setProperty('--brand', C.main); R.setProperty('--on-brand', C.on); R.setProperty('--brand-soft', dark ? C.softDark : C.soft); R.setProperty('--brand-2', C.light);
    $('#clubName').textContent = st.clubName; $('#clubLogo').innerHTML = logoInner();
    const th = prefs.theme || 'system'; if (th === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th);
  }
  const titleOf = (e) => e.s === 'line' ? lineName(e.arg) : e.s === 'item' ? (byId(e.arg) ? TYPE[byId(e.arg).type].label + ' 상세' : '') : TITLES[e.s] || '';
  function viewFor(e) { return ({ home: viewHome, tree: viewTree, find: viewFind, more: viewMore, line: () => viewLine(e.arg), item: () => viewItem(e.arg), board: viewBoard, map: viewMap, settings: viewSettings, about: viewAbout, club: viewClub, people: viewPeople, run: () => viewRun(e.arg), report: () => viewReport(e.arg), trash: viewTrash }[e.s] || (() => ''))(); }
  /* 내용이 같으면 화면을 건드리지 않음 (입력 칸 · 버튼이 바뀌지 않게).
     내용이 바뀌어도 입력 중이던 칸의 글자와 커서는 그대로 살림. */
  const lastHTML = {};
  function setHTML(sel, html) {
    const el = $(sel); if (lastHTML[sel] === html && el.innerHTML) return;
    const keep = [], act = document.activeElement;
    el.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=hidden]),textarea').forEach((f) => { const k = (f.form ? f.form.id : '') + '|' + (f.id || f.name); if (f.value && !f.readOnly) keep.push([k, f.value]); });
    const focusKey = act && el.contains(act) && /INPUT|TEXTAREA|SELECT/.test(act.tagName) ? [(act.form ? act.form.id : '') + '|' + (act.id || act.name), act.selectionStart, act.selectionEnd] : null;
    el.innerHTML = html; lastHTML[sel] = html; dbg('바뀜');
    if (DEBUG) dbg('바뀐이유', sel + ' ' + PF.mode + '/' + (nav[nav.length - 1] || {}).s + ' ' + ((new Error().stack || '').split('\n').slice(3, 6).map((l) => (l.match(/at (\S+)/) || [])[1] || '').join('←')) + ' @' + new Date().toLocaleTimeString());
    const find = (k) => Array.from(el.querySelectorAll('input,textarea,select')).find((f) => (f.form ? f.form.id : '') + '|' + (f.id || f.name) === k);
    keep.forEach(([k, v]) => { const f = find(k); if (f && !f.value && f.id !== 'q') f.value = v; });
    if (focusKey) { const f = find(focusKey[0]); if (f) { f.focus(); try { f.setSelectionRange(focusKey[1], focusKey[2]); } catch (e) {} } }
  }
  // 진단: 짧은 시간에 화면을 너무 자주 다시 그리면 원인을 알려 줌
  const rTimes = [];
  function renderWatch() {
    const now = Date.now(); rTimes.push(now); while (rTimes.length && now - rTimes[0] > 3000) rTimes.shift();
    if (rTimes.length === 12) { const st = (new Error().stack || '').split('\n').slice(3, 6).map((l) => l.trim().replace(/^at /, '').replace(/\(.*\/([^/]+)\)/, '($1)')).join(' ← '); toast('화면 반복 그리기: ' + st); console.warn('render loop', new Error().stack); }
  }
  function render(scrollTop) {
    renderWatch(); dbg('그리기'); dbg('모드', PF.mode);
    applyBrand();
    const gated = GATE.has(PF.mode);
    $('.app').classList.toggle('gated', gated);
    if (gated) { $('#backBtn').hidden = true; $('#brand').hidden = false; $('#screenTitle').hidden = true; $('#pane').hidden = true; setHTML('#screen', viewGate()); if (scrollTop) window.scrollTo(0, 0); return; }
    const mi = mainIndex(), main = nav[mi], paneOn = mi < nav.length - 1, root = mi === 0;
    $('#backBtn').hidden = root; $('#brand').hidden = !root; $('#screenTitle').hidden = root;
    if (!root) $('#screenTitle').textContent = titleOf(main);
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === nav[0].s ? 'page' : 'false'));
    setHTML('#screen', viewFor(main));
    $('#pane').hidden = !paneOn;
    if (!paneOn) document.querySelectorAll('#screen .sel-ring').forEach((el) => el.classList.remove('sel-ring'));
    if (paneOn) {
      const p = cur(); $('#paneTitle').textContent = titleOf(p); $('#paneBack').hidden = nav.length - 1 - mi <= 1;
      setHTML('#paneBody', viewFor(p));
      const sel = p.s === 'item' ? '[data-item="' + p.arg + '"]' : '[data-line="' + p.arg + '"]';
      document.querySelectorAll('#screen .sel-ring').forEach((el) => el.classList.remove('sel-ring'));
      document.querySelectorAll('#screen ' + sel).forEach((el) => el.classList.add('sel-ring'));
    }
    if (scrollTop) window.scrollTo(0, 0);
    if (PF.mode === 'live') setTimeout(loadThumbs, 0);
  }

  /* ---------- 이벤트 ---------- */
  document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
  $('#backBtn').addEventListener('click', back);
  $('#paneBack').addEventListener('click', () => { nav.pop(); render(); });
  $('#paneClose').addEventListener('click', () => { nav = nav.slice(0, mainIndex() + 1); render(); });
  // 화면 크기가 바뀌어도 두 칸 ↔ 한 칸이 바뀔 때만 다시 그림 (스크롤바 · 키보드로 생기는 작은 변화는 무시 → 입력 칸이 꺼지지 않게)
  let rz, lastWide = wide();
  window.addEventListener('resize', () => { dbg('크기변화'); clearTimeout(rz); rz = setTimeout(() => { const w = wide(); if (w === lastWide) return; lastWide = w; const f = document.activeElement; if (f && /INPUT|TEXTAREA|SELECT/.test(f.tagName)) return; render(); }, 150); });
  $('#sheetBg').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  function onClick(e, src) {
    const t = e.target;
    const it = t.closest('[data-item],[data-go]'); if (it) return go('item', it.dataset.item || it.dataset.go, src);
    const rpb = t.closest('[data-report]'); if (rpb) return go('report', rpb.dataset.report, src);
    const ln = t.closest('[data-line]'); if (ln) return go('line', ln.dataset.line, src);
    const nw = t.closest('[data-new]'); if (nw) return newForm(nw.dataset.new);
    const tg = t.closest('[data-tab-go]'); if (tg) return tab(tg.dataset.tabGo);
    const gs = t.closest('[data-go-screen]'); if (gs) return go(gs.dataset.goScreen);
    const tm = t.closest('[data-tmode]'); if (tm) { prefs.treeMode = tm.dataset.tmode; savePrefs(); return render(); }
    if (t.closest('[data-fold]')) { prefs.showDone = !prefs.showDone; savePrefs(); return render(); }
    const vd = t.closest('[data-verdict]'); if (vd) { const it2 = cur().s === 'item' ? byId(cur().arg) : null; if (it2) { it2.verdict = vd.dataset.verdict; save(); render(); toast('판정: ' + it2.verdict); } return; }
    const ty = t.closest('[data-ty]'); if (ty) { prefs.ty = ty.dataset.ty; savePrefs(); return render(); }
    const col = t.closest('[data-color]'); if (col) return saveBrand({ color: col.dataset.color });
    const col2 = t.closest('[data-color2]'); if (col2) return saveBrand({ color2: col2.dataset.color2 });
    const pr = t.closest('[data-pair]'); if (pr) { const [m, l] = pr.dataset.pair.split(','); return saveBrand({ color: m, color2: l }); }
    const rp = t.closest('[data-rule-peers]'); if (rp) return setRule({ peers: +rp.dataset.rulePeers });
    const nkb = t.closest('[data-nk]'); if (nkb) { const fm = nkb.closest('form'); fm.querySelector('[name=kind]').value = nkb.dataset.nk; fm.querySelectorAll('[data-nk]').forEach((x) => x.setAttribute('aria-pressed', String(x === nkb))); return; }
    const th = t.closest('button[data-theme]'); if (th) { prefs.theme = th.dataset.theme; savePrefs(); return render(); }
    const a = t.closest('[data-act]'); if (!a) return;
    const n = ['item', 'run', 'report'].includes(cur().s) ? byId(cur().arg) : null, act = a.dataset.act;
    const did = a.dataset.id;
    const copyText = (txt, done) => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(done), () => toast('길게 눌러 복사해 주세요'));
    if (act === 'clearFilters') { ['fy', 'ff', 'fp', 'fs'].forEach((k) => delete prefs[k]); savePrefs(); return render(); }
    if (act === 'retry') return startClub();
    if (act === 'findPerson') { prefs.fp = a.dataset.name; prefs.ty = 'all'; prefs.q = ''; savePrefs(); return tab('find'); }
    if (act === 'findMine') { prefs.ty = 'mine'; prefs.q = ''; savePrefs(); return tab('find'); }
    if (act === 'demoWho') return demoWho();
    if (act === 'pfLogin') return PF.api && PF.api.login();
    if (act === 'askApprove') return askApprove();
    if (act === 'myCode') return myCode();
    if (act === 'backupNow') return backupNow();
    if (act === 'restoreOpen') return restoreOpen();
    if (act === 'restorePick') return restorePick(did);
    if (act === 'backupTo') return openSheet('<h3>백업 메일 받는 곳</h3><form id="backupToForm" style="display:flex;flex-direction:column;gap:12px"><label class="field">메일 주소<input name="to" type="email" maxlength="120" value="' + esc((PF.bk && PF.bk.to) || '') + '" placeholder="비우면 연결기를 만든 구글 계정"></label><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">저장</button></div></form>');
    if (act === 'restartJoin') { dropDev(); PF.mode = 'join'; return render(); }
    if (act === 'leaveDevice') { if (!confirm('이 기기에서 나갈까요? 다시 들어오려면 학번 · 개인 코드와 승인이 필요해요.')) return; rpc('block', { id: PF.dev.id }).catch(() => {}); dropDev(); PF.mode = 'join'; nav = [{ s: 'home' }]; return render(true); }
    if (act === 'openApprove') return openApprove(did);
    if (act === 'approveDev' || act === 'denyDev') return devAction(act, did);
    if (act === 'addMember') return openSheet('<h3>부원 추가</h3><form id="addMemberForm" style="display:flex;flex-direction:column;gap:12px"><label class="field">학번<input name="sid" inputmode="numeric" maxlength="12" required></label><label class="field">이름<input name="name" maxlength="20" required></label><p class="muted" style="font-size:13px;margin:0">추가하면 4자리 개인 코드가 만들어져요.</p><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">추가</button></div></form>');
    if (act === 'refreshPeople') { PF.people = null; return render(); }
    if (act === 'member') return memberSheet(did);
    if (['resetCode', 'setRole', 'setStatus', 'logoutAll'].includes(act)) return peopleAction(a);
    if (act === 'seenAllDev') { prefs.seenDev = (prefs.seenDev || []).concat(PF.newDevices.map((x) => x.id)).slice(-40); savePrefs(); PF.newDevices = []; return render(); }
    if (act === 'seenDev' || act === 'notMe') {
      prefs.seenDev = (prefs.seenDev || []).concat(did).slice(-20); savePrefs(); PF.newDevices = PF.newDevices.filter((x) => x.id !== did);
      if (act === 'notMe') rpc('block', { id: did }).then(() => toast('그 기기를 막았어요 · 관리자에게도 알려 주세요'), (er) => toast(er.message));
      return render();
    }
    if (act === 'copyGs') return copyGs();
    if (act === 'testConn') { rpc('ping').then((p) => { PF.connVer = p.version; PF.connShell = p.shell || ''; PF.connAuth = false; render(); toast('연결 정상 · 연결기 ' + p.version + (verOld(p.version) ? ' · 업데이트 필요' : '')); }, (er) => { if (er.code === 'network') { PF.connAuth = true; } render(); toast(er.code === 'network' ? '연결기가 응답하지 않아요 · 아래 안내대로 권한을 허용해 주세요' : er.message); }); return; }
    if (act === 'rewire') { PF.rewire = true; return render(); }
    if (act === 'rewireCancel') { PF.rewire = false; return render(); }
    if (act === 'reset') { db = freshSample(); save(); toast('예시 데이터로 되돌렸어요'); return render(); }
    if (act === 'logoClear') return saveBrand({ logo: '' });
    const shareText = (title, text, url) => navigator.share ? navigator.share({ title, text, url }).catch(() => {}) : copyText(url, '링크를 복사했어요');
    if (act === 'copyAddr') return copyText(location.origin + '/c/' + PF.slug, '동아리 주소를 복사했어요');
    if (act === 'shareAddr') return shareText(brand().clubName, brand().clubName + ' 가지 주소예요', location.origin + '/c/' + PF.slug);
    if (act === 'handover') { PF.api.createHandover().then((h) => { PF.handover = h; render(); }).catch(() => toast('링크를 만들지 못했어요')); return; }
    if (act === 'copyHandover') return copyText(PF.handover.link, '넘기기 링크를 복사했어요');
    if (act === 'shareHandover') return shareText('가지 마스터 넘기기', brand().clubName + ' 가지 마스터를 넘겨요. 24시간 안에 열어 구글로 로그인해 주세요.', PF.handover.link);
    if (act === 'fileView') return fileView(a.dataset.fid);
    if (['restore', 'moveTo', 'cmResolve', 'cmEdit', 'cmDel'].includes(act) && flowAct(act, a, n)) return;
    if (!n) return;
    if (act === 'copy') { const c = code(n); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast(c + ' 복사했어요'), () => toast('번호: ' + c)); return; }
    if (act === 'fan') { n.fans = (n.fans || 0) + 1; toast('같이 해요 ' + n.fans + '명'); }
    if (act === 'volunteer') { n.volunteer = meName(); toast('담당으로 지원했어요'); }
    if (act === 'equip') { n.equip = true; toast('장비 확인 완료'); }
    if (act === 'convert') { n.type = 'exp'; n.status = '계획 작성'; n.owner = n.volunteer; n.signal = 0; n.review = 0; save(); render(); toast('실험이 됐어요 · 번호 ' + code(n) + ' 그대로'); return planForm(n); }
    if (act === 'advance' || act === 'askReview') {
      const why = moveBlock(n, STAGES[STAGES.indexOf(n.status) + 1]); if (why) return toast(why);
      const i = STAGES.indexOf(n.status), prev = { status: n.status, signal: n.signal }, id = n.id;
      n.status = STAGES[i + 1]; if (n.status === '준비 중') n.signal = n.signal || 2; PF.myMoves[id] = Date.now();
      toast(n.status + ' 단계로 옮겼어요', { label: '되돌리기', fn: () => { const x = byId(id); if (!x) return; Object.assign(x, prev); save(); render(); toast(prev.status + ' 단계로 되돌렸어요'); } });
    }
    if (act === 'record') return recordForm(n);
    if (flowAct(act, a, n)) return;
    if (act === 'nextIdea') { const t = (n.report && n.report.next) || ''; newForm('idea', n); const ti = $('#newForm [name=title]'); if (ti) ti.value = t.slice(0, 60); return; }
    if (act === 'stageBack') { const i = STAGES.indexOf(n.status); if (i >= 2) { n.status = STAGES[i - 1]; if (!isAdmin()) delete PF.myMoves[n.id]; toast(n.status + ' 단계로 되돌렸어요'); } }
    if (act === 'solve') { n.status = '해결'; toast('해결됨으로 표시했어요'); }
    if (act === 'branch') { save(); return newForm('idea', n); }
    if (act === 'toIdea') { save(); return newForm('idea', n); }
    save(); render();
  }
  // 누르는 사이에 버튼이 새것으로 바뀌어도 누른 것으로 처리
  let downAct = null;
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest('[data-act]'); downAct = b ? { el: b, act: b.dataset.act, id: b.dataset.id || '' } : null; }, true);
  document.addEventListener('pointerup', (e) => {
    const d = downAct; downAct = null; if (!d || document.contains(d.el)) return;
    const b = e.target.closest && e.target.closest('[data-act]');
    if (b && b.dataset.act === d.act && (b.dataset.id || '') === d.id) { dbg('클릭', '복구 ' + d.act); setTimeout(() => b.click(), 0); }
  }, true);
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-act]'); if (b) dbg('클릭도착', b.dataset.act + ' @' + new Date().toLocaleTimeString()); }, true);
  $('#screen').addEventListener('click', (e) => onClick(e, 'main'));
  $('#screen').addEventListener('focusin', (e) => { if (e.target.id === 'gsCode') setTimeout(() => { e.target.select(); e.target.scrollTop = 0; }, 0); });
  window.addEventListener('error', (e) => { if (e.message) toast('화면 오류: ' + e.message); });
  window.addEventListener('unhandledrejection', (e) => { const m = e.reason && e.reason.message; if (m) console.warn(m); });
  $('#paneBody').addEventListener('click', (e) => onClick(e, 'pane'));
  $('#paneBody').addEventListener('submit', (e) => { flowSubmit(e); });
  const onKey = (src) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('g[data-go]')) { e.preventDefault(); go('item', e.target.closest('g[data-go]').dataset.go, src); } };
  $('#screen').addEventListener('keydown', onKey('main'));
  $('#paneBody').addEventListener('keydown', onKey('pane'));
  $('#screen').addEventListener('input', (e) => {
    if (e.target.id === 'q') { prefs.q = e.target.value; savePrefs(); const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
    if (e.target.id === 'clubInput' && !PF.club) { db.settings.clubName = e.target.value.trim() || '실험 동아리'; save(); applyBrand(); }
  });
  $('#screen').addEventListener('change', (e) => {
    if (['fy', 'ff', 'fp', 'fs'].includes(e.target.id)) { prefs[e.target.id] = e.target.value; savePrefs(); return render(); }
    if (e.target.id === 'clubInput' && PF.club) return saveBrand({ name: e.target.value.trim().slice(0, 30) || PF.club.name });
    if (e.target.id === 'domainInput' && PF.club) { const d = e.target.value.trim().toLowerCase().replace(/^@/, '').slice(0, 60); PF.club.domain = d; PF.api.saveInfo({ domain: d }).then(() => toast('저장했어요'), () => toast('저장하지 못했어요')); return; }
    if (e.target.id !== 'logoFile' || !e.target.files[0]) return;
    const f = e.target.files[0]; if (f.size > 2e6) return toast('2MB 이하 이미지를 골라 주세요');
    const img = new Image(), r = new FileReader();
    r.onload = () => { img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 160; const cx = cv.getContext('2d'), s = Math.min(img.width, img.height);
      cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160); saveBrand({ logo: cv.toDataURL('image/png') }); toast('로고를 바꿨어요'); }; img.src = r.result; };
    r.readAsDataURL(f);
  });
  $('#sheet').addEventListener('click', (e) => {
    const uk = e.target.closest('[data-ukind]'); if (uk) { const fm = uk.closest('form'); fm.querySelector('[name=kind' + uk.dataset.i + ']').value = uk.dataset.ukind; uk.parentNode.querySelectorAll('[data-ukind]').forEach((x) => x.setAttribute('aria-pressed', String(x === uk))); return; }
    const kd = e.target.closest('[data-kind]'); if (kd) return pickKind(kd.dataset.kind);
    const cl = e.target.closest('[data-claim]'); if (cl) { $('#recordForm [name=claim]').value = cl.dataset.claim; cl.parentNode.querySelectorAll('[data-claim]').forEach((b) => b.setAttribute('aria-pressed', String(b === cl))); return; }
    const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
    if (act === 'closeSheet') return closeSheet();
    if (act === 'restorePick') return restorePick(a.dataset.id);
    if (['gRow', 'gCol', 'gDelRow', 'gDelCol'].includes(act)) return gridAct(act);
    if (act === 'rowPhoto') return rowPhoto(a);
    if (act === 'approveDev' || act === 'denyDev') return devAction(act, a.dataset.id);
    if (['resetCode', 'setRole', 'setStatus'].includes(act)) return peopleAction(a);
    if (['fileFull', 'fileCap', 'fileDel'].includes(act)) return fileAct(act, a.dataset.fid);
    if (flowAct(act, a, ['item', 'run', 'report'].includes(cur().s) ? byId(cur().arg) : null)) return;
    if (act === 'demoWho') return demoWho();
    if (act === 'demoMe') { prefs.demoMe = a.dataset.name; savePrefs(); closeSheet(); render(); return toast(a.dataset.name + '(으)로 체험해요'); }
    if (act === 'demoReset') { if (!confirm('체험 데이터를 처음 상태로 되돌릴까요?')) return; db = freshSample(); save(); closeSheet(); nav = [{ s: 'home' }]; render(true); return toast('처음 상태로 되돌렸어요'); }
    if (act === 'shareCode') { const t = a.dataset.text; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('복사했어요'), () => {}); }
  });
  $('#screen').addEventListener('submit', (e) => { if (flowSubmit(e)) return;
    const id = e.target.id; if (!['joinForm', 'masterJoinForm', 'connectForm'].includes(id)) return;
    e.preventDefault(); if (id === 'joinForm') submitJoin(e.target); else if (id === 'masterJoinForm') submitMasterJoin(e.target); else submitConnect(e.target);
  });
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-bk-mail]')) return backupSet({ mail: e.target.checked });
    if (e.target.matches && e.target.matches('[data-color-input]')) return saveBrand({ [e.target.dataset.colorInput]: e.target.value.toUpperCase() });
    if (e.target.matches && e.target.matches('[data-rule]')) { const k = e.target.dataset.rule, on = e.target.checked; return setRule(k === 'teacher' ? { teacher: on ? 'final' : 'none' } : { [k]: on }); }
    const q = e.target.closest && e.target.closest('input[data-upload-quick]'); if (q && q.files && q.files.length) { quickMany(q.dataset.uploadQuick, q.files); q.value = ''; return; }
    const u = e.target.closest && e.target.closest('input[data-upload]'); if (u && u.files && u.files.length) { pickFiles(u.dataset.upload, u.files); u.value = ''; } });
  $('#sheet').addEventListener('change', (e) => {
    if (e.target.matches('[data-line-pick]')) { const f = e.target.form, box = f.querySelector('[data-new-line]'); box.hidden = e.target.value !== '__new'; if (!box.hidden) { const i = box.querySelector('input'); if (!i.value) i.value = suggestLine((f.querySelector('[name=title]') || {}).value); i.focus(); } }
  });
  $('#sheet').addEventListener('input', (e) => {
    if (e.target.name === 'title' && e.target.form && e.target.form.id === 'newForm') { const box = e.target.form.querySelector('[data-new-line]'); if (box && !box.hidden) { const i = box.querySelector('input'); if (!i.dataset.touched) i.value = suggestLine(e.target.value); } }
    if (e.target.name === 'newLine') e.target.dataset.touched = '1';
  });
  $('#sheet').addEventListener('paste', (e) => { if (e.target.matches && e.target.matches('[data-nopaste]')) { e.preventDefault(); toast('확인 코드는 직접 쳐 주세요'); } });
  $('#sheet').addEventListener('drop', (e) => { if (e.target.matches && e.target.matches('[data-nopaste]')) e.preventDefault(); });
  $('#sheet').addEventListener('submit', (e) => {
    if (e.target.id === 'uploadForm') { e.preventDefault(); return doUpload(e.target); }
    if (flowSubmit(e)) return;
    if (e.target.id === 'recordForm') { e.preventDefault(); return saveRecord(e.target, e.submitter); }
    if (e.target.id === 'restoreForm') { e.preventDefault(); return restoreDo(e.target); }
    if (e.target.id === 'backupToForm') { e.preventDefault(); closeSheet(); return backupSet({ to: String(new FormData(e.target).get('to') || '').trim() }); }
    if (e.target.id === 'addMemberForm') {
      e.preventDefault(); const fd = new FormData(e.target), name = String(fd.get('name')).trim(), btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      rpc('addMember', { studentId: String(fd.get('sid')).trim(), name }).then((r) => { PF.people = null; showCode(name, r.code); render(); }, (er) => { btn.disabled = false; if (!deviceLost(er)) toast(er.message); });
      return;
    }
    e.preventDefault(); const fm = e.target, fd = new FormData(fm), type = fm.dataset.type, parent = fm.dataset.parent ? byId(fm.dataset.parent) : null;
    const title = String(fd.get('title') || '').trim(); if (!title) return;
    const f = { type, title, field: fd.get('field'), date: fd.get('date') || dstr(TODAY) };
    if (type !== 'q') f.line = parent ? parent.line : pickLine(fd, title);
    if (type === 'exp') Object.assign(f, { status: '계획 작성', owner: meName(), signal: 0, review: 0 });
    if (type === 'idea') Object.assign(f, { status: '아이디어', fans: 1, volunteer: '', equip: false });
    if (type === 'q') f.status = '미해결';
    const n = create(f, parent); closeSheet(); toast(TYPE[type].label + '를 만들었어요 · ' + code(n)); go('item', n.id, 'main'); if (type === 'exp') planForm(n);
  });

  render();
})();
