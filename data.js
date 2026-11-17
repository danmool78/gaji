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
