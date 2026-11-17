// 소개 영상 만들기: 한 장면씩 시각을 맞춰 찍어 mp4로 (끊김 없이 30fps)
//   node intro/record.cjs            → intro/out/가지-소개-가로.mp4 (1920×1080)
//   node intro/record.cjs short      → intro/out/가지-소개-쇼츠.mp4 (1080×1920, short.html)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const D = __dirname, SHORT = process.argv[2] === 'short', FPS = 30;
const W = SHORT ? 1080 : 1920, H = SHORT ? 1920 : 1080, PAGE = SHORT ? 'short.html' : 'index.html';
const OUT = path.join(D, 'out'); fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, SHORT ? '가지-소개-쇼츠.mp4' : '가지-소개-가로.mp4');
const srv = http.createServer((q, r) => { const f = path.join(D, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'image/png' }); fs.createReadStream(f).pipe(r); }).listen(5197);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.goto('http://localhost:5197/' + PAGE + '?record' + (process.env.BY ? '&by=' + encodeURIComponent(process.env.BY) : ''));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const len = await p.evaluate(() => window.LENGTH), n = Math.round(len * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => window.seek(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((z) => ff.stdin.once('drain', z));
    if (i % 300 === 0) console.log(Math.round(i / FPS) + 's / ' + len + 's');
  }
  ff.stdin.end(); await new Promise((z) => ff.on('close', z));
  await b.close(); srv.close(); console.log('완료: ' + file);
})();
