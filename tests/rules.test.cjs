// 동아리 명부 보안 규칙 시험: firebase emulators:exec --only firestore "node tests/rules.test.cjs"
const fs = require('fs'), path = require('path'), assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, collectionGroup, query, where, getDocs } = require('firebase/firestore');

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
  await t('마스터가 동아리를 만든다 (공개 + 비공개 + 내 목록 한 번에)', () => assertSucceeds(createClub(user('alice'), 'alice', 'bukil-sci', '북일 과학')));
  await t('같은 주소로 또 만들 수 없다', () => assertFails(createClub(user('bob'), 'bob', 'bukil-sci')));
  await t('남을 마스터로 적어서 만들 수 없다', async () => { const db = user('bob'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'club-b'), pub('b')); b.set(doc(db, 'clubs', 'club-b', 'private', 'info'), { masterUid: 'alice', createdAt: serverTimestamp() }); await assertFails(b.commit()); });
  await t('예약된 주소(demo)는 쓸 수 없다', () => assertFails(createClub(user('bob'), 'bob', 'demo')));
  await t('주소 형식이 틀리면 안 된다 (대문자)', () => assertFails(createClub(user('bob'), 'bob', 'Bad-Name')));
  await t('누구나 동아리 공개 정보를 읽는다', () => assertSucceeds(getDoc(doc(anon(), 'clubs', 'bukil-sci'))));
  await t('다른 사람은 비공개 정보를 못 읽는다', () => assertFails(getDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('마스터는 비공개 정보를 읽는다', () => assertSucceeds(getDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('시스템 마스터는 사용 현황을 읽는다', () => assertSucceeds(getDoc(doc(user('sys'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('마스터는 이름 · 색을 바꾼다', () => assertSucceeds(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { name: '북일고 과학탐구반', color: '#2F6FDB' })));
  await t('다른 사람은 이름을 못 바꾼다', () => assertFails(updateDoc(doc(user('bob'), 'clubs', 'bukil-sci'), { name: '해킹' })));
  await t('공개 정보에 다른 칸(이메일 등)을 넣을 수 없다', () => assertFails(updateDoc(doc(user('alice'), 'clubs', 'bukil-sci'), { email: 'a@b.c' })));
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
  await t('맞는 코드로 넘겨받는다', async () => { const db = user('bob'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'bob'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'bob' }); await assertSucceeds(b.commit()); });
  await t('넘긴 뒤 예전 마스터는 비공개 정보를 못 읽는다', () => assertFails(getDoc(doc(user('alice'), 'clubs', 'bukil-sci', 'private', 'info'))));
  await t('새 마스터가 넘기기 코드를 지운다', () => assertSucceeds(deleteDoc(doc(user('bob'), 'clubs', 'bukil-sci', 'handover', 'current'))));
  await t('만료된 코드로는 넘겨받을 수 없다', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'clubs/bukil-sci/handover/current'), { code: CODE, expiresAt: Timestamp.fromMillis(Date.now() - 1000) }); });
    const db = user('eve'); const b = writeBatch(db); b.set(doc(db, 'clubs', 'bukil-sci', 'claims', 'eve'), { code: CODE }); b.update(doc(db, 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'eve' }); await assertFails(b.commit()); });
  await t('시스템 마스터는 복구를 위해 마스터를 바꿀 수 있다', () => assertSucceeds(updateDoc(doc(user('sys'), 'clubs', 'bukil-sci', 'private', 'info'), { masterUid: 'carol' })));
  await t('시스템 설정은 아무도 앱에서 못 바꾼다', () => assertFails(setDoc(doc(user('sys'), 'system/config'), { admins: ['sys', 'bob'] })));
  await t('내 동아리 목록은 본인만 읽는다', () => assertFails(getDoc(doc(user('bob'), 'masters', 'alice'))));

  await env.cleanup();
  let fail = 0; for (const [s, n] of results) { console.log((s === 'ok' ? '  ✓ ' : '  ✗ ') + n); if (s !== 'ok') fail++; }
  console.log(`\n${results.length - fail}/${results.length} passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
