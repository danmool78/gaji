// 동아리 명부 보안 규칙 시험: firebase emulators:exec --only firestore "node tests/rules.test.cjs"
const fs = require('fs'), path = require('path'), assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, collectionGroup, query, where, getDocs, addDoc, collection } = require('firebase/firestore');

let env; const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name + ' :: ' + (e && e.message)]); } }
const user = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const pub = (name) => ({ name, color: '#C26A00', createdAt: serverTimestamp() });

async function createClub(db, uid, slug, name) {
  const b = writeBatch(db);
  b.set(doc(db, 'clubs', slug), pub(name || slug));
  b.set(doc(db, 'clubs', slug, 'private', 'info'), { masterUid: uid, stats: { members: 0, experiments: 0 }, createdAt: serverTimestamp() });
  b.set(doc(db, 'masters', uid), { slugs: [slug] });
  return b.commit();
}

(async () => {
  env = await initializeTestEnvironment({ projectId: 'gaji-test', firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'system/config'), { admins: ['sys'] }); });

  await t('로그인 안 하면 동아리를 만들 수 없다', () => assertFails(createClub(anon(), 'x', 'club-a')));
  await t('마스터가 동아리를 만든다 (공개 + 비공개 + 내 목록 한 번에)', () => assertSucceeds(createClub(user('alice'), 'alice', 'bukil-sci', '가지 과학')));
  await t('같은 주소로 또 만들 수 없다', () => assertFails(createClub(user('bob'), 'bob', 'bukil-sci')));
  await t('남을 마스터로 적어서 만들 수 없다', async () => { const db = user('bob'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'club-b'), pub('b')); b.set(doc(db, 'clubs', 'club-b', 'private', 'info'), { masterUid: 'alice', createdAt: serverTimestamp() }); await assertFails(b.commit()); });
  await t('예약된 주소(demo)는 쓸 수 없다', () => assertFails(createClub(user('bob'), 'bob', 'demo')));
  await t('주소 형식이 틀리면 안 된다 (대문자)', () => assertFails(createClub(user('bob'), 'bob', 'Bad-Name')));
  await t('누구나 동아리 공개 정보를 읽는다', () => assertSucceeds(getDoc(doc(anon(), 'clubs', 'bukil-sci'))));
  await t('다른 사람은 비공개 정보를 못 읽는다', () => assertFails(getDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('마스터는 비공개 정보를 읽는다', () => assertSucceeds(getDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('시스템 마스터는 사용 현황을 읽는다', () => assertSucceeds(getDoc(doc(user('sys'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('마스터는 이름 · 색을 바꾼다', () => assertSucceeds(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { name: '가지고 과학탐구반', color: '#2F6FDB' })));
  await t('다른 사람은 이름을 못 바꾼다', () => assertFails(updateDoc(doc(user('bob'), 'clubs', 'bukil-sci'), { name: '해킹' })));
  await t('공개 정보에 다른 칸(이메일 등)을 넣을 수 없다', () => assertFails(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { email: 'a@b.c' })));
  await t('마스터는 연결기 주소를 저장한다', () => assertSucceeds(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { connector: 'https://script.google.com/macros/s/AKfy123/exec' })));
  await t('연결기 주소는 구글 스크립트 주소만', () => assertFails(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { connector: 'https://evil.example.com/exec' })));
  await t('누구나 연결기 주소를 읽는다 (부원 기기용)', () => assertSucceeds(getDoc(doc(anon(), 'clubs', 'bukil-sci'))));
  await t('마스터는 연결기 키를 저장 · 읽는다', async () => { await assertSucceeds(setDoc(doc(user('alice'), 'clubs/bukil-sci/secret/key'), { masterKey: 'K'.repeat(32) })); await assertSucceeds(getDoc(doc(user('alice'), 'clubs/bukil-sci/secret/key'))); });
  await t('시스템 마스터도 연결기 키는 못 읽는다', () => assertFails(getDoc(doc(user('sys'), 'clubs/bukil-sci/secret/key'))));
  await t('다른 사람은 연결기 키를 못 읽는다', () => assertFails(getDoc(doc(user('bob'), 'clubs/bukil-sci/secret/key'))));
  await t('마스터는 사용 현황 숫자를 올린다', () => assertSucceeds(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'), { stats: { members: 12, experiments: 30 } })));
  await t('마스터도 마스터 ID를 직접 바꿀 수 없다', () => assertFails(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'bob' })));
  await t('동아리는 지울 수 없다', () => assertFails(deleteDoc(doc(user('alice'), 'clubs', 'bukil-sci'))));

  // 마스터 넘기기
  const CODE = 'k3J9xQ2mZr7Vt8LpW4sN';
  await t('다른 사람은 넘기기 코드를 만들 수 없다', () => assertFails(setDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'handover', 'current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() + 3600e3) })));
  await t('마스터가 넘기기 코드를 만든다 (24시간)', () => assertSucceeds(setDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'handover', 'current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() + 24 * 3600e3) })));
  await t('넘기기 코드 유효기간은 하루를 넘길 수 없다', () => assertFails(setDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'handover', 'current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() + 72 * 3600e3) })));
  await t('넘겨받을 사람은 코드를 읽을 수 없다', () => assertFails(getDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'handover', 'current'))));
  await t('틀린 코드로는 넘겨받을 수 없다', async () => { const db = user('mallory'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'mallory'), { code: 'wrong-code-wrong-code' }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'mallory' }); await assertFails(b.commit()); });
  await t('코드를 지우지 않으면 넘겨받을 수 없다 (한 번만 쓰기)', async () => { const db = user('bob'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'bob'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'bob' }); await assertFails(b.commit()); });
  await t('맞는 코드로 넘겨받는다 (같은 묶음에서 코드 지움)', async () => { const db = user('bob'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'bob'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'bob' }); b.delete(doc(db, 'clubs', 'bukil-sci', 'handover', 'current')); await assertSucceeds(b.commit()); });
  await t('넘긴 뒤 예전 마스터는 비공개 정보를 못 읽는다', () => assertFails(getDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('쓴 코드로 다른 사람이 또 넘겨받을 수 없다', async () => { const db = user('carol'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'carol'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'carol' }); b.delete(doc(db, 'clubs', 'bukil-sci', 'handover', 'current')); await assertFails(b.commit()); });
  await t('예전 마스터가 쓴 코드로 되찾을 수 없다', async () => { const db = user('alice'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'alice'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'alice' }); await assertFails(b.commit()); });
  await t('남이 아무 때나 넘기기 코드를 지울 수 없다', async () => { await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'clubs/bukil-sci/handover/current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() + 3600e3) }); }); await assertFails(deleteDoc(doc(user('mallory'), 'clubs', 'bukil-sci', 'handover', 'current'))); });
  await t('새 마스터는 넘기기 코드를 지운다', () => assertSucceeds(deleteDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'handover', 'current'))));
  await t('만료된 코드로는 넘겨받을 수 없다', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'clubs/bukil-sci/handover/current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() - 1000) }); });
    const db = user('eve'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'eve'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'eve' }); await assertFails(b.commit()); });
  await t('시스템 마스터는 복구를 위해 마스터를 바꿀 수 있다', () => assertSucceeds(updateDoc(doc(user('sys'), 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'carol' })));
  await t('시스템 설정은 아무도 앱에서 못 바꾼다', () => assertFails(setDoc(doc(user('sys'), 'system/config'), { admins: ['sys', 'bob'] })));
  await t('내 동아리 목록은 본인만 읽는다', () => assertFails(getDoc(doc(user('bob'), 'masters', 'alice'))));

  await t('logo must be an image data URL', async () => {
    const db = user('uLogo'); await createClub(db, 'uLogo', 'logo-club', '로고 시험');
    await assertFails(updateDoc(doc(db, 'clubs', 'logo-club'), { logo: 'javascript:alert(1)' }));
    await assertFails(updateDoc(doc(db, 'clubs', 'logo-club'), { logo: 'https://evil.example/x.png' }));
    await assertSucceeds(updateDoc(doc(db, 'clubs', 'logo-club'), { logo: 'data:image/png;base64,iVBORw0KGgo=' }));
    await assertSucceeds(updateDoc(doc(db, 'clubs', 'logo-club'), { color2: '#FFFFCC' }));
    await assertFails(updateDoc(doc(db, 'clubs', 'logo-club'), { color2: 'red' }));
  });


  // ---------- 가지에 문의하기 (마스터 ↔ 시스템) ----------
  await t('문의용 동아리 만들기', () => assertSucceeds(createClub(user('sup-m'), 'sup-m', 'sup-club', '문의 동아리')));
  const msg = (from, uid, text) => ({ from, text: text || '백업 메일이 안 와요', at: serverTimestamp(), uid });
  await t('마스터는 문의를 쓴다', () => assertSucceeds(addDoc(collection(user('sup-m'), 'clubs', 'sup-club', 'support'), msg('master', 'sup-m'))));
  await t('마스터는 문의를 읽는다', () => assertSucceeds(getDocs(collection(user('sup-m'), 'clubs', 'sup-club', 'support'))));
  await t('다른 사람은 문의를 못 읽는다', () => assertFails(getDocs(collection(user('eve'), 'clubs', 'sup-club', 'support'))));
  await t('로그인 안 하면 못 읽는다', () => assertFails(getDocs(collection(anon(), 'clubs', 'sup-club', 'support'))));
  await t('다른 사람은 문의를 못 쓴다', () => assertFails(addDoc(collection(user('eve'), 'clubs', 'sup-club', 'support'), msg('master', 'eve'))));
  await t('마스터는 운영자 이름으로 못 쓴다', () => assertFails(addDoc(collection(user('sup-m'), 'clubs', 'sup-club', 'support'), msg('system', 'sup-m'))));
  await t('남의 uid 로 못 쓴다', () => assertFails(addDoc(collection(user('sup-m'), 'clubs', 'sup-club', 'support'), msg('master', 'sys'))));
  await t('2000자 넘으면 못 쓴다', () => assertFails(addDoc(collection(user('sup-m'), 'clubs', 'sup-club', 'support'), msg('master', 'sup-m', 'x'.repeat(2001)))));
  await t('시스템 마스터는 답장을 쓴다', () => assertSucceeds(addDoc(collection(user('sys'), 'clubs', 'sup-club', 'support'), msg('system', 'sys', '확인해 볼게요'))));
  await t('시스템 마스터는 모든 문의를 모아 읽는다', () => assertSucceeds(getDocs(collectionGroup(user('sys'), 'support'))));
  await t('마스터는 모든 동아리 문의를 모아 못 읽는다', () => assertFails(getDocs(collectionGroup(user('sup-m'), 'support'))));
  await t('문의는 고칠 수 없다', async () => { const ds = await getDocs(collection(user('sup-m'), 'clubs', 'sup-club', 'support')); await assertFails(updateDoc(ds.docs[0].ref, { text: '바꿈' })); });

  // ---------- 보안 점검 뒤 추가 ----------
  await t('누구나 동아리 목록 전체를 가져갈 수는 없다', () => assertFails(getDocs(collection(anon(), 'clubs'))));
  await t('로그인해도 동아리 목록 전체는 못 가져간다', () => assertFails(getDocs(collection(user('eve'), 'clubs'))));
  await t('동아리 주소로 공개 정보는 본다', () => assertSucceeds(getDoc(doc(anon(), 'clubs', 'sup-club'))));
  await t('시스템 마스터는 동아리 목록을 본다', () => assertSucceeds(getDocs(collection(user('sys'), 'clubs'))));
  await t('시스템 마스터는 연결기 주소를 못 바꾼다', () => assertFails(updateDoc(doc(user('sys'), 'clubs', 'sup-club'), { connector: 'https://script.google.com/macros/s/EVIL/exec' })));
  await t('시스템 마스터는 이름은 고칠 수 있다(복구)', () => assertSucceeds(updateDoc(doc(user('sys'), 'clubs', 'sup-club'), { name: '문의 동아리 (고침)' })));
  await t('사용 현황 칸은 16개까지', () => assertFails(updateDoc(doc(user('sup-m'), 'clubs', 'sup-club', 'private', 'info'), { stats: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, i])) })));

  // ---------- 두 번째 점검 뒤 ----------
  await t('동아리를 만들 때 내 목록에 안 넣으면 못 만든다', async () => { const db = user('zed'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'zed-club'), pub('z')); b.set(doc(db, 'clubs', 'zed-club', 'private', 'info'), { masterUid: 'zed', createdAt: serverTimestamp() }); await assertFails(b.commit()); });
  await t('시스템 마스터는 자기 자신을 마스터로 못 바꾼다', () => assertFails(updateDoc(doc(user('sys'), 'clubs', 'sup-club', 'private', 'info'), { masterUid: 'sys' })));
  await t('시스템 마스터는 마스터 외 칸은 못 바꾼다', () => assertFails(updateDoc(doc(user('sys'), 'clubs', 'sup-club', 'private', 'info'), { masterUid: 'other', stats: {} })));
  await t('넘기기 코드가 없는 동아리에는 넘겨받기 칸을 못 쓴다', () => assertFails(setDoc(doc(user('eve'), 'clubs', 'nope-nope', 'claims', 'eve'), { code: 'x'.repeat(30) })));
  await t('사용 현황 숫자 칸에 글자를 못 넣는다', () => assertFails(updateDoc(doc(user('sup-m'), 'clubs', 'sup-club', 'private', 'info'), { 'stats.members': '<img>' })));
  await t('사용 현황 숫자는 넣는다', () => assertSucceeds(updateDoc(doc(user('sup-m'), 'clubs', 'sup-club', 'private', 'info'), { 'stats.members': 5, 'stats.lastEdit': '2026-11-18', 'stats.backupErr': false })));
  await t('마스터는 새 키를 먼저 pendingKey 로 저장한다', () => assertSucceeds(setDoc(doc(user('sup-m'), 'clubs', 'sup-club', 'secret', 'key'), { masterKey: 'k'.repeat(30), pendingKey: 'p'.repeat(40) })));
  await t('키 칸에 다른 이름은 못 넣는다', () => assertFails(setDoc(doc(user('sup-m'), 'clubs', 'sup-club', 'secret', 'key'), { masterKey: 'k'.repeat(30), other: 'x'.repeat(30) })));
  await env.cleanup();
  let fail = 0; for (const [s, n] of results) { console.log((s === 'ok' ? '  ✓ ' : '  ✗ ') + n); if (s !== 'ok') fail++; }
  console.log(`\n${results.length - fail}/${results.length} passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

