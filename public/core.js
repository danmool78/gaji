/* 가지 연결기 본체 (core.js)
 * ------------------------------------------------------------
 * 각 동아리 시트의 '연결기 껍데기'가 이 파일을 받아 실행합니다. 이 파일이 바뀌면 모든 동아리에 자동으로 적용돼요.
 * 누구나 이 주소에서 내용을 볼 수 있어요: https://gaji-lab.web.app/core.js
 * 시트 '설정' 탭에 autoUpdate = off 를 넣으면 그 동아리는 마지막으로 받은 판에 머물러요.
 * ------------------------------------------------------------ */
var GAJI_CORE = true;
var GAJI_CONNECTOR_VERSION = '2.6.0';

/* ================= 핵심 로직 (저장소와 분리: 시험 가능) ================= */
function GajiCore(store, util, drive) {
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
  A.ping = function () { return { version: GAJI_CONNECTOR_VERSION, shell: typeof GAJI_SHELL_VERSION !== 'undefined' ? String(GAJI_SHELL_VERSION) : '', initialized: initialized(), slug: setting('slug', ''), keyed: setting('masterKeyHash', '') !== '' }; };

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

  // 기장 · 선생님: 시트 · 연결기 · 사진 폴더 바로 열기 주소
  A.links = function (q) {
    var me = deviceOf(q); needAdmin(me);
    var l = {}; try { l = util.links ? util.links() : {}; } catch (e) {}
    return l;
  };

  A.rev = function (q) { deviceOf(q); return { rev: Number(setting('rev', '0')) }; };

  A.load = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    var nodes = store.rows('nodes').filter(function (n) { return !util.bool(n.private) || admin || inTeam(n, me); }).map(cleanNode);
    var members = store.rows('members').filter(function (m) { return m.status === '활동'; }).map(function (m) { return { id: m.id, name: m.name, role: m.role }; });
    var mine = store.rows('devices').filter(function (d) { return d.memberId === me.id; });
    var notice = mine.filter(function (d) { return d.id !== me.deviceId && d.status === '승인' && days(d.approvedAt) < 7; }).map(function (d) { return { id: d.id, label: d.label, at: d.approvedAt }; });
    return {
      rev: Number(setting('rev', '0')), me: { id: me.id, name: me.name, role: me.role }, nodes: nodes,
      links: store.rows('links').filter(function (l) { return !util.bool(l.off); }).map(function (l) { return { id: l.id, s: l.s, t: l.t, k: l.k }; }),
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
  var LOCKED_FIELDS = { plan: 1, prep: 1, run: 1, report: 1, title: 1 };   // 보고서 확정 뒤에는 관리자만
  function mineNode(n, me) { return n.createdBy === me.name || n.owner === me.name; }
  // 이 실험의 사람들: 담당 · 만든 사람 · 함께하는 사람 (아이디어는 담당 지원자도)
  function teamOf(n) { var t = [n.owner, n.createdBy].concat(Array.isArray(n.team) ? n.team : []); if (n.type === 'idea' && n.volunteer) t.push(n.volunteer); return t.filter(Boolean); }
  function inTeam(n, me) { return teamOf(n).indexOf(me.name) >= 0; }
  var OPEN_FIELDS = { fans: 1, volunteer: 1, equip: 1 };   // 아이디어: 누구나 같이 해요 · 담당 지원 · 장비 확인
  function isFinal(n) { return !!(n.report && n.report.final); }
  A.sync = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    return util.lock(function () {
      var rows = store.rows('nodes'), byId = {}, assigned = {}, rejected = [];
      rows.forEach(function (r) { byId[r.id] = r; });
      (q.nodes || []).slice(0, 50).forEach(function (c) {
        if (!c || !c.id || !c.title) return;
        var old = byId[c.id];
        var wasArch = !!(old && old.arch);
        if (wasArch) { old = unarchive(old); byId[c.id] = old; }
        if (!old) {
          var fam = c.type === 'q' ? 'q' : c.type === 'res' ? 'res' : 'exp', no = Number(setting('no_' + fam, 0)) + 1;
          setSetting('no_' + fam, no);
          var n = { id: String(c.id).slice(0, 40), no: no, created: util.today(), createdBy: me.name, updatedAt: util.now(), updatedBy: me.name };
          NODE_FIELDS.forEach(function (f) { if (f in c) n[f] = c[f]; });
          if (!admin) n.verdict = '';
          store.append('nodes', n); assigned[n.id] = no; log(me, '새로 만듦', n.title);
          return;
        }
        var u = cleanNode(old), changed = false, team = admin || inTeam(old, me);
        NODE_FIELDS.forEach(function (f) {
          if (!(f in c) || val(c[f]) === val(old[f])) return;
          if (wasArch && c.arch && HEAVY.indexOf(f) >= 0) return;
          if (!team) {
            if (!(old.type === 'idea' && OPEN_FIELDS[f])) { if (rejected.indexOf(old.id + ':team') < 0) rejected.push(old.id + ':team'); return; }
          }
          if (f === 'volunteer' && !admin && c.volunteer && c.volunteer !== me.name) { rejected.push(old.id + ':team'); return; }   // 담당 지원은 본인만
          if ((f === 'team' || f === 'owner' || f === 'private') && !admin && !mineNode(old, me)) { rejected.push(old.id + ':team'); return; }   // 보관 내용을 아직 안 받은 기기: 무거운 칸은 건드리지 않음
          if (!admin && f === 'verdict') { rejected.push(old.id + ':verdict'); return; }
          if (!admin && f === 'status' && STAGES.indexOf(c.status) >= 0 && STAGES.indexOf(c.status) < STAGES.indexOf(old.status)) {
            // 부원: 내가 방금(10분 안) 옮긴 단계는 한 단계만 되돌릴 수 있음 (실수 되돌리기)
            var mine = old.updatedBy === me.name && (Date.parse(util.now()) - Date.parse(old.updatedAt || 0)) < 10 * 60000 && STAGES.indexOf(c.status) === STAGES.indexOf(old.status) - 1;
            if (!mine) { rejected.push(old.id + ':status'); return; }
          }
          if (!admin && f === 'status' && c.status === '취소') { rejected.push(old.id + ':cancel'); return; }
          if (f === 'type' && !((old.type === 'idea' && c.type === 'exp') || old.type === c.type)) return;

          if (f === 'deleted' && !admin && !mineNode(old, me)) { rejected.push(old.id + ':delete'); return; }
          if (!admin && isFinal(old) && (LOCKED_FIELDS[f] || f === 'status')) { rejected.push(old.id + ':final'); return; }
          if (f === 'report' && !admin && c.report && c.report.final && !isFinal(old)) { rejected.push(old.id + ':final'); return; }
          u[f] = c[f]; changed = true;
        });
        if (changed) { u.updatedAt = util.now(); u.updatedBy = me.name; store.update('nodes', old._row, u); log(me, '수정', old.title); }
      });
      var links = store.rows('links'), key = {}, nodesNow = {};
      store.rows('nodes').forEach(function (r) { nodesNow[r.id] = r; });
      links.forEach(function (l) { key[l.s + '|' + l.t + '|' + l.k] = l; });
      (q.links || []).slice(0, 50).forEach(function (l) {
        if (!l || !l.s || !l.t || l.s === l.t) return;
        if (['follow', 'next', 'q', 'res', 'rel'].indexOf(l.k) < 0) return;
        var old = key[l.s + '|' + l.t + '|' + l.k];
        if (l.off) {   // 연결 끊기 (가지 옮기기): 관리자, 연결을 만든 사람, 도착 항목을 만든 사람 · 담당
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
      Object.keys(q.lines || {}).slice(0, 50).forEach(function (k) { var name = String(q.lines[k]).slice(0, 20); if (!lk[k]) store.append('lines', { key: k, name: name }); else if (lk[k].name !== name && admin) store.update('lines', lk[k]._row, { key: k, name: name }); });
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
  A.tidy = function (q) {
    var me = deviceOf(q); var today = util.today();
    if (setting('tidyAt', '') === today && !q.force) return { done: false, reason: 'today' };
    return util.lock(function () {
      setSetting('tidyAt', today);
      var limit = Number(setting('archLimit', 300000)), size = heavySize(), moved = 0, logs = 0;
      // 기록 탭: 1년 지난 것은 '기록 보관'으로
      var oldLogs = store.rows('log').filter(function (l) { return days(l.at) > 365; });
      if (oldLogs.length > 200) { oldLogs.forEach(function (l) { store.append('logArchive', l); }); store.remove('log', oldLogs.map(function (l) { return l._row; })); logs = oldLogs.length; }
      if (size <= limit && !q.force) return { done: true, moved: 0, logs: logs, size: size };
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
      return { done: true, moved: moved, logs: logs, size: size };
    });
  };
  // 보관된 항목 내용 받기 (열 때)
  A.archived = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], out = {};
    var rows = store.rows('archive'), nodes = store.rows('nodes');
    (q.ids || []).slice(0, 20).forEach(function (id) {
      var n = nodes.filter(function (x) { return x.id === id; })[0]; if (!n || (util.bool(n.private) && !admin && n.owner !== me.name)) return;
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
      var n = nodes[a.id]; if (!n || (util.bool(n.private) && !admin && n.owner !== me.name)) return;
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
    var me = deviceOf(q), admin = !!ADMIN[me.role], op = q.op || 'add';
    return util.lock(function () {
      var rows = store.rows('comments');
      if (op === 'add') {
        var n = store.rows('nodes').filter(function (x) { return x.id === q.node; })[0]; if (!n) err('bad', '항목을 찾을 수 없어요');
        if (util.bool(n.private) && !admin && !inTeam(n, me)) err('bad', '항목을 찾을 수 없어요');
        var kind = KINDS[q.kind] ? q.kind : 'note', text = String(q.text || '').trim().slice(0, 1000);
        if (!text && kind !== 'approve') err('bad', '내용을 써 주세요');
        if (kind === 'approve') {
          if (mineNode(n, me) && !admin) err('self', '내 실험은 내가 승인할 수 없어요');
          rows.forEach(function (c) { if (c.node === n.id && c.kind === 'approve' && c.byId === me.id && !util.bool(c.off)) { c.off = 'true'; store.update('comments', c._row, c); } });
        }
        var c = { id: newId('c'), node: n.id, sec: String(q.sec || '').slice(0, 40), kind: kind, text: text, by: me.name, byId: me.id, role: me.role, at: util.now(), editedAt: '', resolved: '', off: '' };
        store.append('comments', c); bump(); log(me, { note: '댓글', fix: '첨삭', approve: '검토 승인', change: '수정 요청', answer: '답변' }[kind], n.title);
        delete c.off; c.resolved = false; return { comment: c };
      }
      var cm = rows.filter(function (x) { return x.id === q.id && !util.bool(x.off); })[0]; if (!cm) err('bad', '댓글을 찾을 수 없어요');
      var node = store.rows('nodes').filter(function (x) { return x.id === cm.node; })[0] || {};
      if (op === 'edit') { if (cm.byId !== me.id) err('not_mine', '내가 쓴 댓글만 고칠 수 있어요'); cm.text = String(q.text || '').trim().slice(0, 1000); if (!cm.text) err('bad', '내용을 써 주세요'); cm.editedAt = util.now(); }
      else if (op === 'delete') { if (cm.byId !== me.id && !admin) err('not_mine', '내가 쓴 댓글만 지울 수 있어요'); cm.off = 'true'; }
      else if (op === 'resolve' || op === 'reopen') { if (cm.byId !== me.id && !admin && !mineNode(node, me)) err('not_mine', '실험 담당자나 관리자만 할 수 있어요'); cm.resolved = op === 'resolve' ? 'true' : ''; }
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
      if (/permission|권한|authoriz|DriveApp/i.test(m)) err('drive_perm', '연결기에 드라이브 권한이 없어요. 동아리 마스터가 연결기 코드를 새로 붙여 넣고 권한허용을 실행해야 해요');
      err('drive', '드라이브에 저장하지 못했어요: ' + m.slice(0, 80));
    }
  }
  function visibleNode(id, me, admin) {
    var n = store.rows('nodes').filter(function (x) { return x.id === id; })[0];
    if (!n || (util.bool(n.private) && !admin && !inTeam(n, me))) err('bad', '항목을 찾을 수 없어요');
    return n;
  }
  A.upload = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role], n = visibleNode(q.node, me, admin);
    var mime = String(q.mime || ''), data = String(q.data || '');
    if (!MIMES[mime]) err('bad', '사진(JPG · PNG) 또는 PDF만 올릴 수 있어요');
    if (!data || data.length > 14e6) err('big', '파일이 너무 커요 (10MB까지)');
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
        var r = drive.read(q.full ? f.fileId : (f.thumbId || f.fileId)); out[id] = { mime: r.mime, data: r.data };
      });
    });
    return { files: out };
  };
  A.fileEdit = function (q) {
    var me = deviceOf(q), admin = !!ADMIN[me.role];
    var f = store.rows('files').filter(function (x) { return x.id === q.id && !util.bool(x.off); })[0]; if (!f) err('bad', '파일을 찾을 수 없어요');
    var n = visibleNode(f.node, me, admin);
    if (f.by !== me.name && !admin && !mineNode(n, me)) err('not_mine', '올린 사람 · 실험 담당자 · 관리자만 할 수 있어요');
    if (q.op === 'delete') { f.off = 'true'; if (drive) { try { drive.trash(f.fileId); if (f.thumbId) drive.trash(f.thumbId); } catch (e) {} } log(me, '파일 지움', f.name); }
    else { if ('caption' in q) f.caption = String(q.caption || '').slice(0, 200); if (q.kind) f.kind = q.kind === 'graph' ? 'graph' : q.kind === 'doc' ? 'doc' : 'photo'; }
    store.update('files', f._row, f); bump();
    return { ok: true };
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
  nodes: { name: '실험', cols: ['id', 'no', 'type', 'title', 'field', 'status', 'line', 'date', 'owner', 'signal', 'review', 'verdict', 'fans', 'volunteer', 'equip', 'desc', 'private', 'report', 'created', 'createdBy', 'updatedAt', 'updatedBy', 'plan', 'prep', 'run', 'deleted', 'arch', 'team'] },
  archive: { name: '보관', cols: ['id', 'data', 'comments', 'at'] },
  logArchive: { name: '기록 보관', cols: ['at', 'member', 'device', 'action', 'detail'] },
  links: { name: '연결', cols: ['id', 's', 't', 'k', 'createdBy', 'createdAt', 'off'] },
  files: { name: '파일', cols: ['id', 'node', 'fileId', 'thumbId', 'folderId', 'name', 'mime', 'size', 'caption', 'kind', 'by', 'at', 'off'] },
  comments: { name: '댓글', cols: ['id', 'node', 'sec', 'kind', 'text', 'by', 'byId', 'role', 'at', 'editedAt', 'resolved', 'off'] },
  lines: { name: '줄기', cols: ['key', 'name'] },
  log: { name: '기록', cols: ['at', 'member', 'device', 'action', 'detail'] }
};
var GAJI_NUM = { no: 1, signal: 1, review: 1, fans: 1, size: 1 };
var GAJI_JSON = { report: 1, plan: 1, prep: 1, run: 1, data: 1, comments: 1, team: 1 };

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
    append: function (t, obj) { var def = GAJI_TABS[t]; sheet(t).appendRow(def.cols.map(function (c) { return enc(c, obj[c]); })); delete cache[t]; },
    remove: function (t, rows) { var sh = sheet(t); rows.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); }); delete cache[t]; },
    update: function (t, row, obj) { var def = GAJI_TABS[t]; sheet(t).getRange(row, 1, 1, def.cols.length).setValues([def.cols.map(function (c) { return enc(c, obj[c]); })]); delete cache[t]; }
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
    links: function () {
      var ss = SpreadsheetApp.getActiveSpreadsheet(), o = { sheet: ss.getUrl() };
      try { o.script = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit'; } catch (e) {}
      try { var ps = DriveApp.getFileById(ss.getId()).getParents(); if (ps.hasNext()) { var par = ps.next(), it = par.getFoldersByName('가지 실험 파일'); o.home = par.getUrl(); if (it.hasNext()) o.folder = it.next().getUrl(); } } catch (e) {}
      return o;
    },
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
