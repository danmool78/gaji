# 소개 영상에 소리 입히기: 직접 합성한 산뜻한 배경음악 + Gemini 성우 내레이션
#   python3 intro/sound.py          → out/가지-소개-가로-소리.mp4
#   python3 intro/sound.py short    → out/가지-소개-쇼츠-소리.mp4
# 배경음악은 코드로 만든 것이라 저작권 걱정이 없음. 내레이션은 장면 시작 시각에 맞춰 붙이고, 말할 때는 음악을 줄임.
import os, sys, wave, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); import tts

D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, 'out'); VO = os.path.join(OUT, 'voice'); os.makedirs(VO, exist_ok=True)
SHORT = len(sys.argv) > 1 and sys.argv[1] == 'short'
SR = 44100
VOICE = os.environ.get('VOICE', 'Leda')
TTS_MODEL = os.environ.get('TTS_MODEL', 'gemini-2.5-pro-preview-tts')   # 3.8 flash 는 소리가 찌그러짐(포화)
MUSIC = os.environ.get('MUSIC', os.path.join(OUT, 'music', 'a-1.mp3'))   # Lyria 로 만든 배경음악 (music.py)
SPEED = float(os.environ.get('SPEED', '1.12'))   # 내레이션 빠르기

# (시작 초, 이 장면이 끝나는 초, 대사)  ‘EPEC’은 ‘이펙’으로 읽게 씀
LINES = [
    (2.4, 7, '가지. 실험이 가지를 치며 자라는 곳.'),
    (7.6, 15, '이펙 동아리의 실험 기록, 지금 어디에 있나요? 졸업하면, 기록도 함께 졸업합니다.'),
    (15.6, 24.6, '가지에서는 하나의 질문이 다음 실험을 낳습니다. 동전 전지에서 레몬 전지로, 직렬에서 병렬로.'),
    (25.2, 33, '선배가 남긴 실험에서 후배의 실험이 자라고, 다음 가지는 바로, 당신의 실험입니다.'),
    (33.6, 45, '계획서를 쓰고, 팀 밖의 부원 두 명이 검토하고, 선생님이 최종 승인하면 시작합니다. 계획 없이 시작하지 않고, 결과 없이 끝내지 않습니다.'),
    (56.1, 66.5, '측정값만 넣으면 그래프와 보고서가 자동으로. 한 실험의 모든 기록이, 보고서 한 편이 됩니다.'),
    (67.1, 75.5, '십 년 뒤의 후배도, 검색 한 번으로 선배의 실험을 이어 갑니다.'),
    (76.1, 83.5, '기록은 우리 동아리 드라이브에만. 매주 자동으로 백업합니다.'),
    (85.1, 94.5, '한 번 하고 끝나는 실험 말고, 가지를 치며 자라는 연구. 이펙 기장 후보, 김승엽이 만들겠습니다.'),
    (45.6, 55.3, '실험하는 날에는 진행 도우미가 계획서의 방법을 한 단계씩 짚어 줍니다. 순서를 놓치지 않고, 측정값과 사진은 그 자리에서 바로.'),
]
LINES_SHORT = [
    (0.6, 5.2, '이펙 동아리의 실험 기록, 졸업하면 어디로 갈까요?'),
    (5.8, 17, '가지에서는 하나의 질문이 다음 실험을 낳고, 선배의 실험에서 후배의 실험이 자랍니다.'),
    (17.4, 27, '팀 밖의 부원 두 명과 선생님의 승인을 받고 시작하고, 결과를 넣으면 보고서가 자동으로.'),
    (34.4, 41, '십 년 뒤 후배도, 검색 한 번으로 이어 갑니다.'),
    (41.6, 48, '가지를 치며 자라는 연구. 이펙 기장 후보, 김승엽.'),
    (27.4, 33.8, '실험하는 날엔 진행 도우미가 한 단계씩. 순서를 놓치지 않는, 실수 없는 실험.'),
]

# 일반 소개 판 (GENERAL=1): 동아리 이름 · 후보 문구 없이
GENERAL = bool(os.environ.get('GENERAL'))
if GENERAL:
    LINES = [l if i not in (1, 8) else (l[0], l[1], {1: '우리 동아리 실험 기록, 지금 어디에 있나요? 졸업하면, 기록도 함께 졸업합니다.',
             8: '한 번 하고 끝나는 실험 말고, 가지를 치며 자라는 연구. 지금, 가지에서 시작하세요.'}[i]) for i, l in enumerate(LINES)]
    LINES_SHORT = [l if i not in (0, 4) else (l[0], l[1], {0: '우리 동아리 실험 기록, 졸업하면 어디로 갈까요?',
             4: '가지를 치며 자라는 연구. 지금, 가지에서 시작하세요.'}[i]) for i, l in enumerate(LINES_SHORT)]

def read_wav(p):
    with wave.open(p) as w: r = w.getframerate()
    if r != SR:   # 고품질로 44.1kHz 맞춤
        q = p[:-4] + '_44k.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', 'aresample=%d:resampler=soxr' % SR, q], check=True); p = q
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768

def edge(x, ms=15):   # 끝을 부드럽게 (딸깍 소리 방지)
    k = min(len(x) // 2, int(SR * ms / 1000)); r = np.linspace(0, 1, k, dtype=np.float32)
    x = x.copy(); x[:k] *= r; x[-k:] *= r[::-1]; return x

def trim(x, th=0.01):
    i = np.where(np.abs(x) > th)[0]
    return x[max(0, i[0] - 800): i[-1] + 2400] if len(i) else x

def tempo(x, f):   # 말 빠르기만 살짝 올림 (ffmpeg atempo)
    if abs(f - 1.0) < 0.005: return x
    a, b = os.path.join(VO, '_a.wav'), os.path.join(VO, '_b.wav')
    with wave.open(a, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-filter:a', 'atempo=%.3f' % f, b], check=True)
    return read_wav(b)

# ---------- 배경음악: C장조 I–V–vi–IV, 112bpm, 플럭 아르페지오 + 패드 + 베이스 + 가벼운 리듬 ----------
def bgm(length):
    n = int(length * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    bpm = 112; beat = 60 / bpm; bar = beat * 4
    f = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]   # C G Am F
    roots = [36, 43, 45, 41]
    def note(start, dur, freq, amp, kind='pluck'):
        i0 = int(start * SR); m = min(n - i0, int((dur + 1.2) * SR))
        if m <= 0: return
        tt = np.arange(m) / SR
        if kind == 'pluck':
            env = np.exp(-tt * 5.5) * np.minimum(1, tt * 200)
            w = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(4 * np.pi * freq * tt) + 0.12 * np.sin(6 * np.pi * freq * tt)
        elif kind == 'bell':
            env = np.exp(-tt * 2.6) * np.minimum(1, tt * 300)
            w = np.sin(2 * np.pi * freq * tt) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * tt) * np.exp(-tt * 6)
        elif kind == 'bass':
            env = np.exp(-tt * 3.0) * np.minimum(1, tt * 120)
            w = np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(4 * np.pi * freq * tt)
        else:   # pad
            env = np.minimum(1, tt / 0.6) * np.clip((dur + 0.6 - tt) / 0.6, 0, 1)
            w = np.sin(2 * np.pi * freq * tt) + 0.3 * np.sin(2 * np.pi * freq * 1.003 * tt)
        tail = min(m, int(0.05 * SR)); env[-tail:] *= np.linspace(1, 0, tail)
        out[i0:i0 + m] += (amp * env * w).astype(np.float32)
    rng = np.random.default_rng(7)
    def hat(start, amp):
        i0 = int(start * SR); m = min(n - i0, int(0.09 * SR))
        if m <= 0: return
        z = rng.standard_normal(m)   # 셰이커: 거친 고음을 덜어 낸 부드러운 잡음
        z = np.convolve(z, np.ones(4) / 4, mode='same'); z = z - np.convolve(z, np.ones(24) / 24, mode='same')
        tt = np.arange(m) / SR; env = np.minimum(1, tt / 0.004) * np.exp(-tt * 45)
        out[i0:i0 + m] += (amp * 0.7 * z * env).astype(np.float32)
    def kick(start, amp):
        i0 = int(start * SR); m = min(n - i0, int(0.25 * SR))
        if m <= 0: return
        tt = np.arange(m) / SR; ph = 2 * np.pi * (50 * tt + 60 * (1 - np.exp(-tt * 30)) / 30)
        out[i0:i0 + m] += (amp * np.sin(ph) * np.exp(-tt * 14)).astype(np.float32)
    drums_from = 7.0 if not SHORT else 5.6
    melody = [76, 79, 81, 79, 76, 74, 72, 74]   # 짧은 종소리 동기 (2마디마다)
    b = 0; s = 0.0
    end = length - 2.5
    while s < end:
        c = chords[b % 4]
        note(s, bar, f(c[0] - 12), 0.05, 'pad'); note(s, bar, f(c[1] - 12), 0.04, 'pad'); note(s, bar, f(c[2] - 12), 0.04, 'pad')
        arp = [c[0], c[1], c[2], c[1] + 12, c[2], c[1], c[0] + 12, c[2]]
        for k in range(8): note(s + k * beat / 2, beat / 2, f(arp[k]), 0.10 if k % 2 == 0 else 0.07)
        if s >= drums_from - 0.01:
            note(s, beat * 1.5, f(roots[b % 4]), 0.20, 'bass'); note(s + beat * 2, beat * 1.5, f(roots[b % 4]), 0.16, 'bass')
            for k in range(4): kick(s + k * beat, 0.30 if k % 2 == 0 else 0.0)
            for k in range(8): hat(s + k * beat / 2 + (beat / 4 if k % 2 else 0), 0.05 if k % 2 else 0.025)
        if b % 2 == 1 and s >= drums_from:
            for k, mnote in enumerate(melody[(b // 2 % 2) * 4:(b // 2 % 2) * 4 + 4]): note(s + k * beat, beat, f(mnote), 0.06, 'bell')
        b += 1; s += bar
    note(end, 2.4, f(48), 0.10, 'pad'); note(end, 2.4, f(55), 0.08, 'pad'); note(end, 2.4, f(64), 0.08, 'pad'); note(end, 1.0, f(72), 0.08, 'bell')
    fade = np.ones(n, np.float32); fi = int(1.5 * SR); fo = int(2.0 * SR)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    out *= fade
    return out / (np.abs(out).max() + 1e-9) * 0.9

def main():
    vid = os.path.join(OUT, '가지-소개-' + ('일반-' if GENERAL else '') + ('쇼츠' if SHORT else '가로') + '.mp4')
    length = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vid], capture_output=True, text=True).stdout)
    n = int(length * SR); voice = np.zeros(n, np.float32); active = np.zeros(n, np.float32)
    for i, (st, en, text) in enumerate(LINES_SHORT if SHORT else LINES):
        p = os.path.join(VO, ('g' if GENERAL else '') + ('s' if SHORT else 'h') + '%02d.wav' % i)
        if not os.path.exists(p): tts.tts(text, p, VOICE, model=TTS_MODEL, style='')
        x = trim(read_wav(p)); slot = en - st - 0.2; dur = len(x) / SR
        f = max(SPEED, min(1.3, dur / slot))
        x = edge(tempo(x, f))
        i0 = int(st * SR); m = min(len(x), n - i0); voice[i0:i0 + m] += x[:m]; active[i0:i0 + m] = 1
        print('%5.1f초 %4.1f초/%4.1f초  %s' % (st, len(x) / SR, slot + 0.2, text))
    # 말할 때 음악을 줄임 (부드럽게)
    k = int(0.35 * SR); env = np.convolve(active, np.ones(k) / k, mode='same')
    duck = (0.50 - 0.34 * np.clip(env * 1.6, 0, 1))[:, None]
    if os.path.exists(MUSIC):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', MUSIC, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        mu = np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
        mu = np.concatenate([mu, np.zeros((max(0, n - len(mu)), 2), np.float32)])[:n]
        fi, fo = int(0.4 * SR), int(3.0 * SR)
        mu[:fi] *= np.linspace(0, 1, fi)[:, None]; mu[-fo:] *= np.linspace(1, 0, fo)[:, None]
        mu = mu / (np.abs(mu).max() + 1e-9)
    else:
        mu = np.repeat(bgm(length)[:, None], 2, axis=1)
    music = mu * duck
    voice = voice / (np.abs(voice).max() + 1e-9) * 0.9
    mix = voice[:, None] + music; mix = mix / max(1.0, np.abs(mix).max() / 0.89)   # 찌그러지지 않게
    wav = os.path.join(OUT, '_mix.wav')
    with wave.open(wav, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    dst = vid.replace('.mp4', '-소리.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', dst], check=True)
    print('완료:', dst)

if __name__ == '__main__': main()
