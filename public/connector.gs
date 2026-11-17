/**
 * 가지 동아리 연결기 (Google Apps Script)
 * ------------------------------------------------------------
 * 이 짧은 코드는 한 번 넣으면 다시 바꿀 필요가 없어요.
 * 실제 기능(본체)은 가지 사이트에서 받아 실행하므로, 가지가 업데이트되면 자동으로 새 기능이 적용돼요.
 *   본체 주소(누구나 볼 수 있음): https://gaji-lab.web.app/core.js
 *   자동 업데이트 멈추기: 시트 '설정' 탭에 key = autoUpdate, value = off
 * 동아리 기록은 이 시트(동아리 드라이브)에만 저장되고, 가지 서버로 보내지 않아요.
 *
 * 권한: 위쪽 함수 목록에서 '권한허용' 선택 → ▷ 실행 → 권한 검토 → 고급 → 이동 → 허용 (처음 한 번)
 * 설치: 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 저장 → 배포 → 새 배포
 *       → 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 → 배포 → 권한 허용 → 웹 앱 URL을 가지에 붙여넣기
 * ------------------------------------------------------------
 */
var GAJI_SHELL_VERSION = '6';
var GAJI_CORE_URL = 'https://gaji-lab.web.app/core.js';

function gajiCore_() {
  var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  var code = cache.get('gaji_core');
  if (!code) {
    var frozen = false;
    try { var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('설정');
      if (st) frozen = st.getDataRange().getDisplayValues().some(function (r) { return r[0] === 'autoUpdate' && String(r[1]).toLowerCase() === 'off'; }); } catch (x) {}
    var why = '';
    if (!frozen) {
      try {
        var r = UrlFetchApp.fetch(GAJI_CORE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
        var t = r.getResponseCode() === 200 ? r.getContentText() : '';
        if (t.indexOf('var GAJI_CORE = true;') >= 0) { code = t; gajiSaveCore_(props, t); }
        else why = '가지 사이트 응답 ' + r.getResponseCode();
      } catch (x) { why = String(x.message || x); }
    }
    if (!code) code = gajiReadCore_(props);       // 사이트에 못 닿거나 멈춤이면 마지막으로 받은 판
    if (code) cache.put('gaji_core', code, 600);   // 10분마다 새 판 확인
  }
  if (!code) { var er = new Error('가지 본체를 받지 못했어요' + (why ? ': ' + why : '')); er.perm = /permission|권한|authoriz/i.test(why); throw er; }
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
  catch (x) { return gajiOut_({ ok: false, code: x.perm ? 'core_perm' : 'core', message: x.perm ? '연결기에 외부 연결 권한이 아직 없어요. Apps Script에서 권한허용 함수를 한 번 실행해 주세요' : String(x.message || x) }); }
}
function doGet() {
  try { var g = gajiCore_().get(); g.data.shell = GAJI_SHELL_VERSION; return gajiOut_(g); }
  catch (x) { return gajiOut_({ ok: false, code: x.perm ? 'core_perm' : 'core', message: String(x.message || x) }); }
}

/* 처음 한 번: 위쪽 함수 목록에서 '권한허용'을 고르고 ▷ 실행 → 권한 검토 → 허용 */
function 권한허용() {
  CacheService.getScriptCache().remove('gaji_core');
  var g = gajiCore_().get();
  Logger.log('가지 연결기 준비 완료 · 본체 ' + g.data.version);
}

/* 권한 목록 (실행하지 않음). 구글은 이 코드에 적힌 기능만 보고 권한을 묻기 때문에,
   본체가 앞으로 쓸 기능을 모두 여기 적어 두면 처음 연결할 때 한 번 허용으로 끝나요.
   시트 읽기 · 쓰기 / 가지 사이트에서 본체 받기 / 실험 폴더 · 사진 · 보관(드라이브) /
   보고서를 구글 문서로 / 결과 공유회 발표 자료(구글 슬라이드) / 실험 일정(구글 캘린더) /
   주간 백업 메일 / 예약 실행(주간 백업) — 모두 이 계정 안에서만 쓰여요 */
function 권한목록_() {
  // 읽기만 하는 함수만 적으면 구글이 '읽기 권한'만 줘요. 그래서 쓰기(만들기 · 고치기) 함수를 적어요.
  SpreadsheetApp.create; SpreadsheetApp.openById; UrlFetchApp.fetch;
  DriveApp.createFolder; DriveApp.createFile; DriveApp.getFileById; DriveApp.getFolderById;
  DocumentApp.create; DocumentApp.openById; SlidesApp.create; SlidesApp.openById;
  CalendarApp.createCalendar; CalendarApp.getDefaultCalendar;
  MailApp.sendEmail; ScriptApp.newTrigger; ScriptApp.getProjectTriggers; Session.getEffectiveUser; LockService.getScriptLock;
}
