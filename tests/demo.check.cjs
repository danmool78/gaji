// 체험(가지고등학교 실험 동아리) 확인
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const P = require('path').join(__dirname, '../public');
const srv = http.createServer((q, r) => { let f = path.join(P, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = P + '/index.html'; r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(f).pipe(r); }).listen(5096);
const W = Number(process.argv[2] || 390);
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: W, height: W > 700 ? 900 : 844 } })).newPage(); await p.addInitScript(() => { try { const v = JSON.parse(localStorage.getItem('gaji-prefs') || '{}'); v.tourDone = 1; localStorage.setItem('gaji-prefs', JSON.stringify(v)); } catch (e) {} });   // 처음 화면 안내는 따로 시험
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**/platform.js', (r) => r.fulfill({ body: 'document.querySelector(".app").hidden=false', contentType: 'text/javascript' }));
  await p.goto('http://localhost:5096/c/demo');
  // 예전 판 데이터가 브라우저에 남아 있어도(오늘 날짜) 새 판이면 바로 새 데이터로
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gaji-demo-v2') || '{}'); localStorage.setItem('gaji-demo-v2', JSON.stringify(Object.assign({}, s, { nodes: [], ver: 'old', day: new Date().toISOString().slice(0, 10) }))); });
  await p.reload(); await p.waitForTimeout(300);
  ok((await p.textContent('.layout')).includes('전지 연구') || (await p.textContent('.layout')).includes('내가 할 일'), '예전 판 저장 데이터 → 새 예시로 바뀜');
  const body = () => p.textContent('.layout'), click = async (s) => { await p.click(s); await p.waitForTimeout(80); };
  let t = await body(); ok(t.includes('가지고등학교 실험 동아리') && (await p.textContent('#demoPill')).includes('김기장'), '가지고 · 김기장으로 시작');
  await p.screenshot({ path: 'shots/demo-home-' + W + '.png' });
  await click('.tabs [data-tab="tree"]'); t = await body(); ok(t.includes('전지 연구'), '가지: 전지 연구 줄기'); await p.screenshot({ path: 'shots/demo-tree-' + W + '.png' });
  // 확정된 레몬 전지 보고서 · 그림
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '전극 금속'); await p.waitForTimeout(100); await click('.day-list .srow');
  t = await body(); ok(t.includes('보고서 확정') && t.includes('구리-아연 레몬 전지와 멀티미터') && t.includes('사포로 닦기'), '레몬 전지: 확정 · 사진 · 첨삭 반영'); await p.screenshot({ path: 'shots/demo-item-' + W + '.png', fullPage: true });
  await click('[data-act=report]'); t = await body(); ok(t.includes('그림 1') && !t.includes('(아직 안 씀)'), '보고서: 빈 칸 없음 · 그림 1');
  // 날짜가 오늘 기준으로 옮겨짐
  const today = new Date(); const y = today.getFullYear();
  ok(t.includes(String(y)), '날짜가 올해로 옮겨짐');
  // 검토 중인 병렬 연결: 홍교사 승인 1/2, 김기장 수정 요청
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '병렬'); await p.waitForTimeout(100); await click('.day-list .srow');
  t = await body(); ok(t.includes('부원 1/2') && t.includes('고칠 곳 1개'), '병렬 연결: 검토 중 · 승인 1/2 · 고칠 곳 1');
  // 홍교사로 바꿔 댓글
  await click('#demoPill'); await click('#sheet [data-act=demoMe][data-name^="홍교사"]');
  ok((await p.textContent('#demoPill')).includes('홍교사'), '홍교사로 바꿈');
  await p.fill('#comments .cm-add [name=text]', '연결 그림을 넣으면 승인할게요'); await click('#comments .cm-add button[value=note]');
  t = await body(); ok(t.includes('연결 그림을 넣으면') && /홍교사[\s\S]{0,40}연결 그림을 넣으면/.test(t), '홍교사 이름으로 댓글');
  // 승인 규칙(기본): 부원 2명 → 선생님 최종 승인. 부원 1명뿐이면 선생님도 못 함
  ok(!!(await p.$('[data-act=approve]')) && (await p.textContent('[data-act=approve]')).includes('최종 승인'), '홍교사: 최종 승인 버튼');
  await click('[data-act=approve]'); await p.waitForTimeout(150); ok((await p.textContent('#toast')).includes('먼저 승인해야'), '부원 2명 전에는 선생님 최종 승인 안 됨');
  ok(!(await p.$('[data-act=advance]')), '승인 전에는 준비 시작 버튼 없음');
  // 기록 대기 실험(적양배추)에서 결과 기록하기
  await click('.tabs [data-tab="home"]'); t = await body(); ok(t.includes('내가 할 일') && !!(await p.$('.todo-item')), '홈: 지금 챙길 것');
  // 매일 리셋: 저장된 날짜를 어제로 바꾸고 다시 열면 처음 상태
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gaji-demo-v2')); s.day = '2000-01-01'; localStorage.setItem('gaji-demo-v2', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(300);
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '연결 그림을 넣으면'); await p.waitForTimeout(150);
  ok(!(await p.textContent('.day-list')).includes('병렬'), '날짜가 바뀌면 처음 상태 (댓글 사라짐)');
  await click('.tabs [data-tab="more"]'); await click('[data-go-screen="settings"]'); t = await body();
  ok(t.includes('체험용 가상 동아리') && !(await p.$('a[href="/new"]')), '체험 설정: 안내만 · 동아리 만들기 버튼 없음');
  ok(t.includes('실험 승인 규칙') && t.includes('팀 밖의 부원 2명 승인 → 지도 선생님 최종 승인'), '설정: 승인 규칙 카드');
  await click('[data-rule-peers="1"]'); ok((await body()).includes('부원 1명 승인'), '규칙 바꾸기: 부원 1명');
  await click('[data-rule-peers="2"]');
  await click('[data-act=demoWho]'); ok((await p.textContent('#sheet')).includes('누구로 체험할까요'), '설정에서 누구로 체험할지 바꾸기');
  // 권한: 부원(박준서)로 바꾸면 남의 실험은 읽기만, 비공개는 안 보임, 검토 요청이 내 할 일에
  await click('#sheet [data-act=closeSheet]').catch(() => {});
  await click('#demoPill'); await click('#sheet [data-act=demoMe][data-name^="박준서"]');
  await click('.tabs [data-tab="home"]'); t = await body(); ok(t.includes('내가 할 일') && t.includes('검토 요청'), '부원: 내가 할 일에 검토 요청');
  ok(!t.includes('동아리 챙길 것'), '부원: 동아리 챙길 것은 안 보임');
  await click('.tabs [data-tab="find"]'); await p.fill('#q', 'T² 그래프'); await p.waitForTimeout(100); await click('.day-list .srow');
  t = await body(); ok(t.includes('의 실험이에요') && !(await p.$('[data-act=record]')) && !(await p.$('.sec-card [data-act=plan]')), '부원: 남의 실험은 읽기만 (고치기 · 결과 기록 없음)');
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '과학전람회'); await p.waitForTimeout(100);
  ok(!(await p.textContent('.day-list')).includes('내부 저항 정밀'), '부원: 비공개 실험 안 보임');
  await click('.tabs [data-tab="find"]'); await click('[data-ty=mine]'); await p.fill('#q', ''); await p.waitForTimeout(100);
  t = await p.textContent('.day-list'); ok(t.includes('건전지 방전') && !t.includes('진자로 중력'), '‘내 것’: 내 실험만');
  await click('#demoPill'); await click('#sheet [data-act=demoMe][data-name^="이하늘"]');
  await click('.tabs [data-tab="find"]'); await click('[data-ty=all]'); await p.fill('#q', '과학전람회'); await p.waitForTimeout(100);
  ok((await p.textContent('.day-list')).includes('내부 저항 정밀'), '이하늘(담당): 비공개 실험 보임');
  ok(!errs.length, '화면 오류 없음 ' + errs.join(' / '));
  await b.close(); srv.close();
})();
