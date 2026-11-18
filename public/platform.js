// 가지 · 플랫폼 (Firebase): 첫 화면 · 동아리 만들기 · 동아리 주소 · 마스터 넘기기 · 시스템 사용 현황
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, writeBatch, updateDoc, setDoc, deleteDoc, serverTimestamp, Timestamp, arrayUnion, addDoc, query, orderBy, limit, collectionGroup } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const fb = initializeApp(window.GAJI_FIREBASE);
const auth = getAuth(fb);
const db = getFirestore(fb);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = 'v0.3';
const COLORS = ['#C26A00', '#2F6FDB', '#1F8F5A', '#6E4FE0', '#D2394B', '#475467'];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;
const RESERVED = ['demo', 'system', 'admin', 'api', 'www', 'gaji'];
const LOGO = '<svg viewBox="96 56 340 396" class="gaji-mark"><g fill="#fff" fill-opacity=".72" stroke="none"><path d="M0 0C26-30 74-34 104-6C74 22 28 26 0 0Z" transform="translate(138 222) rotate(-132)"/><path d="M0 0C26-30 74-34 104-6C74 22 28 26 0 0Z" transform="translate(402 290) rotate(28)"/><path d="M0 0C22-26 62-28 88-6C62 18 24 22 0 0Z" transform="translate(330 182) rotate(-12)"/></g><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="M164 432C190 356 228 304 284 254C326 216 356 176 368 128" stroke-width="42"/><path d="M232 318C196 292 164 262 140 222" stroke-width="30"/><path d="M298 240C334 246 368 262 400 288" stroke-width="28"/></g><g fill="#E9FF8F" stroke="none"><path d="M0 0C16-20 48-24 68-6C48 12 18 16 0 0Z" transform="translate(366 122) rotate(-128)"/><path d="M0 0C16-20 48-24 68-6C48 12 18 16 0 0Z" transform="translate(370 122) rotate(-58)"/></g></svg>';

let user = null;
const authReady = new Promise((res) => onAuthStateChanged(auth, (u) => { user = u; if (window.GAJI_APP && window.GAJI_APP.dbg) window.GAJI_APP.dbg('로그인변화'); res(); render(); }));

async function login() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, p); if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('로그인하지 못했어요'); }
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400); }
function randomCode(n) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, (x) => a[x % a.length]).join(''); }

/* ---------- 경로 ---------- */
const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
const route = parts[0] === 'c' && parts[1] ? { page: 'club', slug: decodeURIComponent(parts[1]).toLowerCase() } : parts[0] === 'new' ? { page: 'new' } : parts[0] === 'system' ? { page: 'system' } : { page: 'landing' };
const params = new URLSearchParams(location.search);

/* 포털(첫 화면 · 만들기 · 시스템) ↔ 동아리 앱 전환 */
// 가지 첫 화면 · 만들기 · 로그인 화면은 언제나 가지 기본 색 (체험이나 동아리에서 고른 색이 넘어오지 않게)
function gajiColors() { window.GAJI_PORTAL = true; const R = document.documentElement.style; R.setProperty('--brand', '#1F8F5A'); R.setProperty('--on-brand', '#FFFFFF'); R.setProperty('--brand-soft', '#E6F4EC'); R.setProperty('--brand-2', '#FFFFFF'); }
function portal(html) { gajiColors(); $('.app').hidden = true; const p = $('#portal'); p.hidden = false; p.innerHTML = '<div class="portal">' + html + '</div>'; }
function showApp() { window.GAJI_PORTAL = false; $('#portal').hidden = true; $('.app').hidden = false; }
const head = (sub) => '<header class="p-head"><a class="p-brand" href="/"><span class="logo">' + LOGO + '</span><span><b>가지</b><small>' + esc(sub || '실험이 가지를 치며 이어지는 곳') + '</small></span></a>' +
  (user ? '<button type="button" class="chipbtn" data-p="logout">로그아웃</button>' : '<button type="button" class="chipbtn" data-p="login" title="동아리 마스터 · 시스템 관리용 구글 로그인 (부원은 동아리 주소에서 학번 · 코드로 들어가요)">마스터 로그인</button>') + '</header>';

/* ---------- 첫 화면 ---------- */
/* 마스터로 있는 동아리 (없으면 빈 배열) */
async function myClubs() {
  if (!user) return [];
  const m = await getDoc(doc(db, 'masters', user.uid)).catch(() => null);
  const slugs = (m && m.exists() && m.data().slugs) || [];
  return (await Promise.all(slugs.map((s) => getDoc(doc(db, 'clubs', s)).catch(() => null)))).filter((d) => d && d.exists());
}
const clubList = (clubs) => clubs.map((d) => '<a class="menu-item" href="/c/' + esc(d.id) + '"><span class="logo" style="background:' + esc(d.data().color) + '">' + (d.data().logo ? '<img src="' + esc(d.data().logo) + '" alt="">' : LOGO) + '</span><span class="tx"><b>' + esc(d.data().name) + '</b><small class="code">/c/' + esc(d.id) + '</small></span></a>').join('');
async function landing() {
  let mine = '';
  if (user) {
    const [clubs, sys] = await Promise.all([myClubs(), getDoc(doc(db, 'system', 'config')).then((d) => d.exists(), () => false)]);   // 시스템 마스터만 읽을 수 있음
    mine = (sys ? '<a class="menu-item sys-link" href="/system"><span class="logo" style="background:#344054">' + LOGO + '</span><span class="tx"><b>시스템 관리</b><small class="code">' + esc(location.origin) + '/system · 동아리 현황 · 마스터 문의</small></span></a>' : '') +
      '<h2 class="sec">내 동아리 <small>마스터로 있는 동아리</small></h2>' + (clubs.length ? clubList(clubs) : '<div class="card muted" style="font-size:14px">아직 마스터로 있는 동아리가 없어요.</div>');
  }
  portal(head() +
    '<section class="p-hero"><h1>실험이 가지를 치며<br>이어지는 곳</h1><p>계획서 · 준비 · 측정 · 결과, 그리고 다음 실험까지. 실패한 실험도 다음 실험의 씨앗으로 남는 고등학교 실험 동아리 연구 관리 도구입니다.</p></section>' +
    '<div class="p-video"><div class="vimeo"><iframe src="https://player.vimeo.com/video/1247842965?title=0&amp;byline=0&amp;portrait=0&amp;dnt=1" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" title="가지 소개 영상" loading="lazy"></iframe></div><span class="muted">가지 소개 영상 · 1분 34초</span></div>' +
    '<div class="p-actions"><a class="btn primary" href="/c/demo">체험해 보기</a><button type="button" class="btn" data-p="create">우리 동아리 만들기</button></div>' +
    mine +
    '<div class="card p-note p-note-drive"><svg class="p-drive" viewBox="0 0 87.3 78" aria-label="구글 드라이브" role="img"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg><div><b>데이터는 각 동아리 구글 드라이브에만</b><span>가지 서버에는 동아리 이름 · 로고와 마스터 한 명의 계정 ID, 사용 현황 숫자만 저장돼요. 제작자도 동아리 기록을 볼 수 없습니다.</span></div></div>' +
    '<p class="p-foot">가지 ' + VERSION + ' · 동아리 주소는 관리자에게 받으세요</p>');
}

/* ---------- 동아리 만들기 (마스터) ---------- */
async function createPage() {
  if (!user) return portal(head('우리 동아리 만들기') + '<div class="card p-form"><b style="font-size:18px">동아리 마스터로 시작하기</b><p class="muted">동아리를 만드는 사람이 마스터가 됩니다. 구글 계정으로 로그인해 주세요. 학교 계정을 권장해요.</p><button type="button" class="btn primary" data-p="login">구글로 로그인</button></div>');
  const clubs = await myClubs();
  portal(head('우리 동아리 만들기') +
    (clubs.length ? '<h2 class="sec">내 동아리 <small>이미 마스터로 있는 동아리예요 · 누르면 들어가요</small></h2>' + clubList(clubs) + '<h2 class="sec">새 동아리 만들기 <small>다른 동아리를 하나 더 만들 때만</small></h2>' : '') +
    '<form class="card p-form" id="createForm"><b style="font-size:18px">새 동아리</b>' +
    '<label class="field">동아리 이름<input name="name" maxlength="30" required placeholder="예: ○○고 과학탐구반"></label>' +
    '<label class="field">동아리 주소 <span class="muted" style="font-weight:400">영문 소문자 · 숫자 · - (3~30자)</span><input name="slug" maxlength="30" required placeholder="예: gaji-sci" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
    '<span class="code muted" id="slugPreview" style="font-size:13px">' + esc(location.origin) + '/c/…</span>' +
    '<div class="field">대표 색<div class="swatches">' + COLORS.map((c, i) => '<button type="button" data-pc="' + c + '" aria-label="색 ' + c + '" aria-pressed="' + (i === 0) + '" style="background:' + c + '"></button>').join('') + '</div></div>' +
    '<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.6"><input type="checkbox" name="agree" required style="width:20px;height:20px;margin-top:2px">동아리 기록은 우리 학교 구글 드라이브에 저장되고, 가지 서버에는 동아리 이름 · 로고 · 마스터 계정 ID · 사용 현황 숫자만 저장되는 것을 확인했어요.</label>' +
    '<button type="submit" class="btn primary">동아리 만들기</button><span class="muted" style="font-size:12px;line-height:1.6">다음 화면에서 동아리 구글 드라이브를 연결해요 (컴퓨터에서 10분).</span></form>');
}
async function submitCreate(f) {
  const fd = new FormData(f), name = String(fd.get('name')).trim(), slug = String(fd.get('slug')).trim().toLowerCase(), domain = String(fd.get('domain') || '').trim().toLowerCase().replace(/^@/, '');
  const color = (f.querySelector('[data-pc][aria-pressed="true"]') || {}).dataset?.pc || COLORS[0];
  if (!SLUG_RE.test(slug) || RESERVED.includes(slug)) return toast('주소는 영문 소문자 · 숫자 · - 로 3~30자예요');
  const btn = f.querySelector('[type=submit]'); btn.disabled = true;
  try {
    if ((await getDoc(doc(db, 'clubs', slug))).exists()) { btn.disabled = false; return toast('이미 쓰는 주소예요. 다른 주소를 골라 주세요'); }
    const b = writeBatch(db);
    b.set(doc(db, 'clubs', slug), { name, color, createdAt: serverTimestamp(), version: VERSION });
    b.set(doc(db, 'clubs', slug, 'private', 'info'), Object.assign({ masterUid: user.uid, stats: { members: 0, experiments: 0, lastActive: serverTimestamp(), version: VERSION }, createdAt: serverTimestamp() }, domain ? { domain } : {}));
    b.set(doc(db, 'masters', user.uid), { slugs: arrayUnion(slug) }, { merge: true });
    await b.commit();
    location.href = '/c/' + slug + '?welcome=1';
  } catch (e) { console.error(e); btn.disabled = false; toast('만들지 못했어요 · 다시 시도해 주세요'); }
}

/* ---------- 동아리 주소 ---------- */
async function clubPage(slug) {
  if (slug === 'demo') { showApp(); return; }
  const snap = await getDoc(doc(db, 'clubs', slug)).catch(() => null);
  if (!snap || !snap.exists()) return portal(head() + '<div class="card p-form"><b style="font-size:18px">동아리를 찾을 수 없어요</b><p class="muted">주소 <span class="code">/c/' + esc(slug) + '</span> 를 다시 확인해 주세요.</p><a class="btn" href="/">처음으로</a></div>');
  const club = Object.assign({}, snap.data());
  try { localStorage.setItem('gaji-club:' + slug, JSON.stringify({ name: club.name, color: club.color, color2: club.color2 || '', logo: club.logo || '', connector: club.connector || '' })); } catch (e) {}
  const code = params.get('handover');
  if (code) return handoverPage(slug, club, code);
  let isMaster = false;
  if (user) {
    const info = await getDoc(doc(db, 'clubs', slug, 'private', 'info')).catch(() => null);
    if (info && info.exists()) { isMaster = true; club.domain = info.data().domain || '';
      updateDoc(info.ref, { 'stats.lastActive': serverTimestamp(), 'stats.version': VERSION }).catch(() => {});
      const k = await getDoc(doc(db, 'clubs', slug, 'secret', 'key')).catch(() => null);
      club.masterKey = k && k.exists() ? k.data().masterKey : ''; }
  }
  const api = {
    savePublic: (patch) => { const p = {}; if ('name' in patch) p.name = patch.name; if ('color' in patch) p.color = patch.color; if ('color2' in patch) p.color2 = patch.color2; if ('logo' in patch) p.logo = patch.logo; return updateDoc(doc(db, 'clubs', slug), p); },
    saveInfo: (patch) => updateDoc(doc(db, 'clubs', slug, 'private', 'info'), patch.domain ? { domain: patch.domain } : { domain: '' }),
    newKey: () => randomCode(40),
    saveConnector: async (url, key) => {
      const b = writeBatch(db);
      b.update(doc(db, 'clubs', slug), { connector: url });
      if (key) b.set(doc(db, 'clubs', slug, 'secret', 'key'), { masterKey: key });
      await b.commit(); club.connector = url; if (key) club.masterKey = key;
    },
    saveStats: (st) => { const n = (k) => Math.max(0, Math.min(100000, st[k] | 0)), d = (k) => /^\d{4}-\d\d-\d\d$/.test(st[k] || '') ? st[k] : '';
      return updateDoc(doc(db, 'clubs', slug, 'private', 'info'), { 'stats.members': n('members'), 'stats.experiments': n('experiments'), 'stats.ideas': n('ideas'), 'stats.done': n('done'), 'stats.running': n('running'),
        'stats.devices': n('devices'), 'stats.waiting': n('waiting'), 'stats.lastEdit': d('lastEdit'), 'stats.backupAt': d('backupAt'), 'stats.backupErr': !!st.backupErr, 'stats.core': String(st.core || '').slice(0, 12), 'stats.lastActive': serverTimestamp() }); },
    login: () => login(),
    // 가지에 문의하기 (마스터 ↔ 시스템)
    supportList: async () => (await getDocs(query(collection(db, 'clubs', slug, 'support'), orderBy('at', 'asc'), limit(200)))).docs.map((d) => ({ id: d.id, from: d.data().from, text: d.data().text, at: d.data().at && d.data().at.toDate ? d.data().at.toDate().toISOString() : '' })),
    supportSend: (text) => addDoc(collection(db, 'clubs', slug, 'support'), { from: 'master', text: String(text).slice(0, 2000), at: serverTimestamp(), uid: user.uid }),
    createHandover: async () => {
      const code = randomCode(28), until = new Date(Date.now() + 24 * 3600e3);
      await setDoc(doc(db, 'clubs', slug, 'handover', 'current'), { code, expiresAt: Timestamp.fromDate(until) });
      return { link: location.origin + '/c/' + slug + '?handover=' + code, until: until.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    }
  };
  showApp();
  window.GAJI_APP.setClub(club, isMaster, api, slug);
  if (params.get('welcome')) {
    history.replaceState(null, '', '/c/' + slug);
    if (isMaster && !club.connector) { window.GAJI_APP.open('settings'); window.GAJI_APP.toast('동아리를 만들었어요! 이제 동아리 드라이브를 연결해 주세요'); }
    else window.GAJI_APP.toast(isMaster ? '마스터가 됐어요! 이 기기를 연결해 주세요' : '동아리를 열었어요');
  }
}

/* ---------- 마스터 넘겨받기 ---------- */
function handoverPage(slug, club, code) {
  const box = '<div class="card p-form"><span class="logo" style="background:' + esc(club.color) + ';width:56px;height:56px">' + (club.logo ? '<img src="' + esc(club.logo) + '" alt="">' : LOGO) + '</span><b style="font-size:18px">' + esc(club.name) + ' 마스터 넘겨받기</b>';
  if (!user) return portal(head() + box + '<p class="muted">이 동아리의 새 마스터가 됩니다. 구글 계정으로 로그인해 주세요. 링크는 만든 뒤 24시간 동안만 쓸 수 있어요.</p><button type="button" class="btn primary" data-p="login">구글로 로그인</button></div>');
  portal(head() + box + '<p class="muted">로그인한 계정으로 이 동아리의 마스터를 넘겨받습니다. 예전 마스터는 더 이상 관리할 수 없게 돼요.</p><button type="button" class="btn primary" data-p="claim" data-slug="' + esc(slug) + '" data-code="' + esc(code) + '">넘겨받기</button><a class="btn" href="/">취소</a></div>');
}
async function claim(slug, code) {
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'clubs', slug, 'claims', user.uid), { code });
    b.update(doc(db, 'clubs', slug, 'private', 'info'), { masterUid: user.uid });
    await b.commit();
    await Promise.all([
      setDoc(doc(db, 'masters', user.uid), { slugs: arrayUnion(slug) }, { merge: true }),
      deleteDoc(doc(db, 'clubs', slug, 'handover', 'current')).catch(() => {}),
      deleteDoc(doc(db, 'clubs', slug, 'claims', user.uid)).catch(() => {})
    ]);
    location.href = '/c/' + slug + '?welcome=1';
  } catch (e) { console.error(e); toast('넘겨받지 못했어요 · 링크가 만료됐거나 이미 쓰였어요'); }
}

/* ---------- 시스템 사용 현황 (시스템 마스터) ---------- */
async function systemPage() {
  if (!user) return portal(head('시스템 관리') + '<div class="card p-form"><b style="font-size:18px">시스템 관리</b><p class="muted">시스템 마스터만 들어올 수 있어요.</p><button type="button" class="btn primary" data-p="login">구글로 로그인</button></div>');
  const cfg = await getDoc(doc(db, 'system', 'config')).catch(() => null);
  if (!cfg || !cfg.exists()) return portal(head('시스템 관리') + '<div class="card p-form"><b style="font-size:18px">권한이 없어요</b><p class="muted">시스템 마스터로 등록되지 않은 계정입니다. 처음 설정 중이라면 아래 계정 ID를 등록해 주세요.</p><span class="code" style="user-select:all;word-break:break-all">' + esc(user.uid) + '</span></div>');
  const clubs = await getDocs(collection(db, 'clubs'));
  const rows = await Promise.all(clubs.docs.map(async (d) => { const i = await getDoc(doc(db, 'clubs', d.id, 'private', 'info')).catch(() => null); return { id: d.id, pub: d.data(), info: i && i.exists() ? i.data() : {} }; }));
  const now = Date.now(), day = (t) => t && t.toDate ? Math.floor((now - t.toDate()) / 864e5) : null, dday = (iso) => iso ? Math.floor((now - Date.parse(iso + 'T00:00:00')) / 864e5) : null;
  rows.sort((a, b) => (day(a.info.stats?.lastActive) ?? 9e9) - (day(b.info.stats?.lastActive) ?? 9e9));
  const S = (r) => r.info.stats || {}, tot = (k) => rows.reduce((a, r) => a + (+S(r)[k] || 0), 0);
  const linked = rows.filter((r) => r.pub.connector).length, active = rows.filter((r) => (day(S(r).lastActive) ?? 999) <= 14).length;
  const newer = rows.filter((r) => (day(r.pub.createdAt) ?? 999) <= 30).length, newest = rows.map((r) => S(r).core).filter(Boolean).sort().pop() || '';
  const ago = (n) => n === null ? '-' : n <= 0 ? '오늘' : n + '일 전';
  const flags = (r) => { const s = S(r), f = [];
    if (!r.pub.connector) f.push(['t-warn', '드라이브 연결 전']);
    if ((day(s.lastActive) ?? 999) > 30 && r.pub.connector) f.push(['t-neutral', '30일 넘게 안 씀']);
    if (s.backupErr) f.push(['t-bad', '백업 오류']); else if (r.pub.connector && (dday(s.backupAt) ?? 999) > 10) f.push(['t-warn', '백업 오래됨']);
    if (s.waiting) f.push(['t-info', '기기 승인 대기 ' + s.waiting]);
    if (s.core && newest && s.core !== newest) f.push(['t-neutral', '연결기 ' + s.core]);
    return f.map((x) => '<span class="badge ' + x[0] + '">' + esc(x[1]) + '</span>').join(' '); };
  const tile = (k, v, sub) => '<div class="card"><small>' + k + '</small><b>' + v + '</b>' + (sub ? '<span class="muted" style="font-size:12px">' + sub + '</span>' : '') + '</div>';
  portal(head('시스템 관리 · 사용 현황') +
    '<div class="p-stats">' + tile('동아리', rows.length, '최근 30일 새로 ' + newer) + tile('드라이브 연결', linked, '연결 전 ' + (rows.length - linked)) + tile('최근 2주 사용', active, '마스터 접속 기준') +
      tile('부원', tot('members'), '승인된 기기 ' + tot('devices')) + tile('실험', tot('experiments'), '진행 ' + tot('running') + ' · 완료 ' + tot('done')) + tile('아이디어', tot('ideas')) + '</div>' +
    '<div class="card" style="padding:0;overflow-x:auto"><table class="p-table"><thead><tr><th>동아리</th><th>만든 날</th><th>부원</th><th>실험 (진행 · 완료)</th><th>마지막 수정</th><th>마스터 접속</th><th>백업</th><th>살펴볼 것</th></tr></thead><tbody>' +
    rows.map((r) => { const s = S(r), d = day(s.lastActive);
      return '<tr><td><b>' + esc(r.pub.name) + '</b><br><a class="code muted" href="/c/' + esc(r.id) + '" target="_blank" rel="noopener">/c/' + esc(r.id) + '</a></td><td>' + (r.pub.createdAt?.toDate ? r.pub.createdAt.toDate().toLocaleDateString('ko-KR') : '-') + '</td>' +
        '<td class="code">' + (s.members ?? '-') + '</td><td class="code">' + (s.experiments ?? '-') + (s.experiments ? ' (' + (s.running || 0) + ' · ' + (s.done || 0) + ')' : '') + '</td>' +
        '<td>' + ago(dday(s.lastEdit)) + '</td><td>' + ago(d) + '</td><td>' + (s.backupErr ? '오류' : ago(dday(s.backupAt))) + '</td><td>' + (flags(r) || '<span class="muted">-</span>') + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="p-foot">숫자는 각 동아리 마스터가 가지를 열 때 새로 받아요. 사람 이름 · 이메일 · 학번 · 실험 내용은 보이지 않아요.</p>' + await supportAdmin(rows));
}
/* 시스템: 마스터 문의 (동아리별 대화 · 답장) */
async function supportAdmin(rows) {
  const all = (await getDocs(query(collectionGroup(db, 'support'), orderBy('at', 'desc'), limit(300))).catch((e) => ({ docs: [], err: e }))).docs || [];
  const by = {}; all.forEach((d) => { const slug = d.ref.parent.parent.id; (by[slug] = by[slug] || []).push({ from: d.data().from, text: d.data().text, at: d.data().at && d.data().at.toDate ? d.data().at.toDate() : null }); });
  const name = (slug) => ((rows.find((r) => r.id === slug) || {}).pub || {}).name || slug;
  const slugs = Object.keys(by).sort((a, b) => (by[b][0].at || 0) - (by[a][0].at || 0));
  const when = (t) => t ? t.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return '<h2 class="sec">마스터 문의 <small>' + (slugs.filter((s) => by[s][0].from === 'master').length ? '답장 기다리는 동아리 ' + slugs.filter((s) => by[s][0].from === 'master').length + '곳' : '모두 답했어요') + '</small></h2>' +
    (slugs.length ? slugs.map((s) => '<div class="card sup-box"><div class="sup-h"><b>' + esc(name(s)) + '</b><span class="code muted">/c/' + esc(s) + '</span>' + (by[s][0].from === 'master' ? '<span class="badge t-warn">답장 필요</span>' : '') + '</div>' +
      '<div class="sup-thread">' + by[s].slice(0, 20).reverse().map((m) => '<div class="sup-msg ' + m.from + '"><p>' + esc(m.text).replace(/\n/g, '<br>') + '</p><small>' + (m.from === 'system' ? '가지' : '마스터') + ' · ' + when(m.at) + '</small></div>').join('') + '</div>' +
      '<form class="sup-form" data-sup="' + esc(s) + '"><textarea name="text" rows="2" maxlength="2000" required placeholder="답장 쓰기"></textarea><button type="submit" class="btn primary">답장</button></form></div>').join('')
      : '<div class="card muted" style="font-size:14px">아직 문의가 없어요.</div>');
}

document.addEventListener('submit', async (e) => {
  const f = e.target.closest && e.target.closest('form[data-sup]'); if (!f) return;
  e.preventDefault(); const t = String(new FormData(f).get('text') || '').trim(); if (!t) return;
  f.querySelector('button').disabled = true;
  try { await addDoc(collection(db, 'clubs', f.dataset.sup, 'support'), { from: 'system', text: t.slice(0, 2000), at: serverTimestamp(), uid: user.uid }); toast('답장했어요'); systemPage(); }
  catch (x) { f.querySelector('button').disabled = false; toast('보내지 못했어요: ' + (x.message || x)); }
});
/* ---------- 그리기 · 이벤트 ---------- */
async function render() {
  if (route.page === 'club') return clubPage(route.slug);
  if (route.page === 'new') return createPage();
  if (route.page === 'system') return systemPage();
  return landing();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'), c = e.target.closest('[data-pc]');
  if (c) { document.querySelectorAll('[data-pc]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); return; }
  if (!b) return;
  const a = b.dataset.p;
  if (a === 'login') return login();
  if (a === 'logout') return signOut(auth).then(() => location.reload());
  if (a === 'create') { if (location.pathname !== '/new') location.href = '/new'; return; }
  if (a === 'claim') return claim(b.dataset.slug, b.dataset.code);
});
document.addEventListener('submit', (e) => { if (e.target.id === 'createForm') { e.preventDefault(); submitCreate(e.target); } });
document.addEventListener('input', (e) => { if (e.target.name === 'slug' && $('#slugPreview')) { const v = e.target.value.toLowerCase(); e.target.value = v; $('#slugPreview').textContent = location.origin + '/c/' + (v || '…') + (v && (!SLUG_RE.test(v) || RESERVED.includes(v)) ? '  (형식 확인)' : ''); } });

// 처음 그리기: 동아리 체험 화면은 로그인 확인을 기다리지 않음
if (route.page === 'club' && route.slug === 'demo') showApp();
else {
  // 이 기기에서 연 적 있는 동아리는 저장해 둔 이름 · 연결기 주소로 바로 열고, 로그인 · 명부 확인은 뒤에서
  if (route.page === 'club' && !params.get('handover')) {
    try { const c = JSON.parse(localStorage.getItem('gaji-club:' + route.slug) || 'null'); const dv = JSON.parse(localStorage.getItem('gaji-dev:' + route.slug) || 'null'); if (c && c.connector && dv && dv.url === c.connector) { showApp(); window.GAJI_APP.setClub(c, false, null, route.slug); } } catch (e) {}
  }
  authReady.then(() => {});
}
