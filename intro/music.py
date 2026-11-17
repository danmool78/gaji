# Lyria(구글 음악 생성)로 배경음악 만들기:  python3 intro/music.py 이름 "설명"
import json, os, sys, base64, urllib.request
def gen(name, prompt, model='lyria-3.5'):
    body = {'contents': [{'parts': [{'text': prompt}]}]}
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % model, data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    r = json.load(urllib.request.urlopen(req, timeout=600))
    out = []
    for i, p in enumerate(r['candidates'][0]['content']['parts']):
        if 'inlineData' in p:
            mt = p['inlineData'].get('mimeType', ''); ext = 'mp3' if 'mp3' in mt or 'mpeg' in mt else 'wav' if 'wav' in mt else mt.split('/')[-1].split(';')[0]
            path = os.path.join(os.path.dirname(__file__), 'out', 'music', '%s-%d.%s' % (name, i, ext))
            open(path, 'wb').write(base64.b64decode(p['inlineData']['data'])); out.append((path, mt))
        elif 'text' in p: print('글:', p['text'][:300])
    return out
if __name__ == '__main__':
    for p in gen(sys.argv[1], sys.argv[2]): print(p)
