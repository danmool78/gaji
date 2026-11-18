// 체험 모드에서 레몬 전지 실험 전 과정 + 사진 + 줄기 + 찾기. 실행: node tests/flow.check.cjs 390 (또는 1440)
// 고등학생 한 명이 레몬 전지 실험을 처음부터 끝까지 (체험 모드, 휴대폰 390)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const P = require('path').join(__dirname, '../public');
const srv = http.createServer((q, r) => { let f = path.join(P, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = P + '/index.html'; r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(f).pipe(r); }).listen(5087);
const W = Number(process.argv[2] || 390), H = W > 700 ? 1180 : 844, OUT = 'shots/flow-' + W + '-';
const check = (label) => `(() => { const bad = [];
  document.querySelectorAll('.btn, .chipbtn, .chip, .seg button, .toast-act, .badge').forEach((b) => { if (!b.offsetParent) return; const r = b.getBoundingClientRect(); const inBoard = b.closest('.board');
    const lh = parseFloat(getComputedStyle(b).lineHeight) || 20; let lines = 0; const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let tn; while ((tn = tw.nextNode())) { if (!tn.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(tn); lines = Math.max(lines, new Set(Array.from(rg.getClientRects()).filter((x) => x.width > 1).map((x) => Math.round(x.top))).size); }
    if (b.scrollWidth > b.clientWidth + 2) bad.push('넘침: ' + b.textContent.trim());
    if (r.right > innerWidth + 1 && !inBoard) bad.push('화면 밖: ' + b.textContent.trim());
    if (lines > 1) bad.push('줄바꿈: ' + b.textContent.trim()); });
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('가로 스크롤 생김');
  return bad; })()`;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); await p.addInitScript(() => { try { const v = JSON.parse(localStorage.getItem('gaji-prefs') || '{}'); v.tourDone = 1; localStorage.setItem('gaji-prefs', JSON.stringify(v)); } catch (e) {} });   // 처음 화면 안내는 따로 시험
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**/platform.js', (r) => r.fulfill({ body: 'document.querySelector(".app").hidden=false', contentType: 'text/javascript' }));
  await p.goto('http://localhost:5087/c/demo');
  const wrapBad = [];
  const shot = async (n) => { const bad = await p.evaluate(check()); if (bad.length) wrapBad.push(n + ': ' + [...new Set(bad)].join(' / ')); return p.screenshot({ path: OUT + n + '.png', fullPage: true }); };
  const body = () => p.textContent('.layout');
  const click = async (sel) => { await p.click(sel); await p.waitForTimeout(60); };

  // 1. 새 실험 → 계획서가 바로 열림
  await click('[data-new="exp"]'); await p.fill('#newForm [name=title]', '레몬 전지: 전극 금속에 따라 전압이 달라질까?');
  await p.selectOption('#newForm [name=field]', '화학');
  ok((await p.inputValue('#newForm [name=newLine]')) === '레몬 전지', '새 줄기 이름 제안: 제목의 : 앞');
  await p.fill('#newForm [name=newLine]', '전지 연구'); await click('#newForm [type=submit]');
  ok(await p.isVisible('#planForm'), '새 실험 → 계획서 창');
  const plan = {
    purpose: '과일 전지에서 어떤 금속을 쓰면 전압이 가장 높은지 알고 싶다. 전지의 원리(산화 · 환원)를 직접 확인한다.',
    hypo: '두 전극 금속의 반응성 차이가 클수록 전압이 높을 것이다.',
    ind: '전극 금속 조합: 구리-아연, 구리-철, 구리-알루미늄', dep: '전압(V) · 디지털 멀티미터', ctrl: '레몬 크기(약 120g), 전극 간격 2cm, 꽂는 깊이 3cm, 측정 시간 10초 뒤',
    materials: '레몬 3개\n구리판 3장\n아연판 1장\n철 못 1개\n알루미늄판 1장\n디지털 멀티미터\n악어 집게 전선 2개\n자',
    steps: '레몬을 책상에 굴려 즙이 잘 나오게 한다\n구리판과 아연판을 2cm 간격, 3cm 깊이로 꽂는다\n멀티미터를 연결하고 10초 뒤 전압을 읽는다\n같은 방법으로 3번 잰다\n전극을 철 · 알루미늄으로 바꿔 반복한다',
    safety: '금속판 모서리 조심(장갑), 레몬즙이 눈에 튀지 않게 보안경', roles: '측정 - 김성수 · 기록 - 김성수', expect: '구리-아연 > 구리-알루미늄 > 구리-철', refs: '화학Ⅰ 교과서 산화 환원 단원'
  };
  for (const [k, v] of Object.entries(plan)) await p.fill('#planForm [name=' + k + ']', v);
  await shot('01-plan-form'); await click('#planForm [type=submit]');
  let t = await body(); ok(t.includes('검토를 요청해요') && t.includes('반응성 차이'), '계획서 저장 → 검토 요청 안내');
  await shot('02-plan-saved');
  // 2. 검토 요청 → 승인 · 수정 요청 → 고치기
  await click('[data-act=askReview]'); t = await body(); ok(t.includes('검토 중 · 부원 0/2 · 선생님 대기'), '검토 중');
  let ITEM = null;   // 체험 인물을 바꾸면 처음 화면으로 가므로, 만든 실험을 다시 엶
  const reopen = async () => { await click('.tabs [data-tab="find"]'); await p.fill('#q', '전극 금속'); await p.waitForTimeout(120);
    if (!ITEM) ITEM = await p.$$eval('.day-list .srow[data-item]', (a) => (a.map((x) => x.dataset.item).find((id) => !/^[a-z]+\d+$/.test(id)) || null));
    await click('.day-list [data-item="' + ITEM + '"]'); };
  const who = async (name) => { if (!ITEM) await reopen(); await click('#demoPill'); await click('#sheet [data-act=demoMe][data-name^="' + name + '"]'); await reopen(); };
  ok(!(await p.$('[data-act=approve]')), '내 실험은 내가 승인 못 함');
  await who('홍교사');
  await click('[data-act=fixNote]'); await p.selectOption('#sheet .cm-add [name=sec]', 'plan.ctrl'); await p.fill('#sheet .cm-add [name=text]', '통제 변인에 레몬 온도(실온)도 넣어 주세요');
  await click('#sheet .cm-add button[value=change]'); t = await body(); ok(t.includes('고칠 곳 1개') && t.includes('레몬 온도'), '수정 요청 남김');
  ok(await p.$('.sec-chip.has'), '계획서 해당 칸에 첨삭 표시');
  await who('김기장');
  await click('[data-act=plan]'); await p.fill('#planForm [name=ctrl]', plan.ctrl + ', 레몬 온도(실온 22℃)'); await click('#planForm [type=submit]');
  await click('#comments [data-act=cmResolve]'); t = await body(); ok(!t.includes('고칠 곳 1개'), '고쳤어요 → 해결');
  await who('홍교사');
  await click('[data-act=approve]'); ok((await p.textContent('#toast')).includes('먼저 승인해야'), '선생님은 부원 승인 뒤에 최종 승인');
  await who('박준서'); await click('[data-act=approve]'); t = await body(); ok(t.includes('부원 1/2'), '부원 1/2');
  await who('최윤아'); await click('[data-act=approve]'); t = await body(); ok(t.includes('부원 2/2') && t.includes('최종 승인만 남았어요'), '부원 2/2 → 선생님 차례');
  await who('김기장'); ok(!(await p.$('[data-act=advance]')), '선생님 승인 전에는 준비 시작 못 함');
  await who('홍교사'); await click('[data-act=approve]'); t = await body(); ok(t.includes('선생님 ✓'), '선생님 최종 승인');
  await who('김기장');
  await shot('03-review');
  await click('[data-act=advance]'); t = await body(); ok(t.includes('준비물을 챙겨요'), '준비 중');
  // 3. 준비 점검
  const items = await p.$$('[data-act=prepToggle]'); ok(items.length === 13, '준비물 8 + 기본 5 = ' + items.length);
  await p.fill('#prepAdd [name=t]', '여분 레몬 1개'); await click('#prepAdd [type=submit]');
  ok((await p.inputValue('#prepAdd [name=t]')) === '', '추가 뒤 입력 칸 비움');
  for (let i = 0; i < 14; i++) { const x = await p.$$('[data-act=prepToggle]:not(.on)'); if (!x.length) break; await x[0].click(); await p.waitForTimeout(30); }
  t = await body(); ok(t.includes('준비 끝') && t.includes('준비 100%'), '준비 끝 · 준비 100%'); await shot('04-prep');
  // 4. 진행 도우미
  await click('[data-act=runOpen]'); t = await body(); ok(t.includes('진행 도우미') || t.includes('시작 '), '진행 도우미 열림');
  await click('[data-act=stepToggle][data-i="0"]'); await click('[data-act=stepToggle][data-i="1"]');
  await p.fill('#noteForm [name=text]', '구리-아연 1회차 0.92V. 손으로 전극을 잡으면 값이 흔들림'); await click('#noteForm [type=submit]');
  await click('#noteForm [data-nk=change]'); await p.fill('#noteForm [name=text]', '알루미늄판 대신 알루미늄 호일을 접어서 사용'); await click('#noteForm [type=submit]');
  await click('#noteForm [data-nk=problem]'); await p.fill('#noteForm [name=text]', '3번째 레몬 즙이 적어 전압이 낮게 나옴 → 새 레몬으로 다시'); await click('#noteForm [type=submit]');
  for (const i of [2, 3, 4]) await click('[data-act=stepToggle][data-i="' + i + '"]');
  t = await body(); ok(t.includes('바꾼 점') && t.includes('문제') && (await p.$$('.rs.on')).length === 5, '단계 5/5 · 메모 3개'); await shot('05-run');
  const pic = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const x = c.getContext('2d'); x.fillStyle = '#ffe14d'; x.fillRect(0, 0, 1200, 900); x.fillStyle = '#b87333'; x.fillRect(420, 200, 60, 500); x.fillStyle = '#9aa4b2'; x.fillRect(720, 200, 60, 500); return c.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles('input[data-upload]', [{ name: 'lemon.png', mimeType: 'image/png', buffer: Buffer.from(pic, 'base64') }, { name: 'graph.png', mimeType: 'image/png', buffer: Buffer.from(pic, 'base64') }]);
  await p.waitForSelector('#uploadForm'); await p.fill('#uploadForm [name=cap0]', '구리-아연 레몬 전지'); await p.fill('#uploadForm [name=cap1]', '엑셀로 그린 전압 그래프'); await click('#uploadForm [data-ukind=graph][data-i="1"]');
  await shot('05b-upload'); await click('#uploadForm [type=submit]'); await p.waitForTimeout(200);
  ok((await p.$$('.ph img[src]')).length === 2, '사진 2장 올림 · 진행 화면에 보임');
  await click('[data-act=runEnd]'); ok(await p.isVisible('#recordForm'), '실험 끝 → 결과 기록 창');
  // 5. 결과 기록 (조건별 반복)
  await p.fill('#recordForm [name=summary]', '구리를 (+)극으로 두고 (-)극 금속을 바꾸며 레몬 전지 전압을 3번씩 쟀다.');
  const data = [['구리-아연', '0.92', '0.95', '0.93'], ['구리-철', '0.48', '0.51', '0.47'], ['구리-알루미늄', '0.61', '0.55', '0.58']];
  const rows = await p.$$('#recordForm .grid-ed tbody tr'); for (let i = 0; i < 3; i++) { const ins = await rows[i].$$('input'); for (let j = 0; j < 4; j++) await ins[j].fill(data[i][j]); }
  await p.fill('#recordForm [name=unit]', 'V');
  await p.fill('#recordForm [name=observe]', '구리-아연이 가장 높고 안정적이었다. 알루미늄은 값이 들쭉날쭉했다.');
  await p.fill('#recordForm [name=discuss]', '아연은 철보다 반응성이 커서 전자를 더 잘 내놓아 전압이 높다. 알루미늄은 반응성이 크지만 표면의 산화막 때문에 예상보다 낮았다. 측정 오차는 손 접촉과 즙 양 차이 때문이다.');
  await p.fill('#recordForm [name=conclusion]', '두 전극 금속의 반응성 차이가 클수록 전압이 높았다. 단, 산화막이 있는 금속은 예외였다.');
  await click('#recordForm [data-claim="가설 지지"]'); await p.fill('#recordForm [name=next]', '레몬 여러 개를 직렬로 연결하면 LED를 켤 수 있을까?');
  await shot('06-record-form'); await click('#recordForm button[value=done]');
  t = await body(); ok(t.includes('보고서를 다듬어요') && t.includes('0.93'), '기록 완료 → 보고서 안내 · 평균 0.93'); await shot('07-item-done');
  // 6. 보고서
  await click('[data-act=report]'); t = await body();
  ok(t.includes('01연구 동기와 목적') && t.includes('11참고 자료') && t.includes('구리-아연') && t.includes('알루미늄 호일'), '보고서 11개 칸 · 결과 · 진행 메모 포함');
  ok(!t.includes('(아직 안 씀)'), '빈 칸 없음');
  ok(t.includes('그림 1') && t.includes('그림 2') && t.includes('엑셀로 그린 전압 그래프'), '보고서 실험 결과에 그림 1 · 2');
  await click('.rp-sec:nth-of-type(8) [data-act=secNotes]'); await p.fill('#sheet .cm-add [name=text]', '산화막을 어떻게 확인했는지 근거를 더 써 주세요'); await click('#sheet .cm-add button[value=fix]');
  ok((await p.textContent('#sheet')).includes('산화막을 어떻게'), '보고서 고찰에 첨삭'); await click('#sheet [data-act=closeSheet]');
  await shot('08-report');
  await click('[data-act=final]'); t = await body(); ok(t.includes('확정') && !!(await p.$('.rp-state.final')), '보고서 확정');
  // 인쇄 화면
  await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: OUT + '09-print.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  // 7. 다음 아이디어 → 실험 → 가지 옮기기
  await click('#backBtn'); await click('[data-act=nextIdea]'); await click('#newForm [type=submit]');
  t = await body(); ok(t.includes('레몬 여러 개를 직렬로'), '다음 아이디어 생성 (가지로 이어짐)');
  await click('[data-act=itemMenu]'); await click('#sheet [data-act=editItem]'); await p.fill('#editForm [name=title]', '레몬 직렬 연결로 LED 켜기'); await click('#editForm [type=submit]');
  t = await body(); ok(t.includes('레몬 직렬 연결로 LED 켜기'), '제목 고치기');
  await click('[data-act=itemMenu]'); await click('#sheet [data-act=moveItem]'); await click('#sheet [data-act=moveTo][data-id=""]');
  t = await body(); ok(t.includes('1세대'), '가지 옮기기 → 뿌리로');
  await click('[data-act=itemMenu]'); await click('#sheet [data-act=moveItem]'); const tg = await p.$$('#sheet [data-act=moveTo]'); await tg[1].click(); await p.waitForTimeout(60);
  t = await body(); ok(t.includes('2세대'), '가지 옮기기 → 다른 실험 뒤로');
  // 8. 댓글 쓰기 · 고치기 · 지우기
  await p.fill('#comments .cm-add [name=text]', 'LED는 1.8V 이상 필요해요'); await click('#comments .cm-add button[value=note]');
  ok((await p.inputValue('#comments .cm-add [name=text]')) === '', '댓글 뒤 입력 칸 비움');
  await click('#comments [data-act=cmEdit]'); await p.fill('#cmEditForm [name=text]', '빨간 LED는 약 1.8V 이상 필요해요'); await click('#cmEditForm [type=submit]');
  t = await body(); ok(t.includes('빨간 LED는') && t.includes('고침'), '댓글 고치기');
  await click('#comments [data-act=cmDel]'); t = await body(); ok(!t.includes('빨간 LED는'), '댓글 지우기');
  // 9. 휴지통 → 되살리기
  await click('[data-act=itemMenu]'); await click('#sheet [data-act=trashItem]'); await p.waitForTimeout(80);
  await click('.tabs [data-tab="more"]'); await click('[data-go-screen="trash"]'); t = await body(); ok(t.includes('레몬 직렬 연결로 LED 켜기'), '휴지통에 있음');
  await click('[data-act=restore]'); t = await p.textContent('#screen'); ok(!t.includes('레몬 직렬 연결로 LED 켜기'), '되살리기');
  await shot('10-trash');
  // 9-1. 새 뿌리 실험을 같은 줄기로 → 줄기 바꾸기
  await click('.tabs [data-tab="home"]'); await click('[data-new="exp"]'); await p.fill('#newForm [name=title]', '건전지 방전 곡선');
  ok((await p.$eval('#newForm [name=line]', (e) => e.options[e.selectedIndex].text)) === '전지 연구', '지난번 줄기가 기본으로 골라짐');
  await click('#newForm [type=submit]'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  await click('[data-act=itemMenu]'); await click('#sheet [data-act=editItem]'); await p.selectOption('#editForm [name=line]', '__new'); await p.fill('#editForm [name=newLine]', '전기 회로'); await click('#editForm [type=submit]');
  t = await body(); ok(t.includes('전기 회로'), '줄기 바꾸기 (새 줄기)');
  // 10. 내용으로 찾기
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '산화막'); await p.waitForTimeout(150);
  t = await body(); ok(t.includes('레몬 전지') && /고찰|결론/.test(t) && (await p.$('mark')), '‘산화막’ → 고찰 내용으로 찾음');
  await p.fill('#q', '알루미늄 호일'); await p.waitForTimeout(150); t = await p.textContent('.day-list'); ok(t.includes('진행 메모'), '‘알루미늄 호일’ → 진행 메모에서 찾음');
  await p.fill('#q', '레몬 온도'); await p.waitForTimeout(150); t = await p.textContent('.day-list'); ok(t.includes('계획서 · 통제 변인') || t.includes('수정 요청'), '‘레몬 온도’ → 계획서 · 첨삭에서 찾음');
  await p.fill('#q', ''); await p.selectOption('#fs', '기록 완료'); await p.waitForTimeout(100); t = await p.textContent('.day-list'); ok(t.includes('레몬 전지') && !t.includes('미해결'), '단계: 기록 완료로 거르기');
  await p.selectOption('#ff', '화학'); await p.waitForTimeout(100); await shot('11-find');
  await click('[data-act=clearFilters]'); ok(!(await p.inputValue('#fs')), '거르기 풀기');
  ok(!errs.length, '화면 오류 없음 ' + errs.join(' / '));
  ok(!wrapBad.length, '버튼 줄바꿈 · 넘침 없음 ' + wrapBad.join(' | '));
  await b.close(); srv.close();
})();
