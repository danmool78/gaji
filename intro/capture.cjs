// 체험 화면을 가로형 태블릿 크기(1180×820)로 찍어 소개 영상에 씀:  node intro/capture.cjs
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const P = process.env.PUB || path.join(__dirname, '..', 'public'), OUT = path.join(__dirname, 'shots');
const srv = http.createServer((q, r) => { let f = path.join(P, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = P + '/index.html'; r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(5199);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, colorScheme: 'light' })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.route('**/platform.js', (r) => r.fulfill({ body: 'document.querySelector(".app").hidden=false', contentType: 'text/javascript' }));
  await p.goto('http://localhost:5199/c/demo'); await p.waitForTimeout(1200);
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, n + '.png') }); };
  const click = async (s) => { await p.click(s); await p.waitForTimeout(150); };
  await shot('home');
  await click('.tabs [data-tab="tree"]'); await shot('tree');
  const find = async (q) => { await click('.tabs [data-tab="find"]'); await p.fill('#q', q); await p.waitForTimeout(200); await click('.day-list .srow'); };
  await find('병렬'); await shot('review');
  await find('전극 금속'); await shot('item');
  await click('[data-act=report]'); await shot('report');
  await p.evaluate(() => { const e = document.scrollingElement; e.scrollTop = 900; document.querySelectorAll('*').forEach((x) => { if (x.scrollHeight > x.clientHeight + 50 && getComputedStyle(x).overflowY !== 'visible') x.scrollTop = 900; }); }); await shot('report-chart');
  await click('.tabs [data-tab="find"]'); await p.fill('#q', '레몬 전지'); await p.waitForTimeout(250); await shot('search');
  await b.close(); srv.close(); console.log('ok');
})();
