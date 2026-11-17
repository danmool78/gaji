# EPEC 판(index.html · short.html)에서 일반 소개용 초록 판(general.html · general-short.html)을 만듦
#   python3 intro/general.py   → 그다음 GENERAL=1 node intro/record.cjs [short]
import os
D = os.path.dirname(os.path.abspath(__file__))
C = [  # EPEC 색 → 가지 초록
 ('--g: #7D1029; --g2: #A3324B; --gd: #5A0A1D; --leaf: #FFFFCC; --sprout: #FFF3A0; --blue: #8A3D6E;', '--g: #1F8F5A; --g2: #2FA66B; --gd: #0F5C3A; --leaf: #CDF59E; --sprout: #E9FF8F; --blue: #2F6FDB;'),
 ('--g: #7D1029; --g2: #A3324B; --gd: #5A0A1D; --sprout: #FFF3A0; --blue: #8A3D6E;', '--g: #1F8F5A; --g2: #2FA66B; --gd: #0F5C3A; --sprout: #E9FF8F; --blue: #2F6FDB;'),
 ('--bg: #FFFDF0', '--bg: #F5F8F4'), ('--ink: #2A1016; --mute: #7A6268;', '--ink: #14201A; --mute: #5B6B62;'),
 ('#A11F3E, #4A0616', '#24A066, #0E5133'), ("done: '#7D1029', run: '#8A3D6E'", "done: '#1F8F5A', run: '#2F6FDB'"),
 ('#FFFFCC', '#CDF59E'), ('#FFE27A', '#E9FF8F'), ('#DDA9B4', '#9CCDB2'), ('#E9C46A', '#9BD86F'), ('#FFF4B0', '#E3F6C8'), ('#FBEFF1', '#E6F4EC'),
 ('#7D1029', '#1F8F5A'), ('background:#F6E8F0;color:#8A3D6E', 'background:#E8F0FD;color:#2F6FDB'),
 ('#EADFD9', '#D5DED8'), ('#D9C7C0', '#B9C6BE'), ('#E2D3CC', '#C9D3CD'), ('#F0E7E2', '#E3E9E5'),
 ('rgba(60, 10, 25,', 'rgba(20, 40, 30,'), ('rgba(50, 5, 20,', 'rgba(10, 30, 20,'), ('rgba(255, 253, 240, .94)', 'rgba(245, 248, 244, .94)'),
]
T = {  # EPEC · 후보 문구 → 일반 문구
 'index.html': [('<div class="epec fade" style="--d:.2s">EPEC</div>\n', ''), ('EPEC의 실험 기록, 지금 어디에 있나요?', '우리 동아리 실험 기록, 지금 어디에 있나요?'),
                ('>EPEC × 가지</div>', '>동아리 연구 관리 · 가지</div>'), ('<title>가지 소개 영상</title>', '<title>가지 소개 영상 (일반)</title>')],
 'short.html': [('EPEC의 실험 기록,<br>졸업하면 어디로 갈까요?', '우리 동아리 실험 기록,<br>졸업하면 어디로 갈까요?'),
                ('letter-spacing:14px;color:#FFFFCC">EPEC</div>', 'letter-spacing:14px;color:#FFFFCC"></div>'),
                ('>EPEC × 가지</div>', '>동아리 연구 관리 · 가지</div>'), ('<title>가지 쇼츠</title>', '<title>가지 쇼츠 (일반)</title>')],
}
for src, dst in (('index.html', 'general.html'), ('short.html', 'general-short.html')):
    s = open(os.path.join(D, src), encoding='utf-8').read()
    for a, b in T[src]:
        assert a in s, (src, a); s = s.replace(a, b)
    for a, b in C: s = s.replace(a, b)
    assert 'EPEC' not in s, src
    open(os.path.join(D, dst), 'w', encoding='utf-8').write(s); print(dst)
