// 모든 화면에서 버튼 글자 줄바꿈 · 넘침 · 가로 스크롤 점검 (휴대폰 375 · 390, 태블릿 820). 실행: node tests/buttons.check.cjs (playwright 필요)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const P = require('path').join(__dirname, '../public');
const s = http.createServer((q, r) => { let f = path.join(P, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = P + '/index.html'; r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(f).pipe(r); }).listen(5085);
const check = (label) => `(() => { const bad = [];
  document.querySelectorAll('.btn, .chipbtn, .chip, .seg button, .toast-act, .badge').forEach((b) => { if (!b.offsetParent) return; const r = b.getBoundingClientRect(); const inBoard = b.closest('.board');
    const lh = parseFloat(getComputedStyle(b).lineHeight) || 20; let lines = 0; const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let tn; while ((tn = tw.nextNode())) { if (!tn.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(tn); lines = Math.max(lines, new Set(Array.from(rg.getClientRects()).filter((x) => x.width > 1).map((x) => Math.round(x.top))).size); }
    if (b.scrollWidth > b.clientWidth + 2) bad.push('넘침: ' + b.textContent.trim());
    if (r.right > innerWidth + 1 && !inBoard) bad.push('화면 밖: ' + b.textContent.trim());
    if (lines > 1) bad.push('줄바꿈: ' + b.textContent.trim()); });
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('가로 스크롤 생김');
  return bad; })()`;
(async () => { const b = await chromium.launch(); let total = 0;
  for (const [w, h] of [[375, 740], [390, 844], [820, 1180]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.route('**/platform.js', (r) => r.fulfill({ body: 'document.querySelector(".app").hidden=false', contentType: 'text/javascript' }));
    await p.goto('http://localhost:5085/c/demo');
    const report = async (name) => { const bad = await p.evaluate(check()); if (bad.length) { total += bad.length; console.log(w + 'px ' + name + ':', [...new Set(bad)].join(' / ')); } };
    await report('홈');
    const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('gaji-demo-v1') || 'null') ? null : null);
    for (const tabName of ['tree', 'find', 'more']) { await p.click('.tabs [data-tab="' + tabName + '"]'); await report(tabName); }
    for (const sc of ['settings', 'board', 'club', 'about']) { await p.click('.tabs [data-tab="more"]'); const el = await p.$('[data-go-screen="' + sc + '"]'); if (el) { await el.click(); await report(sc); } }
    // 모든 실험 상세 (단계마다 버튼이 다름)
    await p.click('.tabs [data-tab="find"]');
    const n = await p.$$eval('[data-item]', (els) => els.map((e) => e.dataset.item));
    for (const id of n) { await p.click('.tabs [data-tab="find"]'); await p.click('[data-item="' + id + '"]'); await p.waitForTimeout(50); await report('상세 ' + id); }
    // 단계 버튼 가장 긴 경우: 실험 완료 → 기록 완료, 이전 단계로
    for (const id of n) { await p.click('.tabs [data-tab="find"]'); await p.click('[data-item="' + id + '"]'); const adv = await p.$('[data-act=advance]'); if (adv) { await adv.click(); await report('단계 이동 뒤 ' + id); } const rec = await p.$('[data-act=record]'); if (rec) { await rec.click(); await report('기록 양식'); await p.click('#recordForm button[value=done]').catch(() => {}); await p.keyboard.press('Escape'); } }
    await p.click('.tabs [data-tab="home"]'); await p.click('[data-new="exp"]'); await report('새 실험 양식'); await p.keyboard.press('Escape');
  }
  console.log('문제 수:', total); await b.close(); s.close(); })();
