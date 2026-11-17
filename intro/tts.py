# Gemini 음성(TTS)으로 한 줄을 wav로:  python3 intro/tts.py "문장" out.wav [목소리]
import json, os, sys, base64, urllib.request, wave
def tts(text, path, voice='Leda', model='gemini-3.8-flash-tts', style='밝고 따뜻하고 또렷한 목소리로, 고등학생 과학 동아리 홍보 영상의 내레이터처럼 경쾌하게 읽어 주세요'):
    body = {'contents': [{'parts': [{'text': style + ':\n' + text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % model,
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    part = r['candidates'][0]['content']['parts'][0]['inlineData']
    pcm = base64.b64decode(part['data']); rate = 24000
    m = part.get('mimeType', '')
    if 'rate=' in m: rate = int(m.split('rate=')[1].split(';')[0])
    with wave.open(path, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return len(pcm) / 2 / rate
if __name__ == '__main__':
    print('%.2f초' % tts(sys.argv[1], sys.argv[2], *(sys.argv[3:4] or ['Leda'])))
