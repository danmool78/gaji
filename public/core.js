/* 가지 연결기 본체 (core.js)
 * ------------------------------------------------------------
 * 각 동아리 시트의 '연결기 껍데기'가 이 파일을 받아 실행합니다. 이 파일이 바뀌면 모든 동아리에 자동으로 적용돼요.
 * 누구나 이 주소에서 내용을 볼 수 있어요: https://gaji-lab.web.app/core.js
 * 시트 '설정' 탭에 autoUpdate = off 를 넣으면 그 동아리는 마지막으로 받은 판에 머물러요.
 * ------------------------------------------------------------ */
var GAJI_CORE = true;
var GAJI_CONNECTOR_VERSION = '2.22.2';

/* ================= 핵심 로직 (저장소와 분리: 시험 가능) ================= */
function GajiCore(store, util, drive) {
  var STAGES = ['아이디어', '계획 작성', '검토 중', '준비 중', '실험 완료', '기록 완료'];
  var ADMIN = { '관리자': 1, '마스터': 1, '교사': 1 };
  var EXPIRE_DAYS = 60, LOCK_FAILS = 5, LOCK_MIN = 30;

  function err(code, msg) { var e = new Error(msg || code); e.code = code; throw e; }
  function setting(k, d) { var r = store.rows('settings').filter(function (x) { return x.key === k; })[0]; return r ? r.value : d; }
  function setSetting(k, v) { var r = store.rows('settings').filter(function (x) { return x.key === k; })[0]; if (r) store.update('settings', r._row, { key: k, value: String(v) }); else store.append('settings', { key: k, value: String(v) }); }
  var SELF_REV = { noticeSet: 1, eventSet: 1, rulesSet: 1, sync: 1 };   // 응답으로 화면을 바로 고치는 요청
  var isStaff = function (m) { return m && (m.role === '마스터' || m.role === '교사' || m.role === '관리자'); };   // 마스터 · 선생님 · 운영진
  var memberOf = function (id) { return store.rows('members').filter(function (x) { return x.id === id; })[0]; };
  function realDate(d) { var t = Date.parse(String(d) + 'T00:00:00Z'); return /^\d{4}-\d\d-\d\d$/.test(String(d)) && !isNaN(t) && new Date(t).toISOString().slice(0, 10) === String(d); }
  function locked(fn) { return util.lock(function () { if (store.fresh) store.fresh(); return fn(); }); }
  function bump() { setSetting('rev', Number(setting('rev', '0')) + 1); }
  function log(me, action, detail) { store.append('log', { at: util.now(), member: me ? me.name : '', device: me ? me.deviceId : '', action: action, detail: String(detail || '').slice(0, 200) }); }
  function hash(salt, v) { return util.sha256(salt + ':' + v); }
  // 이름은 처음부터 '이름(학번)'으로 받음: 같은 이름도 학번으로 구분되고, 같은 이름(학번)이면 이미 가입된 사람
  function uniqName(name, sid, selfId) {
    var base = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(), tail = '(' + String(sid) + ')';
    name = (base.slice(0, Math.max(2, 20 - tail.length)) + tail).slice(0, 20);
    var taken = function (nm) { return store.rows('members').some(function (m) { return m.status === '활동' && m.id !== selfId && m.name === nm; }); };
    if (!taken(name)) return name;
    var nm = (name.slice(0, 20 - String(sid).length - 2) + '(' + sid + ')');
    return taken(nm) ? nm.slice(0, 16) + util.token(4) : nm;
  }
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
    if (!mem || (mem.status !== '활동' && !(allowPending && mem.status === '신청'))) err('member_off', mem && mem.status === '거절' ? '가입 신청이 거절됐어요. 기장님께 문의해 주세요' : '부원 명단에서 빠졌어요. 운영진에게 문의해 주세요');
    if (dev.status === '차단') err('blocked', '이 기기는 사용이 막혔어요');
    if (dev.status === '승인' && !util.bool(dev.shared) && days(dev.lastSeen || dev.approvedAt) > EXPIRE_DAYS) { dev.status = '만료'; store.update('devices', dev._row, dev); }
    if (!allowPending && dev.status !== '승인') err(dev.status === '만료' ? 'expired' : 'pending', dev.status === '만료' ? '오래 안 써서 다시 승인이 필요해요' : '아직 승인 전이에요');
    if (dev.status === '승인' && days(dev.lastSeen) > 0.01) { dev.lastSeen = util.now(); store.update('devices', dev._row, dev); }
    return { id: mem.id, name: mem.name, role: mem.role, studentId: mem.studentId, deviceId: dev.id, device: dev };
  }
  function needAdmin(me) { if (!ADMIN[me.role]) err('not_admin', '운영진만 할 수 있어요'); }

  /* ---------- 동작 ---------- */
  var A = {};
  A.ping = function () { return { version: GAJI_CONNECTOR_VERSION, shell: typeof GAJI_SHELL_VERSION !== 'undefined' ? String(GAJI_SHELL_VERSION) : '', initialized: initialized(), slug: setting('slug', ''), keyed: setting('masterKeyHash', '') !== '' }; };

  A.init = function (q) { return locked(function () { return initOnce(q); }); };
  function initOnce(q) {
    if (initialized()) err('already', '이미 준비된 연결기예요');
    if (!q.slug || !q.name || !q.studentId) err('bad', '동아리 주소 · 이름 · 학번이 필요해요');
    store.ensure();
    setSetting('slug', q.slug); setSetting('version', GAJI_CONNECTOR_VERSION); setSetting('rev', 1);
    setSetting('no_exp', q.startNo || 0); setSetting('no_q', 0); setSetting('no_res', 0);
    if (q.masterKey) setSetting('masterKeyHash', hash('master', q.masterKey));
    var code = digits(4), mid = newId('m');
    store.append('members', { id: mid, studentId: String(q.studentId), name: uniqName(q.name, String(q.studentId)), role: '마스터', codeHash: hash(mid, code), codeEnc: seal(mid, code), status: '활동', createdAt: util.now() });
    var did = newId('d'), secret = util.token(32);
    store.append('devices', { id: did, memberId: mid, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '승인', confirm: '', shared: 'false', createdAt: util.now(), approvedAt: util.now(), approvedBy: '처음 설정', lastSeen: util.now() });
    setSetting('initializedAt', util.now());
    log({ name: q.name, deviceId: did }, '연결기 준비', q.slug);
    return { device: { id: did, secret: secret }, code: code };
  }

  A.register = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    var sid = String(q.studentId || '').trim().slice(0, 12); limit('reg', 60, 600); limit('reg_' + sid, 8, 600);
    if (!/^[0-9A-Za-z-]{2,12}$/.test(sid)) err('wrong', '학번 또는 개인 코드가 맞지 않아요');
    var lockKey = 'lock_' + sid, lk = setting(lockKey, '');
    var fails = 0;
    if (lk) { var p = lk.split('|'); fails = days(p[1]) * 1440 < LOCK_MIN ? Number(p[0]) : 0; if (fails >= LOCK_FAILS) err('locked', '여러 번 틀려서 30분 동안 잠겼어요'); }
    var mem = store.rows('members').filter(function (m) { return m.studentId === sid && m.status === '활동'; })[0];
    if (!mem || mem.codeHash !== hash(mem.id, String(q.code || ''))) {
      if (mem) setSetting(lockKey, (fails + 1) + '|' + util.now());   // 있는 학번만 잠금 기록 (없는 학번을 마구 넣어도 시트가 늘지 않게)
      err('wrong', '학번 또는 개인 코드가 맞지 않아요');
    }
    if (lk) setSetting(lockKey, '');
    var did = newId('d'), secret = util.token(32), confirm = digits(4);
    store.append('devices', { id: did, memberId: mem.id, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '대기', confirm: confirm, shared: 'false', createdAt: util.now(), approvedAt: '', approvedBy: '', lastSeen: '' });
    bump(); log({ name: mem.name, deviceId: did }, '기기 승인 요청', q.label);
    return { device: { id: did, secret: secret }, confirm: confirm, name: mem.name };
  };

  /* 초대 링크: 기장이 링크 하나를 단톡방에 올리면 부원이 이름 · 학번으로 가입 신청 → 기장이 기기 승인하면 부원이 됨 */
  A.invite = function (q) {
    var me = deviceOf(q); needAdmin(me);
    if (q.op === 'make') { setSetting('invite', util.token(16)); setSetting('inviteAt', util.now()); log(me, '초대 링크 만듦', ''); }
    else if (q.op === 'off') { setSetting('invite', ''); log(me, '초대 링크 끔', ''); }
    return { invite: setting('invite', ''), at: setting('inviteAt', '') };
  };
  A.apply = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    limit('apply', 40, 600);
    var tok = setting('invite', '');
    if (!tok || String(q.invite || '') !== tok) err('invite_off', '초대 링크가 바뀌었거나 꺼졌어요. 기장님께 새 링크를 받아 주세요');
    var sid = String(q.studentId || '').trim().slice(0, 12), name = String(q.name || '').replace(/[<>"'`]/g, '').trim().slice(0, 20);
    if (!/^[0-9A-Za-z-]{2,12}$/.test(sid)) err('bad', '학번을 확인해 주세요');
    if (!name) err('bad', '이름을 넣어 주세요');
    limit('apply_' + sid, 5, 600);
    var ms = store.rows('members');
    if (ms.some(function (m) { return m.studentId === sid && m.status === '중지'; })) err('dup', '활동 중지된 학번이에요. 기장님께 활동으로 되돌려 달라고 해 주세요');
    if (ms.some(function (m) { return m.studentId === sid && m.status === '활동'; })) err('dup', '이미 가입된 학번이에요: ' + (ms.filter(function (m) { return m.studentId === sid && m.status === '활동'; })[0] || {}).name + '. 기장님께 받은 개인 코드로 들어가 주세요');
    if (ms.filter(function (m) { return m.status === '신청'; }).length >= 100) err('busy', '가입 신청이 너무 많이 쌓였어요. 기장님께 알려 주세요');
    var mem = ms.filter(function (m) { return m.studentId === sid && m.status === '신청'; })[0];
    name = uniqName(name, sid, mem && mem.id);
    if (mem) { mem.name = name; store.update('members', mem._row, mem); }
    else { mem = { id: newId('m'), studentId: sid, name: name, role: '부원', codeHash: '', codeEnc: '', status: '신청', createdAt: util.now() }; store.append('members', mem); }
    var did = newId('d'), secret = util.token(32), confirm = digits(4);
    store.append('devices', { id: did, memberId: mem.id, label: String(q.label || '').slice(0, 40), secretHash: hash(did, secret), status: '대기', confirm: confirm, shared: 'false', createdAt: util.now(), approvedAt: '', approvedBy: '', lastSeen: '' });
    bump(); log({ name: name, deviceId: did }, '초대 링크 가입 신청', sid + ' ' + q.label);
    return { device: { id: did, secret: secret }, confirm: confirm, name: name };
  };

  A.status = function (q) { var me = deviceOf(q, true); return { status: me.device.status, name: me.name, confirm: me.device.confirm }; };

  /* 동아리 마스터(가지에 구글로 로그인한 사람)의 새 기기: 마스터 키로 바로 승인.
     마스터가 바뀌면 새 마스터의 학번으로 마스터 역할이 옮겨 감.
     키를 잃어버리면 시트 '설정' 탭의 masterKeyHash 값을 지우면 다음 키로 다시 맞춰짐 (시트 편집 권한 = 드라이브 주인만). */
  /* 마스터를 넘겨받은 사람이 연결기 마스터 키를 새로 바꿈 (예전 키를 아는 사람만) */
  A.rekey = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    var kh = setting('masterKeyHash', ''), old = String(q.masterKey || ''), nk = String(q.newKey || '');
    if (nk.length < 20 || nk.length > 100) err('bad', '새 키가 짧아요');
    if (kh && kh === hash('master', nk)) return { ok: true, already: true };   // 이미 바뀜 (다시 시도)
    if (!kh || kh !== hash('master', old)) { limit('rekey_bad', 20, 600); err('wrong_key', '이 동아리의 연결기가 아니에요'); }   // 틀린 키만 횟수 제한 (남이 막을 수 없게)
    setSetting('masterKeyHash', hash('master', nk)); log(null, '마스터 키 바꿈', '');
    return { ok: true };
  };
  A.masterRegister = function (q) {
    if (!initialized()) err('not_initialized', '연결기가 아직 준비되지 않았어요');
    limit('mreg', 20, 600);
    var kh = setting('masterKeyHash', ''), key = String(q.masterKey || '');
    if (key.length < 20) err('bad', '마스터 키가 없어요');
    if (kh && kh !== hash('master', key)) err('wrong_key', '이 동아리의 연결기가 아니에요');
    if (!kh) setSetting('masterKeyHash', hash('master', key));
    if (q.slug) setSetting('slug', q.slug);
    var sid = String(q.studentId || '').trim(), code = '';
    if (!sid) err('bad', '학번을 넣어 주세요');
    var mem = store.rows('members').filter(function (m) { return m.studentId === sid && m.status === '활동'; })[0];
    var ap0 = !mem && store.rows('members').filter(function (m) { return m.studentId === sid && m.status === '신청'; })[0];
    if (ap0) { code = digits(4); ap0.status = '활동'; ap0.codeHash = hash(ap0.id, code); ap0.codeEnc = seal(ap0.id, code); if (q.name) ap0.name = uniqName(q.name, sid, ap0.id); store.update('members', ap0._row, ap0); mem = store.rows('members').filter(function (m) { return m.id === ap0.id; })[0]; }
    if (!mem) {
      if (!q.name) err('need_name', '처음 쓰는 학번이에요. 이름도 넣어 주세요');
      code = digits(4); var mid = newId('m');
      store.append('members', { id: mid, studentId: sid, name: uniqName(q.name, sid), role: '마스터', codeHash: hash(mid, code), codeEnc: seal(mid, code), status: '활동', createdAt: util.now() });
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
    if (util.bool(me.device.shared)) err('shared', '동아리 공용 기기에서는 개인 코드를 볼 수 없어요');
    if (!m) err('member_off', '부원 명단에서 빠졌어요');
    var code = unseal(m.id, m.codeEnc), renewed = false;
    if (!code) {   // 예전 판에서 만든 코드는 꺼낼 수 없음 → 새 코드를 만들어 줌 (쓰던 기기는 그대로)
      code = digits(4); m.codeHash = hash(m.id, code); m.codeEnc = seal(m.id, code); store.update('members', m._row, m);
      renewed = true; log(me, '내 코드 새로 만듦', '');
    }
    return { code: code, name: me.name, studentId: me.studentId, renewed: renewed };
  };

  // 기장 · 선생님: 시트 · 연결기 · 사진 폴더 바로 열기 주소
  A.links = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var l = {}; try { l = util.links ? util.links() : {}; } catch (e) {}
    return l;
  };

  A.rev = function (q) { deviceOf(q); return { rev: Number(setting('rev', '0')) }; };

  A.load = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    if (setting('version', '') !== GAJI_CONNECTOR_VERSION) { setSetting('version', GAJI_CONNECTOR_VERSION); setSetting('shell', typeof GAJI_SHELL_VERSION !== 'undefined' ? String(GAJI_SHELL_VERSION) : ''); }   // 시트 '설정' 탭에 지금 돌고 있는 판
    var nodes = store.rows('nodes').filter(function (n) { return !util.bool(n.private) || admin || inTeam(n, me); }).map(cleanNode);
    var members = store.rows('members').filter(function (m) { return m.status === '활동'; }).map(function (m) { return { id: m.id, name: m.name, role: m.role }; });
    var mine = store.rows('devices').filter(function (d) { return d.memberId === me.id; });
    var notice = mine.filter(function (d) { return d.id !== me.deviceId && d.status === '승인' && days(d.approvedAt) < 7; }).map(function (d) { return { id: d.id, label: d.label, at: d.approvedAt }; });
    return {
      rev: Number(setting('rev', '0')), me: { id: me.id, name: me.name, role: me.role }, rules: rules(), notice: noticeGet(), events: eventsFor(me), nodes: nodes,
      links: (function () { var vis = {}; nodes.forEach(function (n) { vis[n.id] = 1; }); return store.rows('links').filter(function (l) { return !util.bool(l.off) && vis[l.s] && vis[l.t]; }); })().map(function (l) { return { id: l.id, s: l.s, t: l.t, k: l.k }; }),
      files: (function () { var seen = {}; nodes.forEach(function (n) { seen[n.id] = 1; });
        return store.rows('files').filter(function (f) { return !util.bool(f.off) && seen[f.node]; }).map(fileOut); })(),
      comments: (function () { var seen = {}; nodes.forEach(function (n) { seen[n.id] = 1; });
        return store.rows('comments').filter(function (c) { return !util.bool(c.off) && seen[c.node]; }).map(function (c) { return { id: c.id, node: c.node, sec: c.sec, kind: c.kind, text: c.text, by: c.by, byId: c.byId, role: c.role, at: c.at, editedAt: c.editedAt, resolved: util.bool(c.resolved) }; }); })(),
      lines: store.rows('lines').reduce(function (o, l) { o[l.key] = l.name; return o; }, {}),
      members: members, newDevices: notice,
      lastNo: { exp: Number(setting('no_exp', 0)), q: Number(setting('no_q', 0)), res: Number(setting('no_res', 0)) }
    };
  };
  function cleanNode(n) { var o = {}; Object.keys(n).forEach(function (k) { if (k !== '_row') o[k] = n[k]; }); return o; }

  var NODE_FIELDS = ['type', 'title', 'field', 'status', 'line', 'date', 'owner', 'signal', 'review', 'verdict', 'fans', 'volunteer', 'equip', 'desc', 'private', 'report', 'plan', 'prep', 'run', 'deleted', 'team'];
  var HEAVY = ['plan', 'prep', 'run', 'report', 'desc'];
  var LOCKED_FIELDS = { plan: 1, prep: 1, run: 1, report: 1, title: 1 };   // 보고서 확정 뒤에는 운영진만
  function mineNode(n, me) { return n.createdBy === me.name || n.owner === me.name; }
  // 이 실험의 사람들: 담당 · 만든 사람 · 함께하는 사람 (아이디어는 담당 지원자도)
  function teamOf(n) { var t = [n.owner, n.createdBy].concat(Array.isArray(n.team) ? n.team : []); if (n.type === 'idea' && n.volunteer) t.push(n.volunteer); return t.filter(Boolean); }
  function inTeam(n, me) { return teamOf(n).indexOf(me.name) >= 0; }
  var OPEN_FIELDS = { fans: 1, volunteer: 1, equip: 1 };   // 아이디어: 누구나 같이 해요 · 담당 지원 · 장비 확인
  function isFinal(n) { return !!(n.report && n.report.final); }
  /* 단계 규칙: 내용 없이 앞 단계로 넘어갈 수 없음 (운영진도 계획서 · 결과는 꼭 있어야 함)
     검토 중 이상 = 계획서(목적 · 방법) / 준비 중 = 승인 2명 (운영진은 건너뛸 수 있음) / 기록 완료 = 결과(요약 · 측정값 · 관찰 중 하나 + 결론) */
  function planOk(p) { return !!(p && p.purpose && p.steps && p.steps.length); }
  function resultOk(r) { return !!(r && (r.summary || (r.table && r.table.rows && r.table.rows.length) || r.observe) && r.claim); }
  /* 승인 규칙 (동아리마다 설정 → 실험 승인 규칙, 마스터 · 선생님이 바꿈)
     peers: 부원 승인 몇 명 (0~5, 기본 2) / team: 함께하는 사람 승인도 셈 (기본 아니오)
     teacher: 'final' 부원 승인 뒤 선생님 최종 승인 필수(기본) · 'none' 필요 없음 / skip: 기장 · 운영진 · 선생님이 건너뛸 수 있음 (기본 아니오)
     선생님(역할 '교사')이 아직 없으면 선생님 승인은 빼고 적용 */
  function rules() {
    var p = Math.round(Number(setting('approvePeers', '2'))); if (!(p >= 0 && p <= 5)) p = 2;
    return { peers: p, team: setting('approveTeam', 'off') === 'on', teacher: setting('approveTeacher', 'final') === 'none' ? 'none' : 'final', skip: setting('approveSkip', 'off') === 'on',
      expTeacher: setting('approveExpTeacher', 'on') !== 'off', expLeader: setting('approveExpLeader', 'on') !== 'off' };   // 실험일(실험실 사용): 선생님 허가 필요 · 기장 대행
  }
  function approvalsOf(n) {
    var R = rules(), t = teachers();
    var k = store.rows('comments').filter(function (c) { return c.node === n.id && c.kind === 'approve' && !util.bool(c.off) && c.by !== n.owner && c.by !== n.createdBy && t.indexOf(c.by) < 0 && (R.team || !inTeam(n, { name: c.by })); }).length;
    return k;   // 승인 댓글만 셈 (review 숫자는 화면 표시용)
  }
  function teacherNeeded() { return rules().teacher === 'final' && teachers().length > 0; }
  // 지도 선생님(역할 '교사')이 있으면 선생님 승인이 꼭 있어야 준비 시작 (선생님이 아직 없으면 승인 2명으로)
  function teachers() { return store.rows('members').filter(function (m) { return m.role === '교사' && m.status === '활동'; }).map(function (m) { return m.name; }); }
  function teacherOk(n) { var t = teachers(); if (!teacherNeeded()) return true; return store.rows('comments').some(function (c) { return c.node === n.id && c.kind === 'approve' && !util.bool(c.off) && t.indexOf(c.by) >= 0; }); }
  function stageBlock(old, u, admin, contentOnly) {
    var a = STAGES.indexOf(old.status), b = STAGES.indexOf(u.status);
    if (u.type !== 'exp' || b < 0 || b <= a) return '';
    // 여러 단계를 한 번에 보내도(실험 끝 → 바로 결과 기록) 지나는 단계마다 아래 조건을 모두 확인
    if (b >= 2 && !planOk(u.plan)) return 'plan';
    if (b >= 3 && a < 3 && !contentOnly && !(admin && rules().skip)) {
      if (approvalsOf(old) < rules().peers) return 'review';
      if (!teacherOk(old)) return 'teacher';
    }
    if (b >= 5 && !resultOk(u.report)) return 'result';
    return '';
  }

  /* ---------- 변경 기록: 무엇을 · 누가 · 언제 · 전 → 후 ----------
     같은 사람이 같은 칸을 10분 안에 또 고치면 한 줄로 합침 (처음 값은 그대로). 되돌리기도 기록됨 */
  var HIST_FIELDS = ['title', 'field', 'status', 'line', 'date', 'owner', 'verdict', 'desc', 'private', 'report', 'plan', 'prep', 'run', 'deleted', 'team'];
  function recordHistory(old, u, me) {
    var rows = null;
    HIST_FIELDS.forEach(function (f) {
      var a = val(old[f]), b = val(u[f]); if (a === b) return;
      rows = rows || store.rows('history');
      var lastI = -1; for (var i = rows.length - 1; i >= 0 && i >= rows.length - 400; i--) if (rows[i].node === old.id && rows[i].field === f) { lastI = i; break; }
      var last = lastI >= 0 ? rows[lastI] : null;
      if (last && last.byId === me.id && (Date.parse(util.now()) - Date.parse(last.at)) < 10 * 60000) {
        if (last.before === b) { store.remove('history', [last._row]); rows = store.rows('history'); return; }   // 원래대로 돌아오면 지움
        last.after = b.slice(0, 45000); last.at = util.now(); store.update('history', last._row, last); return;
      }
      store.append('history', { id: newId('h'), node: old.id, field: f, by: me.name, byId: me.id, at: util.now(), before: a.slice(0, 45000), after: b.slice(0, 45000) });
      rows = store.rows('history');
    });
  }
  A.history = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    var n = store.rows('nodes').filter(function (x) { return x.id === q.node; })[0]; if (!n) err('bad', '항목을 찾을 수 없어요');
    if (util.bool(n.private) && !admin && !inTeam(n, me)) err('bad', '항목을 찾을 수 없어요');
    return { list: store.rows('history').filter(function (h) { return h.node === n.id; }).reverse().slice(0, 150).map(function (h) { return { id: h.id, field: h.field, by: h.by, at: h.at, before: h.before, after: h.after }; }) };
  };
  // 되돌리기: 그 칸을 바꿀 수 있는 사람만 (저장 규칙을 그대로 거침)
  A.revert = function (q) {
    var me = deviceOf(q), h = store.rows('history').filter(function (x) { return x.id === q.id; })[0]; if (!h) err('bad', '기록을 찾을 수 없어요');
    var n = store.rows('nodes').filter(function (x) { return x.id === h.node; })[0]; if (!n) err('bad', '항목을 찾을 수 없어요');
    var v = h.before; if (GAJI_JSON[h.field]) { try { v = v ? JSON.parse(v) : null; } catch (e) { v = null; } }
    var c = { id: n.id, title: h.field === 'title' ? v : n.title }; c[h.field] = v;
    var r = A.sync({ device: q.device, nodes: [c] });
    if (r.rejected && r.rejected.length) err('not_allowed', '이 칸은 되돌릴 수 없어요 (담당 · 함께하는 사람 · 운영진만, 확정된 보고서는 확정을 푼 뒤)');
    log(me, '되돌리기', n.title + ' · ' + h.field);
    return { ok: true, rev: r.rev };
  };

  /* ---------- 보안: 들어오는 값 검사 ----------
     번호(id)는 영문 · 숫자 · _ - 만 (화면에 끼워 넣는 공격 막기), 정해진 값만 (분야 · 단계 · 판정), 글자 수 · 크기 제한 */
  var ID_RE = /^[A-Za-z0-9_-]{1,40}$/, DATE_RE = /^\d{4}-\d\d-\d\d$/;
  var TYPES = { exp: 1, idea: 1, q: 1, res: 1 }, FIELDS = { '물리': 1, '화학': 1, '생명': 1, '지구': 1, '공통': 1, '융합': 1 };
  var VERDICTS = { '': 1, '가설 지지': 1, '가설 기각': 1, '추가 실험 필요': 1 };
  var JSON_MAX = 40000;   // 시트 한 칸은 5만 자까지
  var plain = function (v, n) { return String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n); };
  function cleanIn(c, bad) {
    if (!c || typeof c !== 'object' || !ID_RE.test(String(c.id || ''))) return null;
    var o = { id: String(c.id) };
    Object.keys(c).forEach(function (k) {
      var v = c[k];
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;   // 검사 건너뛰기 막기
      if (k === 'title') o.title = plain(v, 100);
      else if (k === 'type') { if (TYPES[v]) o.type = v; }
      else if (k === 'field') { if (FIELDS[v]) o.field = v; }
      else if (k === 'status') { var st = plain(v, 20); if (STAGES.indexOf(st) >= 0 || /^(취소|미해결|해결|도움 \d{1,4})$/.test(st)) o.status = st; }
      else if (k === 'verdict') { if (VERDICTS[v] != null) o.verdict = v; }
      else if (k === 'date') { if (DATE_RE.test(String(v))) o.date = String(v); }
      else if (k === 'line') o.line = String(v == null ? '' : v).replace(/[^\w가-힣 ·-]/g, '').slice(0, 40);
      else if (k === 'owner' || k === 'volunteer') o[k] = plain(v, 20);
      else if (k === 'desc') o.desc = plain(v, 3000);
      else if (k === 'private' || k === 'deleted' || k === 'equip' || k === 'arch') o[k] = v === true || v === 'true' ? 'true' : v === '보관' ? '보관' : '';
      else if (k === 'signal' || k === 'review' || k === 'fans') o[k] = Math.max(0, Math.min(999, Math.round(Number(v) || 0)));
      else if (k === 'team') o.team = Array.isArray(v) ? v.slice(0, 12).map(function (x) { return plain(x, 20); }).filter(Boolean) : [];
      else if (Object.prototype.hasOwnProperty.call(GAJI_JSON, k)) { if (typeof v === 'string' && v !== '') { try { v = JSON.parse(v); } catch (e) { return; } if (!v || typeof v !== 'object') return; }   // 글자로 보낸 JSON도 풀어서 같은 검사
        if (v == null || v === '') o[k] = v; else { var sv = typeof v === 'string' ? v : JSON.stringify(v); if (sv.length > JSON_MAX) { if (bad) bad.push(c.id + ':big'); } else o[k] = v; } }
    });
    return o.title === undefined ? null : o;
  }
  // 너무 잦은 요청 막기 (기기 · 학번마다 일정 시간에 몇 번까지)
  function limit(key, n, sec) { if (util.hit && !util.hit(key, n, sec)) err('slow', '요청이 너무 많아요. 잠시 뒤 다시 해 주세요'); }

  /* ---------- 공지판: 하나뿐인 판, 기장 · 운영진 · 선생님만 쓰고 고침 ---------- */
  function noticeGet() { try { var v = JSON.parse(setting('notice', '') || 'null'); return v && v.text ? v : null; } catch (e) { return null; } }
  A.noticeSet = function (q) {
    var me = deviceOf(q); needAdmin(me); limit('nt_' + me.id, 20, 600);
    var text = String(q.text || '').replace(/[<>]/g, '').trim().slice(0, 1000);
    setSetting('notice', text ? JSON.stringify({ text: text, by: me.name, role: me.role, at: util.now() }) : '');
    bump(); log(me, text ? '공지' : '공지 지움', text.slice(0, 60));
    return { notice: noticeGet() };
  };

  /* ---------- 달력 일정: 동아리 일정(운영진이 쓰고 모두 봄) · 내 일정(누구나 쓰고 나만 봄) ---------- */
  function eventsFor(me) {
    // 동아리 일정 · 승인된 실험일은 모두에게, 내 일정은 나에게만, 승인 대기 실험일은 올린 사람과 승인하는 사람(선생님 · 마스터)에게만
    var ap = expApprover(me), need = expNeedsOk(), hidden = {};
    store.rows('nodes').forEach(function (n) { if (util.bool(n.private)) hidden[n.id] = n; });   // 비공개 실험
    return store.rows('events').map(function (e) { if (!need && e.scope === 'exp' && e.state === 'wait') e.state = 'ok'; return e; }).filter(function (e) { if (util.bool(e.off)) return false; if (e.scope === 'club') return true; if (e.scope === 'exp') return e.state === 'ok' || e.byId === me.id || ap; return e.byId === me.id; })
      .filter(function (e) { if (e.scope !== 'exp' || !e.node) return true; var n = hidden[e.node]; return !n || ADMIN[me.role] || inTeam(n, me); })
      .map(function (e) { return { id: e.id, date: e.date, title: e.title, scope: e.scope, by: e.by, mine: e.byId === me.id, node: e.node || '', state: e.scope === 'exp' ? (e.state || 'ok') : '', okBy: e.okBy || '' }; });
  }
  // 실험일 승인: 선생님. 설정에서 허용하면 기장(마스터)이 대행. 선생님이 아직 없으면 기장이 대신함
  function expApprover(me) { var R = rules(); if (me.role === '교사') return true; return me.role === '마스터' && (R.expLeader || !teachers().length); }
  function expNeedsOk() { return rules().expTeacher; }
  A.eventSet = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], op = q.op || 'add'; limit('ev_' + me.id, 40, 600);
    return locked(function () {
      if (op === 'add') {
        var scope = q.scope === 'club' ? 'club' : q.scope === 'exp' ? 'exp' : 'me', node = '';
        if (scope === 'club' && !admin) err('not_admin', '동아리 일정은 기장 · 선생님만 올릴 수 있어요');
        var date = String(q.date || ''), title = String(q.title || '').replace(/[<>]/g, '').trim().slice(0, 60);
        if (scope === 'exp') {   // 실험일: 승인이 끝난(준비 중 이후) 내 실험만, 모두에게 보임
          var n = store.rows('nodes').filter(function (x) { return x.id === q.node && x.type === 'exp' && !util.bool(x.deleted); })[0];
          if (!n) err('bad', '실험을 찾을 수 없어요');
          if (!admin && !inTeam(n, me)) err('not_mine', '내 실험(담당 · 함께하는 사람)만 실험일을 올릴 수 있어요');
          if (STAGES.indexOf(n.status) < 3) err('not_ready', '승인이 끝난 실험(준비 중부터)만 실험일을 올릴 수 있어요');
          node = n.id; title = n.title.slice(0, 60);
        }
        if (!realDate(date) || !title) err('bad', '날짜와 내용을 넣어 주세요');
        store.append('events', { id: newId('e'), date: date, title: title, scope: scope, by: me.name, byId: me.id, at: util.now(), off: '', node: node, state: scope === 'exp' ? (!expNeedsOk() || expApprover(me) ? 'ok' : 'wait') : '', okBy: scope === 'exp' && expNeedsOk() && expApprover(me) ? me.name : '' });
        if (scope !== 'me') { bump(); log(me, scope === 'club' ? '동아리 일정' : '실험일', date + ' ' + title); }
      } else {
        var e = store.rows('events').filter(function (x) { return x.id === q.id && !util.bool(x.off); })[0]; if (!e) err('bad', '일정을 찾을 수 없어요');
        if (op === 'approve' || op === 'reject') {
          if (e.scope !== 'exp') err('bad', '실험일만 승인해요');
          if (!expApprover(me)) err('not_approver', rules().expLeader ? '실험일은 선생님이나 기장(마스터)만 승인할 수 있어요' : '실험일은 지도 선생님만 승인할 수 있어요');
          e.state = op === 'approve' ? 'ok' : 'no'; e.okBy = me.name; store.update('events', e._row, e); bump(); log(me, op === 'approve' ? '실험일 승인' : '실험일 거절', e.date + ' ' + e.title);
          return { events: eventsFor(me) };
        }
        if (e.byId !== me.id && !(e.scope !== 'me' && admin)) err('not_mine', '내가 올린 일정만 고치거나 지울 수 있어요');
        if (op === 'delete') e.off = 'true';
        else { if (q.date && realDate(q.date) && q.date !== e.date) { e.date = q.date; if (e.scope === 'exp' && expNeedsOk() && !expApprover(me)) { e.state = 'wait'; e.okBy = ''; } } if (q.title && e.scope !== 'exp') e.title = String(q.title).replace(/[<>]/g, '').trim().slice(0, 60); }
        store.update('events', e._row, e); if (e.scope !== 'me') bump();
      }
      return { events: eventsFor(me) };
    });
  };

  function namesOk(list) {
    var ok = Object.create(null); store.rows('members').forEach(function (m) { if (m.status === '활동' || m.status === '중지') ok[m.name] = 1; });
    return (list || []).every(function (x) { return !x || Object.prototype.hasOwnProperty.call(ok, x); });
  }
  A.sync = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role]; limit('sy_' + me.id, 120, 60);
    return locked(function () {
      var rows = store.rows('nodes'), byId = {}, assigned = {}, rejected = [], lineNow = {};
      var parentLine = function (id) { var l = store.rows('links').concat((q.links || []).filter(function (x) { return x && !x.off; })).filter(function (x) { return x.t === id && (x.k === 'next' || x.k === 'follow') && !util.bool(x.off); }).pop(); if (!l) return null; return lineNow[l.s] !== undefined ? lineNow[l.s] : (byId[l.s] || {}).line; };
      rows.forEach(function (r) { byId[r.id] = r; });
      (q.nodes || []).slice(0, 50).forEach(function (c0) {
        var c = cleanIn(c0, rejected); if (!c || !c.title) return;
        if (assigned[c.id]) return;   // 같은 묶음에서 방금 만든 것 (다음 저장에서 고침)
        var old = byId[c.id];
        if (old && util.bool(old.private) && !admin && !inTeam(old, me)) { rejected.push(old.id + ':team'); return; }   // 볼 수 없는 비공개 항목 (보관에서 꺼내기 전에)
        var wasArch = !!(old && old.arch);
        if (wasArch) { old = unarchive(old); byId[c.id] = old; }
        if (!old) {
          var fam = c.type === 'q' ? 'q' : c.type === 'res' ? 'res' : 'exp', no = Number(setting('no_' + fam, 0)) + 1;
          setSetting('no_' + fam, no);
          var n = { id: String(c.id).slice(0, 40), no: no, created: util.today(), createdBy: me.name, updatedAt: util.now(), updatedBy: me.name };
          NODE_FIELDS.forEach(function (f) { if (Object.prototype.hasOwnProperty.call(c, f)) n[f] = c[f]; });
          if (!namesOk([n.owner, n.volunteer].concat(n.team || []))) { n.owner = namesOk([n.owner]) ? n.owner : me.name; n.volunteer = ''; n.team = (n.team || []).filter(function (x) { return namesOk([x]); }); rejected.push(n.id + ':name'); }
          if (!admin && n.volunteer && n.volunteer !== me.name) n.volunteer = '';   // 담당 지원은 본인만
          if (!admin) { n.verdict = ''; delete n.review; if (n.report && typeof n.report === 'object' && n.report.final) { n.report = JSON.parse(JSON.stringify(n.report)); delete n.report.final; } }
          if (n.type !== 'exp' && STAGES.indexOf(n.status) > 0) n.status = '';   // 아이디어 · 질문 · 자료는 실험 단계를 가질 수 없음
          if (n.type === 'exp' && !admin && STAGES.indexOf(n.status) > 2) { n.status = '검토 중'; rejected.push(n.id + ':stage:review'); }   // 운영진은 지난 기록 옮겨 오기(끝난 실험)를 위해 그대로   // 새로 만들 때 검토를 건너뛸 수 없음
          if (n.type === 'exp' && n.status && STAGES.indexOf(n.status) < 0 && n.status !== '취소') n.status = '계획 작성';
          if (n.type === 'exp' && STAGES.indexOf(n.status) > 1 && stageBlock({ id: n.id, status: '계획 작성' }, n, true, true)) { n.status = '계획 작성'; rejected.push(n.id + ':stage'); }
          store.append('nodes', n); assigned[n.id] = no; byId[n.id] = Object.assign({ _row: -1 }, n); log(me, '새로 만듦', n.title);
          return;
        }
        if (util.bool(old.private) && !admin && !inTeam(old, me)) { rejected.push(old.id + ':team'); return; }   // 볼 수 없는 비공개 항목
        var u = cleanNode(old), changed = false, team = admin || inTeam(old, me);
        NODE_FIELDS.forEach(function (f) {
          if (!Object.prototype.hasOwnProperty.call(c, f) || val(c[f]) === val(old[f])) return;
          if (wasArch && c.arch && HEAVY.indexOf(f) >= 0) return;
          if (!team && f === 'line' && parentLine(old.id) === c.line) { u.line = c.line; changed = true; return; }   // 가지 옮기기: 부모와 같은 줄기로 맞추는 것은 누구나
          if (!team) {
            if (!(old.type === 'idea' && OPEN_FIELDS[f])) { if (rejected.indexOf(old.id + ':team') < 0) rejected.push(old.id + ':team'); return; }
          }
          if (f === 'volunteer' && !admin && c.volunteer && c.volunteer !== me.name) { rejected.push(old.id + ':team'); return; }   // 담당 지원은 본인만
          if (f === 'owner' && old.type === 'idea' && old.volunteer === me.name && c.owner === me.name) { u.owner = c.owner; changed = true; return; }   // 담당 지원한 사람이 계획서로 만들기
          if ((f === 'team' || f === 'owner' || f === 'private') && !admin && !mineNode(old, me)) { rejected.push(old.id + ':team'); return; }   // 보관 내용을 아직 안 받은 기기: 무거운 칸은 건드리지 않음
          if (!admin && f === 'verdict') { rejected.push(old.id + ':verdict'); return; }
          if (!admin && f === 'review') return;   // 승인 수는 승인 댓글로만 셈
          if (f === 'fans') { var fb = Array.isArray(old.fanBy) ? old.fanBy.slice() : []; if (fb.indexOf(me.name) >= 0) { rejected.push(old.id + ':fan'); return; } fb.push(me.name); u.fanBy = fb; u.fans = (Number(old.fans) || 0) + 1; changed = true; return; }   // 한 사람 한 번
          if (f === 'fanBy') return;   // 서버가 정함
          if ((f === 'owner' || f === 'volunteer' || f === 'team') && !namesOk(f === 'team' ? c.team : [c[f]])) { rejected.push(old.id + ':name'); return; }   // 명단에 없는 이름 (예전 이름 등)
          if (f === 'volunteer' && !admin && old.volunteer && old.volunteer !== me.name) { rejected.push(old.id + ':team'); return; }   // 남의 담당 지원을 지울 수 없음
          if (!admin && f === 'status' && STAGES.indexOf(c.status) >= 0 && STAGES.indexOf(c.status) < STAGES.indexOf(old.status)) {
            // 부원: 내가 방금(10분 안) 옮긴 단계는 한 단계만 되돌릴 수 있음 (실수 되돌리기)
            var mine = old.updatedBy === me.name && (Date.parse(util.now()) - Date.parse(old.updatedAt || 0)) < 10 * 60000 && STAGES.indexOf(c.status) === STAGES.indexOf(old.status) - 1;
            if (!mine) { rejected.push(old.id + ':status'); return; }
          }
          if (!admin && f === 'status' && c.status === '취소') { rejected.push(old.id + ':cancel'); return; }
          if (f === 'status' && (old.type === 'exp' || c.type === 'exp') && STAGES.indexOf(c.status) < 0 && c.status !== '취소') { rejected.push(old.id + ':status'); return; }   // 실험에 질문 단계 같은 값 막기
          if (f === 'type' && !((old.type === 'idea' && c.type === 'exp') || old.type === c.type)) return;

          if (f === 'deleted' && !admin && !mineNode(old, me)) { rejected.push(old.id + ':delete'); return; }
          if (!admin && isFinal(old) && (LOCKED_FIELDS[f] || f === 'status')) { rejected.push(old.id + ':final'); return; }
          if (f === 'report' && !admin && c.report && c.report.final && !isFinal(old)) { rejected.push(old.id + ':final'); return; }
          u[f] = c[f]; changed = true;
        });
        var base = old.type === 'exp' ? old : Object.assign({}, old, { status: STAGES[0] });   // 아이디어에서 실험이 되면 처음 단계부터 확인
        var sb = changed ? stageBlock(base, u, admin) : '';
        if (!sb && changed && u.type === 'exp') {   // 이미 지난 단계의 내용(계획서 · 결과)을 비우면 막음
          var si = STAGES.indexOf(u.status);
          if (si >= 2 && !planOk(u.plan) && planOk(old.plan)) { u.plan = old.plan; rejected.push(old.id + ':stage:plan'); }
          if (si >= 5 && !resultOk(u.report) && resultOk(old.report)) { u.report = old.report; rejected.push(old.id + ':stage:result'); }
        }
        if (u.type !== 'exp' && STAGES.indexOf(u.status) > 0 && STAGES.indexOf(u.status) !== STAGES.indexOf(old.status)) { u.status = old.status; rejected.push(old.id + ':stage'); }
        if (sb) { u.status = old.status; rejected.push(old.id + ':stage:' + sb); changed = NODE_FIELDS.some(function (f) { return val(u[f]) !== val(old[f]); }); }
        if (changed && u.type === 'exp') {
          var resetAp = old.status === '검토 중' && val(u.plan) !== val(old.plan) && !admin, newTeam = (u.team || []).filter(function (x) { return (old.team || []).indexOf(x) < 0; });
          if (resetAp || newTeam.length) store.rows('comments').forEach(function (cm) { if (cm.node === old.id && cm.kind === 'approve' && !util.bool(cm.off) && (resetAp || newTeam.indexOf(cm.by) >= 0)) { cm.off = 'true'; store.update('comments', cm._row, cm); } });   // 바뀐 계획서는 다시 검토
        }
        if (changed) lineNow[old.id] = u.line;
        if (changed) { recordHistory(old, u, me); u.updatedAt = util.now(); u.updatedBy = me.name; store.update('nodes', old._row, u); log(me, '수정', old.title); }
      });
      var links = store.rows('links'), key = {}, nodesNow = {};
      store.rows('nodes').forEach(function (r) { nodesNow[r.id] = r; });
      links.forEach(function (l) { key[l.s + '|' + l.t + '|' + l.k] = l; });
      (q.links || []).slice(0, 50).forEach(function (l) {
        if (!l || !ID_RE.test(String(l.s || '')) || !ID_RE.test(String(l.t || '')) || l.s === l.t) return;
        if (['follow', 'next', 'q', 'res', 'rel'].indexOf(l.k) < 0) return;
        var ls = nodesNow[l.s], lt = nodesNow[l.t];
        if (!ls || !lt || (!admin && ((util.bool(ls.private) && !inTeam(ls, me)) || (util.bool(lt.private) && !inTeam(lt, me))))) { rejected.push(l.t + ':link'); return; }   // 없는 항목 · 볼 수 없는 비공개
        var old = key[l.s + '|' + l.t + '|' + l.k];
        if (l.off) {   // 연결 끊기 (가지 옮기기): 운영진, 연결을 만든 사람, 도착 항목을 만든 사람 · 담당
          if (!old || util.bool(old.off)) return;
          var tn = nodesNow[l.t] || {};
          if (!admin && old.createdBy !== me.name && !mineNode(tn, me)) { rejected.push(l.t + ':unlink'); return; }
          old.off = 'true'; store.update('links', old._row, old); log(me, '연결 끊기', l.s + '→' + l.t); return;
        }
        if (old && !util.bool(old.off)) return;
        if (old) { old.off = ''; old.createdBy = me.name; old.createdAt = util.now(); store.update('links', old._row, old); return; }
        var nl = { id: newId('l'), s: l.s, t: l.t, k: l.k, createdBy: me.name, createdAt: util.now() };
        store.append('links', nl); key[l.s + '|' + l.t + '|' + l.k] = nl;
      });
      var lines = store.rows('lines'), lk = {};
      lines.forEach(function (l) { lk[l.key] = l; });
      Object.keys(q.lines || {}).slice(0, 50).forEach(function (k) { if (!/^[\w가-힣 ·-]{1,40}$/.test(k)) return; var name = plain(q.lines[k], 20); if (!lk[k]) store.append('lines', { key: k, name: name }); else if (lk[k].name !== name && admin) store.update('lines', lk[k]._row, { key: k, name: name }); });
      bump();
      return { ok: true, assigned: assigned, rejected: rejected, rev: Number(setting('rev', '0')) };
    });
  };

  /* ---------- 자동 보관 (눈에 안 보이게) ----------
     데이터가 커지면(기본 30만 자) 지난 학년도(3월 1일 전)에 가지 전체가 끝난 실험의 무거운 내용(계획서 · 준비 · 진행 · 결과 · 설명 · 댓글)만
     같은 시트의 '보관' 탭으로 옮김. 번호 · 제목 · 단계 · 판정 · 줄기 · 연결은 그대로 남아서 가지 · 목록 · 찾기는 그대로. */
  function schoolYearStart() { var d = new Date(util.now()), y = d.getUTCFullYear() - (d.getUTCMonth() < 2 ? 1 : 0); return y + '-03-01'; }
  function heavySize() { var t = 0; store.rows('nodes').forEach(function (n) { HEAVY.forEach(function (k) { t += val(n[k]).length; }); }); store.rows('comments').forEach(function (c) { t += str(c.text).length + 80; }); return t; }
  function closedNode(n) { return util.bool(n.deleted) || n.status === '기록 완료' || n.status === '취소' || (n.type === 'q' && n.status === '해결') || n.type === 'res'; }
  function unarchive(old) {
    var a = store.rows('archive').filter(function (x) { return x.id === old.id; })[0];
    var u = cleanNode(old); u.arch = '';
    if (a) { var h = a.data || {}; HEAVY.forEach(function (k) { if (k in h) u[k] = h[k]; });
      (a.comments || []).forEach(function (c) { store.append('comments', c); });
      store.remove('archive', [a._row]); }
    store.update('nodes', old._row, u);
    return store.rows('nodes').filter(function (x) { return x.id === old.id; })[0];
  }
  /* ---------- 자동 백업 ----------
     일주일이 지났고 그동안 바뀐 것이 있으면: ① 시트 사본을 '가지 백업' 폴더에 ② 엑셀 첨부 + 한 주 요약을 마스터 메일로.
     최근 8개 + 달마다 1개(12달)만 남김. 실패해도 가지 쓰기에는 영향 없음 (오류는 설정 탭에 남김). */
  function weekSummary() {
    var nodes = store.rows('nodes'), wk = function (iso) { return days(iso) <= 7; };
    var made = nodes.filter(function (n) { return wk(n.created ? n.created + 'T00:00:00Z' : '') && !util.bool(n.deleted); });
    var done = nodes.filter(function (n) { return n.status === '기록 완료' && wk(n.updatedAt); });
    var logs = store.rows('log').filter(function (l) { return wk(l.at); }), who = {};
    logs.forEach(function (l) { if (l.member) who[l.member] = (who[l.member] || 0) + 1; });
    var top = Object.keys(who).sort(function (a, b) { return who[b] - who[a]; }).slice(0, 5).map(function (k) { return k + ' ' + who[k]; });
    return { total: nodes.filter(function (n) { return !util.bool(n.deleted); }).length, made: made.map(function (n) { return n.title; }), done: done.map(function (n) { return n.title; }), acts: logs.length, top: top };
  }
  function doBackup(me, why) {
    if (!util.backup) return { ok: false, error: '백업을 할 수 없는 환경이에요' };
    var sum = weekSummary(), mail = setting('backupMail', 'on') !== 'off', slug = setting('slug', '');
    var esc = function (t) { return String(t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
    var li = function (a) { return a.length ? '<ul>' + a.slice(0, 15).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p style="color:#666">없음</p>'; };
    var html = '<div style="font-family:sans-serif;line-height:1.6"><h2 style="margin:0 0 8px">가지 주간 백업 · ' + esc(slug) + '</h2>' +
      '<p>동아리 데이터 시트 사본을 드라이브 \'가지 백업\' 폴더에 만들었고, 같은 내용을 엑셀 파일로 첨부했어요.</p>' +
      '<p><b>전체 항목</b> ' + sum.total + '개 · <b>이번 주 활동</b> ' + sum.acts + '번</p>' +
      '<h3 style="margin:14px 0 4px">이번 주 새로 만든 것</h3>' + li(sum.made) + '<h3 style="margin:14px 0 4px">이번 주 기록을 마친 실험</h3>' + li(sum.done) +
      '<h3 style="margin:14px 0 4px">많이 참여한 사람</h3>' + li(sum.top) +
      '<p style="color:#888;font-size:12px;margin-top:18px">이 메일은 가지 연결기가 일주일에 한 번 보내요. 끄려면 가지 → 설정 → 자동 백업에서 메일을 끄세요.</p></div>';
    var r;
    try { r = util.backup({ mail: mail, to: setting('backupTo', ''), subject: '[가지] ' + slug + ' 주간 백업 · ' + util.today(), html: html, keep: 8, months: 12 }); }
    catch (e) { setSetting('backupErr', util.now() + ' ' + String(e.message || e).slice(0, 200)); log(me, '백업 실패', String(e.message || e).slice(0, 120)); return { ok: false, error: String(e.message || e).slice(0, 200) }; }
    setSetting('backupAt', util.now()); setSetting('backupRev', setting('rev', '0')); setSetting('backupErr', '');
    if (r && r.folder) setSetting('backupFolder', r.folder);
    if (r && r.mailError) setSetting('backupErr', util.now() + ' 메일: ' + String(r.mailError).slice(0, 160));
    log(me, '백업', (why || '') + (r && r.mailed ? ' · 메일 ' + r.mailed : ''));
    return { ok: true, at: setting('backupAt', ''), folder: r && r.folder, mailed: r && r.mailed, kept: r && r.kept };
  }
  function backupDue() { return days(setting('backupAt', '')) >= 7 && setting('backupRev', '') !== setting('rev', '0'); }
  A.backupInfo = function (q) {
    var me = deviceOf(q); needAdmin(me);
    return { at: setting('backupAt', ''), folder: setting('backupFolder', ''), mail: setting('backupMail', 'on') !== 'off', to: setting('backupTo', ''), err: setting('backupErr', ''), due: backupDue() };
  };
  A.backupNow = function (q) { var me = deviceOf(q); needAdmin(me); limit('bk', 4, 3600); return locked(function () { return doBackup(me, '지금 백업'); }); };
  A.backupSet = function (q) {
    var me = deviceOf(q); needAdmin(me);
    if (('mail' in q || 'to' in q) && me.role !== '마스터') err('not_master', '백업 메일은 마스터만 바꿀 수 있어요');
    if ('mail' in q) setSetting('backupMail', q.mail ? 'on' : 'off');
    if ('to' in q) { var to = String(q.to || '').trim(); if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) err('bad', '메일 주소를 확인해 주세요'); setSetting('backupTo', to.slice(0, 120)); }
    log(me, '백업 설정', ''); return A.backupInfo(q);
  };

  /* ---------- 백업에서 되살리기 ----------
     실험 내용만 되돌림 (실험 · 연결 · 줄기 · 댓글 · 파일 · 보관). 부원 · 기기 · 설정 · 기록은 지금 그대로.
     안전장치: 운영진만 · 화면에 뜬 일회용 확인 코드(8자리)를 그대로 쳐야 함 · 10분 안 · 3번 틀리면 취소 ·
     되살리기 직전에 지금 상태를 먼저 백업 (그 백업이 실패하면 되살리지 않음) */
  var RESTORE_TABS = ['nodes', 'links', 'lines', 'comments', 'files', 'archive'];
  function backupFiles() { return (util.backupList ? util.backupList() : []).sort(function (a, b) { return a.at < b.at ? 1 : -1; }); }
  A.backupList = function (q) {
    var me = deviceOf(q); needAdmin(me);
    return { list: backupFiles().slice(0, 40), now: { exp: liveCount() } };
  };
  function liveCount() { return store.rows('nodes').filter(function (n) { return !util.bool(n.deleted); }).length + store.rows('archive').length; }
  function restoreCode() {
    var a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', t = util.token(40).replace(/[^A-Za-z0-9]/g, '').toUpperCase(), c = '';
    for (var i = 0; c.length < 8; i++) { var ch = i < t.length ? t.charAt(i) : a.charAt(Math.floor(util.random() * a.length)); if (a.indexOf(ch) >= 0) c += ch; }
    return c.slice(0, 4) + '-' + c.slice(4);
  }
  A.restorePrep = function (q) {
    var me = deviceOf(q); needAdmin(me); limit('rp_' + me.id, 6, 600);
    var b = backupFiles().filter(function (f) { return f.id === q.id; })[0];
    if (!b) err('no_backup', '그 백업을 찾을 수 없어요');
    var peek = util.backupPeek(b.id), code = restoreCode();
    setSetting('restorePending', JSON.stringify({ id: b.id, by: me.id, code: code, until: Date.parse(util.now()) + 10 * 60000, tries: 0 }));
    log(me, '되살리기 준비', b.name);
    return { id: b.id, name: b.name, at: b.at, code: code, backup: peek, now: { exp: liveCount() }, minutes: 10 };
  };
  A.restore = function (q) {
    var me = deviceOf(q); needAdmin(me);
    return locked(function () {
      var p = null; try { p = JSON.parse(setting('restorePending', '') || 'null'); } catch (e) {}
      if (!p || p.id !== q.id || p.by !== me.id) err('no_pending', '확인 코드를 먼저 받아 주세요');
      if (Date.parse(util.now()) > p.until) { setSetting('restorePending', ''); err('expired', '확인 코드 시간이 지났어요 (10분). 다시 받아 주세요'); }
      var typed = String(q.code || '').toUpperCase().replace(/\s/g, '');
      if (typed !== p.code) {
        p.tries = (p.tries || 0) + 1;
        if (p.tries >= 3) { setSetting('restorePending', ''); log(me, '되살리기 취소', '코드 3번 틀림'); err('bad_code', '확인 코드가 3번 틀려서 취소했어요. 다시 받아 주세요'); }
        setSetting('restorePending', JSON.stringify(p)); err('bad_code', '확인 코드가 달라요 (' + (3 - p.tries) + '번 남음)');
      }
      setSetting('restorePending', '');
      var before = doBackup(me, '되살리기 전');
      if (!before.ok) err('backup_failed', '되살리기 전에 지금 상태를 백업하지 못해서 멈췄어요: ' + (before.error || ''));
      var r = util.restore(q.id, RESTORE_TABS.map(function (t) { return GAJI_TABS[t].name; }));
      bump(); setSetting('backupRev', setting('rev', '0'));
      log(me, '되살리기', (r && r.name || q.id) + ' · 실험 ' + liveCount() + '개');
      return { ok: true, name: r && r.name, exp: liveCount(), before: { at: before.at, folder: before.folder } };
    });
  };

  A.rulesSet = function (q) {
    var me = deviceOf(q);
    if (me.role !== '마스터' && me.role !== '교사') err('not_master', '승인 규칙은 동아리 마스터나 지도 선생님만 바꿀 수 있어요');
    if ('peers' in q) { var p = Math.round(Number(q.peers)); if (!(p >= 0 && p <= 5)) err('bad', '부원 승인은 0~5명이에요'); setSetting('approvePeers', p); }
    if ('team' in q) setSetting('approveTeam', q.team ? 'on' : 'off');
    if ('teacher' in q) setSetting('approveTeacher', q.teacher === 'none' ? 'none' : 'final');
    if ('skip' in q) setSetting('approveSkip', q.skip ? 'on' : 'off');
    if ('expTeacher' in q) setSetting('approveExpTeacher', q.expTeacher ? 'on' : 'off');
    if ('expLeader' in q) setSetting('approveExpLeader', q.expLeader ? 'on' : 'off');
    bump(); var R = rules(); log(me, '승인 규칙', '부원 ' + R.peers + ' · 팀 ' + (R.team ? '인정' : '제외') + ' · 선생님 ' + R.teacher + ' · 건너뛰기 ' + (R.skip ? '허용' : '안 됨') + ' · 실험일 ' + (R.expTeacher ? '선생님 허가' + (R.expLeader ? '(기장 대행)' : '') : '허가 없음'));
    return R;
  };

  A.tidy = function (q) {
    var me = deviceOf(q); var today = util.today();
    if (q.force && !ADMIN[me.role]) q.force = false;   // 강제 정리는 운영진만
    if (setting('tidyAt', '') === today && !q.force) return { done: false, reason: 'today' };
    return locked(function () {
      setSetting('tidyAt', today);
      var bk = backupDue() ? doBackup(me, '주간 자동') : null;
      var limit = Number(setting('archLimit', 300000)), size = heavySize(), moved = 0, logs = 0;
      // 기록 탭: 1년 지난 것은 '기록 보관'으로
      var oldLogs = store.rows('log').filter(function (l) { return days(l.at) > 365; });
      if (oldLogs.length > 200) { oldLogs.forEach(function (l) { store.append('logArchive', l); }); store.remove('log', oldLogs.map(function (l) { return l._row; })); logs = oldLogs.length; }
      if (size <= limit && !q.force) return { done: true, moved: 0, logs: logs, size: size, backup: bk };
      var nodes = store.rows('nodes'), links = store.rows('links').filter(function (l) { return !util.bool(l.off); }), byId = {}, adj = {};
      nodes.forEach(function (n) { byId[n.id] = n; adj[n.id] = []; });
      links.forEach(function (l) { if (adj[l.s] && adj[l.t]) { adj[l.s].push(l.t); adj[l.t].push(l.s); } });
      var start = schoolYearStart(), seen = {}, groups = [];
      nodes.forEach(function (n) { if (seen[n.id]) return; var g = [], st = [n.id]; seen[n.id] = 1;
        while (st.length) { var id = st.pop(); g.push(byId[id]); adj[id].forEach(function (x) { if (!seen[x]) { seen[x] = 1; st.push(x); } }); }
        groups.push(g); });
      // 가지 전체가 끝났고, 모두 지난 학년도 전에 마지막으로 고친 것만 · 오래된 것부터
      var cand = groups.filter(function (g) { return g.every(function (n) { return n.arch || (closedNode(n) && String(n.updatedAt || n.created || '').slice(0, 10) < start); }); })
        .map(function (g) { return { g: g, at: g.map(function (n) { return String(n.updatedAt || ''); }).sort().pop() }; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
      var comments = store.rows('comments');
      for (var i = 0; i < cand.length && size > limit * 0.7; i++) {
        cand[i].g.forEach(function (n) {
          if (n.arch) return;
          var heavy = {}; HEAVY.forEach(function (k) { if (n[k] !== '' && n[k] !== null && n[k] !== undefined) heavy[k] = n[k]; });
          var cm = comments.filter(function (c) { return c.node === n.id; });
          if (JSON.stringify(heavy).length > 45000 || JSON.stringify(cm.map(cleanNode)).length > 45000) return;   // 한 칸에 안 들어가면 보관하지 않음 (그대로 둠)
          store.append('archive', { id: n.id, data: heavy, comments: cm.map(cleanNode), at: util.now() });
          var light = cleanNode(n); HEAVY.forEach(function (k) { light[k] = ''; });
          if (n.report && (n.report.final || n.report.claim)) light.report = { final: n.report.final || null, claim: n.report.claim || '' };
          light.arch = '보관'; store.update('nodes', n._row, light);
          if (cm.length) { store.remove('comments', cm.map(function (c) { return c._row; })); comments = store.rows('comments'); }
          moved++;
        });
        size = heavySize();
      }
      if (moved) { bump(); log(me, '자동 보관', moved + '개'); }
      return { done: true, moved: moved, logs: logs, size: size, backup: bk };
    });
  };
  // 보관된 항목 내용 받기 (열 때)
  A.archived = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], out = {};
    var rows = store.rows('archive'), nodes = store.rows('nodes');
    (q.ids || []).slice(0, 20).forEach(function (id) {
      var n = nodes.filter(function (x) { return x.id === id; })[0]; if (!n || (util.bool(n.private) && !admin && !inTeam(n, me))) return;
      var a = rows.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      out[id] = { data: a.data || {}, comments: (a.comments || []).map(function (c) { return { id: c.id, node: c.node, sec: c.sec, kind: c.kind, text: c.text, by: c.by, byId: c.byId, role: c.role, at: c.at, editedAt: c.editedAt, resolved: util.bool(c.resolved) }; }) };
    });
    return { items: out };
  };
  // 보관 내용에서 찾기
  A.search = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], terms = String(q.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    if (!terms.length) return { hits: [] };
    var nodes = {}; store.rows('nodes').forEach(function (n) { nodes[n.id] = n; });
    var hits = [];
    store.rows('archive').forEach(function (a) {
      var n = nodes[a.id]; if (!n || (util.bool(n.private) && !admin && !inTeam(n, me))) return;
      var text = (JSON.stringify(a.data || {}) + ' ' + (a.comments || []).map(function (c) { return c.text; }).join(' ')).toLowerCase();
      if (!terms.every(function (t) { return text.indexOf(t) >= 0; })) return;
      var i = text.indexOf(terms[0]); hits.push({ id: a.id, snip: text.slice(Math.max(0, i - 20), i + 50).replace(/[{}"\[\]]/g, ' ').replace(/\s+/g, ' ') });
    });
    return { hits: hits.slice(0, 50) };
  };

  /* ---------- 댓글 · 첨삭 · 검토 ----------
     kind: note(댓글) · fix(첨삭: 고칠 곳) · approve(검토 승인) · change(수정 요청) · answer(질문 답)
     sec: 어느 부분에 대한 것인지 (plan.purpose, report.discuss 등, 비우면 전체) */
  var KINDS = { note: 1, fix: 1, approve: 1, change: 1, answer: 1 };
  A.comment = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], op = q.op || 'add'; limit('cm_' + me.id, 40, 300);
    return locked(function () {
      var rows = store.rows('comments');
      if (op === 'add') {
        var n = store.rows('nodes').filter(function (x) { return x.id === q.node; })[0]; if (!n) err('bad', '항목을 찾을 수 없어요');
        if (util.bool(n.private) && !admin && !inTeam(n, me)) err('bad', '항목을 찾을 수 없어요');
        var kind = KINDS[q.kind] ? q.kind : 'note', text = String(q.text || '').trim().slice(0, 1000);
        if (!text && kind !== 'approve') err('bad', '내용을 써 주세요');
        if (kind === 'approve') {
          if (mineNode(n, me)) err('self', '내 실험은 내가 승인할 수 없어요');
          var R = rules(), isT = teachers().indexOf(me.name) >= 0;
          if (!isT && !R.team && inTeam(n, me)) err('team', '함께하는 사람은 승인할 수 없어요 · 팀 밖의 부원이 검토해요');
          if (isT && teacherNeeded() && approvalsOf(n) < R.peers) err('order', '부원 ' + R.peers + '명이 먼저 승인해야 선생님이 최종 승인할 수 있어요');
          if (n.status !== '검토 중' || !planOk(n.plan)) err('not_ready', '계획서를 다 쓰고 검토를 요청한 실험만 승인할 수 있어요');
          rows.forEach(function (c) { if (c.node === n.id && c.kind === 'approve' && c.byId === me.id && !util.bool(c.off)) { c.off = 'true'; store.update('comments', c._row, c); } });
        }
        var c = { id: newId('c'), node: n.id, sec: String(q.sec || '').replace(/[^\w.]/g, '').slice(0, 40), kind: kind, text: text, by: me.name, byId: me.id, role: me.role, at: util.now(), editedAt: '', resolved: '', off: '' };
        store.append('comments', c); bump(); log(me, { note: '댓글', fix: '첨삭', approve: '검토 승인', change: '수정 요청', answer: '답변' }[kind], n.title);
        delete c.off; c.resolved = false; return { comment: c };
      }
      var cm = rows.filter(function (x) { return x.id === q.id && !util.bool(x.off); })[0]; if (!cm) err('bad', '댓글을 찾을 수 없어요');
      var node = store.rows('nodes').filter(function (x) { return x.id === cm.node; })[0] || {};
      if (op === 'edit') { if (cm.byId !== me.id) err('not_mine', '내가 쓴 댓글만 고칠 수 있어요'); cm.text = String(q.text || '').trim().slice(0, 1000); if (!cm.text) err('bad', '내용을 써 주세요'); cm.editedAt = util.now(); }
      else if (op === 'delete') { if (cm.byId !== me.id && !admin) err('not_mine', '내가 쓴 댓글만 지울 수 있어요'); cm.off = 'true'; }
      else if (op === 'resolve' || op === 'reopen') { if (cm.byId !== me.id && !admin && !mineNode(node, me)) err('not_mine', '실험 담당자나 운영진만 할 수 있어요'); cm.resolved = op === 'resolve' ? 'true' : ''; }
      else err('bad');
      store.update('comments', cm._row, cm); bump(); log(me, '댓글 ' + op, node.title || '');
      return { ok: true };
    });
  };

  /* ---------- 사진 · 파일: 동아리 드라이브의 '가지 실험 파일/<번호 제목>/' 폴더에 저장, 시트 '파일' 탭이 장부 ---------- */
  var MIMES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
  function fileOut(f) { return { id: f.id, node: f.node, name: f.name, mime: f.mime, size: Number(f.size) || 0, caption: f.caption, kind: f.kind, by: f.by, at: f.at, thumb: !!f.thumbId }; }
  function needDrive(fn) {
    if (!drive) err('no_drive', '이 연결기는 사진을 저장할 수 없어요');
    try { return fn(); } catch (e) {
      if (e.code) throw e;
      var m = String(e.message || e);
      if (/permission|권한|authoriz/i.test(m)) err('drive_perm', '연결기에 드라이브 권한이 없어요. 동아리 마스터가 Apps Script에서 권한허용을 실행해야 해요 (' + m.slice(0, 160) + ')');
      err('drive', '드라이브에 저장하지 못했어요: ' + m.slice(0, 80));
    }
  }
  function visibleNode(id, me, admin) {
    var n = store.rows('nodes').filter(function (x) { return x.id === id; })[0];
    if (!n || (util.bool(n.private) && !admin && !inTeam(n, me))) err('bad', '항목을 찾을 수 없어요');
    return n;
  }
  A.upload = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], n = visibleNode(q.node, me, admin); limit('up_' + me.id, 40, 600);
    var mime = String(q.mime || ''), data = String(q.data || '');
    if (!MIMES[mime]) err('bad', '사진(JPG · PNG) 또는 PDF만 올릴 수 있어요');
    if (!data || data.length > 14e6) err('big', '파일이 너무 커요 (10MB까지)');
    if (q.thumb && (String(q.thumb).length > 2e6 || !/^[A-Za-z0-9+/=]+$/.test(String(q.thumb)))) err('bad', '미리보기 그림이 올바르지 않아요');
    var base = String(q.name || '').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || ('사진_' + util.today());
    var name = base + '.' + MIMES[mime];
    var led = store.rows('files').filter(function (f) { return f.node === n.id && f.folderId; })[0];
    var folderName = String(n.no || '') + ' ' + String(n.title || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
    var saved = needDrive(function () {
      var full = drive.save(led ? led.folderId : '', folderName, name, mime, data);
      var th = q.thumb ? drive.save(full.folderId, folderName, '작게_' + base + '.jpg', 'image/jpeg', String(q.thumb)) : null;
      return { full: full, th: th };
    });
    var row = { id: newId('f'), node: n.id, fileId: saved.full.id, thumbId: saved.th ? saved.th.id : '', folderId: saved.full.folderId, name: name, mime: mime, size: Math.round(data.length * 0.75),
      caption: String(q.caption || '').slice(0, 200), kind: q.kind === 'graph' ? 'graph' : q.kind === 'doc' ? 'doc' : 'photo', by: me.name, at: util.now(), off: '' };
    store.append('files', row); bump(); log(me, '파일 올림', n.title + ' · ' + name);
    return { file: fileOut(row) };
  };
  // 사진 내용 받기 (부원은 드라이브에 직접 못 들어가므로 연결기가 전해 줌). 기본은 작은 사진, full이면 원본
  A.fileGet = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], out = {};
    var rows = store.rows('files'), ids = (q.ids || []).slice(0, 24);
    needDrive(function () {
      ids.forEach(function (id) {
        var f = rows.filter(function (x) { return x.id === id && !util.bool(x.off); })[0]; if (!f) return;
        try { visibleNode(f.node, me, admin); } catch (e) { return; }
        try { var r = drive.read(q.full ? f.fileId : (f.thumbId || f.fileId)); out[id] = { mime: r.mime, data: r.data }; } catch (e) { if (/permission|권한|authoriz/i.test(String(e && e.message))) throw e; }   // 지워진 파일은 건너뜀
      });
    });
    return { files: out };
  };
  A.fileEdit = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    var f = store.rows('files').filter(function (x) { return x.id === q.id && !util.bool(x.off); })[0]; if (!f) err('bad', '파일을 찾을 수 없어요');
    var n = visibleNode(f.node, me, admin);
    if (f.by !== me.name && !admin && !mineNode(n, me)) err('not_mine', '올린 사람 · 실험 담당자 · 운영진만 할 수 있어요');
    if (q.op === 'delete') { f.off = 'true'; if (drive) { try { drive.trash(f.fileId); if (f.thumbId) drive.trash(f.thumbId); } catch (e) {} } log(me, '파일 지움', f.name); }
    else { if ('caption' in q) f.caption = String(q.caption || '').slice(0, 200); if (q.kind) f.kind = q.kind === 'graph' ? 'graph' : q.kind === 'doc' ? 'doc' : 'photo'; }
    store.update('files', f._row, f); bump();
    return { ok: true };
  };

  /* ---------- 운영진: 부원 · 기기 ---------- */
  A.people = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var devs = store.rows('devices');
    return {
      invite: setting('invite', ''),
      members: store.rows('members').map(function (m) { return { id: m.id, studentId: m.studentId, name: m.name, role: m.role, status: m.status, devices: devs.filter(function (d) { return d.memberId === m.id && d.status === '승인'; }).length }; }),
      devices: devs.filter(function (d) { return d.status !== '차단'; }).map(function (d) { var m = store.rows('members').filter(function (x) { return x.id === d.memberId; })[0] || {};
        return { id: d.id, member: m.name || '', studentId: m.studentId || '', applied: m.status === '신청', label: d.label, status: d.status, confirm: d.status === '대기' ? d.confirm : '', shared: util.bool(d.shared), createdAt: d.createdAt, lastSeen: d.lastSeen,
          others: devs.filter(function (x) { return x.memberId === d.memberId && x.id !== d.id && x.status === '승인'; }).length }; })
    };
  };
  /* 부원 이름 정리 (마스터): 예전 부원 이름을 '이름(학번)'으로 바꾸고, 그 이름이 쓰인 기록(담당 · 팀원 · 작성자 · 승인 · 댓글 · 일정 · 변경 기록 · 공지 · 보관)도 함께 바꿈.
     같은 이름이 두 명 이상이면 기록 속 이름이 누구 것인지 알 수 없어 그 이름은 건너뛰고 알려 줌. 기록 탭(로그)은 그대로 둠. */
  A.renameAll = function (q) {
    var me = deviceOf(q); if (me.role !== '마스터') err('not_master', '마스터만 할 수 있어요');
    return locked(function () {
      var ms = store.rows('members').filter(function (m) { return m.status === '활동' || m.status === '중지'; }), cnt = Object.create(null), map = Object.create(null), skipped = [];
      ms.forEach(function (m) { cnt[m.name] = (cnt[m.name] || 0) + 1; });
      ms.forEach(function (m) {
        if (/\([^)]*\)$/.test(m.name) || !m.studentId) return;   // 이미 정리됨
        setSetting('renamedAt', util.now());
        if (cnt[m.name] > 1) { if (skipped.indexOf(m.name) < 0) skipped.push(m.name); return; }
        map[m.name] = uniqName(m.name, m.studentId, m.id);
      });
      var olds = Object.keys(map); if (!olds.length) return { renamed: 0, skipped: skipped, changedRows: 0 };
      // 이름 칸만 바꿈 (제목 · 본문에 같은 글자가 있어도 그대로)
      var NAMEK = { owner: 1, createdBy: 1, updatedBy: 1, volunteer: 1, by: 1, okBy: 1, approvedBy: 1, team: 1, member: 1 };
      var has = function (k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(map, k); };
      var deep = function (v, key) {
        if (typeof v === 'string') return NAMEK[key] && has(v) ? map[v] : v;
        if (Array.isArray(v)) return v.map(function (x) { return deep(x, key); });
        if (v && typeof v === 'object') { var r = {}; Object.keys(v).forEach(function (k) { r[k] = deep(v[k], k); }); return r; }
        return v;
      };
      var rowDeep = function (tab, row) {
        var u = {};
        Object.keys(row).forEach(function (k) {
          if (k === '_row') return;
          var v = row[k];
          if (tab === 'history' && (k === 'before' || k === 'after')) {   // 변경 기록: 이름 칸의 전 · 후만
            if (!NAMEK[row.field]) { u[k] = v; return; }
            if (typeof v === 'string' && /^\s*\[/.test(v)) { try { u[k] = JSON.stringify(deep(JSON.parse(v), row.field)); } catch (e) { u[k] = v; } return; }
            u[k] = deep(v, row.field); return;
          }
          u[k] = deep(v, k);
        });
        return u;
      };
      var rows = 0;
      ['nodes', 'comments', 'links', 'files', 'events', 'history', 'archive'].forEach(function (tab) {
        store.rows(tab).forEach(function (row) {
          var u = rowDeep(tab, row), ch = Object.keys(u).some(function (k) { return JSON.stringify(u[k]) !== JSON.stringify(row[k]); });
          if (ch) { store.update(tab, row._row, u); rows++; }
        });
      });
      var nt = setting('notice', ''); if (nt) { try { var no = JSON.parse(nt), nn = JSON.stringify(deep(no, '')); if (nn !== nt) setSetting('notice', nn); } catch (e) {} }
      store.rows('members').forEach(function (m) { if (has(m.name) && (m.status === '활동' || m.status === '중지')) { m.name = map[m.name]; store.update('members', m._row, m); } });
      bump(); log(me, '부원 이름 정리', olds.length + '명 · 기록 ' + rows + '줄');
      return { renamed: olds.length, skipped: skipped, changedRows: rows };
    });
  };
  A.addMember = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var sid = String(q.studentId || '').trim(), name = String(q.name || '').trim().slice(0, 20);
    if (!sid || !name) err('bad', '학번과 이름을 넣어 주세요');
    var all = store.rows('members');
    var dupm = all.filter(function (m) { return m.studentId === sid && (m.status === '활동' || m.status === '중지'); })[0]; if (dupm) err('dup', dupm.status === '중지' ? '활동 중지된 부원이에요: ' + dupm.name + '. 부원 명단에서 활동으로 되돌려 주세요' : '이미 가입된 부원이에요: ' + dupm.name);
    if (all.some(function (m) { return m.studentId === sid && m.status === '신청'; })) err('dup', '초대 링크로 가입 신청한 학번이에요. 부원 · 기기의 승인 기다리는 기기에서 승인해 주세요');
    name = uniqName(name, sid);
    var id = newId('m'), code = digits(4);
    store.append('members', { id: id, studentId: sid, name: name, role: '부원', codeHash: hash(id, code), codeEnc: seal(id, code), status: '활동', createdAt: util.now() });
    bump(); log(me, '부원 추가', name);
    return { id: id, code: code, name: name };
  };
  A.resetCode = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var m = store.rows('members').filter(function (x) { return x.id === q.id; })[0]; if (!m) err('bad');
    if (m.role === '마스터' && m.id !== me.id) err('not_master', '마스터의 코드는 마스터 본인만 다시 만들 수 있어요');
    if ((m.role === '관리자' || m.role === '교사') && me.role !== '마스터' && m.id !== me.id) err('not_master', '운영진 · 선생님의 코드는 마스터만 다시 만들 수 있어요');
    var code = digits(4); m.codeHash = hash(m.id, code); m.codeEnc = seal(m.id, code); store.update('members', m._row, m);
    store.rows('devices').forEach(function (d) { if (d.memberId === m.id && d.status !== '차단') { d.status = '차단'; store.update('devices', d._row, d); } });
    bump(); log(me, '코드 재발급 · 기기 해제', m.name);
    return { code: code };
  };
  A.setMember = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var m = store.rows('members').filter(function (x) { return x.id === q.id; })[0]; if (!m) err('bad');
    if (m.role === '마스터') err('bad', '마스터는 바꿀 수 없어요');
    if (q.role && q.role !== m.role) { if (me.role !== '마스터') err('not_master', '역할은 마스터만 바꿀 수 있어요'); if (['부원', '관리자', '교사'].indexOf(q.role) < 0) err('bad'); m.role = q.role; }
    if (q.status && q.status !== m.status && (m.role === '관리자' || m.role === '교사') && me.role !== '마스터') err('not_master', '운영진 · 선생님의 활동은 마스터만 바꿀 수 있어요');
    if (q.status === '활동' && m.status !== '활동' && store.rows('members').some(function (x) { return x.id !== m.id && x.status === '활동' && x.studentId === m.studentId; })) err('dup', '같은 학번의 부원이 이미 활동 중이에요');
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
    var dm = store.rows('members').filter(function (x) { return x.id === d.memberId; })[0] || {};
    if ((dm.role === '마스터' || dm.role === '교사' || dm.role === '관리자') && me.role !== '마스터' && dm.id !== me.id) err('not_master', '마스터 · 운영진 · 선생님의 새 기기는 마스터만 승인할 수 있어요');
    d.status = '승인'; d.shared = q.shared ? 'true' : 'false'; d.approvedAt = util.now(); d.approvedBy = me.name; d.confirm = ''; d.lastSeen = util.now();
    var nm0 = store.rows('members').filter(function (x) { return x.id === d.memberId && x.status === '신청'; })[0];
    if (nm0 && store.rows('members').some(function (x) { return (x.status === '활동' || x.status === '중지') && x.studentId === nm0.studentId; })) err('dup', '같은 학번의 부원이 이미 있어요. 이 신청은 거절해 주세요');
    if (nm0) { var un = uniqName(nm0.name, nm0.studentId, nm0.id); if (un !== nm0.name) { nm0.name = un; store.update('members', nm0._row, nm0); } }
    store.update('devices', d._row, d);
    var nm = store.rows('members').filter(function (x) { return x.id === d.memberId && x.status === '신청'; })[0], code = '';
    if (nm) { code = digits(4); nm.codeHash = hash(nm.id, code); nm.codeEnc = seal(nm.id, code); nm.status = '활동'; store.update('members', nm._row, nm); log(me, '가입 승인', nm.name); }
    bump(); log(me, '기기 승인', d.label);
    return { ok: true, joined: !!nm, code: code };
  };
  A.block = function (q) {
    var me = deviceOf(q);
    var d = store.rows('devices').filter(function (x) { return x.id === q.id; })[0]; if (!d) err('bad');
    if (d.memberId !== me.id) { needAdmin(me); if (isStaff(memberOf(d.memberId)) && me.role !== '마스터') err('not_master', '마스터 · 선생님 · 운영진의 기기는 마스터만 막을 수 있어요'); }   // 본인 기기는 본인이 끊을 수 있음 ('내가 아님')
    d.status = '차단'; store.update('devices', d._row, d);
    var rm = store.rows('members').filter(function (x) { return x.id === d.memberId && x.status === '신청'; })[0];
    if (rm && !store.rows('devices').some(function (x) { return x.memberId === rm.id && x.status === '대기'; })) { rm.status = '거절'; store.update('members', rm._row, rm); }
    bump(); log(me, '기기 차단', d.label);
    return { ok: true };
  };
  A.logoutAll = function (q) {
    var me = deviceOf(q); needAdmin(me);
    store.rows('devices').forEach(function (d) { if (d.id !== me.deviceId && d.status === '승인' && (me.role === '마스터' || !isStaff(memberOf(d.memberId)))) { d.status = '만료'; store.update('devices', d._row, d); } });   // 운영진이 누르면 부원 기기만
    bump(); log(me, '모든 기기 로그아웃', '');
    return { ok: true };
  };
  A.stats = function (q) {
    var me = deviceOf(q); needAdmin(me);
    // 시스템 사용 현황용 숫자만 (이름 · 학번 · 실험 내용 없음)
    var ns = store.rows('nodes').filter(function (n) { return !util.bool(n.deleted); }), ex = ns.filter(function (n) { return n.type === 'exp'; }), devs = store.rows('devices');
    var last = ns.reduce(function (a, n) { var t = String(n.updatedAt || n.created || ''); return t > a ? t : a; }, '');
    return { members: store.rows('members').filter(function (m) { return m.status === '활동'; }).length, experiments: ex.length, ideas: ns.filter(function (n) { return n.type === 'idea'; }).length,
      done: ex.filter(function (n) { return n.status === '기록 완료'; }).length, running: ex.filter(function (n) { return ['검토 중', '준비 중', '실험 완료'].indexOf(n.status) >= 0; }).length,
      devices: devs.filter(function (d) { return d.status === '승인'; }).length, waiting: devs.filter(function (d) { return d.status === '대기'; }).length,
      lastEdit: String(last).slice(0, 10), backupAt: String(setting('backupAt', '')).slice(0, 10), backupErr: !!setting('backupErr', ''), core: GAJI_CONNECTOR_VERSION };
  };

  return {
    handle: function (q) {
      try {
        var fn = A[q && q.action]; if (!fn) err('unknown', '알 수 없는 요청이에요');
        var r0 = Number(setting('rev', '0')), data = fn(q), r1 = Number(setting('rev', '0')), out = { ok: true, data: data };
        if (r1 !== r0 && SELF_REV[q.action]) out.rev = { from: r0, to: r1 };   // 내가 바꾼 것(화면에 이미 들어감) → 다시 받지 않게
        return out;
      } catch (e) { return { ok: false, code: e.code || 'error', message: e.code ? e.message : '연결기에서 문제가 생겼어요' }; }
    }
  };
}

/* ================= 구글 시트 저장소 ================= */
var GAJI_TABS = {
  settings: { name: '설정', cols: ['key', 'value'] },
  members: { name: '부원', cols: ['id', 'studentId', 'name', 'role', 'codeHash', 'status', 'createdAt', 'codeEnc'] },
  devices: { name: '기기', cols: ['id', 'memberId', 'label', 'secretHash', 'status', 'confirm', 'shared', 'createdAt', 'approvedAt', 'approvedBy', 'lastSeen'] },
  nodes: { name: '실험', cols: ['id', 'no', 'type', 'title', 'field', 'status', 'line', 'date', 'owner', 'signal', 'review', 'verdict', 'fans', 'volunteer', 'equip', 'desc', 'private', 'report', 'created', 'createdBy', 'updatedAt', 'updatedBy', 'plan', 'prep', 'run', 'deleted', 'arch', 'team', 'fanBy'] },
  archive: { name: '보관', cols: ['id', 'data', 'comments', 'at'] },
  logArchive: { name: '기록 보관', cols: ['at', 'member', 'device', 'action', 'detail'] },
  links: { name: '연결', cols: ['id', 's', 't', 'k', 'createdBy', 'createdAt', 'off'] },
  files: { name: '파일', cols: ['id', 'node', 'fileId', 'thumbId', 'folderId', 'name', 'mime', 'size', 'caption', 'kind', 'by', 'at', 'off'] },
  comments: { name: '댓글', cols: ['id', 'node', 'sec', 'kind', 'text', 'by', 'byId', 'role', 'at', 'editedAt', 'resolved', 'off'] },
  lines: { name: '줄기', cols: ['key', 'name'] },
  log: { name: '기록', cols: ['at', 'member', 'device', 'action', 'detail'] },
  events: { name: '일정', cols: ['id', 'date', 'title', 'scope', 'by', 'byId', 'at', 'off', 'node', 'state', 'okBy'] },
  history: { name: '변경 기록', cols: ['id', 'node', 'field', 'by', 'byId', 'at', 'before', 'after'] }
};
var GAJI_NUM = { no: 1, signal: 1, review: 1, fans: 1, size: 1 };
var GAJI_JSON = { report: 1, plan: 1, prep: 1, run: 1, data: 1, comments: 1, team: 1, fanBy: 1 };

function GajiSheetStore(ss) {
  var cache = {};
  function sheet(t) {
    var def = GAJI_TABS[t], sh = ss.getSheetByName(def.name);
    if (!sh) { sh = ss.insertSheet(def.name); sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]); sh.setFrozenRows(1); sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@'); }
    else if (sh.getLastColumn() < def.cols.length) {   // 새 열 추가 (지우지 않음) · 글자 형식으로
      sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]); sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@'); }
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
    append: function (t, obj) { var def = GAJI_TABS[t], sh = sheet(t), vals = def.cols.map(function (c) { return enc(c, obj[c]); });
      try { var r = sh.getLastRow() + 1;   // 새 줄도 글자 형식으로 (= 로 시작하는 글이 수식이 되지 않게)
        if (r > sh.getMaxRows()) { sh.insertRowsAfter(sh.getMaxRows(), 200); sh.getRange(r, 1, 200, def.cols.length).setNumberFormat('@'); }
        sh.getRange(r, 1, 1, def.cols.length).setNumberFormat('@').setValues([vals]); }
      catch (e) { sh.appendRow(vals); }
      delete cache[t]; },
    remove: function (t, rows) { var sh = sheet(t); rows.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); }); delete cache[t]; },
    update: function (t, row, obj) { var def = GAJI_TABS[t]; sheet(t).getRange(row, 1, 1, def.cols.length).setValues([def.cols.map(function (c) { return enc(c, obj[c]); })]); delete cache[t]; },
    fresh: function () { cache = {}; }   // 잠근 뒤 다시 읽기
  };
}

/* ================= 동아리 드라이브 ================= */
function GajiDrive(ss) {
  function root() {
    var ps = DriveApp.getFileById(ss.getId()).getParents(), parent = ps.hasNext() ? ps.next() : DriveApp.getRootFolder();
    var it = parent.getFoldersByName('가지 실험 파일'); return it.hasNext() ? it.next() : parent.createFolder('가지 실험 파일');
  }
  function folder(id, name) {
    if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
    var r = root(), it = r.getFoldersByName(name); return it.hasNext() ? it.next() : r.createFolder(name);
  }
  return {
    save: function (folderId, folderName, name, mime, b64) {
      var f = folder(folderId, folderName), file = f.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, name));
      return { id: file.getId(), folderId: f.getId() };
    },
    read: function (id) { var b = DriveApp.getFileById(id).getBlob(); return { mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) }; },
    trash: function (id) { DriveApp.getFileById(id).setTrashed(true); }
  };
}

function gajiUtil() {
  return {
    now: function () { return new Date().toISOString(); },
    today: function () { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); },
    random: Math.random,
    token: function (n) { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', s = ''; var b = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); for (var i = 0; i < n; i++) s += a[(parseInt(b.substr((i * 2) % 60, 2), 16) + Math.floor(Math.random() * 256)) % a.length]; return s; },
    sha256: function (s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); },
    bool: function (v) { return v === true || String(v).toLowerCase() === 'true'; },
    secret: function () { var p = PropertiesService.getScriptProperties(), v = p.getProperty('GAJI_SECRET'); if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('GAJI_SECRET', v); } return v; },
    backup: function (o) {
      var ss = SpreadsheetApp.getActiveSpreadsheet(), file = DriveApp.getFileById(ss.getId()), ps = file.getParents(), par = ps.hasNext() ? ps.next() : DriveApp.getRootFolder();
      var it = par.getFoldersByName('가지 백업'), dir = it.hasNext() ? it.next() : par.createFolder('가지 백업');
      var name = '가지 데이터 백업 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HHmm');
      SpreadsheetApp.flush();
      var copy = file.makeCopy(name, dir), out = { id: copy.getId(), folder: dir.getUrl() };
      // 정리: 최근 o.keep개 + 달마다 가장 최근 1개(o.months달)
      var list = [], fi = dir.getFiles(); while (fi.hasNext()) { var f = fi.next(); if (f.getName().indexOf('가지 데이터 백업 ') === 0) list.push(f); }
      list.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
      var keep = {}, months = {};
      list.forEach(function (f, i) { var m = Utilities.formatDate(f.getDateCreated(), 'Asia/Seoul', 'yyyy-MM');
        if (i < o.keep) keep[f.getId()] = 1; else if (!months[m] && Object.keys(months).length < o.months) { months[m] = 1; keep[f.getId()] = 1; } });
      list.forEach(function (f) { if (!keep[f.getId()]) { try { f.setTrashed(true); } catch (e) {} } });
      out.kept = Object.keys(keep).length;
      if (o.mail) {
        try {
          var to = o.to || Session.getEffectiveUser().getEmail();
          var x = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
          var att = x.getResponseCode() === 200 ? [x.getBlob().setName(name + '.xlsx')] : [];
          MailApp.sendEmail({ to: to, subject: o.subject, htmlBody: o.html, attachments: att, name: '가지' });
          out.mailed = to.replace(/^(.{2}).*(@.*)$/, '$1…$2');
        } catch (e) { out.mailError = String(e.message || e); }
      }
      return out;
    },
    backupList: function () {
      var ss = SpreadsheetApp.getActiveSpreadsheet(), ps = DriveApp.getFileById(ss.getId()).getParents(), out = [];
      if (!ps.hasNext()) return out;
      var it = ps.next().getFoldersByName('가지 백업'); if (!it.hasNext()) return out;
      var fi = it.next().getFiles();
      while (fi.hasNext()) { var f = fi.next(); if (f.getName().indexOf('가지 데이터 백업 ') === 0 && f.getMimeType() === MimeType.GOOGLE_SHEETS) out.push({ id: f.getId(), name: f.getName(), at: f.getDateCreated().toISOString() }); }
      return out;
    },
    backupPeek: function (id) {
      var b = SpreadsheetApp.openById(id), cnt = function (n) { var sh = b.getSheetByName(n); return sh ? Math.max(0, sh.getLastRow() - 1) : 0; };
      return { exp: cnt('실험') + cnt('보관'), comments: cnt('댓글'), files: cnt('파일') };
    },
    restore: function (id, names) {
      var ss = SpreadsheetApp.getActiveSpreadsheet(), b = SpreadsheetApp.openById(id);
      names.forEach(function (n) {
        var from = b.getSheetByName(n); if (!from) return;
        var to = ss.getSheetByName(n) || ss.insertSheet(n);
        var vals = from.getDataRange().getValues();
        to.clearContents();
        if (vals.length && vals[0].length) {
          if (to.getMaxRows() < vals.length) to.insertRowsAfter(to.getMaxRows(), vals.length - to.getMaxRows());
          if (to.getMaxColumns() < vals[0].length) to.insertColumnsAfter(to.getMaxColumns(), vals[0].length - to.getMaxColumns());
          var rg = to.getRange(1, 1, vals.length, vals[0].length); rg.setNumberFormat('@'); rg.setValues(vals.map(function (r) { return r.map(function (v) { return v instanceof Date ? v.toISOString() : String(v); }); }));
        }
      });
      SpreadsheetApp.flush();
      return { name: DriveApp.getFileById(id).getName() };
    },
    links: function () {
      var ss = SpreadsheetApp.getActiveSpreadsheet(), o = { sheet: ss.getUrl() };
      try { o.script = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit'; } catch (e) {}
      try { var ps = DriveApp.getFileById(ss.getId()).getParents(); if (ps.hasNext()) { var par = ps.next(), it = par.getFoldersByName('가지 실험 파일'); o.home = par.getUrl(); if (it.hasNext()) o.folder = it.next().getUrl(); } } catch (e) {}
      return o;
    },
    hit: function (key, n, sec) { var c = CacheService.getScriptCache(), k = 'rl_' + key, v = Number(c.get(k) || 0) + 1; c.put(k, String(v), sec); return v <= n; },
    lock: function (fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
  };
}

/* ================= 껍데기가 부르는 입구 ================= */
function gajiPost(e) {
  var q = {}; try { q = JSON.parse(e.postData.contents); } catch (x) {}
  var ss = SpreadsheetApp.getActiveSpreadsheet(), core = GajiCore(GajiSheetStore(ss), gajiUtil(), GajiDrive(ss));
  return q.action === 'init' ? gajiUtil().lock(function () { return core.handle(q); }) : core.handle(q);
}
function gajiGet() { return { ok: true, data: { gaji: true, version: GAJI_CONNECTOR_VERSION } }; }
