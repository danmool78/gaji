// 체험 예시 데이터 점검: 단계마다 있어야 할 문서(계획서 · 승인 · 준비 · 진행 · 결과 · 보고서 칸)가 다 있는지
global.window = {}; require(require('path').join(__dirname, '..', 'public', 'data.js')); const D = window.GAJI_SAMPLE;
const S = ['아이디어', '계획 작성', '검토 중', '준비 중', '실험 완료', '기록 완료'];
const planReady = (p) => !!(p && p.purpose && p.steps && p.steps.length);
const resultReady = (r) => !!(r && (r.summary || (r.table && r.table.rows && r.table.rows.length) || r.observe) && r.claim);
const T = (D.members || []).filter((m) => m.role === '교사').map((m) => m.name);
const team = (n) => [n.owner, n.createdBy].concat(n.team || []).filter(Boolean);
let bad = 0;
for (const n of D.nodes.filter((x) => x.type === 'exp')) {
  const i = S.indexOf(n.status), p = n.plan || {}, r = n.report || {}, miss = [];
  if (i >= 2 && !planReady(p)) miss.push('계획서');
  if (i >= 2) { for (const k of ['hypo', 'materials']) if (!p[k] || (Array.isArray(p[k]) && !p[k].length)) miss.push('계획.' + k); if (!(p.ind || p.dep || p.ctrl)) miss.push('계획.변인'); }
  const ap = (D.comments || []).filter((c) => c.node === n.id && c.kind === 'approve');
  const peers = ap.filter((c) => !T.includes(c.by) && !team(n).includes(c.by)).length, tch = ap.some((c) => T.includes(c.by));
  if (i >= 3 && (peers < 2 || !tch)) miss.push('승인(부원 ' + peers + '/2, 선생님 ' + (tch ? 'O' : 'X') + ')');
  if (i >= 3 && !(n.prep && Object.keys(n.prep.done || {}).length)) miss.push('준비 점검');
  if (i >= 4 && !(n.run && n.run.started && n.run.ended)) miss.push('진행 기록');
  if (i >= 5) { if (!resultReady(r)) miss.push('결과'); for (const k of ['discuss', 'conclusion', 'next']) if (!r[k]) miss.push('보고서.' + k); if (!p.refs) miss.push('참고 자료'); }
  if (n.status === '취소') continue;
  if (miss.length) { bad++; console.log(n.id.padEnd(4), n.status.padEnd(6), (n.owner || '').padEnd(4), n.title.slice(0, 26).padEnd(28), '→', miss.join(', ')); }
}
if (bad) process.exitCode = 1;
console.log('체험 예시: 문서 빠진 실험', bad, '/', D.nodes.filter((x) => x.type === 'exp').length, '· 선생님', T);
