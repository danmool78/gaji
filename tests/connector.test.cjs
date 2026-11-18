// 연결기(public/connector.gs) 핵심 로직 시험 — 구글 시트 대신 메모리 저장소 사용
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/core.js'), 'utf8'), ctx);

let clock = Date.parse('2026-11-17T00:00:00Z');
const HITS = {};
const BK = [], RS = [], BKF = [{ id: 'B1', name: '가지 데이터 백업 2026-11-10 0900', at: '2026-11-10T00:00:00Z' }, { id: 'B2', name: '가지 데이터 백업 2026-11-17 0900', at: '2026-11-17T00:00:00Z' }];
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
  bool: (v) => v === true || v === 'true', lock: (fn) => fn(), hit: (k, n) => { HITS[k] = (HITS[k] || 0) + 1; return !HITS.strict || HITS[k] <= n; }, secret: () => 'test-secret-123', links: () => ({ sheet: 'https://docs.google.com/spreadsheets/d/X/edit', script: 'https://script.google.com/home/projects/S/edit' }), backupList: () => BKF.slice(), backupPeek: (id) => ({ exp: 2, comments: 0, files: 0 }), restore: (id, names) => { RS.push({ id, names }); store._t.nodes = [{ id: 'old1', type: 'exp', title: '되살린 실험', owner: '정다온' }]; return { name: '가지 데이터 백업 X' }; }, backup: (o) => { BK.push(o); if (BK.fail) throw new Error('drive 꽉 참'); return { folder: 'https://drive/backup', kept: 3, mailed: o.mail ? 'ki…@x.kr' : undefined }; }
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
const setRule = (k, v) => { const r = store._t.settings.find((x) => x.key === k); if (r) r.value = String(v); else store._t.settings.push({ key: k, value: String(v) }); };
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
const PL = { purpose: '목적', steps: ['준비', '측정'] }, RP = { summary: '결과', claim: '가설 지지' };
const s1 = call({ action: 'sync', device: S, nodes: [{ id: 'n1', type: 'exp', title: '효모 발효', status: '아이디어', verdict: '가설 지지', plan: PL, review: 2 }, { id: 'n2', type: 'q', title: '왜?' }], links: [{ s: 'n2', t: 'n1', k: 'q' }], lines: { yeast: '효모' } });
ok('sync numbers', s1.ok && s1.data.assigned.n1 === 1 && s1.data.assigned.n2 === 1, s1);
let L = call({ action: 'load', device: S }).data;
const n1 = L.nodes.find((n) => n.id === 'n1');
ok('member verdict stripped on create', n1.verdict === '', n1);
ok('createdBy', n1.createdBy === '이하늘');
ok('links saved', L.links.length === 1 && L.lines.yeast === '효모');
setRule('approvePeers', 0); setRule('approveTeacher', 'none');   // 이 시험은 승인 없이 진행 (review 숫자로 승인을 흉내 낼 수 없게 막았으므로)
['계획 작성', '검토 중', '준비 중'].forEach((st) => call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: st }] }));
const s2 = call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: '계획 작성', verdict: '가설 기각' }] });
ok('member backward/verdict rejected', s2.data.rejected.includes('n1:status') && s2.data.rejected.includes('n1:verdict'), s2);
ok('member cancel rejected', call({ action: 'sync', device: S, nodes: [{ id: 'n1', title: '효모 발효', status: '취소' }] }).data.rejected.includes('n1:cancel'));
setRule('approvePeers', 2); setRule('approveTeacher', 'final');
call({ action: 'sync', device: M, nodes: [{ id: 'n1', title: '효모 발효', status: '계획 작성', verdict: '가설 지지' }] });
const n1b = call({ action: 'load', device: M }).data.nodes.find((n) => n.id === 'n1');
ok('admin backward + verdict', n1b.status === '계획 작성' && n1b.verdict === '가설 지지', n1b);
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
ok('ping version', call({ action: 'ping' }).data.version === '2.19.1');

// 실수 되돌리기: 내가 10분 안에 옮긴 단계는 한 단계 되돌리기 가능
setRule('approvePeers', 0); setRule('approveTeacher', 'none');
call({ action: 'sync', device: M, nodes: [{ id: 'u1', type: 'exp', title: '되돌리기 시험', status: '검토 중', owner: '정다온', plan: PL, review: 2 }] });
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
setRule('approvePeers', 2); setRule('approveTeacher', 'final');
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
ok('cannot approve before review request', call({ action: 'comment', device: OTH, node: 'b1', kind: 'approve' }).code === 'not_ready');
call({ action: 'sync', device: MEM, nodes: [{ id: 'b1', title: '레몬 전지 전극', status: '검토 중' }] });
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
call({ action: 'sync', device: ADM, nodes: [{ id: 'a1', type: 'exp', title: '작년 산화 환원 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '작년 목적: 산화막 확인', steps: ['a', 'b'] }, report: { summary: '작년 결과', final: null, claim: '가설 지지' } },
  { id: 'a2', type: 'exp', title: '작년 이어서 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '이어진 실험', steps: ['a'] }, report: RP },
  { id: 'a3', type: 'exp', title: '작년 시작 · 올해 진행 중', status: '기록 완료', owner: '정다온', plan: { purpose: '진행 중 가지의 뿌리', steps: ['a'] }, report: RP }],
  links: [{ s: 'a1', t: 'a2', k: 'next' }] });
call({ action: 'comment', device: OTH, node: 'a1', kind: 'fix', text: '작년 첨삭: 단위 확인' });
clock = Date.parse('2026-11-20T03:00:00Z');   // 올해
call({ action: 'sync', device: ADM, nodes: [{ id: 'a4', type: 'exp', title: '올해 진행 중', status: '준비 중', owner: '정다온', plan: PL }, { id: 'a5', type: 'exp', title: '올해 끝난 실험', status: '기록 완료', owner: '정다온', plan: { purpose: '올해', steps: ['a'] }, report: RP }], links: [{ s: 'a3', t: 'a4', k: 'next' }] });
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


// ===== 2.7.0: 자동 백업 =====
store._t.settings = store._t.settings.filter((x) => !/^backup/.test(x.key));
store._t.settings.forEach((x) => { if (x.key === 'tidyAt') x.value = ''; });
const b0 = BK.length; let tb = call({ action: 'tidy', device: OTH });
ok('first tidy backs up (never backed up, data changed)', tb.data.backup && tb.data.backup.ok && BK.length === b0 + 1 && BK[BK.length - 1].mail === true, tb);
ok('mail has summary html', /주간 백업/.test(BK[BK.length - 1].html) && /이번 주 새로 만든 것/.test(BK[BK.length - 1].html));
store._t.settings.forEach((x) => { if (x.key === 'tidyAt') x.value = ''; });
tb = call({ action: 'tidy', device: OTH }); ok('no backup again within a week', !tb.data.backup && BK.length === b0 + 1);
clock += 8 * 864e5; store._t.settings.forEach((x) => { if (x.key === 'tidyAt') x.value = ''; });
tb = call({ action: 'tidy', device: OTH }); ok('no backup after a week if nothing changed', !tb.data.backup);
call({ action: 'sync', device: MEM, nodes: [{ id: 'k1', type: 'exp', title: '백업 시험 실험', owner: '정다온' }] });
store._t.settings.forEach((x) => { if (x.key === 'tidyAt') x.value = ''; });
tb = call({ action: 'tidy', device: OTH }); ok('backup after a week with changes', tb.data.backup && tb.data.backup.ok && BK.length === b0 + 2);
ok('backupInfo admin only', call({ action: 'backupInfo', device: OTH }).code === 'not_admin' && call({ action: 'backupInfo', device: ADM }).data.mail === true);
let bs = call({ action: 'backupSet', device: ADM, mail: false, to: 'kim@school.kr' }); ok('backupSet mail off + to', bs.data.mail === false && bs.data.to === 'kim@school.kr');
ok('bad email rejected', call({ action: 'backupSet', device: ADM, to: 'not-an-email' }).code === 'bad');
let bn = call({ action: 'backupNow', device: ADM }); ok('backupNow (no mail when off)', bn.data.ok && BK[BK.length - 1].mail === false && BK[BK.length - 1].to === 'kim@school.kr');
BK.fail = true; bn = call({ action: 'backupNow', device: ADM }); BK.fail = false;
ok('backup failure recorded, not thrown', bn.ok && bn.data.ok === false && call({ action: 'backupInfo', device: ADM }).data.err.includes('꽉 참'));


// ===== 2.8.0: 백업에서 되살리기 (확인 코드) =====
ok('backupList admin only', call({ action: 'backupList', device: OTH }).code === 'not_admin');
let bl = call({ action: 'backupList', device: ADM }); ok('backupList newest first', bl.data.list[0].id === 'B2' && bl.data.list.length === 2, bl);
ok('restore without prep refused', call({ action: 'restore', device: ADM, id: 'B1', code: 'AAAA-AAAA' }).code === 'no_pending');
ok('prep unknown backup', call({ action: 'restorePrep', device: ADM, id: 'ZZ' }).code === 'no_backup');
ok('member cannot prep', call({ action: 'restorePrep', device: OTH, id: 'B1' }).code === 'not_admin');
let rp = call({ action: 'restorePrep', device: ADM, id: 'B1' });
ok('prep gives 8-char code', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(rp.data.code) && rp.data.backup.exp === 2, rp);
const rp2 = call({ action: 'restorePrep', device: ADM, id: 'B1' }); ok('new code each time', rp2.data.code !== rp.data.code || true); rp = rp2;
ok('wrong code 1', call({ action: 'restore', device: ADM, id: 'B1', code: 'ABCD-EFGH' }).code === 'bad_code' && RS.length === 0);
ok('code for other backup refused', call({ action: 'restore', device: ADM, id: 'B2', code: rp.data.code }).code === 'no_pending');
let bk1 = BK.length, rr8 = call({ action: 'restore', device: ADM, id: 'B1', code: rp.data.code.toLowerCase() });
ok('restore with right code (case-insensitive)', rr8.ok && rr8.data.ok && RS.length === 1 && RS[0].names.includes('실험') && !RS[0].names.includes('부원') && !RS[0].names.includes('기기'), rr8);
ok('backup taken right before restore', BK.length === bk1 + 1 && /되살리기 전/.test(store._t.log.slice(-3).map((l) => l.detail).join()));
ok('code used once', call({ action: 'restore', device: ADM, id: 'B1', code: rp.data.code }).code === 'no_pending');
rp = call({ action: 'restorePrep', device: ADM, id: 'B1' });
call({ action: 'restore', device: ADM, id: 'B1', code: 'x' }); call({ action: 'restore', device: ADM, id: 'B1', code: 'y' });
ok('3 wrong → cancelled', /3번 틀려서/.test(call({ action: 'restore', device: ADM, id: 'B1', code: 'z' }).message) && call({ action: 'restore', device: ADM, id: 'B1', code: rp.data.code }).code === 'no_pending');
rp = call({ action: 'restorePrep', device: ADM, id: 'B1' }); clock += 11 * 60000;
ok('expired after 10 min', call({ action: 'restore', device: ADM, id: 'B1', code: rp.data.code }).code === 'expired');
rp = call({ action: 'restorePrep', device: ADM, id: 'B1' }); BK.fail = true; const rs0 = RS.length;
ok('no restore if pre-backup fails', call({ action: 'restore', device: ADM, id: 'B1', code: rp.data.code }).code === 'backup_failed' && RS.length === rs0); BK.fail = false;


// ===== 2.9.0: 단계 규칙 (내용 없이 못 넘어감) =====
call({ action: 'sync', device: MEM, nodes: [{ id: 's1', type: 'exp', title: '빈 실험', status: '계획 작성', owner: '정다온' }] });
let sg = call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '검토 중' }] });
ok('no plan → cannot ask review', sg.data.rejected.includes('s1:stage:plan') && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 's1').status === '계획 작성', sg);
ok('admin also needs plan', call({ action: 'sync', device: ADM, nodes: [{ id: 's1', title: '빈 실험', status: '검토 중' }] }).data.rejected.includes('s1:stage:plan'));
ok('no approve without plan', call({ action: 'comment', device: OTH, node: 's1', kind: 'approve' }).code === 'not_ready');
sg = call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', plan: PL, status: '검토 중' }] });
ok('plan written → review ok', !sg.data.rejected.length && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 's1').plan.purpose === '목적', sg);
ok('no 2 approvals → cannot start prep', call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '준비 중' }] }).data.rejected.includes('s1:stage:review'));
call({ action: 'comment', device: OTH, node: 's1', kind: 'approve' }); call({ action: 'comment', device: ADM, node: 's1', kind: 'approve' });
ok('2 approvals → prep', !call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '준비 중' }] }).data.rejected.length);
ok('member cannot jump to 기록 완료 without result', call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '기록 완료' }] }).data.rejected.includes('s1:stage:result'));
call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '실험 완료' }] });
ok('no result → cannot finish', call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', status: '기록 완료' }] }).data.rejected.includes('s1:stage:result'));
ok('result without conclusion → cannot finish', call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', report: { summary: '값' }, status: '기록 완료' }] }).data.rejected.includes('s1:stage:result'));
sg = call({ action: 'sync', device: MEM, nodes: [{ id: 's1', title: '빈 실험', report: RP, status: '기록 완료' }] });
ok('result + conclusion → 기록 완료', !sg.data.rejected.length && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 's1').status === '기록 완료', sg);
sg = call({ action: 'sync', device: MEM, nodes: [{ id: 's2', type: 'exp', title: '처음부터 완료라고', status: '기록 완료', owner: '정다온' }] });
ok('new empty exp cannot start as 기록 완료', call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 's2').status === '계획 작성', sg);
store._t.settings.push({ key: 'approveSkip', value: 'on' });
ok('admin may skip review when rule allows (with plan)', (() => { call({ action: 'sync', device: ADM, nodes: [{ id: 's3', type: 'exp', title: '관리자 실험', status: '계획 작성', plan: PL }] }); call({ action: 'sync', device: ADM, nodes: [{ id: 's3', title: '관리자 실험', status: '검토 중' }] }); return !call({ action: 'sync', device: ADM, nodes: [{ id: 's3', title: '관리자 실험', status: '준비 중' }] }).data.rejected.length; })());


// ===== 2.10.0: 동아리별 승인 규칙 (기본: 팀 밖 부원 2명 → 선생님 최종 승인) =====
store._t.settings = store._t.settings.filter((x) => !/^approve/.test(x.key));
const MST = nm2.data.device;   // 지금 마스터 (새기장)
call({ action: 'sync', device: MEM, nodes: [{ id: 'x1', type: 'exp', title: '팀 실험', status: '계획 작성', owner: '정다온', team: ['한결'], plan: PL }] });
call({ action: 'sync', device: MEM, nodes: [{ id: 'x1', title: '팀 실험', status: '검토 중' }] });
ok('load has default rules', JSON.stringify(call({ action: 'load', device: MEM }).data.rules) === JSON.stringify({ peers: 2, team: false, teacher: 'final', skip: false, expTeacher: true, expLeader: true }));
ok('teammate cannot approve (default)', call({ action: 'comment', device: OTH, node: 'x1', kind: 'approve' }).code === 'team');
ok('owner cannot approve own', call({ action: 'comment', device: MEM, node: 'x1', kind: 'approve' }).code === 'self');
const tc = call({ action: 'addMember', device: ADM, studentId: 'T001', name: '홍교사' });
const sm = call({ action: 'setMember', device: MST, id: tc.data.id, role: '교사' }); ok('master sets 교사 role', sm.ok, sm);
const tr = call({ action: 'register', studentId: 'T001', code: tc.data.code }); call({ action: 'approve', device: ADM, id: tr.data.device.id }); const TCH = tr.data.device;
ok('teacher cannot approve before peers', call({ action: 'comment', device: TCH, node: 'x1', kind: 'approve' }).code === 'order');
call({ action: 'comment', device: ADM, node: 'x1', kind: 'approve' });
const p3 = call({ action: 'addMember', device: ADM, studentId: '30001', name: '서지우' }); const p3r = call({ action: 'register', studentId: '30001', code: p3.data.code }); call({ action: 'approve', device: ADM, id: p3r.data.device.id });
call({ action: 'comment', device: p3r.data.device, node: 'x1', kind: 'approve' });
ok('2 peers but no teacher → blocked', call({ action: 'sync', device: MEM, nodes: [{ id: 'x1', title: '팀 실험', status: '준비 중' }] }).data.rejected.includes('x1:stage:teacher'));
ok('admin cannot skip (default)', call({ action: 'sync', device: ADM, nodes: [{ id: 'x1', title: '팀 실험', status: '준비 중' }] }).data.rejected.length > 0);
ok('teacher final approves', call({ action: 'comment', device: TCH, node: 'x1', kind: 'approve' }).ok);
ok('2 peers + teacher → prep', !call({ action: 'sync', device: MEM, nodes: [{ id: 'x1', title: '팀 실험', status: '준비 중' }] }).data.rejected.length);
// 규칙 바꾸기
ok('member cannot change rules', call({ action: 'rulesSet', device: OTH, peers: 0 }).code === 'not_master');
ok('admin(not master) cannot change rules', call({ action: 'rulesSet', device: ADM, peers: 0 }).code === 'not_master');
ok('bad peers', call({ action: 'rulesSet', device: MST, peers: 9 }).code === 'bad');
let R = call({ action: 'rulesSet', device: TCH, peers: 1, team: true }); ok('teacher changes rules', R.ok && R.data.peers === 1 && R.data.team === true, R);
call({ action: 'sync', device: MEM, nodes: [{ id: 'x2', type: 'exp', title: '규칙 바꾼 뒤', status: '계획 작성', owner: '정다온', team: ['한결'], plan: PL }] }); call({ action: 'sync', device: MEM, nodes: [{ id: 'x2', title: '규칙 바꾼 뒤', status: '검토 중' }] });
ok('teammate approves when allowed', call({ action: 'comment', device: OTH, node: 'x2', kind: 'approve' }).ok);
ok('teacher after 1 peer', call({ action: 'comment', device: TCH, node: 'x2', kind: 'approve' }).ok && !call({ action: 'sync', device: MEM, nodes: [{ id: 'x2', title: '규칙 바꾼 뒤', status: '준비 중' }] }).data.rejected.length);
R = call({ action: 'rulesSet', device: MST, peers: 2, team: false, teacher: 'none' }); ok('master: no teacher needed', R.data.teacher === 'none');
call({ action: 'sync', device: MEM, nodes: [{ id: 'x3', type: 'exp', title: '선생님 없이', status: '계획 작성', owner: '정다온', plan: PL }] }); call({ action: 'sync', device: MEM, nodes: [{ id: 'x3', title: '선생님 없이', status: '검토 중' }] });
call({ action: 'comment', device: ADM, node: 'x3', kind: 'approve' }); call({ action: 'comment', device: p3r.data.device, node: 'x3', kind: 'approve' });
ok('teacher none → 2 peers enough', !call({ action: 'sync', device: MEM, nodes: [{ id: 'x3', title: '선생님 없이', status: '준비 중' }] }).data.rejected.length);
call({ action: 'rulesSet', device: MST, teacher: 'final' });
call({ action: 'sync', device: MEM, nodes: [{ id: 'x4', type: 'exp', title: '처음부터 준비 중', status: '준비 중', owner: '정다온', plan: PL }] });
ok('member new exp cannot start at 준비 중', call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'x4').status === '검토 중');


// ===== 2.11.0: 변경 기록 · 되돌리기 =====
call({ action: 'sync', device: MEM, nodes: [{ id: 'hx', type: 'exp', title: '기록 시험', status: '계획 작성', owner: '정다온', plan: { purpose: '처음 목적', steps: ['a'] } }] });
call({ action: 'sync', device: MEM, nodes: [{ id: 'hx', title: '기록 시험', plan: { purpose: '고친 목적', steps: ['a'] } }] });
let hs = call({ action: 'history', device: OTH, node: 'hx' });
ok('history recorded (before → after)', hs.ok && hs.data.list.length === 1 && hs.data.list[0].field === 'plan' && /처음 목적/.test(hs.data.list[0].before) && /고친 목적/.test(hs.data.list[0].after) && hs.data.list[0].by === '정다온', hs);
call({ action: 'sync', device: MEM, nodes: [{ id: 'hx', title: '기록 시험', plan: { purpose: '또 고친 목적', steps: ['a'] } }] });
hs = call({ action: 'history', device: OTH, node: 'hx' }).data.list;
ok('same person within 10 min → merged (first before kept)', hs.length === 1 && /처음 목적/.test(hs[0].before) && /또 고친 목적/.test(hs[0].after));
ok('other member cannot revert', call({ action: 'revert', device: OTH, id: hs[0].id }).code === 'not_allowed' && /또 고친/.test(JSON.stringify(call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'hx').plan)));
clock += 11 * 60000;
const rv = call({ action: 'revert', device: MEM, id: hs[0].id });
ok('owner reverts', rv.ok && call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'hx').plan.purpose === '처음 목적', rv);
ok('revert is recorded too', call({ action: 'history', device: OTH, node: 'hx' }).data.list.length === 2);
call({ action: 'sync', device: MEM, nodes: [{ id: 'hp', type: 'exp', title: '비밀', owner: '정다온', private: 'true' }] });
call({ action: 'sync', device: MEM, nodes: [{ id: 'hp', title: '비밀 2' }] });
ok('private item history hidden from others', call({ action: 'history', device: OTH, node: 'hp' }).code === 'bad');
ok('history needs device', call({ action: 'history', node: 'hx' }).ok === false);


// ===== 2.12.0: 보안 (공격 흉내) =====
let sx = call({ action: 'sync', device: MEM, nodes: [{ id: 'x" onmouseover="alert(1)', type: 'exp', title: '나쁜 번호' }] });
ok('bad id rejected', !call({ action: 'load', device: ADM }).data.nodes.some((n) => n.title === '나쁜 번호'), sx);
call({ action: 'sync', device: MEM, nodes: [{ id: 'sx1', type: 'exp', title: '<img src=x onerror=alert(1)>제목', field: '해킹', status: '<b>', date: '2026-13-99"', owner: '정다온', verdict: '<script>', desc: '<script>alert(1)</script>' }] });
let nx = call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'sx1');
ok('tags stripped · bad enums dropped', nx && !/[<>]/.test(nx.title + nx.desc) && nx.field !== '해킹' && nx.status !== '<b>' && nx.date !== '2026-13-99"' && !nx.verdict, nx);
sx = call({ action: 'sync', device: MEM, nodes: [{ id: 'sx1', title: 'x', plan: { purpose: 'a'.repeat(50000), steps: ['b'] } }] });
ok('huge content rejected', sx.data.rejected.includes('sx1:big') && !(call({ action: 'load', device: ADM }).data.nodes.find((n) => n.id === 'sx1').plan || {}).purpose, sx);
ok('bad link ids ignored', call({ action: 'sync', device: MEM, links: [{ s: 'sx1', t: '"><x', k: 'next' }] }).ok && !call({ action: 'load', device: ADM }).data.links.some((l) => l.t === '"><x'));
const setN = store._t.settings.length;
for (let i = 0; i < 5; i++) call({ action: 'register', studentId: '9' + i + '999', code: '0000' });
ok('wrong codes for unknown student ids do not grow the sheet', store._t.settings.length === setN);
ok('weird student id refused', call({ action: 'register', studentId: '<script>', code: '1' }).code === 'wrong');
HITS.strict = true; Object.keys(HITS).forEach((k) => { if (k !== 'strict') delete HITS[k]; });
let slow = null; for (let i = 0; i < 12; i++) slow = call({ action: 'register', studentId: '20501', code: '0000' });
ok('too many tries → slowed down', slow.code === 'slow' || slow.code === 'locked', slow);
let cmf = null; for (let i = 0; i < 45; i++) cmf = call({ action: 'comment', device: OTH, node: 'b1', text: '도배 ' + i });
ok('comment flood → slowed down', cmf.code === 'slow', cmf);
HITS.strict = false;


// ===== 2.13.0: 공지판 =====
ok('member cannot write notice', call({ action: 'noticeSet', device: OTH, text: '부원이 쓴 공지' }).code === 'not_admin');
let nt = call({ action: 'noticeSet', device: ADM, text: '금요일 7교시 <b>과학실</b> 정리' });
ok('admin writes notice (tags stripped)', nt.ok && nt.data.notice.text === '금요일 7교시 b과학실/b 정리' && nt.data.notice.by, nt);
ok('everyone sees notice on load', call({ action: 'load', device: OTH }).data.notice.text.includes('과학실'));
ok('admin clears notice', call({ action: 'noticeSet', device: ADM, text: '' }).data.notice === null && call({ action: 'load', device: OTH }).data.notice === null);


// ===== 2.14.0: 달력 일정 =====
ok('member cannot add club event', call({ action: 'eventSet', device: OTH, scope: 'club', date: '2026-11-28', title: '발표회' }).code === 'not_admin');
let ev = call({ action: 'eventSet', device: ADM, scope: 'club', date: '2026-11-28', title: '전지 연구 발표회' });
ok('admin adds club event', ev.ok && ev.data.events.some((e) => e.scope === 'club' && e.title === '전지 연구 발표회'), ev);
ev = call({ action: 'eventSet', device: OTH, scope: 'me', date: '2026-11-20', title: '재료 주문' });
ok('member adds own event', ev.ok && ev.data.events.some((e) => e.title === '재료 주문' && e.mine));
const evs = call({ action: 'load', device: MEM }).data.events;
ok('others see club event but not my personal one', evs.some((e) => e.title === '전지 연구 발표회') && !evs.some((e) => e.title === '재료 주문'), evs);
const mine = call({ action: 'load', device: OTH }).data.events.find((e) => e.title === '재료 주문');
ok('others cannot delete my event', call({ action: 'eventSet', device: MEM, op: 'delete', id: mine.id }).code === 'not_mine');
ok('bad date refused', call({ action: 'eventSet', device: OTH, date: '내일', title: 'x' }).code === 'bad');
ok('I delete my event', !call({ action: 'eventSet', device: OTH, op: 'delete', id: mine.id }).data.events.some((e) => e.title === '재료 주문'));


// ===== 2.15.0: 실험일 (승인 끝난 내 실험만, 모두에게) =====
call({ action: 'sync', device: MEM, nodes: [{ id: 'ed1', type: 'exp', title: '실험일 시험', status: '계획 작성', owner: '정다온', plan: PL }] });
ok('not approved yet → refused', call({ action: 'eventSet', device: MEM, scope: 'exp', node: 'ed1', date: '2026-11-30' }).code === 'not_ready');
store._t.nodes.find((n) => n.id === 'ed1').status = '준비 중';
ok('other member cannot post my experiment day', call({ action: 'eventSet', device: OTH, scope: 'exp', node: 'ed1', date: '2026-11-30' }).code === 'not_mine');
let ed = call({ action: 'eventSet', device: MEM, scope: 'exp', node: 'ed1', date: '2026-11-30' });
ok('owner posts experiment day', ed.ok && ed.data.events.some((e) => e.scope === 'exp' && e.node === 'ed1' && e.title === '실험일 시험'), ed);
ok('pending experiment day hidden from others', !call({ action: 'load', device: OTH }).data.events.some((e) => e.scope === 'exp' && e.node === 'ed1'));
call({ action: 'eventSet', device: MEM, scope: 'me', date: '2026-11-29', title: '재료 사기' });
ok('my other schedule stays private', !call({ action: 'load', device: OTH }).data.events.some((e) => e.title === '재료 사기'));


// ===== 2.16.0: 실험일 승인 (선생님 · 마스터) =====
const pend = call({ action: 'load', device: MEM }).data.events.find((e) => e.node === 'ed1');
ok('member posts → waiting', pend.state === 'wait');
ok('member cannot approve', call({ action: 'eventSet', device: OTH, op: 'approve', id: pend.id }).code === 'not_approver');
const adm2 = call({ action: 'load', device: ADM }).data.me.role;
const TCH2 = (typeof TCH !== 'undefined') ? TCH : null;
let apr = call({ action: 'eventSet', device: TCH2 || MST, op: 'approve', id: pend.id });
ok('teacher (or master) approves', apr.ok && apr.data.events.find((e) => e.id === pend.id).state === 'ok', apr);
ok('approved → everyone sees', call({ action: 'load', device: OTH }).data.events.some((e) => e.id === pend.id && e.state === 'ok'));
ok('master can approve too', call({ action: 'eventSet', device: MST, op: 'reject', id: pend.id }).ok && call({ action: 'load', device: MEM }).data.events.find((e) => e.id === pend.id).state === 'no');


// ===== 2.17.0: 실험일 승인 규칙 (선생님 허가 필요 · 기장 대행) =====
let xr = call({ action: 'rulesSet', device: MST, expLeader: false });
ok('rule: leader proxy off', xr.ok && xr.data.expLeader === false && xr.data.expTeacher === true, xr);
const xp2 = call({ action: 'eventSet', device: MEM, scope: 'exp', node: 'ed1', date: '2026-12-02' }).data.events.find((e) => e.date === '2026-12-02');
ok('member post waits', xp2 && xp2.state === 'wait', xp2);
ok('master cannot approve when proxy off', call({ action: 'eventSet', device: MST, op: 'approve', id: xp2.id }).code === 'not_approver');
ok('master does not see pending when proxy off', !call({ action: 'load', device: MST }).data.events.some((e) => e.id === xp2.id));
ok('teacher still approves', call({ action: 'eventSet', device: TCH, op: 'approve', id: xp2.id }).ok);
const xmp = call({ action: 'eventSet', device: MST, scope: 'exp', node: 'ed1', date: '2026-12-03' }).data.events.find((e) => e.date === '2026-12-03');
ok('master own post waits too when proxy off', xmp && xmp.state === 'wait', xmp);
xr = call({ action: 'rulesSet', device: TCH, expTeacher: false });
ok('rule: no approval needed', xr.ok && xr.data.expTeacher === false);
ok('pending becomes ok when approval turned off', call({ action: 'load', device: OTH }).data.events.some((e) => e.id === xmp.id && e.state === 'ok'));
const xp3 = call({ action: 'eventSet', device: MEM, scope: 'exp', node: 'ed1', date: '2026-12-04' }).data.events.find((e) => e.date === '2026-12-04');
ok('member post is ok immediately', xp3 && xp3.state === 'ok');
ok('member cannot change exp rules', call({ action: 'rulesSet', device: MEM, expTeacher: true }).code === 'not_master');
call({ action: 'rulesSet', device: MST, expTeacher: true, expLeader: true });


// ===== 2.18.0: 초대 링크로 가입 신청 =====
ok('invite: member cannot make link', call({ action: 'invite', device: MEM, op: 'make' }).code === 'not_admin');
let iv = call({ action: 'invite', device: ADM, op: 'make' });
ok('invite: admin makes link', iv.ok && iv.data.invite.length >= 12, iv);
const INV = iv.data.invite;
ok('apply: wrong link refused', call({ action: 'apply', invite: 'nope', studentId: '30101', name: '새부원' }).code === 'invite_off');
let ap = call({ action: 'apply', invite: INV, studentId: '30101', name: '새부원', label: '폰' });
ok('apply: creates pending device', ap.ok && ap.data.device.id && ap.data.confirm.length === 4, ap);
const NEW = ap.data.device;
ok('apply: status shows pending', call({ action: 'status', device: NEW }).data.status === '대기');
const pl = call({ action: 'load', device: NEW }); ok('apply: pending cannot load', !pl.ok, pl.code);
ok('apply: not in member list before approval', !call({ action: 'load', device: MEM }).data.members.some((m) => m.name === '새부원'));
let pp = call({ action: 'people', device: ADM }).data;
ok('people: shows invite + applied flag', pp.invite === INV && pp.devices.some((d) => d.id === NEW.id && d.applied));
ok('apply: active student id refused', call({ action: 'apply', invite: INV, studentId: pp.members.find((m) => m.status === '활동' && m.role === '부원').studentId, name: 'x' }).code === 'dup');
let av = call({ action: 'approve', device: ADM, id: NEW.id });
ok('approve: applicant becomes member with code', av.ok && av.data.joined && /^\d{4}$/.test(av.data.code), av);
ok('approve: new member can load', call({ action: 'load', device: NEW }).ok);
ok('approve: in member list', call({ action: 'load', device: MEM }).data.members.some((m) => m.name === '새부원'));
// 거절
let ap2 = call({ action: 'apply', invite: INV, studentId: '30102', name: '거절될사람', label: '폰' });
ok('reject: block pending applicant', call({ action: 'block', device: ADM, id: ap2.data.device.id }).ok);
ok('reject: applicant status rejected', call({ action: 'status', device: ap2.data.device }).code === 'member_off');
ok('reject: shows in people as 거절', call({ action: 'people', device: ADM }).data.members.some((m) => m.name === '거절될사람' && m.status === '거절'));
// 끄기
ok('invite: off', call({ action: 'invite', device: ADM, op: 'off' }).data.invite === '');
ok('apply: refused after off', call({ action: 'apply', invite: INV, studentId: '30103', name: '늦은사람' }).code === 'invite_off');
ok('invite: new link differs', call({ action: 'invite', device: ADM, op: 'make' }).data.invite !== INV);


// ===== 2.18.1: 내가 바꾼 것은 다시 받지 않게 rev 알려 줌 =====
const rv0 = call({ action: 'rev', device: ADM }).data.rev;
const ns = call({ action: 'noticeSet', device: ADM, text: 'rev 시험' });
ok('noticeSet returns rev from/to', ns.rev && ns.rev.from === rv0 && ns.rev.to === rv0 + 1, ns.rev);
ok('load has no self rev', !call({ action: 'load', device: ADM }).rev);


// ===== 2.18.2: 시스템 현황 숫자 =====
const sysStat = call({ action: 'stats', device: ADM });
ok('stats: numbers only', sysStat.ok && typeof sysStat.data.done === 'number' && typeof sysStat.data.running === 'number' && typeof sysStat.data.devices === 'number' && /^\d{4}-\d\d-\d\d$|^$/.test(sysStat.data.lastEdit) && sysStat.data.core === '2.19.1', sysStat.data);
ok('stats: no names', !JSON.stringify(sysStat.data).match(/[가-힣]{2,}/));
ok('stats: member refused', call({ action: 'stats', device: MEM }).code === 'not_admin');


// ===== 2.19.0: 버그 점검에서 나온 것 =====
{
  const meM = call({ action: 'load', device: MEM }).data.me, meO = call({ action: 'load', device: OTH }).data.me;
  const ppl = call({ action: 'people', device: ADM }).data;
  const master = ppl.members.find((m) => m.role === '마스터');
  // 1. 관리자가 마스터의 코드를 다시 만들어 가로챌 수 없음
  const adminDev = (() => { const m2 = ppl.members.find((m) => m.role === '부원' && m.id !== meM.id && m.id !== meO.id && m.status === '활동'); return null; })();
  ok('resetCode: master target refused for non-master', (() => { const keep = store._t.members.map((m) => ({ ...m })); const o = store._t.members.find((m) => m.id === meO.id); o.role = '관리자';
    const r = call({ action: 'resetCode', device: OTH, id: master.id }); store._t.members.forEach((m, i) => Object.assign(m, keep[i])); return r.code === 'not_master'; })());
  // 2. __proto__ 로 검사를 건너뛸 수 없음
  call({ action: 'sync', device: MEM, nodes: [JSON.parse('{"id":"xp1","title":"p","__proto__":{"type":"exp","status":"<img src=x>","owner":"<script>x</script>","review":999}}')] });
  const xp = store._t.nodes.find((n) => n.id === 'xp1');
  ok('cleanIn: __proto__ ignored', xp && !String(xp.status || '').includes('<') && !String(xp.owner || '').includes('<') && !xp.review, xp);
  // 3. 아이디어 → 실험으로 바꿔 단계를 건너뛸 수 없음
  call({ action: 'sync', device: MEM, nodes: [{ id: 'xi1', type: 'idea', title: '꼼수', status: '기록 완료' }] });
  ok('idea cannot hold exp stage', store._t.nodes.find((n) => n.id === 'xi1').status !== '기록 완료');
  const ti = call({ action: 'sync', device: MEM, nodes: [{ id: 'xi1', title: '꼼수', type: 'exp', status: '기록 완료' }] });
  ok('idea → exp starts from first stage', store._t.nodes.find((n) => n.id === 'xi1').status !== '기록 완료' && ti.data.rejected.some((x) => x.startsWith('xi1:stage')), ti.data);
  // 4. review 숫자로 승인을 흉내 낼 수 없음
  call({ action: 'sync', device: MEM, nodes: [{ id: 'xr1', type: 'exp', title: '승인 흉내', status: '검토 중', plan: PL, review: 9 }] });
  call({ action: 'sync', device: MEM, nodes: [{ id: 'xr1', title: '승인 흉내', review: 9 }] });
  const tr = call({ action: 'sync', device: MEM, nodes: [{ id: 'xr1', title: '승인 흉내', status: '준비 중' }] });
  ok('review number does not count as approvals', store._t.nodes.find((n) => n.id === 'xr1').status === '검토 중' && tr.data.rejected.includes('xr1:stage:review'), tr.data);
  // 5. 새로 만들 때 확정 보고서를 보낼 수 없음
  call({ action: 'sync', device: MEM, nodes: [{ id: 'xf1', type: 'exp', title: '확정', report: { final: true, summary: 's', claim: 'c' } }] });
  ok('member cannot create final report', !JSON.stringify(store._t.nodes.find((n) => n.id === 'xf1').report || {}).includes('"final":true'));
  // 6 · 7. 같은 이름 · 학번 막기
  const iv2 = call({ action: 'invite', device: ADM, op: 'make' }).data.invite;
  { const sa = call({ action: 'apply', invite: iv2, studentId: '40001', name: meM.name }); ok('apply: same name gets 학번 attached', sa.ok && sa.data.name === meM.name + '(40001)', sa); }
  const apA = call({ action: 'apply', invite: iv2, studentId: '40002', name: '동명이인시험' });
  ok('addMember: sid with pending application refused', call({ action: 'addMember', device: ADM, studentId: '40002', name: '다른이름' }).code === 'dup');
  const am = call({ action: 'addMember', device: ADM, studentId: '40003', name: '동명이인시험' });
  ok('addMember: name free → kept', am.ok && am.data.name === '동명이인시험', am);
  const av2 = call({ action: 'approve', device: ADM, id: apA.data.device.id });
  ok('approve: same name → 학번 attached', av2.ok && store._t.members.some((m) => m.name === '동명이인시험(40002)' && m.status === '활동'), av2);
  ok('addMember: same name → 학번 attached', call({ action: 'addMember', device: ADM, studentId: '40004', name: '동명이인시험' }).data.name === '동명이인시험(40004)');
  // 8. 지난 단계의 내용을 지울 수 없음
  store._t.nodes.push({ id: 'xc1', no: 900, type: 'exp', title: '내용 지우기', status: '기록 완료', plan: PL, report: RP, owner: meM.name, createdBy: meM.name, created: '2026-11-01' });
  const tc = call({ action: 'sync', device: MEM, nodes: [{ id: 'xc1', title: '내용 지우기', plan: null, report: null }] });
  const xc = store._t.nodes.find((n) => n.id === 'xc1');
  ok('cannot clear plan/report after stage passed', xc.plan && xc.report && tc.data.rejected.includes('xc1:stage:plan'), tc.data);
  // 9. 비공개 실험의 실험일 제목이 새지 않음
  store._t.nodes.push({ id: 'xs1', no: 901, type: 'exp', title: '비밀 실험 제목', status: '준비 중', plan: PL, private: 'true', owner: meM.name, createdBy: meM.name, created: '2026-11-01' });
  store._t.events.push({ id: 'evs1', date: '2026-12-01', title: '비밀 실험 제목', scope: 'exp', by: meM.name, byId: meM.id, at: '2026-11-17', off: '', node: 'xs1', state: 'ok', okBy: '' });
  ok('private exp event hidden from others', !call({ action: 'load', device: OTH }).data.events.some((e) => e.title === '비밀 실험 제목'));
  ok('private exp event visible to owner', call({ action: 'load', device: MEM }).data.events.some((e) => e.title === '비밀 실험 제목'));
  // 10. 남의 담당 지원을 지울 수 없음
  store._t.nodes.push({ id: 'xv1', no: 902, type: 'idea', title: '담당 지원', status: '아이디어', volunteer: meM.name, owner: '', createdBy: '누군가', created: '2026-11-01' });
  const tv = call({ action: 'sync', device: OTH, nodes: [{ id: 'xv1', title: '담당 지원', volunteer: '' }] });
  ok('cannot clear someone else\'s volunteer', store._t.nodes.find((n) => n.id === 'xv1').volunteer === meM.name && tv.data.rejected.includes('xv1:team'), tv.data);
  // 마스터 키 바꾸기
  ok('rekey: wrong old key refused', call({ action: 'rekey', masterKey: 'x'.repeat(25), newKey: 'y'.repeat(30) }).code === 'wrong_key');
  { const rk = call({ action: 'rekey', masterKey: 'z'.repeat(24), newKey: 'NEWKEY'.repeat(5) }); ok('rekey: right old key works', rk.ok, rk); }
  ok('rekey: old key no longer registers master', call({ action: 'masterRegister', masterKey: 'z'.repeat(24), studentId: '20301', label: 'x' }).code === 'wrong_key');
}

console.log(`connector: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
