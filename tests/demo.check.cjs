// 체험(북일고등학교 실험 동아리) 확인
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const P = require('path').join(__dirname, '../public');
const srv = http.createServer((q, r) => { let f = path.join(P, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = P + '/index.html'; r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(f).pipe(r); }).listen(5096);
const W = Number(process.argv[2] || 390);
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: W, height: W > 700 ? 900 : 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**/platform.js', (r) => r.fulfill({ body: 'document.querySelector(".app").hidden=false', contentType: 'text/javascript' }));
  await p.goto('http://localhost:5096/c/demo');
  const body = () => p.textContent('.layout'), click = async (s) => { await p.click(s); await p.waitForTimeout(80); };
  let t = await body(); ok(t.includes('북일고등학교 실험 동아리') && (await p.textContent('#demoPill')).includes('김기장'), '북일고 · 김기장으로 시작');
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
  t = await body(); ok(t.includes('승인 1/2') && t.includes('고칠 곳 1개'), '병렬 연결: 검토 중 · 승인 1/2 · 고칠 곳 1');
  // 홍교사로 바꿔 댓글
  await click('#demoPill'); await click('#sheet [data-act=demoMe][data-name="홍교사"]');
  ok((await p.textContent('#demoPill')).includes('홍교사'), '홍교사로 바꿈');
  await p.fill('#comments .cm-add [name=text]', '연결 그림을 넣으면 승인할게요'); await click('#comments .cm-add button[value=note]');
  t = await body(); ok(t.includes('연결 그림을 넣으면') && /홍교사[\s\S]{0,40}연결 그림을 넣으면/.test(t), '홍교사 이름으로 댓글');
  // 기록 대기 실험(적양배추)에서 결과 기록하기
  await click('.tabs [data-tab="home"]'); t = await body(); ok(t.includes('적양배추') || t.includes('결과 기록'), '홈: 지금 챙길 것');
  // 매일 리셋: 저장된 날짜를 어제로 바꾸고 다시 열면 처음 상태
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gaji-demo-v2')); s.day = '2000-01-01'; localStorage.setItem('gaji-demo-v2', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(300);
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '연결 그림을 넣으면'); await p.waitForTimeout(150);
  ok(!(await p.textContent('.day-list')).includes('병렬'), '날짜가 바뀌면 처음 상태 (댓글 사라짐)');
  await click('.tabs [data-tab="more"]'); await click('[data-go-screen="settings"]'); t = await body();
  ok(t.includes('체험용 가상 동아리') && !(await p.$('a[href="/new"]')), '체험 설정: 안내만 · 동아리 만들기 버튼 없음');
  await click('[data-act=demoWho]'); ok((await p.textContent('#sheet')).includes('누구로 체험할까요'), '설정에서 누구로 체험할지 바꾸기');
  ok(!errs.length, '화면 오류 없음 ' + errs.join(' / '));
  await b.close(); srv.close();
})();
