/* 가지 연결기 본체 (core.js)
 * ------------------------------------------------------------
 * 각 동아리 시트의 '연결기 껍데기'가 이 파일을 받아 실행합니다. 이 파일이 바뀌면 모든 동아리에 자동으로 적용돼요.
 * 누구나 이 주소에서 내용을 볼 수 있어요: https://gaji-lab.web.app/core.js
 * 시트 '설정' 탭에 autoUpdate = off 를 넣으면 그 동아리는 마지막으로 받은 판에 머물러요.
 * ------------------------------------------------------------ */
var GAJI_CORE = true;
var GAJI_CONNECTOR_VERSION = '2.2.0';

/* ================= 핵심 로직 (저장소와 분리: 시험 가능) ================= */
function GajiCore(store, util) {
  var STAGES = ['아이디어', '계획 작성', '검토 중', '준비 중', '실험 완료', '기록 완료'];
  var ADMIN = { '관리자': 1, '마스터': 1 };
  var EXPIRE_DAYS = 60, LOCK_FAILS = 5, LOCK_MIN = 30;

  function err(code, msg) { var e = new Error(msg || code); e.code = code; throw e; }
  function setting(k, d) { var r = store.rows('settings').filter(function (x) { return x.key === k; })[0]; return r ? r.value : d; }
  function setSetting(k, v) { var r = store.rows('settings').filter(function (x) { return x.key === k; })[0]; if (r) store.update('settings', r._row, { key: k, value: String(v) }); else store.append('settings', { key: k, value: String(v) }); }
  function bump() { setSetting('rev', Number(setting('rev', '0')) + 1); }
  function log(me, action, detail) { store.append('log', { at: util.now(), member: me ? me.name : '', device: me ? me.deviceId : '', action: action, detail: String(detail || '').slice(0, 200) }); }
  function hash(salt, v) { return util.sha256(salt + ':' + v); }
  function digits(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(util.random() * 10); return s; }
  function newId(p) { return p + util.token(10); }
  function days(iso) { return iso ? (Date.parse(util.now()) - Date.parse(iso)) / 864e5 : 9999; }
  /* 개인 코드 잠금: 연결기 비밀 열쇠(스크립트 속성, 시트에 없음)로 숫자마다 섞어서 저장 → 본인만 다시 볼 수 있음 */
  function seal(id, code) { var k = util.sha256(util.secret() + ':code:' + id), o = ''; for (var i = 0; i < code.length; i++) o += (Number(code[i]) + parseInt(k.substr(i * 2, 2), 16)) % 10; return 'v1:' + o; }
  function unseal(id, v) { if (!v || v.indexOf('v1:') !== 0) return ''; v = v.slice(3); var k = util.sha256(util.secret() + ':code:' + id), o = ''; for (var i = 0; i < v.length; i++) o += (Number(v[i]) - parseInt(k.substr(i * 2, 2), 16) % 10 + 10) % 10; return o; }
  function val(v) { return v && typeof v === 'object' ? JSON.stringify(v) : str(v); }   // 기록(report) 같은 묶음 값 비교
  function str(v) { return v === undefined || v === null ? '' : String(v); }
  function initialized() { return setting('initializedAt', '') !== ''; }

  /* ---------- 기기 인증 ---------- */
  function deviceOf(req, allowPending) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    var d = req.device || {}, dev = store.rows('devices').filter(function (x) { return x.id === d.id; })[0];
    if (!dev || dev.secretHash !== hash(dev.id, d.secret || '')) err('no_device', '이 기기는 등록되지 않았어요');
    var mem = store.rows('members').filter(function (m) { return m.id === dev.memberId; })[0];
    if (!mem || mem.status !== '활동') err('member_off', '부원 명단에서 빠졌어요. 관리자에게 문의해 주세요');
    if (dev.status === '차단') err('blocked', '이 기기는 사용이 막혔어요');
    if (dev.status === '승인' && !util.bool(dev.shared) && days(dev.lastSeen || dev.approvedAt) > EXPIRE_DAYS) { dev.status = '만료'; store.update('devices', dev._row, dev); }
    if (!allowPending && dev.status !== '승인') err(dev.status === '만료' ? 'expired' : 'pending', dev.status === '만료' ? '오래 안 써서 다시 승인이 필요해요' : '아직 승인 전이에요');
    if (dev.status === '승인' && days(dev.lastSeen) > 0.01) { dev.lastSeen = util.now(); store.update('devices', dev._row, dev); }
    return { id: mem.id, name: mem.name, role: mem.role, studentId: mem.studentId, deviceId: dev.id, device: dev };
  }
  function needAdmin(me) { if (!ADMIN[me.role]) err('not_admin', '관리자만 할 수 있어요'); }

  /* ---------- 동작 ---------- */
  var A = {};
  A.ping = function () { return { version: GAJI_CONNECTOR_VERSION, initialized: initialized(), slug: setting('slug', ''), keyed: setting('masterKeyHash', '') !== '' }; };

  A.init = function (q) {
    if (initialized()) err('already', '이미 준비된 연결기예요');
    if (!q.slug || !q.name || !q.studentId) err('bad', '동아리 주소 · 이름 · 학번이 필요해요');
    store.ensure();
    setSetting('slug', q.slug); setSetting('version', GAJI_CONNECTOR_VERSION); setSetting('rev', 1);
    setSetting('no_exp', q.startNo || 0); setSetting('no_q', 0); setSetting('no_res', 0);
    if (q.masterKey) setSetting('masterKeyHash', hash('master', q.masterKey));
    var code = digits(4), mid = newId('m');
    store.append('members', { id: mid, studentId: String(q.studentId), name: String(q.name).slice(0, 20), role: '마스터', codeHash: hash(mid, code), codeEnc: seal(mid, code), status: '활동', createdAt: util.now() });
    var did = newId('d'), secret = util.token(32);
    store.append('devices', { id: did, memberId: mid, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '승인', confirm: '', shared: 'false', createdAt: util.now(), approvedAt: util.now(), approvedBy: '처음 설정', lastSeen: util.now() });
    setSetting('initializedAt', util.now());
    log({ name: q.name, deviceId: did }, '연결기 준비', q.slug);
    return { device: { id: did, secret: secret }, code: code };
  };

  A.register = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    var sid = String(q.studentId || '').trim(), lockKey = 'lock_' + sid, lk = setting(lockKey, '');
    var fails = 0;
    if (lk) { var p = lk.split('|'); fails = days(p[1]) * 1440 < LOCK_MIN ? Number(p[0]) : 0; if (fails >= LOCK_FAILS) err('locked', '여러 번 틀려서 30분 동안 잠겼어요'); }
    var mem = store.rows('members').filter(function (m) { return m.studentId === sid && m.status === '활동'; })[0];
    if (!mem || mem.codeHash !== hash(mem.id, String(q.code || ''))) {
      setSetting(lockKey, (fails + 1) + '|' + util.now());
      err('wrong', '학번 또는 개인 코드가 맞지 않아요');
    }
    if (lk) setSetting(lockKey, '');
    var did = newId('d'), secret = util.token(32), confirm = digits(4);
    store.append('devices', { id: did, memberId: mem.id, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '대기', confirm: confirm, shared: 'false', createdAt: util.now(), approvedAt: '', approvedBy: '', lastSeen: '' });
    bump(); log({ name: mem.name, deviceId: did }, '기기 승인 요청', q.label);
    return { device: { id: did, secret: secret }, confirm: confirm, name: mem.name };
  };

  A.status = function (q) { var me = deviceOf(q, true); return { status: me.device.status, name: me.name, confirm: me.device.confirm }; };

  /* 동아리 마스터(가지에 구글로 로그인한 사람)의 새 기기: 마스터 키로 바로 승인.
     마스터가 바뀌면 새 마스터의 학번으로 마스터 역할이 옮겨 감.
     키를 잃어버리면 시트 '설정' 탭의 masterKeyHash 값을 지우면 다음 키로 다시 맞춰짐 (시트 편집 권한 = 드라이브 주인만). */
  A.masterRegister = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    var kh = setting('masterKeyHash', ''), key = String(q.masterKey || '');
    if (key.length < 20) err('bad', '마스터 키가 없어요');
    if (kh && kh !== hash('master', key)) err('wrong_key', '이 동아리의 연결기가 아니에요');
    if (!kh) setSetting('masterKeyHash', hash('master', key));
    if (q.slug) setSetting('slug', q.slug);
    var sid = String(q.studentId || '').trim(), code = '';
    if (!sid) err('bad', '학번을 넣어 주세요');
    var mem = store.rows('members').filter(function (m) { return m.studentId === sid && m.status === '활동'; })[0];
    if (!mem) {
      if (!q.name) err('need_name', '처음 쓰는 학번이에요. 이름도 넣어 주세요');
      code = digits(4); var mid = newId('m');
      store.append('members', { id: mid, studentId: sid, name: String(q.name).slice(0, 20), role: '마스터', codeHash: hash(mid, code), codeEnc: seal(mid, code), status: '활동', createdAt: util.now() });
      mem = store.rows('members').filter(function (m) { return m.id === mid; })[0];
    }
    var mid2 = mem.id;
    store.rows('members').forEach(function (m) { if (m.id !== mid2 && m.role === '마스터') { m.role = '관리자'; store.update('members', m._row, m); } });
    if (mem.role !== '마스터') { mem.role = '마스터'; store.update('members', mem._row, mem); }
    var did = newId('d'), secret = util.token(32);
    store.append('devices', { id: did, memberId: mem.id, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '승인', confirm: '', shared: 'false', createdAt: util.now(), approvedAt: util.now(), approvedBy: '마스터 키', lastSeen: util.now() });
    bump(); log({ name: mem.name, deviceId: did }, '마스터 기기 연결', q.label);
    return { device: { id: did, secret: secret }, name: mem.name, code: code };
  };

  A.myCode = function (q) {
    var me = deviceOf(q), m = store.rows('members').filter(function (x) { return x.id === me.id; })[0];
    if (!m) err('member_off', '부원 명단에서 빠졌어요');
    var code = unseal(m.id, m.codeEnc), renewed = false;
    if (!code) {   // 예전 판에서 만든 코드는 꺼낼 수 없음 → 새 코드를 만들어 줌 (쓰던 기기는 그대로)
      code = digits(4); m.codeHash = hash(m.id, code); m.codeEnc = seal(m.id, code); store.update('members', m._row, m);
      renewed = true; log(me, '내 코드 새로 만듦', '');
    }
    return { code: code, name: me.name, studentId: me.studentId, renewed: renewed };
  };

  A.rev = function (q) { deviceOf(q); return { rev: Number(setting('rev', '0')) }; };

  A.load = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    var nodes = store.rows('nodes').filter(function (n) { return !util.bool(n.private) || admin || n.owner === me.name; }).map(cleanNode);
    var members = store.rows('members').filter(function (m) { return m.status === '활동'; }).map(function (m) { return { id: m.id, name: m.name, role: m.role }; });
    var mine = store.rows('devices').filter(function (d) { return d.memberId === me.id; });
    var notice = mine.filter(function (d) { return d.id !== me.deviceId && d.status === '승인' && days(d.approvedAt) < 7; }).map(function (d) { return { id: d.id, label: d.label, at: d.approvedAt }; });
    return {
      rev: Number(setting('rev', '0')), me: { id: me.id, name: me.name, role: me.role }, nodes: nodes,
      links: store.rows('links').map(function (l) { return { id: l.id, s: l.s, t: l.t, k: l.k }; }),
      lines: store.rows('lines').reduce(function (o, l) { o[l.key] = l.name; return o; }, {}),
      members: members, newDevices: notice,
      lastNo: { exp: Number(setting('no_exp', 0)), q: Number(setting('no_q', 0)), res: Number(setting('no_res', 0)) }
    };
  };
  function cleanNode(n) { var o = {}; Object.keys(n).forEach(function (k) { if (k !== '_row') o[k] = n[k]; }); return o; }

  var NODE_FIELDS = ['type', 'title', 'field', 'status', 'line', 'date', 'owner', 'signal', 'review', 'verdict', 'fans', 'volunteer', 'equip', 'desc', 'private', 'report'];
  A.sync = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    return util.lock(function () {
      var rows = store.rows('nodes'), byId = {}, assigned = {}, rejected = [];
      rows.forEach(function (r) { byId[r.id] = r; });
      (q.nodes || []).slice(0, 50).forEach(function (c) {
        if (!c || !c.id || !c.title) return;
        var old = byId[c.id];
        if (!old) {
          var fam = c.type === 'q' ? 'q' : c.type === 'res' ? 'res' : 'exp', no = Number(setting('no_' + fam, 0)) + 1;
          setSetting('no_' + fam, no);
          var n = { id: String(c.id).slice(0, 40), no: no, created: util.today(), createdBy: me.name, updatedAt: util.now(), updatedBy: me.name };
          NODE_FIELDS.forEach(function (f) { if (f in c) n[f] = c[f]; });
          if (!admin) n.verdict = '';
          store.append('nodes', n); assigned[n.id] = no; log(me, '새로 만듦', n.title);
          return;
        }
        var u = cleanNode(old), changed = false;
        NODE_FIELDS.forEach(function (f) {
          if (!(f in c) || val(c[f]) === val(old[f])) return;
          if (!admin && f === 'verdict') { rejected.push(old.id + ':verdict'); return; }
          if (!admin && f === 'status' && STAGES.indexOf(c.status) >= 0 && STAGES.indexOf(c.status) < STAGES.indexOf(old.status)) {
            // 부원: 내가 방금(10분 안) 옮긴 단계는 한 단계만 되돌릴 수 있음 (실수 되돌리기)
            var mine = old.updatedBy === me.name && (Date.parse(util.now()) - Date.parse(old.updatedAt || 0)) < 10 * 60000 && STAGES.indexOf(c.status) === STAGES.indexOf(old.status) - 1;
            if (!mine) { rejected.push(old.id + ':status'); return; }
          }
          if (!admin && f === 'status' && c.status === '취소') { rejected.push(old.id + ':cancel'); return; }
          if (f === 'type' && !((old.type === 'idea' && c.type === 'exp') || old.type === c.type)) return;
          if (f === 'private' && !admin && old.owner !== me.name) return;
          u[f] = c[f]; changed = true;
        });
        if (changed) { u.updatedAt = util.now(); u.updatedBy = me.name; store.update('nodes', old._row, u); log(me, '수정', old.title); }
      });
      var links = store.rows('links'), key = {};
      links.forEach(function (l) { key[l.s + '|' + l.t + '|' + l.k] = 1; });
      (q.links || []).slice(0, 50).forEach(function (l) {
        if (!l || !l.s || !l.t || l.s === l.t || key[l.s + '|' + l.t + '|' + l.k]) return;
        if (['follow', 'next', 'q', 'res', 'rel'].indexOf(l.k) < 0) return;
        store.append('links', { id: newId('l'), s: l.s, t: l.t, k: l.k, createdBy: me.name, createdAt: util.now() }); key[l.s + '|' + l.t + '|' + l.k] = 1;
      });
      var lines = store.rows('lines'), lk = {};
      lines.forEach(function (l) { lk[l.key] = l; });
      Object.keys(q.lines || {}).slice(0, 50).forEach(function (k) { var name = String(q.lines[k]).slice(0, 20); if (!lk[k]) store.append('lines', { key: k, name: name }); else if (lk[k].name !== name && admin) store.update('lines', lk[k]._row, { key: k, name: name }); });
      bump();
      return { ok: true, assigned: assigned, rejected: rejected, rev: Number(setting('rev', '0')) };
    });
  };

  /* ---------- 관리자: 부원 · 기기 ---------- */
  A.people = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var devs = store.rows('devices');
    return {
      members: store.rows('members').map(function (m) { return { id: m.id, studentId: m.studentId, name: m.name, role: m.role, status: m.status, devices: devs.filter(function (d) { return d.memberId === m.id && d.status === '승인'; }).length }; }),
      devices: devs.filter(function (d) { return d.status !== '차단'; }).map(function (d) { var m = store.rows('members').filter(function (x) { return x.id === d.memberId; })[0] || {};
        return { id: d.id, member: m.name || '', studentId: m.studentId || '', label: d.label, status: d.status, confirm: d.status === '대기' ? d.confirm : '', shared: util.bool(d.shared), createdAt: d.createdAt, lastSeen: d.lastSeen,
          others: devs.filter(function (x) { return x.memberId === d.memberId && x.id !== d.id && x.status === '승인'; }).length }; })
    };
  };
  A.addMember = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var sid = String(q.studentId || '').trim(), name = String(q.name || '').trim().slice(0, 20);
    if (!sid || !name) err('bad', '학번과 이름을 넣어 주세요');
    if (store.rows('members').some(function (m) { return m.studentId === sid && m.status === '활동'; })) err('dup', '이미 있는 학번이에요');
    var id = newId('m'), code = digits(4);
    store.append('members', { id: id, studentId: sid, name: name, role: '부원', codeHash: hash(id, code), codeEnc: seal(id, code), status: '활동', createdAt: util.now() });
    bump(); log(me, '부원 추가', name);
    return { id: id, code: code };
  };
  A.resetCode = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var m = store.rows('members').filter(function (x) { return x.id === q.id; })[0]; if (!m) err('bad');
    var code = digits(4); m.codeHash = hash(m.id, code); m.codeEnc = seal(m.id, code); store.update('members', m._row, m);
    store.rows('devices').forEach(function (d) { if (d.memberId === m.id && d.status !== '차단') { d.status = '차단'; store.update('devices', d._row, d); } });
    bump(); log(me, '코드 재발급 · 기기 해제', m.name);
    return { code: code };
  };
  A.setMember = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var m = store.rows('members').filter(function (x) { return x.id === q.id; })[0]; if (!m) err('bad');
    if (m.role === '마스터') err('bad', '마스터는 바꿀 수 없어요');
    if (q.role && q.role !== m.role) { if (me.role !== '마스터') err('not_master', '역할은 마스터만 바꿀 수 있어요'); if (['부원', '관리자'].indexOf(q.role) < 0) err('bad'); m.role = q.role; }
    if (q.status && q.status !== m.status) { m.status = q.status === '중지' ? '중지' : '활동';
      if (m.status === '중지') store.rows('devices').forEach(function (d) { if (d.memberId === m.id && d.status !== '차단') { d.status = '차단'; store.update('devices', d._row, d); } }); }
    store.update('members', m._row, m); bump(); log(me, '부원 변경', m.name + ' ' + m.role + ' ' + m.status);
    return { ok: true };
  };
  A.getDevice = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var r = A.people(q).devices.filter(function (d) { return d.id === q.id; })[0]; if (!r) err('bad', '요청을 찾을 수 없어요'); return r;
  };
  A.approve = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var d = store.rows('devices').filter(function (x) { return x.id === q.id; })[0]; if (!d) err('bad', '요청을 찾을 수 없어요');
    if (q.confirm && d.confirm && String(q.confirm) !== String(d.confirm)) err('confirm', '확인 숫자가 달라요');
    d.status = '승인'; d.shared = q.shared ? 'true' : 'false'; d.approvedAt = util.now(); d.approvedBy = me.name; d.confirm = ''; d.lastSeen = util.now();
    store.update('devices', d._row, d); bump(); log(me, '기기 승인', d.label);
    return { ok: true };
  };
  A.block = function (q) {
    var me = deviceOf(q);
    var d = store.rows('devices').filter(function (x) { return x.id === q.id; })[0]; if (!d) err('bad');
    if (d.memberId !== me.id) needAdmin(me);   // 본인 기기는 본인이 끊을 수 있음 ('내가 아님')
    d.status = '차단'; store.update('devices', d._row, d); bump(); log(me, '기기 차단', d.label);
    return { ok: true };
  };
  A.logoutAll = function (q) {
    var me = deviceOf(q); needAdmin(me);
    store.rows('devices').forEach(function (d) { if (d.id !== me.deviceId && d.status === '승인') { d.status = '만료'; store.update('devices', d._row, d); } });
    bump(); log(me, '모든 기기 로그아웃', '');
    return { ok: true };
  };
  A.stats = function (q) {
    var me = deviceOf(q); needAdmin(me);
    return { members: store.rows('members').filter(function (m) { return m.status === '활동'; }).length, experiments: store.rows('nodes').filter(function (n) { return n.type === 'exp'; }).length, ideas: store.rows('nodes').filter(function (n) { return n.type === 'idea'; }).length };
  };

  return {
    handle: function (q) {
      try {
        var fn = A[q && q.action]; if (!fn) err('unknown', '알 수 없는 요청이에요');
        return { ok: true, data: fn(q) };
      } catch (e) { return { ok: false, code: e.code || 'error', message: e.code ? e.message : '연결기에서 문제가 생겼어요' }; }
    }
  };
}

/* ================= 구글 시트 저장소 ================= */
var GAJI_TABS = {
  settings: { name: '설정', cols: ['key', 'value'] },
  members: { name: '부원', cols: ['id', 'studentId', 'name', 'role', 'codeHash', 'status', 'createdAt', 'codeEnc'] },
  devices: { name: '기기', cols: ['id', 'memberId', 'label', 'secretHash', 'status', 'confirm', 'shared', 'createdAt', 'approvedAt', 'approvedBy', 'lastSeen'] },
  nodes: { name: '실험', cols: ['id', 'no', 'type', 'title', 'field', 'status', 'line', 'date', 'owner', 'signal', 'review', 'verdict', 'fans', 'volunteer', 'equip', 'desc', 'private', 'report', 'created', 'createdBy', 'updatedAt', 'updatedBy'] },
  links: { name: '연결', cols: ['id', 's', 't', 'k', 'createdBy', 'createdAt'] },
  lines: { name: '줄기', cols: ['key', 'name'] },
  log: { name: '기록', cols: ['at', 'member', 'device', 'action', 'detail'] }
};
var GAJI_NUM = { no: 1, signal: 1, review: 1, fans: 1 };
var GAJI_JSON = { report: 1 };

function GajiSheetStore(ss) {
  var cache = {};
  function sheet(t) {
    var def = GAJI_TABS[t], sh = ss.getSheetByName(def.name);
    if (!sh) { sh = ss.insertSheet(def.name); sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
    else if (sh.getLastColumn() < def.cols.length) sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]);   // 새 열 추가 (지우지 않음)
    return sh;
  }
  function enc(k, v) { if (v === undefined || v === null) return ''; if (GAJI_JSON[k]) return typeof v === 'string' ? v : JSON.stringify(v); return String(v); }
  function dec(k, v) { if (GAJI_NUM[k]) return v === '' ? 0 : Number(v); if (GAJI_JSON[k]) { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } } return v === undefined ? '' : String(v); }
  return {
    ensure: function () { Object.keys(GAJI_TABS).forEach(sheet); var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1'); if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1); },
    rows: function (t) {
      if (cache[t]) return cache[t];
      var def = GAJI_TABS[t], sh = sheet(t), last = sh.getLastRow();
      if (last < 2) return (cache[t] = []);
      var vals = sh.getRange(2, 1, last - 1, def.cols.length).getDisplayValues();
      return (cache[t] = vals.map(function (r, i) { var o = { _row: i + 2 }; def.cols.forEach(function (c, j) { o[c] = dec(c, r[j]); }); return o; }));
    },
    append: function (t, obj) { var def = GAJI_TABS[t]; sheet(t).appendRow(def.cols.map(function (c) { return enc(c, obj[c]); })); delete cache[t]; },
    update: function (t, row, obj) { var def = GAJI_TABS[t]; sheet(t).getRange(row, 1, 1, def.cols.length).setValues([def.cols.map(function (c) { return enc(c, obj[c]); })]); delete cache[t]; }
  };
}

function gajiUtil() {
  return {
    now: function () { return new Date().toISOString(); },
    today: function () { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); },
    random: Math.random,
    token: function (n) { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', s = ''; var b = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); for (var i = 0; i < n; i++) s += a[(parseInt(b.substr((i * 2) % 60, 2), 16) + Math.floor(Math.random() * 256)) % a.length]; return s; },
    sha256: function (s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); },
    bool: function (v) { return v === true || v === 'true'; },
    secret: function () { var p = PropertiesService.getScriptProperties(), v = p.getProperty('GAJI_SECRET'); if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('GAJI_SECRET', v); } return v; },
    lock: function (fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
  };
}

/* ================= 껍데기가 부르는 입구 ================= */
function gajiPost(e) {
  var q = {}; try { q = JSON.parse(e.postData.contents); } catch (x) {}
  var core = GajiCore(GajiSheetStore(SpreadsheetApp.getActiveSpreadsheet()), gajiUtil());
  return q.action === 'init' ? gajiUtil().lock(function () { return core.handle(q); }) : core.handle(q);
}
function gajiGet() { return { ok: true, data: { gaji: true, version: GAJI_CONNECTOR_VERSION } }; }
