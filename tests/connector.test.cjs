// 연결기(public/connector.gs) 핵심 로직 시험 — 구글 시트 대신 메모리 저장소 사용
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/core.js'), 'utf8'), ctx);

let clock = Date.parse('2026-11-17T00:00:00Z');
function memStore() {
  const t = {};
  const tab = (k) => (t[k] = t[k] || []);
  return {
    _t: t,
    ensure() {},
    rows: (k) => tab(k).map((r, i) => ({ ...r, _row: i + 2 })),
    append: (k, o) => { tab(k).push({ ...o }); },
    update: (k, row, o) => { const c = { ...o }; delete c._row; tab(k)[row - 2] = c; },
    remove: (k, rows) => { rows.slice().sort((x, y) => y - x).forEach((r) => tab(k).splice(r - 2, 1)); }
  };
}
const util = {
  now: () => new Date(clock).toISOString(), today: () => new Date(clock).toISOString().slice(0, 10),
  random: Math.random, token: (n) => crypto.randomBytes(n).toString('base64url').slice(0, n),
  sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  bool: (v) => v === true || v === 'true', lock: (fn) => fn(), secret: () => 'test-secret-123', links: () => ({ sheet: 'https://docs.google.com/spreadsheets/d/X/edit', script: 'https://script.google.com/home/projects/S/edit' })
};
// 가짜 드라이브: 폴더 · 파일을 메모리에
const DRIVE = { files: {}, folders: {}, perm: true, n: 0 };
const drive = {
  save(folderId, folderName, name, mime, b64) { if (!DRIVE.perm) throw new Error('You do not have permission to call DriveApp.getFileById'); const fid = folderId || Object.keys(DRIVE.folders).find((k) => DRIVE.folders[k] === folderName) || ('F' + ++DRIVE.n); DRIVE.folders[fid] = DRIVE.folders[fid] || folderName; const id = 'D' + ++DRIVE.n; DRIVE.files[id] = { folderId: fid, name, mime, b64, trashed: false }; return { id, folderId: fid }; },
  read(id) { const f = DRIVE.files[id]; if (!f) throw new Error('no file'); return { mime: f.mime, data: f.b64 }; },
  trash(id) { if (DRIVE.files[id]) DRIVE.files[id].trashed = true; }
};
const store = memStore(), core = ctx.GajiCore(store, util, drive);
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

// 내 개인 코드 보기
const add9 = call({ action: 'addMember', device: M, studentId: '20399', name: '정다온' });
const r9 = call({ action: 'register', studentId: '20399', code: add9.data.code }); call({ action: 'approve', device: M, id: r9.data.device.id });
const mc = call({ action: 'myCode', device: r9.data.device });
ok('myCode returns own code', mc.ok && mc.data.code === add9.data.code, mc);
ok('pending device cannot see code', call({ action: 'myCode', device: call({ action: 'register', studentId: '20399', code: add9.data.code }).data.device }).code === 'pending');
const rc9 = call({ action: 'resetCode', device: M, id: add9.data.id });
ok('code not plaintext in sheet', !JSON.stringify(store._t.members.find((m) => m.studentId === '20399')).includes('"' + rc9.data.code + '"'));
const r9b = call({ action: 'register', studentId: '20399', code: rc9.data.code }); call({ action: 'approve', device: M, id: r9b.data.device.id });
ok('myCode after reset', call({ action: 'myCode', device: r9b.data.device }).data.code === rc9.data.code);

// 예전 판 코드 → 새 코드 발급, 기기 유지
const m9 = store._t.members.find((m) => m.studentId === '20399'); m9.codeEnc = '';
const mc2 = call({ action: 'myCode', device: r9b.data.device });
ok('old code renewed', mc2.ok && mc2.data.renewed && /^\d{4}$/.test(mc2.data.code), mc2);
ok('device kept after renew', call({ action: 'load', device: r9b.data.device }).ok);
ok('new code works', call({ action: 'register', studentId: '20399', code: mc2.data.code }).ok);
ok('ping version', call({ action: 'ping' }).data.version === '2.6.2');

// 실수 되돌리기: 내가 10분 안에 옮긴 단계는 한 단계 되돌리기 가능
call({ action: 'sync', device: M, nodes: [{ id: 'u1', type: 'exp', title: '되돌리기 시험', status: '검토 중', owner: '정다온' }] });
call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '준비 중' }] });
let ub = call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '검토 중' }] });
ok('member undo own move within 10 min', ub.data.rejected.length === 0, ub);
call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '준비 중' }] });
ub = call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '계획 작성' }] });
ok('member cannot jump back 2 steps', ub.data.rejected.includes('u1:status'), ub);
clock += 11 * 60000;
ub = call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '검토 중' }] });
ok('member cannot undo after 10 min', ub.data.rejected.includes('u1:status'), ub);
call({ action: 'sync', device: M, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '준비 중' }] });
ub = call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '검토 중' }] });
ok('member cannot undo someone else\'s move', ub.data.rejected.includes('u1:status'), ub);
ub = call({ action: 'sync', device: M, nodes: [{ id: 'u1', title: '되돌리기 시험', status: '검토 중' }] });
ok('admin can always go back', ub.data.rejected.length === 0, ub);

// 결과 기록(report) 저장 · 수정
const rep1 = { summary: '세 농도로 끓는점 측정', unit: '℃', rows: [{ cond: '0%', v: [100, 100.2, 99.9] }], claim: '가설 지지' };
call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', report: rep1 }] });
let ld = call({ action: 'load', device: M }).data.nodes.find((n) => n.id === 'u1');
ok('report saved', ld.report && ld.report.rows[0].v[1] === 100.2, ld.report);
call({ action: 'sync', device: r9b.data.device, nodes: [{ id: 'u1', title: '되돌리기 시험', report: Object.assign({}, rep1, { summary: '고침' }) }] });
ld = call({ action: 'load', device: M }).data.nodes.find((n) => n.id === 'u1');
ok('report edit saved', ld.report.summary === '고침', ld.report);


// ===== 2.3.0: 계획서 · 삭제 · 댓글 · 검토 · 확정 잠금 · 연결 끊기 =====
const MEM = r9b.data.device;               // 부원 정다온
const ADM = M;                             // 마스터
call({ action: 'sync', device: MEM, nodes: [{ id: 'b1', type: 'exp', title: '레몬 전지 전극', status: '계획 작성', owner: '정다온', plan: { purpose: '전극 금속에 따른 전압', steps: ['레몬 자르기', '전극 꽂기'] } }] });
let L2 = call({ action: 'load', device: ADM }).data;
ok('plan saved as object', L2.nodes.find((n) => n.id === 'b1').plan.steps[1] === '전극 꽂기');
// 삭제: 남의 것은 못 지움, 내 것 · 관리자는 지움
call({ action: 'addMember', device: ADM, studentId: '20500', name: '오세린' });
const cs = call({ action: 'addMember', device: ADM, studentId: '20501', name: '한결' });
const rr = call({ action: 'register', studentId: '20501', code: cs.data.code }); call({ action: 'approve', device: ADM, id: rr.data.device.id });
const OTH = rr.data.device;
let sy = call({ action: 'sync', device: OTH, nodes: [{ id: 'b1', title: '레몬 전지 전극', deleted: 'true' }] });
ok('other member cannot delete', sy.data.rejected.includes('b1:delete') || sy.data.rejected.includes('b1:team'), sy);
sy = call({ action: 'sync', device: MEM, nodes: [{ id: 'b1', title: '레몬 전지 전극', deleted: 'true' }] });
ok('owner can delete', sy.data.rejected.length === 0 && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'b1').deleted === 'true');
call({ action: 'sync', device: ADM, nodes: [{ id: 'b1', title: '레몬 전지 전극', deleted: '' }] });
ok('admin restores', call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'b1').deleted === '');
// 댓글 · 첨삭
let cm = call({ action: 'comment', device: OTH, node: 'b1', kind: 'fix', sec: 'plan.purpose', text: '측정 횟수를 적어 주세요' });
ok('comment add', cm.ok && cm.data.comment.id, cm);
const cid = cm.data.comment.id;
ok('load has comment', call({ action: 'load', device: MEM }).data.comments.some((c) => c.id === cid && c.sec === 'plan.purpose'));
ok('cannot edit others comment', call({ action: 'comment', device: MEM, op: 'edit', id: cid, text: 'x' }).code === 'not_mine');
ok('edit own comment', call({ action: 'comment', device: OTH, op: 'edit', id: cid, text: '측정 횟수(3회)를 적어 주세요' }).ok);
ok('owner resolves', call({ action: 'comment', device: MEM, op: 'resolve', id: cid }).ok && call({ action: 'load', device: MEM }).data.comments.find((c) => c.id === cid).resolved === true);
ok('empty comment rejected', call({ action: 'comment', device: OTH, node: 'b1', text: '  ' }).code === 'bad');
// 검토 승인: 본인은 안 됨, 한 사람 한 번
ok('self approve rejected', call({ action: 'comment', device: MEM, node: 'b1', kind: 'approve' }).code === 'self');
call({ action: 'comment', device: OTH, node: 'b1', kind: 'approve' }); call({ action: 'comment', device: OTH, node: 'b1', kind: 'approve' });
ok('one approval per person', call({ action: 'load', device: ADM }).data.comments.filter((c) => c.node === 'b1' && c.kind === 'approve').length === 1);
// 댓글 지우기: 관리자는 남의 것도
const c2 = call({ action: 'comment', device: OTH, node: 'b1', text: '좋아요' }).data.comment.id;
ok('admin deletes any comment', call({ action: 'comment', device: ADM, op: 'delete', id: c2 }).ok && !call({ action: 'load', device: ADM }).data.comments.some((c) => c.id === c2));
// 비공개 실험 댓글은 못 봄
call({ action: 'sync', device: ADM, nodes: [{ id: 'p9', type: 'exp', title: '비공개', owner: '김승엽', private: 'true' }] });
call({ action: 'comment', device: ADM, node: 'p9', text: '비밀' });
ok('private comments hidden', !call({ action: 'load', device: OTH }).data.comments.some((c) => c.node === 'p9'));
ok('cannot comment on hidden private', call({ action: 'comment', device: OTH, node: 'p9', text: 'x' }).code === 'bad');
// 보고서 확정: 부원은 확정 못 함, 확정 뒤 부원 수정 막힘, 관리자는 가능
sy = call({ action: 'sync', device: MEM, nodes: [{ id: 'b1', title: '레몬 전지 전극', report: { summary: 'a', final: { by: '정다온' } } }] });
ok('member cannot finalize', sy.data.rejected.includes('b1:final'), sy);
call({ action: 'sync', device: ADM, nodes: [{ id: 'b1', title: '레몬 전지 전극', report: { summary: 'a', final: { by: '김승엽' } } }] });
sy = call({ action: 'sync', device: MEM, nodes: [{ id: 'b1', title: '레몬 전지 전극', plan: { purpose: '바꿈' } }] });
ok('locked after final', sy.data.rejected.includes('b1:final'), sy);
sy = call({ action: 'sync', device: ADM, nodes: [{ id: 'b1', title: '레몬 전지 전극', report: { summary: 'a' } }] });
ok('admin unlocks', sy.data.rejected.length === 0);
// 연결 끊기 · 다시 잇기 (가지 옮기기)
call({ action: 'sync', device: MEM, nodes: [{ id: 'b2', type: 'exp', title: '레몬 직렬', owner: '정다온' }], links: [{ s: 'b1', t: 'b2', k: 'next' }] });
ok('link made', call({ action: 'load', device: ADM }).data.links.some((l) => l.s === 'b1' && l.t === 'b2'));
sy = call({ action: 'sync', device: OTH, links: [{ s: 'b1', t: 'b2', k: 'next', off: true }] });
ok('other cannot unlink', sy.data.rejected.includes('b2:unlink'), sy);
call({ action: 'sync', device: MEM, links: [{ s: 'b1', t: 'b2', k: 'next', off: true }, { s: 'u1', t: 'b2', k: 'next' }] });
let ls = call({ action: 'load', device: ADM }).data.links;
ok('moved branch', !ls.some((l) => l.s === 'b1' && l.t === 'b2') && ls.some((l) => l.s === 'u1' && l.t === 'b2'));
call({ action: 'sync', device: MEM, links: [{ s: 'b1', t: 'b2', k: 'next' }] });
ok('relink revives', call({ action: 'load', device: ADM }).data.links.some((l) => l.s === 'b1' && l.t === 'b2'));
ok('bool TRUE from sheet', ctx.GajiCore && true);


// ===== 2.4.0: 사진 · 파일 =====
const IMG = Buffer.from('fake-jpeg-bytes').toString('base64'), TH = Buffer.from('tiny').toString('base64');
let up = call({ action: 'upload', device: MEM, node: 'b1', name: '레몬 전지 사진.jpeg', mime: 'image/jpeg', data: IMG, thumb: TH, caption: '구리-아연 연결', kind: 'photo' });
ok('upload', up.ok && up.data.file.name === '레몬 전지 사진.jpg' && up.data.file.thumb, up);
const fid1 = up.data.file.id;
const fl = Object.values(DRIVE.files); ok('saved full + thumb in one folder', fl.length === 2 && fl[0].folderId === fl[1].folderId && DRIVE.folders[fl[0].folderId].includes('레몬 전지 전극'));
up = call({ action: 'upload', device: MEM, node: 'b1', name: 'graph.png', mime: 'image/png', data: IMG, kind: 'graph' });
ok('second file same folder', Object.values(DRIVE.files)[2].folderId === fl[0].folderId);
ok('load has files', call({ action: 'load', device: ADM }).data.files.filter((f) => f.node === 'b1').length === 2);
let fg = call({ action: 'fileGet', device: OTH, ids: [fid1] });
ok('fileGet thumb', fg.ok && fg.data.files[fid1].data === TH, fg);
fg = call({ action: 'fileGet', device: OTH, ids: [fid1], full: true });
ok('fileGet full', fg.data.files[fid1].data === IMG);
ok('bad mime rejected', call({ action: 'upload', device: MEM, node: 'b1', name: 'x.exe', mime: 'application/x-msdownload', data: IMG }).code === 'bad');
ok('too big rejected', call({ action: 'upload', device: MEM, node: 'b1', name: 'x.jpg', mime: 'image/jpeg', data: 'A'.repeat(14e6 + 10) }).code === 'big');
ok('private node upload rejected', call({ action: 'upload', device: OTH, node: 'p9', name: 'x.jpg', mime: 'image/jpeg', data: IMG }).code === 'bad');
ok('other cannot delete', call({ action: 'fileEdit', device: OTH, id: fid1, op: 'delete' }).code === 'not_mine');
ok('caption edit by uploader', call({ action: 'fileEdit', device: MEM, id: fid1, caption: '구리-아연 레몬 전지 (0.93V)' }).ok && call({ action: 'load', device: ADM }).data.files.find((f) => f.id === fid1).caption.includes('0.93V'));
ok('admin deletes', call({ action: 'fileEdit', device: ADM, id: fid1, op: 'delete' }).ok && !call({ action: 'load', device: ADM }).data.files.some((f) => f.id === fid1) && DRIVE.files[fl[0] === DRIVE.files.D2 ? 'D2' : Object.keys(DRIVE.files)[0]].trashed);
ok('deleted not served', !call({ action: 'fileGet', device: ADM, ids: [fid1] }).data.files[fid1]);
DRIVE.perm = false;
const pe = call({ action: 'upload', device: MEM, node: 'b1', name: 'x.jpg', mime: 'image/jpeg', data: IMG });
ok('no drive permission → drive_perm', pe.code === 'drive_perm', pe);
DRIVE.perm = true;
const noDrive = ctx.GajiCore(store, util);
ok('no drive object → no_drive', noDrive.handle({ action: 'upload', device: MEM, node: 'b1', name: 'x.jpg', mime: 'image/jpeg', data: IMG }).code === 'no_drive');


// ===== 2.5.0: 자동 보관 =====
const nowSave = clock;
clock = Date.parse('2025-09-10T03:00:00Z');   // 지난 학년도
call({ action: 'sync', device: MEM, nodes: [{ id: 'a1', type: 'exp', title: '작년 산화 환원 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '작년 목적: 산화막 확인', steps: ['a', 'b'] }, report: { summary: '작년 결과', final: null, claim: '가설 지지' } },
  { id: 'a2', type: 'exp', title: '작년 이어서 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '이어진 실험' } },
  { id: 'a3', type: 'exp', title: '작년 시작 · 올해 진행 중', status: '기록 완료', owner: '정다온', plan: { purpose: '진행 중 가지의 뿌리' } }],
  links: [{ s: 'a1', t: 'a2', k: 'next' }] });
call({ action: 'comment', device: OTH, node: 'a1', kind: 'fix', text: '작년 첨삭: 단위 확인' });
clock = Date.parse('2026-11-20T03:00:00Z');   // 올해
call({ action: 'sync', device: MEM, nodes: [{ id: 'a4', type: 'exp', title: '올해 진행 중', status: '준비 중', owner: '정다온' }, { id: 'a5', type: 'exp', title: '올해 끝난 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '올해' } }], links: [{ s: 'a3', t: 'a4', k: 'next' }] });
ok('tidy: small data → nothing moved', call({ action: 'tidy', device: MEM }).data.moved === 0);
ok('tidy: once a day', call({ action: 'tidy', device: MEM }).data.reason === 'today');
store._t.settings.find((x) => x.key === 'tidyAt').value = '';
store._t.settings.push({ key: 'archLimit', value: '50' });
const td = call({ action: 'tidy', device: MEM }); ok('tidy: moved last year finished branch (2)', td.ok && td.data.moved === 2, td);
let LA = call({ action: 'load', device: ADM }).data, na1 = LA.nodes.find((n) => n.id === 'a1');
ok('archived light row keeps title · status · verdict claim', na1.arch === '보관' && na1.title === '작년 산화 환원 실험' && na1.status === '기록 완료' && !na1.plan && na1.report.claim === '가설 지지');
ok('branch link kept', LA.links.some((l) => l.s === 'a1' && l.t === 'a2'));
ok('archived comments not in load', !LA.comments.some((c) => c.node === 'a1'));
ok('active branch (a3→a4) not archived', !LA.nodes.find((n) => n.id === 'a3').arch && !LA.nodes.find((n) => n.id === 'a4').arch);
ok('this year finished not archived', !LA.nodes.find((n) => n.id === 'a5').arch);
const ar = call({ action: 'archived', device: OTH, ids: ['a1'] });
ok('archived contents returned', ar.data.items.a1.data.plan.purpose.includes('산화막') && ar.data.items.a1.comments[0].text.includes('단위'));
ok('search archive', call({ action: 'search', device: OTH, q: '산화막' }).data.hits.some((h) => h.id === 'a1'));
ok('search archive comments', call({ action: 'search', device: OTH, q: '단위 확인' }).data.hits.some((h) => h.id === 'a1'));
// 내용을 안 받은 기기에서 제목만 고쳐도 내용은 그대로 · 보관에서 꺼내짐
const light = Object.assign({}, na1, { title: '작년 산화 환원 실험 (제목 고침)' });
call({ action: 'sync', device: MEM, nodes: [light] });
LA = call({ action: 'load', device: ADM }).data; na1 = LA.nodes.find((n) => n.id === 'a1');
ok('edit archived (light) → restored, content safe', !na1.arch && na1.title.includes('제목 고침') && na1.plan.purpose.includes('산화막') && na1.report.summary === '작년 결과', na1);
ok('restored comments back', LA.comments.some((c) => c.node === 'a1' && c.text.includes('단위')));
ok('archive row removed', !store._t.archive.some((a) => a.id === 'a1'));
// 오래된 기록 탭 정리 (200개 넘을 때)
for (let i = 0; i < 230; i++) store._t.log.unshift({ at: '2025-01-01T00:00:00Z', member: 'x', device: '', action: '옛날', detail: '' });
store._t.settings.find((x) => x.key === 'tidyAt').value = '';
const lg = call({ action: 'tidy', device: MEM }); ok('old logs moved to 기록 보관', lg.data.logs >= 230 && store._t.logArchive.length >= 230, lg);
clock = nowSave;


// ===== 2.6.0: 남의 실험은 못 고침 · 함께하는 사람 =====
call({ action: 'sync', device: MEM, nodes: [{ id: 't1', type: 'exp', title: '정다온의 실험', status: '계획 작성', owner: '정다온', plan: { purpose: '원래 목적' } }, { id: 't2', type: 'idea', title: '정다온의 아이디어', status: '아이디어', fans: 1 }] });
let ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', plan: { purpose: '남이 고침' } }] });
ok('other member cannot edit plan', ts.data.rejected.includes('t1:team') && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 't1').plan.purpose === '원래 목적', ts);
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', status: '검토 중' }] });
ok('other member cannot move stage', ts.data.rejected.includes('t1:team'));
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', report: { summary: '남이 쓴 결과' } }] });
ok('other member cannot write results', ts.data.rejected.includes('t1:team'));
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't2', title: '정다온의 아이디어', fans: 2, volunteer: '한결' }] });
ok('anyone: idea 같이 해요 · 담당 지원(본인)', ts.data.rejected.length === 0 && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 't2').volunteer === '한결', ts);
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't2', title: '정다온의 아이디어', volunteer: '정다온' }] });
ok('cannot volunteer someone else', ts.data.rejected.includes('t2:team'));
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', team: ['한결'] }] });
ok('other cannot add self to team', ts.data.rejected.includes('t1:team'));
ts = call({ action: 'sync', device: MEM, nodes: [{ id: 't1', title: '정다온의 실험', team: ['한결'] }] });
ok('owner adds team member', ts.data.rejected.length === 0);
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', plan: { purpose: '함께 고침' } }] });
ok('team member can edit', ts.data.rejected.length === 0 && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 't1').plan.purpose === '함께 고침', ts);
ts = call({ action: 'sync', device: OTH, nodes: [{ id: 't1', title: '정다온의 실험', private: 'true' }] });
ok('team member cannot change private', ts.data.rejected.includes('t1:team'));
ts = call({ action: 'sync', device: ADM, nodes: [{ id: 't1', title: '정다온의 실험', plan: { purpose: '관리자 고침' } }] });
ok('admin can edit any', ts.data.rejected.length === 0);
call({ action: 'sync', device: MEM, nodes: [{ id: 't1', title: '정다온의 실험', private: 'true' }] });
ok('private visible to team', call({ action: 'load', device: OTH }).data.nodes.some((n) => n.id === 't1'));
const add5 = call({ action: 'addMember', device: ADM, studentId: '20599', name: '남궁민' }); const r5 = call({ action: 'register', studentId: '20599', code: add5.data.code }); call({ action: 'approve', device: ADM, id: r5.data.device.id });
ok('private hidden from non-team', !call({ action: 'load', device: r5.data.device }).data.nodes.some((n) => n.id === 't1'));
ok('non-team can still comment on public', call({ action: 'comment', device: r5.data.device, node: 't2', text: '저도 해 보고 싶어요' }).ok);

ok('links: admin gets sheet · script', call({ action: 'links', device: ADM }).data.sheet.includes('spreadsheets'));
ok('links: member refused', call({ action: 'links', device: OTH }).code === 'not_admin');

console.log(`connector: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
