// 가지 · 체험 모드 예시 데이터
// 실제 사용 때는 이 데이터 대신 동아리 구글 드라이브의 '가지 데이터' 시트를 읽습니다.
// 날짜는 2026-11-16 기준으로 적었고, 앱이 오늘 날짜에 맞춰 옮겨서 보여 줍니다.
window.GAJI_SAMPLE = {
  base: '2026-11-16',
  settings: { clubName: '○○고 실험 동아리', color: '#C26A00', logo: '' },
  lines: {
    enzyme: '효소 연구', plant: '식물 · 빛', antho: '안토시아닌 · pH', precip: '앙금 · 농도',
    titration: '적정 · 농도 개념', ice: '얼음 · 용액', pendulum: '진자 · 중력', friction: '마찰 · 경사'
  },
  nodes: [
    { id: 'e0', no: 3, created: '2026-03-12', type: 'exp', title: '카탈레이스와 과산화수소', field: '생명', status: '기록 완료', line: 'enzyme', date: '2026-06-10', owner: '윤OO', verdict: '가설 지지', desc: '1학기 실험. 감자 조각의 카탈레이스로 기체 발생을 확인함.' },
    { id: 'e1', no: 20, created: '2026-10-02', type: 'exp', title: '온도에 따른 효소 반응 속도', field: '생명', status: '준비 중', line: 'enzyme', date: '2026-11-24', owner: '김OO', signal: 3, review: 2, desc: '20 · 30 · 40 · 50℃에서 1분간 발생한 기체 부피를 3회씩 측정.' },
    { id: 'i1', no: 25, created: '2026-11-03', type: 'idea', title: 'pH도 효소 반응에 영향을 줄까?', field: '생명', status: '아이디어', line: 'enzyme', date: '2026-12-10', fans: 2, volunteer: '', equip: true, desc: '온도 실험에서 나온 다음 질문.' },
    { id: 'q1', no: 4, created: '2026-11-05', type: 'q', title: '효소 실험 대조군은 뭘로 해요?', field: '생명', status: '해결', date: '2026-11-05', desc: '끓여서 효소를 비활성화한 감자 조각으로 결론.' },
    { id: 'r1', no: 6, created: '2026-10-01', type: 'res', title: '엑셀로 오차 막대 그리기', field: '공통', status: '도움 9', date: '2026-10-01', desc: '결과 그래프 만들 때 쓰는 5분 영상과 순서 정리.' },
    { id: 'e6', no: 18, created: '2026-09-25', type: 'exp', title: '식물 생장과 빛의 색', field: '생명', status: '준비 중', line: 'plant', date: '2026-11-20', owner: '한OO', signal: 5, review: 2, desc: '빨강 · 파랑 · 초록 LED 아래 새싹 길이 비교.' },
    { id: 'e7', no: 21, created: '2026-10-05', type: 'exp', title: 'pH에 따른 안토시아닌 색 변화', field: '화학', status: '검토 중', line: 'antho', date: '2026-11-25', owner: '최OO', review: 0, desc: '적양배추 즙에 pH 2~12 용액을 떨어뜨려 색 비교.' },
    { id: 'e2', no: 8, created: '2026-09-01', type: 'exp', title: '반응 온도와 앙금 생성', field: '화학', status: '기록 완료', line: 'precip', date: '2026-09-20', owner: '정OO', verdict: '가설 기각', desc: '온도보다 농도의 영향이 더 컸음.' },
    { id: 'e8', no: 13, created: '2026-09-28', type: 'exp', title: '용액 농도별 앙금의 양', field: '화학', status: '기록 완료', line: 'precip', date: '2026-10-25', owner: '정OO', verdict: '가설 지지', desc: '기각된 온도 실험에서 이어짐. 농도를 2배로 하면 앙금 질량도 약 2배.' },
    { id: 'i2', no: 23, created: '2026-10-30', type: 'idea', title: '앙금 입자 크기와 침전 속도', field: '화학', status: '아이디어', line: 'precip', date: '2026-11-30', fans: 5, volunteer: '정OO', equip: true, desc: '농도 실험에서 다시 이어진 아이디어.' },
    { id: 'e3', no: 19, created: '2026-09-30', type: 'exp', title: '산화 환원 적정', field: '화학', status: '준비 중', line: 'titration', date: '2026-11-22', owner: '정OO', signal: 3, review: 2, desc: '과망가니즈산 칼륨 적정. 선생님 입회 필수.' },
    { id: 'q2', no: 7, created: '2026-11-12', type: 'q', title: '몰 농도와 몰랄 농도 차이?', field: '화학', status: '미해결', date: '2026-11-12', desc: '적정 계산 중에 나온 질문.' },
    { id: 'r2', no: 5, created: '2026-09-28', type: 'res', title: '화학Ⅰ 몰 농도 한 장 정리', field: '화학', status: '도움 12', date: '2026-09-28', desc: '계산 순서를 그림으로 정리한 요약 노트.' },
    { id: 'i3', no: 27, created: '2026-11-13', type: 'idea', title: '몰 농도 개념 확인 실험', field: '화학', status: '아이디어', line: 'titration', date: '2026-12-20', fans: 1, volunteer: '', equip: false, desc: '질문 게시판에서 넘어온 아이디어.' },
    { id: 'i5', no: 26, created: '2026-11-10', type: 'idea', title: '소금물 농도와 얼음이 녹는 속도', field: '화학', status: '아이디어', line: 'ice', date: '2026-12-15', fans: 1, volunteer: '', equip: true, desc: '직접 올린 아이디어.' },
    { id: 'e4', no: 11, created: '2026-09-11', type: 'exp', title: '진자 길이와 주기', field: '물리', status: '기록 완료', line: 'pendulum', date: '2026-10-14', owner: '이OO', verdict: '부분 지지', desc: '주기는 길이의 제곱근에 비례. 진폭이 크면 오차가 커짐.' },
    { id: 'i4', no: 24, created: '2026-10-20', type: 'idea', title: '스마트폰 센서로 중력 가속도 재기', field: '물리', status: '아이디어', line: 'pendulum', date: '2026-12-05', fans: 3, volunteer: '', equip: true, desc: '진자 실험을 휴대폰 가속도 센서로 다시 해 보기.' },
    { id: 'e5', no: 22, created: '2026-10-08', type: 'exp', title: '마찰 계수와 경사각', field: '물리', status: '계획 작성', line: 'friction', date: '2026-12-03', owner: '박OO', desc: '나무 블록이 미끄러지기 시작하는 각도 측정.' }
  ],
  links: [
    { s: 'e0', t: 'e1', k: 'follow' }, { s: 'e1', t: 'i1', k: 'next' }, { s: 'q1', t: 'e1', k: 'q' }, { s: 'r1', t: 'e1', k: 'res' },
    { s: 'r1', t: 'e3', k: 'res' }, { s: 'r1', t: 'e4', k: 'res' }, { s: 'e2', t: 'e8', k: 'next' }, { s: 'e8', t: 'i2', k: 'next' },
    { s: 'q2', t: 'e3', k: 'q' }, { s: 'q2', t: 'i3', k: 'next' }, { s: 'r2', t: 'q2', k: 'res' }, { s: 'r2', t: 'e3', k: 'res' },
    { s: 'e4', t: 'i4', k: 'next' }, { s: 'e7', t: 'i1', k: 'rel' }, { s: 'r1', t: 'e6', k: 'res' }
  ]
};

/* ===== 체험용 가상 동아리: 북일고등학교 실험 동아리 (기장 김기장 · 지도교사 홍교사) =====
 * 사람 · 학교 · 실험은 모두 가상입니다. 체험 화면에서 바꾼 내용은 그 브라우저에만 저장되고 매일 처음 상태로 돌아갑니다. */
(function (S) {
  S.settings = { clubName: '북일고등학교 실험 동아리', color: '#1F8F5A', logo: '' };
  S.members = [
    { name: '김기장', role: '마스터', note: '기장' }, { name: '홍교사', role: '관리자', note: '지도교사' }, { name: '이하늘', role: '부원' }, { name: '박준서', role: '부원' },
    { name: '최윤아', role: '부원' }, { name: '정다온', role: '부원' }, { name: '오세린', role: '부원' }, { name: '한결', role: '부원' }, { name: '윤서연', role: '부원' }
  ];
  const rename = { '윤OO': '윤서연', '김OO': '김기장', '박OO': '박준서', '이OO': '이하늘', '정OO': '정다온', '최OO': '최윤아', '한OO': '한결' };
  S.nodes.forEach((n) => { if (rename[n.owner]) n.owner = rename[n.owner]; if (rename[n.volunteer]) n.volunteer = rename[n.volunteer]; n.createdBy = n.createdBy || n.owner || '김기장'; });
  S.lines.battery = '전지 연구';
  const T = (d, hm) => d + 'T' + (hm || '06:00') + ':00.000Z';
  // 체험용 사진 (그림)
  const svg = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const LEMON = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><rect width="480" height="360" fill="#eef3f8"/><rect y="250" width="480" height="110" fill="#d9c7a7"/><ellipse cx="200" cy="230" rx="120" ry="80" fill="#f6d32d" stroke="#d4a90f" stroke-width="5"/><rect x="150" y="120" width="16" height="110" fill="#c87533"/><rect x="236" y="120" width="16" height="110" fill="#9aa4b2"/><path d="M158 120 C158 70 330 70 360 120" stroke="#d2394b" stroke-width="5" fill="none"/><path d="M244 120 C244 90 330 95 372 130" stroke="#222" stroke-width="5" fill="none"/><rect x="340" y="120" width="110" height="150" rx="12" fill="#ffcc33" stroke="#222" stroke-width="4"/><rect x="355" y="138" width="80" height="44" rx="4" fill="#cfe8cf"/><text x="395" y="170" font-family="sans-serif" font-size="26" text-anchor="middle" fill="#123">0.93</text><text x="395" y="220" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#222">V</text><text x="158" y="110" font-family="sans-serif" font-size="16" text-anchor="middle">Cu</text><text x="244" y="110" font-family="sans-serif" font-size="16" text-anchor="middle">Zn</text></svg>');
  const SERIES = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><rect width="480" height="360" fill="#f2f0ea"/>' + [0, 1, 2, 3, 4].map((i) => '<ellipse cx="' + (60 + i * 90) + '" cy="220" rx="38" ry="28" fill="#f6d32d" stroke="#d4a90f" stroke-width="3"/><rect x="' + (46 + i * 90) + '" y="170" width="7" height="40" fill="#c87533"/><rect x="' + (66 + i * 90) + '" y="170" width="7" height="40" fill="#9aa4b2"/>' + (i < 4 ? '<path d="M' + (70 + i * 90) + ' 170 C' + (90 + i * 90) + ' 140 ' + (120 + i * 90) + ' 140 ' + (139 + i * 90) + ' 170" stroke="#222" stroke-width="3" fill="none"/>' : '')).join('') + '<circle cx="250" cy="70" r="22" fill="#ff5a5a" opacity=".55"/><circle cx="250" cy="70" r="12" fill="#ff2a2a"/><text x="250" y="120" font-family="sans-serif" font-size="18" text-anchor="middle">LED (희미하게 켜짐)</text></svg>');
  const plan1 = {
    purpose: '과일 전지에서 어떤 금속을 쓰면 전압이 가장 높은지 알고 싶다. 산화 · 환원으로 전류가 생기는 원리를 직접 확인한다.',
    hypo: '두 전극 금속의 반응성 차이가 클수록 전압이 높을 것이다.', ind: '(-)극 금속: 아연, 철, 알루미늄 ((+)극은 구리로 고정)', dep: '전압(V) · 디지털 멀티미터',
    ctrl: '레몬 크기 약 120g, 전극 간격 2cm, 꽂는 깊이 3cm, 연결 10초 뒤 읽기, 실온 22℃, 금속판은 사포로 닦기',
    materials: ['레몬 3개', '구리판 3장', '아연판 1장', '철 못 1개', '알루미늄판 1장', '디지털 멀티미터', '악어 집게 전선 2개', '사포'],
    steps: ['레몬을 책상에 굴려 즙이 잘 나오게 한다', '금속판을 사포로 닦는다', '구리판과 아연판을 2cm 간격, 3cm 깊이로 꽂는다', '멀티미터를 연결하고 10초 뒤 전압을 읽는다', '같은 방법으로 3번 잰다', '(-)극을 철 · 알루미늄으로 바꿔 반복한다'],
    safety: '금속판 모서리에 베지 않게 장갑, 레몬즙이 눈에 튀지 않게 보안경', roles: '측정 - 정다온 · 기록 - 박준서', expect: '구리-아연이 가장 높고 구리-철이 가장 낮을 것', refs: '화학Ⅰ 교과서 4단원 산화 환원', by: '정다온', at: T('2026-10-28', '07:10')
  };
  const allDone = (items, d) => items.reduce((o, x, i) => (o[x] = T(d, '0' + (1 + (i % 8)) + ':1' + (i % 6)), o), {});
  const base5 = ['실험 장소 · 시간 정하기', '안전 장비 (보안경 · 장갑)', '결과 기록 표 미리 만들기', '역할 나누기', '선생님께 알리기'];
  S.nodes.push(
    { id: 'b1', no: 28, created: '2026-10-27', type: 'exp', title: '레몬 전지: 전극 금속에 따라 전압이 달라질까?', field: '화학', status: '기록 완료', line: 'battery', date: '2026-11-10', owner: '정다온', createdBy: '정다온', verdict: '가설 지지',
      plan: plan1, prep: { done: allDone(plan1.materials.map((m) => '준비물: ' + m).concat(base5), '2026-11-07'), extra: [] }, signal: 5,
      run: { started: T('2026-11-10', '06:20'), ended: T('2026-11-10', '07:05'), done: { 0: T('2026-11-10', '06:22'), 1: T('2026-11-10', '06:25'), 2: T('2026-11-10', '06:30'), 3: T('2026-11-10', '06:33'), 4: T('2026-11-10', '06:48'), 5: T('2026-11-10', '07:02') },
        notes: [{ id: 'nb1', at: T('2026-11-10', '06:34'), by: '정다온', kind: 'obs', text: '구리-아연 1회차 0.92V. 손으로 전극을 잡으면 값이 흔들려서 집게로만 잡음' }, { id: 'nb2', at: T('2026-11-10', '06:41'), by: '박준서', kind: 'change', text: '알루미늄판이 없어 알루미늄 호일을 4겹 접어 사용' }, { id: 'nb3', at: T('2026-11-10', '06:55'), by: '정다온', kind: 'problem', text: '세 번째 레몬은 즙이 적어 0.3V대가 나와 새 레몬으로 다시 쟀다' }] },
      report: { kind: 'rep', unit: 'V', summary: '(+)극은 구리로 두고 (-)극 금속을 바꾸며 레몬 전지 전압을 3번씩 쟀다.', table: { cols: ['(-)극 금속', '1회', '2회', '3회'], rows: [['아연', '0.92', '0.95', '0.93'], ['철', '0.48', '0.51', '0.47'], ['알루미늄', '0.61', '0.55', '0.58']] },
        observe: '아연이 가장 높고 안정적이었다. 알루미늄은 값이 들쭉날쭉했다.', discuss: '아연은 철보다 반응성이 커서 전자를 더 잘 내놓아 전압이 높다. 알루미늄은 반응성이 크지만 표면의 산화막(Al₂O₃) 때문에 예상보다 낮았다. 사포로 닦기 전에는 0.4V대였던 것이 닦은 뒤 0.58V로 올라 산화막의 영향을 확인했다.',
        conclusion: '전극 금속의 반응성 차이가 클수록 레몬 전지의 전압이 높았다. 단, 산화막이 있는 알루미늄은 예외였다.', claim: '가설 지지', next: '레몬 여러 개를 직렬로 연결하면 LED를 켤 수 있을까?', by: '정다온', at: '2026-11-11', final: { by: '홍교사', at: T('2026-11-13', '08:30') } } },
    { id: 'b2', no: 29, created: '2026-11-10', type: 'exp', title: '레몬 전지 직렬 연결: 몇 개면 LED가 켜질까?', field: '화학', status: '기록 완료', line: 'battery', date: '2026-11-12', owner: '정다온', createdBy: '정다온', verdict: '',
      plan: { purpose: '레몬 전지 하나로는 LED가 켜지지 않았다. 몇 개를 직렬로 이으면 빨간 LED(약 1.8V)가 켜지는지 알아본다.', hypo: '직렬로 연결한 레몬 수에 비례해 전압이 커지고, 2개부터 LED가 켜질 것이다.', ind: '직렬로 연결한 레몬 수 1~5개', dep: '전체 전압(V), LED 밝기(관찰)', ctrl: '전극: 구리-아연, 간격 2cm, 깊이 3cm',
        materials: ['레몬 5개', '구리판 5장', '아연판 5장', '악어 집게 전선 6개', '빨간 LED 1개', '디지털 멀티미터'], steps: ['레몬마다 구리판과 아연판을 꽂는다', '앞 레몬의 아연과 다음 레몬의 구리를 전선으로 잇는다', '레몬 수를 1개씩 늘리며 전체 전압을 잰다', '각 단계에서 LED를 연결해 켜지는지 본다'], expect: '1개 0.9V, 2개 1.8V, 3개 2.7V 정도', by: '정다온', at: T('2026-11-10', '09:00') },
      prep: { done: allDone(['준비물: 레몬 5개', '준비물: 구리판 5장', '준비물: 아연판 5장', '준비물: 악어 집게 전선 6개', '준비물: 빨간 LED 1개', '준비물: 디지털 멀티미터'].concat(base5), '2026-11-11'), extra: [] }, signal: 5,
      run: { started: T('2026-11-12', '06:30'), ended: T('2026-11-12', '07:10'), done: { 0: T('2026-11-12', '06:31'), 1: T('2026-11-12', '06:40'), 2: T('2026-11-12', '06:52'), 3: T('2026-11-12', '07:05') },
        notes: [{ id: 'nb4', at: T('2026-11-12', '06:58'), by: '정다온', kind: 'obs', text: '2개에서는 LED가 거의 안 보이고 3개부터 희미하게 켜짐' }, { id: 'nb5', at: T('2026-11-12', '07:04'), by: '오세린', kind: 'obs', text: '전압은 늘지만 LED는 기대보다 어두움 → 전류가 작은 듯' }] },
      report: { kind: 'xy', summary: '구리-아연 레몬 전지를 1~5개 직렬로 연결하며 전체 전압을 쟀다.', table: { cols: ['레몬 수(개)', '전압(V)'], rows: [['1', '0.93'], ['2', '1.82'], ['3', '2.71'], ['4', '3.55'], ['5', '4.42']] },
        observe: '전압은 개수에 거의 비례해 늘었다. LED는 3개부터 희미하게, 5개에서도 밝지 않았다.', discuss: '직렬 연결로 전압은 더해졌지만 레몬 전지의 내부 저항이 커서 흐르는 전류가 작아 LED가 어둡다.', conclusion: '레몬 전지를 직렬로 이으면 전압이 개수에 비례해 커진다(1개당 약 0.88V). LED를 켜려면 3개 이상 필요했다.', claim: '가설 지지', next: '병렬로 연결하면 LED가 더 밝아질까?', by: '정다온', at: '2026-11-12' } },
    { id: 'b3', no: 30, created: '2026-11-03', type: 'exp', title: '건전지 방전 곡선: 연결한 저항에 따라 전압이 얼마나 빨리 떨어질까?', field: '물리', status: '기록 완료', line: 'battery', date: '2026-11-14', owner: '박준서', createdBy: '박준서', verdict: '가설 지지',
      plan: { purpose: '같은 건전지라도 쓰는 기기(저항)에 따라 얼마나 빨리 닳는지 알아본다.', hypo: '저항이 작을수록(전류가 클수록) 전압이 빨리 떨어질 것이다.', ind: '연결한 저항: 10Ω, 47Ω', dep: '건전지 단자 전압(V) · 5분마다', ctrl: '새 AA 알카라인 건전지 같은 제품, 실온, 측정 시간 30분',
        materials: ['새 AA 건전지 2개', '건전지 홀더 2개', '저항 10Ω · 47Ω (2W)', '디지털 멀티미터', '타이머'], steps: ['새 건전지의 처음 전압을 잰다', '홀더에 건전지와 저항을 연결한다', '5분마다 전압을 잰다', '30분 동안 반복한다', '다른 저항으로 같은 실험을 한다'], safety: '10Ω 저항은 뜨거워질 수 있으니 만지지 않기', expect: '10Ω이 47Ω보다 전압이 빨리 떨어질 것', by: '박준서', at: T('2026-11-04', '07:00') },
      prep: { done: allDone(['준비물: 새 AA 건전지 2개', '준비물: 건전지 홀더 2개', '준비물: 저항 10Ω · 47Ω (2W)', '준비물: 디지털 멀티미터', '준비물: 타이머'].concat(base5), '2026-11-13'), extra: [] }, signal: 5,
      run: { started: T('2026-11-14', '06:00'), ended: T('2026-11-14', '06:40'), done: { 0: T('2026-11-14', '06:01'), 1: T('2026-11-14', '06:03'), 2: T('2026-11-14', '06:08'), 3: T('2026-11-14', '06:33'), 4: T('2026-11-14', '06:40') },
        notes: [{ id: 'nb6', at: T('2026-11-14', '06:12'), by: '박준서', kind: 'obs', text: '10Ω 저항이 손으로 만지기 어려울 만큼 뜨거워짐' }, { id: 'nb7', at: T('2026-11-14', '06:26'), by: '박준서', kind: 'change', text: '저항이 뜨거워서 25분째에 잠깐 식힌 뒤 계속 (기록에 표시)' }] },
      report: { kind: 'line', summary: '새 AA 건전지에 10Ω, 47Ω 저항을 각각 연결하고 30분 동안 5분마다 단자 전압을 쟀다.', table: { cols: ['시간(분)', '10Ω(V)', '47Ω(V)'], rows: [['0', '1.58', '1.58'], ['5', '1.41', '1.52'], ['10', '1.36', '1.50'], ['15', '1.32', '1.49'], ['20', '1.29', '1.48'], ['25', '1.26', '1.47'], ['30', '1.23', '1.46']] },
        observe: '10Ω은 처음 5분에 크게 떨어지고 그 뒤 천천히 떨어졌다. 47Ω은 거의 일정했다.', discuss: '저항이 작으면 큰 전류가 흘러 건전지 내부 저항에서 전압 강하가 커지고 화학 물질이 빨리 소모된다.', conclusion: '연결한 저항이 작을수록 건전지 전압이 빨리 떨어졌다.', claim: '가설 지지', next: '건전지 온도를 낮추면 방전 곡선이 어떻게 달라질까?', by: '박준서', at: '2026-11-14' } },
    { id: 'b4', no: 31, created: '2026-11-11', type: 'exp', title: '다니엘 전지: 황산구리 농도에 따라 전압이 달라질까?', field: '화학', status: '준비 중', line: 'battery', date: '2026-11-24', owner: '최윤아', createdBy: '최윤아',
      plan: { purpose: '교과서의 다니엘 전지를 직접 만들고, 농도가 전압에 주는 영향을 확인한다.', hypo: '황산구리 수용액의 농도가 높을수록 전압이 조금씩 커질 것이다.', ind: '황산구리 농도: 0.01 · 0.1 · 0.5 · 1.0 M', dep: '전압(V)', ctrl: '황산아연 1.0M 고정, 같은 염다리, 전극 넓이, 온도',
        materials: ['황산구리 · 황산아연', '비커 50mL 2개', '구리판 · 아연판', '염다리 (KNO₃ 적신 거름종이)', '디지털 멀티미터'], steps: ['농도별 황산구리 수용액을 만든다', '두 비커에 용액과 전극을 넣는다', '염다리로 잇는다', '전압을 3번 잰다', '농도를 바꿔 반복한다'], safety: '황산구리는 피부 · 눈에 닿지 않게 장갑 · 보안경, 폐액은 지정 통에', roles: '용액 만들기 - 최윤아 · 측정 - 한결', expect: '1.0M에서 약 1.10V, 0.01M에서 약 1.04V', by: '최윤아', at: T('2026-11-12', '07:30') },
      prep: { done: { '준비물: 황산구리 · 황산아연': T('2026-11-17', '05:10'), '준비물: 비커 50mL 2개': T('2026-11-17', '05:11'), '준비물: 구리판 · 아연판': T('2026-11-17', '05:12'), '안전 장비 (보안경 · 장갑)': T('2026-11-17', '05:13'), '역할 나누기': T('2026-11-17', '05:14') }, extra: [] }, signal: 3 },
    { id: 'b5', no: 32, created: '2026-11-13', type: 'exp', title: '레몬 전지 병렬 연결: LED가 더 밝아질까?', field: '물리', status: '검토 중', line: 'battery', date: '2026-11-27', owner: '이하늘', createdBy: '이하늘',
      plan: { purpose: '직렬 연결은 전압이 커져도 LED가 어두웠다. 병렬로 묶으면 전류가 커져 LED가 더 밝아지는지 확인한다.', hypo: '직렬 3개 묶음을 병렬로 2줄 연결하면 LED에 흐르는 전류가 약 2배가 될 것이다.', ind: '연결 방식: 직렬 3개 / 직렬 3개 × 병렬 2줄', dep: 'LED에 흐르는 전류(mA), LED 밝기', ctrl: '구리-아연 전극, 레몬 크기, 같은 LED',
        materials: ['레몬 6개', '구리판 · 아연판 6쌍', '악어 집게 전선 10개', '빨간 LED', '디지털 멀티미터'], steps: ['직렬 3개 묶음을 만든다', 'LED를 연결하고 전류를 잰다', '같은 묶음을 하나 더 만들어 병렬로 연결한다', '전류와 밝기를 비교한다'], expect: '전류가 0.4mA → 0.8mA 정도로 늘 것', by: '이하늘', at: T('2026-11-14', '08:00') } },
    { id: 'b6', no: 33, created: '2026-11-15', type: 'idea', title: '추운 날 배터리가 빨리 닳는 이유: 온도와 건전지 용량', field: '물리', status: '아이디어', line: 'battery', date: '2026-12-08', fans: 2, volunteer: '', equip: false, createdBy: '한결', desc: '냉장고(4℃), 실온, 따뜻한 물(40℃)에서 같은 저항으로 방전 곡선을 비교해 보면 어떨까?' },
    { id: 'bq', no: 8, created: '2026-11-12', type: 'q', title: '레몬 전지 전압은 1.8V가 넘는데 왜 LED가 어둡게 켜질까?', field: '물리', status: '해결', date: '2026-11-12', createdBy: '정다온' },
    { id: 'b8', no: 34, created: '2026-11-05', type: 'exp', title: '천연 지시약: 적양배추 즙의 pH별 색 변화', field: '화학', status: '실험 완료', line: 'antho', date: '2026-11-16', owner: '오세린', createdBy: '오세린',
      plan: { purpose: '적양배추 즙이 pH에 따라 어떤 색으로 변하는지 표로 정리해 천연 지시약 색표를 만든다.', hypo: '산성에서는 붉은색, 염기성에서는 초록 · 노란색으로 변할 것이다.', ind: '용액의 pH (2, 4, 7, 9, 12)', dep: '용액 색', ctrl: '즙 양 2mL, 용액 양 10mL, 흰 종이 위에서 관찰',
        materials: ['적양배추 즙', '시험관 5개', 'pH 2 · 4 · 7 · 9 · 12 용액', '스포이트', '흰 종이'], steps: ['시험관에 pH별 용액을 10mL씩 넣는다', '적양배추 즙을 2mL씩 넣는다', '흰 종이 위에서 색을 관찰하고 사진을 찍는다'], by: '오세린', at: T('2026-11-06', '07:00') },
      prep: { done: allDone(['준비물: 적양배추 즙', '준비물: 시험관 5개', '준비물: pH 2 · 4 · 7 · 9 · 12 용액', '준비물: 스포이트', '준비물: 흰 종이'].concat(base5), '2026-11-14'), extra: [] }, signal: 5,
      run: { started: T('2026-11-16', '06:10'), ended: T('2026-11-16', '06:40'), done: { 0: T('2026-11-16', '06:12'), 1: T('2026-11-16', '06:20'), 2: T('2026-11-16', '06:38') }, notes: [{ id: 'nb8', at: T('2026-11-16', '06:30'), by: '오세린', kind: 'obs', text: 'pH 12는 처음엔 초록이었다가 10분 뒤 노랗게 변함' }] } }
  );
  S.links.push({ s: 'b1', t: 'b2', k: 'next' }, { s: 'b2', t: 'b5', k: 'next' }, { s: 'b2', t: 'bq', k: 'q' }, { s: 'b3', t: 'b6', k: 'next' });
  S.comments = [
    { id: 'c1', node: 'b1', sec: 'plan.ctrl', kind: 'change', text: '통제 변인에 “금속판을 사포로 닦기”를 넣어 주세요. 산화막 때문에 값이 달라져요.', by: '홍교사', role: '관리자', at: T('2026-10-29', '05:00'), resolved: true },
    { id: 'c2', node: 'b1', sec: '', kind: 'approve', text: '', by: '홍교사', role: '관리자', at: T('2026-10-30', '05:00'), resolved: false },
    { id: 'c3', node: 'b1', sec: '', kind: 'approve', text: '', by: '박준서', role: '부원', at: T('2026-10-30', '06:00'), resolved: false },
    { id: 'c4', node: 'b1', sec: 'report.discuss', kind: 'fix', text: '산화막을 어떻게 확인했는지 근거를 한 줄 더 써 주세요.', by: '홍교사', role: '관리자', at: T('2026-11-12', '05:00'), resolved: true },
    { id: 'c5', node: 'b1', sec: '', kind: 'note', text: '알루미늄 결과가 재밌네요. 다음엔 사포로 닦기 전후를 따로 재 보면 좋겠어요.', by: '김기장', role: '마스터', at: T('2026-11-13', '09:00'), resolved: false },
    { id: 'c6', node: 'b5', sec: '', kind: 'approve', text: '', by: '홍교사', role: '관리자', at: T('2026-11-15', '05:00'), resolved: false },
    { id: 'c7', node: 'b5', sec: 'plan.steps', kind: 'change', text: '전류를 재려면 멀티미터를 LED와 직렬로 연결해야 해요. 방법에 연결 그림이나 설명을 넣어 주세요.', by: '김기장', role: '마스터', at: T('2026-11-15', '06:00'), resolved: false },
    { id: 'c8', node: 'bq', sec: '', kind: 'answer', text: '전압보다 전류가 문제예요. 레몬 전지는 내부 저항이 커서(수 kΩ) 전류가 1mA도 안 돼요. 병렬로 연결하면 전류를 키울 수 있어요.', by: '홍교사', role: '관리자', at: T('2026-11-12', '10:00'), resolved: false },
    { id: 'c9', node: 'b4', sec: 'plan.safety', kind: 'fix', text: '황산구리 폐액은 과학실 중금속 폐액통에 버린다고 적어 주세요.', by: '홍교사', role: '관리자', at: T('2026-11-13', '05:00'), resolved: false },
    { id: 'c10', node: 'b6', sec: '', kind: 'note', text: '저도 해 보고 싶어요! 냉장고는 과학실 것을 빌릴 수 있대요.', by: '윤서연', role: '부원', at: T('2026-11-16', '04:00'), resolved: false }
  ];
  S.files = [
    { id: 'f1', node: 'b1', name: 'lemon.svg', mime: 'image/svg+xml', caption: '구리-아연 레몬 전지와 멀티미터 (0.93V)', kind: 'photo', by: '정다온', at: T('2026-11-10', '06:35'), _data: LEMON },
    { id: 'f2', node: 'b2', name: 'series.svg', mime: 'image/svg+xml', caption: '레몬 5개 직렬 연결 · LED가 희미하게 켜짐', kind: 'photo', by: '오세린', at: T('2026-11-12', '07:06'), _data: SERIES }
  ];
})(window.GAJI_SAMPLE);
