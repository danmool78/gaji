// 연결기(public/connector.gs) 핵심 로직 시험 — 구글 시트 대신 메모리 저장소 사용
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/connector.gs'), 'utf8'), ctx);

let clock = Date.parse('2026-11-17T00:00:00Z');
function memStore() {
  const t = {};
  const tab = (k) => (t[k] = t[k] || []);
  return {
    _t: t,
    ensure() {},
    rows: (k) => tab(k).map((r, i) => ({ ...r, _row: i + 2 })),
    append: (k, o) => { tab(k).push({ ...o }); },
    update: (k, row, o) => { const c = { ...o }; delete c._row; tab(k)[row - 2] = c; }
  };
}
const util = {
  now: () => new Date(clock).toISOString(), today: () => new Date(clock).toISOString().slice(0, 10),
  random: Math.random, token: (n) => crypto.randomBytes(n).toString('base64url').slice(0, n),
  sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  bool: (v) => v === true || v === 'true', lock: (fn) => fn()
};
const store = memStore(), core = ctx.GajiCore(store, util);
const call = (q) => core.handle(q);
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// 준비 전
ok('ping before init', call({ action: 'ping' }).data.initialized === false);
ok('register before init', call({ action: 'register', studentId: '1', code: '1' }).code === 'not_initialized');
ok('unknown action', call({ action: 'hack' }).code === 'unknown');

// 준비
const KEY = 'k'.repeat(10) + 'MASTERKEY1234567890';
const init = call({ action: 'init', slug: 'bio-lab', name: '김승엽', studentId: '20301', label: 'iPad', masterKey: KEY });
ok('init', init.ok && /^\d{4}$/.test(init.data.code), init);
const M = init.data.device;
ok('init twice', call({ action: 'init', slug: 'x', name: 'a', studentId: '1' }).code === 'already');
ok('master load', call({ action: 'load', device: M }).data.me.role === '마스터');
ok('bad secret', call({ action: 'load', device: { id: M.id, secret: 'x' } }).code === 'no_device');

// 부원 추가 → 가입 → 대기 → 승인
const add = call({ action: 'addMember', device: M, studentId: '20315', name: '이하늘' });
ok('addMember', add.ok && /^\d{4}$/.test(add.data.code), add);
ok('dup member', call({ action: 'addMember', device: M, studentId: '20315', name: 'x' }).code === 'dup');
const wrong = add.data.code === '0000' ? '1111' : '0000';
ok('wrong code', call({ action: 'register', studentId: '20315', code: wrong }).code === 'wrong');
const reg = call({ action: 'register', studentId: '20315', code: add.data.code, label: 'Galaxy' });
ok('register', reg.ok && reg.data.name === '이하늘' && /^\d{4}$/.test(reg.data.confirm), reg);
const S = reg.data.device;
ok('status pending', call({ action: 'status', device: S }).data.status === '대기');
ok('pending cannot load', call({ action: 'load', device: S }).code === 'pending');
ok('member cannot approve', call({ action: 'approve', device: S, id: S.id }).code === 'pending');
const gd = call({ action: 'getDevice', device: M, id: S.id });
ok('getDevice', gd.ok && gd.data.member === '이하늘' && gd.data.confirm === reg.data.confirm, gd);
ok('approve wrong confirm', call({ action: 'approve', device: M, id: S.id, confirm: '99999' }).code === 'confirm');
ok('approve', call({ action: 'approve', device: M, id: S.id, confirm: reg.data.confirm }).ok);
ok('status approved', call({ action: 'status', device: S }).data.status === '승인');
ok('member not admin', call({ action: 'people', device: S }).code === 'not_admin');

// 동기화: 번호 · 권한
const s1 = call({ action: 'sync', device: S, nodes: [{ id: 'n1', type: 'exp', title: '효모 발효', status: '아이디어', verdict: '성공' }, { id: 'n2', type: 'q', title: '왜?' }], links: [{ s: 'n2', t: 'n1', k: 'q' }], lines: { yeast: '효모' } });
ok('sync numbers', s1.ok && s1.data.assigned.n1 === 1 && s1.data.assigned.n2 === 1, s1);
let L = call({ action: 'load', device: S }).data;
const n1 = L.nodes.find((n) => n.id === 'n1');
ok('member verdict stripped on create', n1.verdict === '', n1);
ok('createdBy', n1.createdBy === '이하늘');
ok('links saved', L.links.length === 1 && L.lines.yeast === '효모');
call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: '준비 중' }] });
const s2 = call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: '계획 작성', verdict: '실패' }] });
ok('member backward/verdict rejected', s2.data.rejected.includes('n1:status') && s2.data.rejected.includes('n1:verdict'), s2);
ok('member cancel rejected', call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: '취소' }] }).data.rejected.includes('n1:cancel'));
call({ action: 'sync', device: M, nodes: [{ id: 'n1', title: '효모 발효', status: '계획 작성', verdict: '성공' }] });
const n1b = call({ action: 'load', device: M }).data.nodes.find((n) => n.id === 'n1');
ok('admin backward + verdict', n1b.status === '계획 작성' && n1b.verdict === '성공', n1b);
ok('next exp number', call({ action: 'sync', device: S, nodes: [{ id: 'n3', type: 'exp', title: '두 번째' }] }).data.assigned.n3 === 2);
ok('dup link ignored', (call({ action: 'sync', device: S, links: [{ s: 'n2', t: 'n1', k: 'q' }, { s: 'n1', t: 'n1', k: 'rel' }, { s: 'n1', t: 'n3', k: 'evil' }] }), call({ action: 'load', device: S }).data.links.length === 1));

// 비공개 실험
call({ action: 'sync', device: M, nodes: [{ id: 'p1', type: 'exp', title: '대회 준비', owner: '김승엽', private: 'true' }] });
ok('private hidden from member', !call({ action: 'load', device: S }).data.nodes.some((n) => n.id === 'p1'));
ok('private visible to admin', call({ action: 'load', device: M }).data.nodes.some((n) => n.id === 'p1'));

// rev
const r1 = call({ action: 'rev', device: S }).data.rev;
call({ action: 'sync', device: M, nodes: [{ id: 'n3', title: '두 번째 실험' }] });
ok('rev bumps', call({ action: 'rev', device: S }).data.rev > r1);

// 새 기기 알림 · 본인 차단
const reg2 = call({ action: 'register', studentId: '20315', code: add.data.code, label: 'PC' });
call({ action: 'approve', device: M, id: reg2.data.device.id });
const nd = call({ action: 'load', device: S }).data.newDevices;
ok('new device notice', nd.length === 1 && nd[0].label === 'PC', nd);
ok('self block', call({ action: 'block', device: S, id: reg2.data.device.id }).ok);
ok('blocked device', call({ action: 'load', device: reg2.data.device }).code === 'blocked');

// 잠금
const add2 = call({ action: 'addMember', device: M, studentId: '20320', name: '박별' });
const w2 = add2.data.code === '0000' ? '1111' : '0000';
for (let i = 0; i < 5; i++) call({ action: 'register', studentId: '20320', code: w2 });
ok('locked after 5', call({ action: 'register', studentId: '20320', code: add2.data.code }).code === 'locked');
clock += 31 * 60e3;
ok('unlocked after 30m', call({ action: 'register', studentId: '20320', code: add2.data.code }).ok);

// 만료 (60일)
clock += 61 * 864e5;
ok('expired after 60d', call({ action: 'load', device: S }).code === 'expired');
ok('master also expires', call({ action: 'load', device: M }).code === 'expired');
clock -= 61 * 864e5;  // 되돌려 이어서 시험 (저장된 상태는 '만료' 그대로)

// 코드 재발급 → 기기 해제
const M2reg = (() => { const r = call({ action: 'register', studentId: '20301', code: init.data.code, label: 'phone' }); return r; })();
ok('master re-register', M2reg.ok, M2reg);
// 마스터 기기가 만료되었으므로 승인할 관리자가 없음 → 시트에서 직접 처리하는 경우를 흉내: 상태 수정
const devs = store._t.devices; devs.forEach((d) => { if (d.id === M.id) { d.status = '승인'; d.lastSeen = util.now(); } });
ok('master back', call({ action: 'load', device: M }).ok);
const rc = call({ action: 'resetCode', device: M, id: add.data.id });
ok('resetCode', rc.ok && /^\d{4}$/.test(rc.data.code));
ok('old devices blocked after reset', call({ action: 'status', device: S }).code === 'blocked');
ok('old code fails', call({ action: 'register', studentId: '20315', code: add.data.code === rc.data.code ? 'zzzz' : add.data.code }).code === 'wrong');

// 역할 · 중지
ok('promote', call({ action: 'setMember', device: M, id: add2.data.id, role: '관리자' }).ok);
ok('cannot change master', call({ action: 'setMember', device: M, id: init.data && store._t.members[0].id, role: '부원' }).code === 'bad');
ok('suspend', call({ action: 'setMember', device: M, id: add2.data.id, status: '중지' }).ok);
ok('suspended cannot register', call({ action: 'register', studentId: '20320', code: add2.data.code }).code === 'wrong');

// 모든 기기 로그아웃
const add3 = call({ action: 'addMember', device: M, studentId: '20330', name: '최온' });
const r3 = call({ action: 'register', studentId: '20330', code: add3.data.code });
call({ action: 'approve', device: M, id: r3.data.device.id });
ok('logoutAll', call({ action: 'logoutAll', device: M }).ok);
ok('others expired', call({ action: 'load', device: r3.data.device }).code === 'expired');
ok('master still in', call({ action: 'load', device: M }).ok);
const st = call({ action: 'stats', device: M }).data;
ok('stats', st.members === 3 && st.experiments === 3, st);
ok('log written', store._t.log.length > 10);
ok('no plaintext codes', !JSON.stringify(store._t).includes('"' + add3.data.code + '"') || add3.data.code.length === 4 && !store._t.members.some((m) => m.codeHash === add3.data.code));

// 마스터 키
ok('ping keyed', call({ action: 'ping' }).data.keyed === true);
ok('masterRegister wrong key', call({ action: 'masterRegister', masterKey: 'x'.repeat(30), studentId: '20301' }).code === 'wrong_key');
const mr = call({ action: 'masterRegister', masterKey: KEY, studentId: '20301', label: 'Mac' });
ok('masterRegister existing master approved', mr.ok && call({ action: 'status', device: mr.data.device }).data.status === '승인', mr);
const nm = call({ action: 'masterRegister', masterKey: KEY, studentId: '20401', label: 'iPad' });
ok('new master needs name', nm.code === 'need_name');
const nm2 = call({ action: 'masterRegister', masterKey: KEY, studentId: '20401', name: '새기장', label: 'iPad' });
ok('handover: new master', nm2.ok && /^\d{4}$/.test(nm2.data.code));
const roles = store._t.members.reduce((o, m) => (o[m.studentId] = m.role, o), {});
ok('old master demoted', roles['20301'] === '관리자' && roles['20401'] === '마스터', roles);
store._t.settings.find((x) => x.key === 'masterKeyHash').value = '';
ok('key reset via sheet', call({ action: 'masterRegister', masterKey: 'z'.repeat(24), studentId: '20401', label: 'x' }).ok);

console.log(`connector: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
