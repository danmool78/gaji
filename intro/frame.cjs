// 확인용: 몇 초 화면을 찍음  node intro/frame.cjs 3 20 50 ...
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const D = __dirname; const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'image/png' }); fs.createReadStream(f).pipe(r); }).listen(5198);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: /short/.test(process.env.PAGE || '') ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } })).newPage();
  await p.goto('http://localhost:5198/' + (process.env.PAGE || 'index.html') + '?record'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  for (const t of process.argv.slice(2)) { await p.evaluate((t) => window.seek(t), +t); await p.waitForTimeout(80); await p.screenshot({ path: path.join(process.env.OUT || '/tmp', 'f' + t + '.png') }); }
  await b.close(); srv.close();
})();
