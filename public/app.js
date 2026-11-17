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
  function save() { if (PF.mode === 'live') return scheduleSync(); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  let db = load();
  /* 실제 동아리 주소(/c/주소)로 열렸을 때 platform.js 가 채워 줌 */
  const PF = { club: null, isMaster: false, api: null, slug: null, handover: null, mode: 'demo', me: null, dev: null, rev: 0, base: null, busy: false, newDevices: [], people: null,
    approveId: new URLSearchParams(location.search).get('approve') };
  window.GAJI_APP = {
    setClub(club, isMaster, api, slug) { PF.club = club; PF.isMaster = !!isMaster; PF.api = api; PF.slug = slug; dbg('동아리설정'); startClub(); },
    refresh() { render(); }, toast: (m) => toast(m), dbg: (k, v) => dbg(k, v),
    open(sc) { nav = [{ s: 'more' }, { s: sc }]; render(true); }
  };
  const brand = () => PF.club ? { clubName: PF.club.name, color: PF.club.color, logo: PF.club.logo || '' } : db.settings;
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
  const LATEST_VER = '1.2.0';
  const verOld = (v, need) => { const a = String(v || '0').split('.').map(Number), b = (need || NEED_VER).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i]; } return false; };
  const GATE = new Set(['closed', 'join', 'pending', 'loading', 'error']);
  const devKey = () => 'gaji-dev:' + PF.slug;
  const getDev = () => { try { return JSON.parse(localStorage.getItem(devKey()) || 'null'); } catch (e) { return null; } };
  const putDev = (d) => { try { localStorage.setItem(devKey(), JSON.stringify(d)); } catch (e) {} PF.dev = d; };
  const dropDev = () => { try { localStorage.removeItem(devKey()); } catch (e) {} PF.dev = null; };
  const isAdmin = () => PF.mode === 'live' && PF.me && (PF.me.role === '관리자' || PF.me.role === '마스터');
  const meName = () => (PF.mode === 'live' && PF.me ? PF.me.name : '나');
  const URL_RE = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/;
  function deviceLabel() {
    const u = navigator.userAgent;
    if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(u)) return 'iPhone';
    if (/Android/.test(u)) return /Mobile/.test(u) ? '안드로이드 휴대폰' : '안드로이드 태블릿';
    if (/CrOS/.test(u)) return '크롬북'; if (/Windows/.test(u)) return 'Windows PC'; if (/Mac/.test(u)) return 'Mac'; return '기기';
  }
  async function rpc(action, data, url) {
    let j;
    try {
      const r = await fetch(url || PF.club.connector, { method: 'POST', body: JSON.stringify(Object.assign({ action, device: PF.dev ? { id: PF.dev.id, secret: PF.dev.secret } : null }, data || {})) });
      j = await r.json();
    } catch (e) { const x = new Error('연결기에 닿지 않아요. 인터넷이나 연결기 주소를 확인해 주세요'); x.code = 'network'; throw x; }
    if (!j || !j.ok) { const x = new Error(j && j.code === 'unknown' ? '연결기가 예전 판이라 이 기능이 없어요. 마스터가 연결기를 업데이트해야 해요 (설정 → 드라이브 연결)' : (j && j.message) || '연결기에서 문제가 생겼어요'); x.code = (j && j.code) || 'error'; throw x; }
    return j.data;
  }
  // 기기가 끊긴 경우 공통 처리
  function deviceLost(e) {
    if (['no_device', 'blocked', 'member_off', 'expired'].includes(e.code)) { dropDev(); PF.mode = 'join'; PF.notice = e.message; render(); return true; }
    if (e.code === 'pending') { startClub(); return true; }
    return false;
  }
  async function startClub() {
    const c = PF.club; PF.notice = PF.notice || '';
    if (!c.connector) { PF.mode = PF.isMaster ? 'preview' : 'closed'; return render(); }
    let d = getDev(); if (d && d.url !== c.connector) { dropDev(); d = null; }
    if (!d) { PF.mode = 'join'; return render(); }
    PF.dev = d; PF.mode = 'loading'; render();
    try {
      const st = await rpc('status');
      if (st.status === '승인') return liveLoad();
      if (st.status === '만료') { dropDev(); PF.mode = 'join'; PF.notice = '오래 안 써서 다시 승인이 필요해요'; return render(); }
      PF.pending = st; PF.mode = 'pending'; render(); pollPending();
    } catch (e) { if (!deviceLost(e)) { PF.mode = 'error'; PF.error = e.message; render(); } }
  }
  function pollPending() {
    clearTimeout(pollPending.t);
    pollPending.t = setTimeout(async () => {
      if (PF.mode !== 'pending') return;
      if (document.visibilityState === 'visible') {
        try { const st = await rpc('status'); if (st.status === '승인') { toast('승인됐어요!'); return liveLoad(); } }
        catch (e) { if (deviceLost(e)) return; }
      }
      pollPending();
    }, 4000);
  }
  const fixNode = (n) => Object.assign(n, { equip: n.equip === true || n.equip === 'true', fans: +n.fans || 0, signal: +n.signal || 0, review: +n.review || 0, no: +n.no || 0, date: n.date || n.created || dstr(TODAY), created: n.created || dstr(TODAY), field: n.field || '공통', desc: n.desc || '' });
  const lkey = (l) => l.s + '|' + l.t + '|' + l.k;
  function snapshot() { const m = {}; db.nodes.forEach((n) => (m[n.id] = JSON.stringify(n))); return { nodes: m, links: new Set(db.links.map(lkey)), lines: JSON.stringify(db.lines) }; }
  async function liveLoad() {
    try {
      const d = await rpc('load');
      PF.me = d.me; PF.rev = d.rev; PF.newDevices = (d.newDevices || []).filter((x) => !(prefs.seenDev || []).includes(x.id));
      db = { settings: db.settings, nodes: d.nodes.map(fixNode), links: d.links, lines: d.lines || {}, lastNo: d.lastNo || { exp: 0, q: 0, res: 0 } };
      PF.base = snapshot(); PF.mode = 'live'; PF.notice = ''; render(); pollRev();
      if (PF.isMaster && !PF.connVer) rpc('ping').then((pg) => { PF.connVer = pg.version; render(); }, () => {});
      if (PF.isMaster && PF.api && !PF.statsSent) { PF.statsSent = true; rpc('stats').then((st) => PF.api.saveStats(st)).catch(() => {}); }
      if (PF.approveId) { const id = PF.approveId; PF.approveId = null; history.replaceState(null, '', location.pathname); openApprove(id); }
    } catch (e) { if (!deviceLost(e)) { PF.mode = 'error'; PF.error = e.message; render(); } }
  }
  /* 바꾼 것만 연결기로 보냄 → 번호는 연결기가 매김 */
  function dirty() {
    const nodes = db.nodes.filter((n) => PF.base.nodes[n.id] !== JSON.stringify(n)), links = db.links.filter((l) => !PF.base.links.has(lkey(l)));
    const lines = JSON.stringify(db.lines) !== PF.base.lines;
    return nodes.length || links.length || lines ? { nodes, links, lines } : null;
  }
  function scheduleSync() { clearTimeout(scheduleSync.t); scheduleSync.t = setTimeout(doSync, 300); }
  async function doSync() {
    if (PF.mode !== 'live') return; if (PF.busy) return scheduleSync();
    const d = dirty(); if (!d) return;
    const sent = d.nodes.map((n) => JSON.parse(JSON.stringify(n))), links = d.links.map((l) => ({ s: l.s, t: l.t, k: l.k })), lines = Object.assign({}, db.lines);
    PF.busy = true; applyBrand();
    try {
      const r = await rpc('sync', { nodes: sent, links, lines });
      PF.busy = false;
      if (r.rejected && r.rejected.length) { toast('결과 판정 · 취소 · 단계 되돌리기는 관리자만 할 수 있어요'); return liveLoad(); }
      sent.forEach((s) => { const no = r.assigned && r.assigned[s.id]; const n = byId(s.id); if (no) { s.no = no; if (n) n.no = no; } PF.base.nodes[s.id] = JSON.stringify(s); });
      links.forEach((l) => PF.base.links.add(lkey(l))); PF.base.lines = JSON.stringify(lines);
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
        try { const r = await rpc('rev'); if (r.rev !== PF.rev) return liveLoad(); } catch (e) { if (deviceLost(e)) return; }
      }
      pollRev();
    }, 15000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && PF.mode === 'live') { clearTimeout(pollRev.t); pollRev.t = setTimeout(() => rpc('rev').then((r) => { if (r.rev !== PF.rev && !dirty()) liveLoad(); else pollRev(); }, (e) => { if (!deviceLost(e)) pollRev(); }), 50); } });

  /* ---------- 들어가기 화면 (탭 없이 한 장) ---------- */
  function gateCard(inner) { return '<div class="gate"><span class="logo gate-logo">' + logoInner() + '</span><b class="gate-name">' + esc(brand().clubName) + '</b>' + inner + '</div>'; }
  function viewGate() {
    const m = PF.mode;
    if (m === 'loading') return gateCard('<p class="muted">동아리 드라이브에 연결하는 중…</p>');
    if (m === 'error') return gateCard('<div class="card gate-box"><b>연결하지 못했어요</b><p class="muted">' + esc(PF.error) + '</p><button type="button" class="btn primary" data-act="retry">다시 시도</button></div>');
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
    openSheet('<h3>기기 승인</h3><p class="muted">불러오는 중…</p>');
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
    if (!PF.people) { loadPeople(); return '<div class="card empty">부원 명단을 불러오는 중…</div>'; }
    const p = PF.people, wait = p.devices.filter((d) => d.status === '대기'), act = p.members.filter((m) => m.status === '활동'), off = p.members.filter((m) => m.status !== '활동');
    const ROLE = { '마스터': 't-info', '관리자': 't-ok', '부원': 't-neutral' };
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
      (master && m.role !== '마스터' && m.status === '활동' ? '<button type="button" class="btn" data-act="setRole" data-id="' + esc(m.id) + '" data-role="' + (m.role === '관리자' ? '부원' : '관리자') + '">' + (m.role === '관리자' ? '부원으로 바꾸기' : '관리자로 지정') + '</button>' : '') +
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
      (PF.connAuth ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>연결기가 응답하지 않아요 · 권한 허용이 필요할 수 있어요</span><span style="font-weight:400;line-height:1.7">① <b>연결기 권한 확인</b>을 눌러 새 창 열기<br>② ‘권한 필요’ 또는 ‘액세스 승인’이 나오면 → <b>권한 검토</b> → 내 계정 → <b>고급 → 이동 → 허용</b><br>③ 새 창에 <b>"gaji":true</b> 글자가 보이면 성공 → 여기서 <b>연결 시험</b></span></div>' : '') +
      (PF.connVer ? (verOld(PF.connVer)
        ? '<div class="card gate-note" style="display:flex;flex-direction:column;gap:6px;text-align:left"><span>연결기 업데이트 필요 · 지금 ' + esc(PF.connVer) + ' → 새 판 ' + NEED_VER + '</span><span style="font-weight:400;line-height:1.7">① 아래 <b>연결기 코드 복사</b> → Apps Script에 덮어쓰고 저장<br>② <b>배포 → 배포 관리</b> → 연필 모양(수정) → 버전: <b>새 버전</b> → 배포<br>③ 여기서 <b>연결 시험</b> → ' + NEED_VER + ' 확인</span></div>'
        : '<span class="muted" style="font-size:12px">● 연결기 ' + esc(PF.connVer) + ' · 정상' + (verOld(PF.connVer, LATEST_VER) ? ' (새 판 ' + LATEST_VER + '은 급하지 않아요)' : '') + '</span>') : '') +
      '<div class="btn-row"><button type="button" class="btn" data-act="testConn">연결 시험</button><a class="btn" href="' + esc(c.connector) + '" target="_blank" rel="noopener">연결기 권한 확인</a><button type="button" class="btn" data-act="copyGs">연결기 코드 복사</button></div>' +
      '<span class="muted" style="font-size:12px;line-height:1.6">연결기를 새로 배포했거나 다른 시트로 옮길 때만 주소를 바꿔요.</span><button type="button" class="chipbtn" data-act="rewire">연결기 주소 바꾸기</button></div>';
    const step = (n, t, d, extra) => '<li class="wstep"><span class="wnum">' + n + '</span><div><b>' + t + '</b><span class="muted">' + d + '</span>' + (extra || '') + '</div></li>';
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">드라이브 연결</b><span class="badge t-warn">● 연결 전</span></div>' +
      '<span class="muted" style="font-size:13px;line-height:1.6">동아리 기록은 우리 드라이브의 시트에 저장돼요. 한 번만 하면 되고, 컴퓨터에서 하는 게 편해요 (10분).</span>' +
      '<ol class="wizard">' +
      step(1, '가지 데이터 시트 만들기', '학교 공유 드라이브(권장)나 내 드라이브에 새 구글 시트를 만들고 이름을 <b>가지 데이터</b>로 바꿔요.', '<a class="btn" href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noopener">새 시트 열기</a>') +
      step(2, '연결기 코드 붙여 넣기', '시트 메뉴 <b>확장 프로그램 → Apps Script</b>. 원래 있던 코드를 모두 지우고 붙여 넣은 뒤 저장해요.', '<textarea id="gsCode" class="gs-code" readonly spellcheck="false" aria-label="연결기 코드">' + esc(PF.gs || '불러오는 중…') + '</textarea>' +
        '<span class="muted" style="font-size:12px">버튼이 안 되면 상자를 한 번 누르고 <b>Ctrl+C</b> (맥은 ⌘+C)</span>' +
        '<div class="btn-row"><button type="button" class="btn primary" data-act="copyGs">코드 전체 복사</button><a class="btn" href="/connector.gs" target="_blank" rel="noopener">새 창에서 보기</a></div>') +
      step(3, '웹 앱으로 배포', '<b>배포 → 새 배포 → 유형: 웹 앱</b> · 실행: <b>나</b> · 액세스: <b>모든 사용자</b> → 배포 → 권한 허용. ‘확인되지 않은 앱’이 나오면 고급 → 이동을 눌러요.') +
      step(4, '웹 앱 주소 붙여 넣기', '배포가 끝나면 나오는 웹 앱 URL을 복사해 아래에 넣어요.',
        '<form id="connectForm" style="display:flex;flex-direction:column;gap:10px;margin-top:6px"><label class="field">웹 앱 URL<input name="url" required placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="grid2"><label class="field">내 학번<input name="sid" inputmode="numeric" maxlength="12" required></label><label class="field">내 이름<input name="name" maxlength="20" required></label></div>' +
        '<button type="submit" class="btn primary">연결하기</button>' + (PF.rewire ? '<button type="button" class="chipbtn" data-act="rewireCancel">취소</button>' : '') + '</form>') +
      '</ol></div>';
  }
  function fetchGs() {
    if (PF.gs || fetchGs.busy) return; fetchGs.busy = true;
    fetch('/connector.gs', { cache: 'no-cache' }).then((r) => r.text()).then((t) => { PF.gs = t; const ta = $('#gsCode'); if (ta) ta.value = t; }).catch(() => {}).finally(() => { fetchGs.busy = false; });
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
    const nd = PF.mode === 'live' ? PF.newDevices : [];
    return nd.map((d) => '<div class="card notice"><b>내 이름으로 새 기기가 승인됐어요</b><span class="muted">' + esc(d.label || '기기') + ' · ' + esc(String(d.at).slice(5, 10).replace('-', '/')) + '</span><div class="btn-row"><button type="button" class="btn danger" data-act="notMe" data-id="' + esc(d.id) + '">내가 아니에요</button><button type="button" class="btn" data-act="seenDev" data-id="' + esc(d.id) + '">확인</button></div></div>').join('') +
      '<div class="home-grid"><div><div class="hello"><span class="muted">' + (TODAY.getMonth() + 1) + '월 ' + TODAY.getDate() + '일 ' + WD[TODAY.getDay()] + '요일</span><b>지금 챙길 것 ' + t.length + '개</b></div>' +
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
      (PF.isMaster ? mi('club', 'var(--brand)', 'M8 15a4 4 0 1 0 0-.01zM11 12l8.5-8.5M16.5 6.5l3 3M14 9l2 2', '동아리 관리', '동아리 주소 · 학교 계정 · 마스터 넘기기') : '') +
      (isAdmin() ? mi('people', 'var(--done)', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 11l2 2 4-4', '부원 · 기기', '부원 추가 · 개인 코드 · 기기 승인') : '') +
      mi('settings', 'var(--club)', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z', '설정', (PF.isMaster ? '드라이브 연결 · ' : '') + '동아리 이름 · 로고 · 색 · 화면 밝기') +
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
    const st = brand(), th = prefs.theme || 'system', ed = canEditBrand(), dis = ed ? '' : ' disabled';
    return driveCard() + (ed ? '' : '<div class="card muted" style="font-size:13px">동아리 이름 · 로고 · 색은 동아리 마스터만 바꿀 수 있어요. 화면 밝기는 이 기기에서 바로 바뀝니다.</div>') +
      '<div class="card" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="logo-edit"><span class="logo" id="logoPreview">' + logoInner() + '</span><div style="display:flex;flex-direction:column;gap:6px">' + (ed ? '<label class="btn" for="logoFile" style="min-height:40px">로고 바꾸기</label><input id="logoFile" type="file" accept="image/*" hidden>' : '') + (ed && st.logo ? '<button type="button" class="chipbtn" data-act="logoClear">기본 로고로</button>' : '') + '</div></div>' +
      '<label class="field">동아리 이름<input id="clubInput" maxlength="30" value="' + esc(st.clubName) + '"' + dis + '></label>' +
      '<div class="field">대표 색<div class="swatches">' + COLORS.map((c) => '<button type="button" data-color="' + c + '" aria-label="색 ' + c + '" aria-pressed="' + (st.color === c) + '" style="background:' + c + '"' + dis + '></button>').join('') + '</div></div>' +
      '<div class="field">화면 밝기<div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => '<button type="button" data-theme="' + k + '" aria-pressed="' + (th === k) + '">' + l + '</button>').join('') + '</div></div>' +
      '</div>' +
      (PF.mode === 'live' ? '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>내 계정</b><span class="muted" style="font-size:13px">' + esc(PF.me.name) + ' · ' + esc(PF.me.role) + ' · 이 기기: ' + esc((PF.dev && PF.dev.label) || deviceLabel()) + '<br>개인 코드는 다른 기기에서 들어갈 때 학번과 함께 써요.</span><div class="btn-row"><button type="button" class="btn primary" data-act="myCode">내 개인 코드 보기</button><button type="button" class="btn" data-act="leaveDevice">이 기기에서 나가기</button></div></div>' :
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>체험 데이터</b><span class="muted" style="font-size:13px">' + (PF.club ? '동아리 드라이브 연결 전까지 실험 목록은 예시 데이터로 보여요. 이 기기에만 저장됩니다.' : '지금은 이 브라우저에만 저장돼요.') + '</span><button type="button" class="btn" data-act="reset">예시로 되돌리기</button></div>');
  }
  /* 설정 맨 위: 드라이브 연결 (동아리마다 따로) */
  function driveCard() {
    const box = (badge, body) => '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="panel-title" style="margin:0"><b style="font-size:16px;color:var(--fg)">드라이브 연결</b>' + badge + '</div>' + body + '</div>';
    if (!PF.club) return box('<span class="badge t-neutral">체험 모드</span>', '<span class="muted" style="font-size:13px;line-height:1.6">드라이브 연결은 동아리마다 따로 해요. 우리 동아리를 만들면 그 동아리의 설정에서 동아리 드라이브를 연결할 수 있어요. 지금 화면은 체험용이라 이 기기에만 저장돼요.</span><a class="btn primary" href="/new">우리 동아리 만들기</a>');
    if (PF.isMaster) { fetchGs(); return connectCard(); }
    return '';   // 부원 · 관리자에게는 보이지 않음 (연결은 동아리 마스터만)
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
  const TITLES = { line: '', item: '', board: '보드', map: '전체 지도', settings: '설정', about: '가지 소개', club: '동아리 관리', people: '부원 · 기기' };
  function logoInner() { const st = brand(); return st.logo ? '<img src="' + esc(st.logo) + '" alt="">' : '<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="' + ICON.branch + '"/></svg>'; }
  function applyBrand() {
    const st = brand();
    const pill = $('#demoPill');
    pill.hidden = GATE.has(PF.mode);
    pill.textContent = PF.mode === 'live' ? (PF.busy ? '저장 중…' : PF.me.name + (PF.me.role !== '부원' ? ' · ' + PF.me.role : '')) : PF.club ? '드라이브 연결 전' : '체험 모드';
    pill.classList.toggle('live', PF.mode === 'live');
    document.documentElement.style.setProperty('--brand', st.color || '#C26A00');
    $('#clubName').textContent = st.clubName; $('#clubLogo').innerHTML = logoInner();
    const th = prefs.theme || 'system'; if (th === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th);
  }
  const titleOf = (e) => e.s === 'line' ? lineName(e.arg) : e.s === 'item' ? (byId(e.arg) ? TYPE[byId(e.arg).type].label + ' 상세' : '') : TITLES[e.s] || '';
  function viewFor(e) { return ({ home: viewHome, tree: viewTree, find: viewFind, more: viewMore, line: () => viewLine(e.arg), item: () => viewItem(e.arg), board: viewBoard, map: viewMap, settings: viewSettings, about: viewAbout, club: viewClub, people: viewPeople }[e.s] || (() => ''))(); }
  /* 내용이 같으면 화면을 건드리지 않음 (입력 칸 · 버튼이 바뀌지 않게).
     내용이 바뀌어도 입력 중이던 칸의 글자와 커서는 그대로 살림. */
  const lastHTML = {};
  function setHTML(sel, html) {
    const el = $(sel); if (lastHTML[sel] === html && el.innerHTML) return;
    const keep = [], act = document.activeElement;
    el.querySelectorAll('input:not([type=file]):not([type=checkbox]),textarea,select').forEach((f) => { const k = (f.form ? f.form.id : '') + '|' + (f.id || f.name); if (f.value && !f.readOnly) keep.push([k, f.value]); });
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
    const ln = t.closest('[data-line]'); if (ln) return go('line', ln.dataset.line, src);
    const nw = t.closest('[data-new]'); if (nw) return newForm(nw.dataset.new);
    const tg = t.closest('[data-tab-go]'); if (tg) return tab(tg.dataset.tabGo);
    const gs = t.closest('[data-go-screen]'); if (gs) return go(gs.dataset.goScreen);
    const tm = t.closest('[data-tmode]'); if (tm) { prefs.treeMode = tm.dataset.tmode; savePrefs(); return render(); }
    if (t.closest('[data-fold]')) { prefs.showDone = !prefs.showDone; savePrefs(); return render(); }
    const ty = t.closest('[data-ty]'); if (ty) { prefs.ty = ty.dataset.ty; savePrefs(); return render(); }
    const col = t.closest('[data-color]'); if (col) return saveBrand({ color: col.dataset.color });
    const th = t.closest('button[data-theme]'); if (th) { prefs.theme = th.dataset.theme; savePrefs(); return render(); }
    const a = t.closest('[data-act]'); if (!a) return;
    const n = cur().s === 'item' ? byId(cur().arg) : null, act = a.dataset.act;
    const did = a.dataset.id;
    const copyText = (txt, done) => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(done), () => toast('길게 눌러 복사해 주세요'));
    if (act === 'retry') return startClub();
    if (act === 'pfLogin') return PF.api && PF.api.login();
    if (act === 'askApprove') return askApprove();
    if (act === 'myCode') return myCode();
    if (act === 'restartJoin') { dropDev(); PF.mode = 'join'; return render(); }
    if (act === 'leaveDevice') { if (!confirm('이 기기에서 나갈까요? 다시 들어오려면 학번 · 개인 코드와 승인이 필요해요.')) return; rpc('block', { id: PF.dev.id }).catch(() => {}); dropDev(); PF.mode = 'join'; nav = [{ s: 'home' }]; return render(true); }
    if (act === 'openApprove') return openApprove(did);
    if (act === 'approveDev' || act === 'denyDev') return devAction(act, did);
    if (act === 'addMember') return openSheet('<h3>부원 추가</h3><form id="addMemberForm" style="display:flex;flex-direction:column;gap:12px"><label class="field">학번<input name="sid" inputmode="numeric" maxlength="12" required></label><label class="field">이름<input name="name" maxlength="20" required></label><p class="muted" style="font-size:13px;margin:0">추가하면 4자리 개인 코드가 만들어져요.</p><div class="btn-row"><button type="button" class="btn" data-act="closeSheet">취소</button><button type="submit" class="btn primary">추가</button></div></form>');
    if (act === 'refreshPeople') { PF.people = null; return render(); }
    if (act === 'member') return memberSheet(did);
    if (['resetCode', 'setRole', 'setStatus', 'logoutAll'].includes(act)) return peopleAction(a);
    if (act === 'seenDev' || act === 'notMe') {
      prefs.seenDev = (prefs.seenDev || []).concat(did).slice(-20); savePrefs(); PF.newDevices = PF.newDevices.filter((x) => x.id !== did);
      if (act === 'notMe') rpc('block', { id: did }).then(() => toast('그 기기를 막았어요 · 관리자에게도 알려 주세요'), (er) => toast(er.message));
      return render();
    }
    if (act === 'copyGs') return copyGs();
    if (act === 'testConn') { rpc('ping').then((p) => { PF.connVer = p.version; PF.connAuth = false; render(); toast('연결 정상 · 연결기 ' + p.version + (verOld(p.version) ? ' · 업데이트 필요' : '')); }, (er) => { if (er.code === 'network') { PF.connAuth = true; render(); } toast(er.code === 'network' ? '연결기가 응답하지 않아요 · 아래 안내대로 권한을 허용해 주세요' : er.message); }); return; }
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
    if (!n) return;
    if (act === 'copy') { const c = code(n); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast(c + ' 복사했어요'), () => toast('번호: ' + c)); return; }
    if (act === 'fan') { n.fans = (n.fans || 0) + 1; toast('같이 해요 ' + n.fans + '명'); }
    if (act === 'volunteer') { n.volunteer = meName(); toast('담당으로 지원했어요'); }
    if (act === 'equip') { n.equip = true; toast('장비 확인 완료'); }
    if (act === 'convert') { n.type = 'exp'; n.status = '계획 작성'; n.owner = n.volunteer; n.signal = 0; n.review = 0; toast('계획서가 됐어요 · 번호 ' + code(n) + ' 그대로'); }
    if (act === 'advance') { const i = STAGES.indexOf(n.status); n.status = STAGES[i + 1]; if (n.status === '준비 중') n.signal = n.signal || 2; toast(n.status + ' 단계로 옮겼어요'); }
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
  const onKey = (src) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('g[data-go]')) { e.preventDefault(); go('item', e.target.closest('g[data-go]').dataset.go, src); } };
  $('#screen').addEventListener('keydown', onKey('main'));
  $('#paneBody').addEventListener('keydown', onKey('pane'));
  $('#screen').addEventListener('input', (e) => {
    if (e.target.id === 'q') { prefs.q = e.target.value; savePrefs(); const pos = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
    if (e.target.id === 'clubInput' && !PF.club) { db.settings.clubName = e.target.value.trim() || '실험 동아리'; save(); applyBrand(); }
  });
  $('#screen').addEventListener('change', (e) => {
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
    const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
    if (act === 'closeSheet') return closeSheet();
    if (act === 'approveDev' || act === 'denyDev') return devAction(act, a.dataset.id);
    if (['resetCode', 'setRole', 'setStatus'].includes(act)) return peopleAction(a);
    if (act === 'shareCode') { const t = a.dataset.text; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('복사했어요'), () => {}); }
  });
  $('#screen').addEventListener('submit', (e) => {
    const id = e.target.id; if (!['joinForm', 'masterJoinForm', 'connectForm'].includes(id)) return;
    e.preventDefault(); if (id === 'joinForm') submitJoin(e.target); else if (id === 'masterJoinForm') submitMasterJoin(e.target); else submitConnect(e.target);
  });
  $('#sheet').addEventListener('submit', (e) => {
    if (e.target.id === 'addMemberForm') {
      e.preventDefault(); const fd = new FormData(e.target), name = String(fd.get('name')).trim(), btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      rpc('addMember', { studentId: String(fd.get('sid')).trim(), name }).then((r) => { PF.people = null; showCode(name, r.code); render(); }, (er) => { btn.disabled = false; if (!deviceLost(er)) toast(er.message); });
      return;
    }
    e.preventDefault(); const fm = e.target, fd = new FormData(fm), type = fm.dataset.type, parent = fm.dataset.parent ? byId(fm.dataset.parent) : null;
    const title = String(fd.get('title') || '').trim(); if (!title) return;
    const f = { type, title, field: fd.get('field'), date: fd.get('date') || dstr(TODAY) };
    if (type !== 'q') { let ln = parent ? parent.line : fd.get('line'); if (!ln || ln === '__new') { ln = 'L' + Date.now().toString(36); db.lines[ln] = title.slice(0, 12); } f.line = ln; }
    if (type === 'exp') Object.assign(f, { status: '계획 작성', owner: meName(), signal: 0, review: 0 });
    if (type === 'idea') Object.assign(f, { status: '아이디어', fans: 1, volunteer: '', equip: false });
    if (type === 'q') f.status = '미해결';
    const n = create(f, parent); closeSheet(); toast(TYPE[type].label + '를 만들었어요 · ' + code(n)); go('item', n.id, 'main');
  });

  render();
})();
