/**
 * 가지 동아리 연결기 (Google Apps Script)
 * ------------------------------------------------------------
 * 이 짧은 코드는 한 번 넣으면 다시 바꿀 필요가 없어요.
 * 실제 기능(본체)은 가지 사이트에서 받아 실행하므로, 가지가 업데이트되면 자동으로 새 기능이 적용돼요.
 *   본체 주소(누구나 볼 수 있음): https://gaji-lab.web.app/core.js
 *   자동 업데이트 멈추기: 시트 '설정' 탭에 key = autoUpdate, value = off
 * 동아리 기록은 이 시트(동아리 드라이브)에만 저장되고, 가지 서버로 보내지 않아요.
 *
 * 설치: 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 저장 → 배포 → 새 배포
 *       → 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 → 배포 → 권한 허용 → 웹 앱 URL을 가지에 붙여넣기
 * ------------------------------------------------------------
 */
var GAJI_SHELL_VERSION = '2';
var GAJI_CORE_URL = 'https://gaji-lab.web.app/core.js';

function gajiCore_() {
  var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  var code = cache.get('gaji_core');
  if (!code) {
    var frozen = false;
    try { var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('설정');
      if (st) frozen = st.getDataRange().getDisplayValues().some(function (r) { return r[0] === 'autoUpdate' && String(r[1]).toLowerCase() === 'off'; }); } catch (x) {}
    if (!frozen) {
      try {
        var r = UrlFetchApp.fetch(GAJI_CORE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
        var t = r.getResponseCode() === 200 ? r.getContentText() : '';
        if (t.indexOf('var GAJI_CORE = true;') >= 0) { code = t; gajiSaveCore_(props, t); }
      } catch (x) {}
    }
    if (!code) code = gajiReadCore_(props);       // 사이트에 못 닿거나 멈춤이면 마지막으로 받은 판
    if (code) cache.put('gaji_core', code, 600);   // 10분마다 새 판 확인
  }
  if (!code) throw new Error('가지 본체를 받지 못했어요');
  return (new Function(code + '\nreturn { post: gajiPost, get: gajiGet };'))();
}
// 스크립트 속성은 칸당 9KB까지라 나눠서 보관
function gajiSaveCore_(props, t) {
  var n = Math.ceil(t.length / 8000), o = { gaji_core_n: String(n) };
  for (var i = 0; i < n; i++) o['gaji_core_' + i] = t.substr(i * 8000, 8000);
  props.setProperties(o);
}
function gajiReadCore_(props) {
  var n = Number(props.getProperty('gaji_core_n') || 0), t = '';
  for (var i = 0; i < n; i++) t += props.getProperty('gaji_core_' + i) || '';
  return t.indexOf('var GAJI_CORE = true;') >= 0 ? t : '';
}
function gajiOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try { return gajiOut_(gajiCore_().post(e)); }
  catch (x) { return gajiOut_({ ok: false, code: 'core', message: '연결기가 가지 본체를 받지 못했어요. 잠시 뒤 다시 해 주세요' }); }
}
function doGet() {
  try { var g = gajiCore_().get(); g.data.shell = GAJI_SHELL_VERSION; return gajiOut_(g); }
  catch (x) { return gajiOut_({ ok: false, code: 'core', message: String(x.message || x) }); }
}
