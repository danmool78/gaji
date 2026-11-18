// 연결기 껍데기(public/connector.gs)를 가짜 구글 환경에서 시험: 본체 받기 · 보관 · 사이트 장애 · 자동 업데이트 멈춤
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const SHELL = fs.readFileSync(path.join(__dirname, '../public/connector.gs'), 'utf8');
let CORE = fs.readFileSync(path.join(__dirname, '../public/core.js'), 'utf8');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };
function makeSS() {
  const sheets = [];
  function mk(name) { const d = []; const sh = { name, d, getMaxRows: () => 1000, getLastRow: () => d.length, getLastColumn: () => d.reduce((m, r) => Math.max(m, r.length), 0), setFrozenRows() {}, appendRow: (r) => d.push(r.map(String)),
    getDataRange: () => ({ getDisplayValues: () => d.map((r) => r.slice()) }),
    getRange(r, c, nr, nc) { if (typeof r === 'string') return { setNumberFormat() {} }; nr = nr || 1; nc = nc || 1;
      return { setNumberFormat() {}, setValues(v) { for (let i = 0; i < nr; i++) { d[r - 1 + i] = d[r - 1 + i] || []; for (let j = 0; j < nc; j++) d[r - 1 + i][c - 1 + j] = String(v[i][j]); } },
        getDisplayValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((d[r - 1 + i] || [])[c - 1 + j] ?? ''); o.push(row); } return o; } }; } };
    sheets.push(sh); return sh; }
  return { getSheetByName: (n) => sheets.find((s) => s.name === n) || null, insertSheet: mk, getSheets: () => sheets, deleteSheet: (s) => sheets.splice(sheets.indexOf(s), 1) };
}
const ss = makeSS(), props = {}, cache = {}; let site = 'up', fetches = 0;
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10), getUuid: () => crypto.randomUUID(), computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)), DigestAlgorithm: {}, Charset: {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, setProperties: (o) => Object.entries(o).forEach(([k, v]) => { if (String(v).length > 9216) throw new Error('too big ' + k); props[k] = v; }) }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { if (v.length > 100000) throw new Error('cache too big'); cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
  UrlFetchApp: { fetch: () => { fetches++; if (site === 'down') throw new Error('dns'); if (site === 'perm') throw new Error('You do not have permission to call UrlFetchApp.fetch. Required permissions: https://www.googleapis.com/auth/script.external_request'); return { getResponseCode: () => (site === '500' ? 500 : 200), getContentText: () => (site === '500' ? 'error' : CORE) }; } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'j' }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) }
};
vm.createContext(ctx); vm.runInContext(SHELL, ctx);
const post = (q) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(q) } }).t);
const get = () => JSON.parse(ctx.doGet().t);
const clearCache = () => Object.keys(cache).forEach((k) => delete cache[k]);

ok('doGet version', get().data.version === '2.23.2' && get().data.shell === '6', get());
ok('core stored in chunks', Number(props.gaji_core_n) >= 3);
const init = post({ action: 'init', slug: 't', name: '김', studentId: '1', label: 'PC', masterKey: 'K'.repeat(40) });
ok('init via shell', init.ok, init);
const M = init.data.device;
ok('load via shell', post({ action: 'load', device: M }).ok);
const f0 = fetches; post({ action: 'rev', device: M }); ok('cached (no refetch within 10 min)', fetches === f0);
// 사이트 장애 → 마지막 판으로 계속 동작
clearCache(); site = 'down'; ok('site down still works', post({ action: 'load', device: M }).ok);
clearCache(); site = '500'; ok('site 500 still works', post({ action: 'load', device: M }).ok);
// 새 판 자동 적용
site = 'up'; CORE = CORE.replace("GAJI_CONNECTOR_VERSION = '2.23.2'", "GAJI_CONNECTOR_VERSION = '2.1.1'"); clearCache();
ok('auto update', post({ action: 'ping' }).data.version === '2.1.1');
// 자동 업데이트 멈춤
const st = ss.getSheetByName('설정'); st.d.push(['autoUpdate', 'off']);
CORE = CORE.replace("'2.1.1'", "'2.1.2'"); clearCache();
ok('frozen keeps old', post({ action: 'ping' }).data.version === '2.1.1');
// 이상한 내용은 받지 않음
st.d.pop(); clearCache(); const good = CORE; CORE = '<html>hacked</html>';
ok('rejects non-core content', post({ action: 'ping' }).data.version === '2.1.1');
CORE = good;
// 처음부터 사이트에 못 닿으면 친절한 오류
for (const k of Object.keys(props)) delete props[k]; clearCache(); site = 'down';
const e = post({ action: 'ping' }); ok('no core → friendly error', !e.ok && e.code === 'core', e);
// 외부 연결 권한이 없을 때 → 원인을 알려 줌
site = 'perm'; clearCache();
const pe = post({ action: 'ping' }); ok('no permission → core_perm', !pe.ok && pe.code === 'core_perm', pe);
const ge = get(); ok('doGet shows reason', !ge.ok && ge.code === 'core_perm' && /permission/.test(ge.message), ge);
// 권한 허용 뒤 권한허용() 실행 → 본체 받음
site = 'up'; ctx.Logger = { log: (m) => { ctx._log = m; } }; vm.runInContext('권한허용()', ctx);
ok('권한허용 runs', /준비 완료/.test(ctx._log || ''), ctx._log);
console.log(`shell: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
