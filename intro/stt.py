# 확인용: wav를 Gemini로 받아쓰기
import json, os, sys, base64, urllib.request
def stt(path):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    body = {'contents': [{'parts': [{'inlineData': {'mimeType': 'audio/wav', 'data': b}}, {'text': '이 음성을 들리는 그대로 한국어로 받아써 줘. 받아쓴 글만.'}]}]}
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    r = json.load(urllib.request.urlopen(req, timeout=120)); return r['candidates'][0]['content']['parts'][0]['text'].strip()
if __name__ == '__main__':
    for p in sys.argv[1:]: print(p, '→', stt(p))
