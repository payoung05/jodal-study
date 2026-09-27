"""Jev가 '앱 문장 ↔ 현행 조문' 불일치를 잡는지 시험한다. (주인님 PC에서 직접 실행)

    PowerShell:  $env:TYPESAFE_API_KEY="발급받은키"; python tools/jev-test.py
    또는 tools/.jev-key 파일에 키 한 줄만 저장 (.gitignore 에 들어 있어 GitHub에 안 올라감)

tools/jev-cases.json: 제가 원문 대조로 '불일치'·'일치'로 판정한 14문항. Jev 판정과 맞는지 표로 출력하고
결과 전체를 reports/jev-test-날짜.json 에 저장한다(질문·근거·확률 기록).
"""
import datetime, json, os, pathlib, sys, urllib.request, urllib.error
R = pathlib.Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding='utf-8')
key = os.environ.get('TYPESAFE_API_KEY') or ((R / 'tools' / '.jev-key').read_text(encoding='utf-8').strip() if (R / 'tools' / '.jev-key').exists() else '')
if not key: sys.exit('키가 없습니다. TYPESAFE_API_KEY 환경변수나 tools/.jev-key 파일에 넣어 주세요.')
URL = 'https://api.typesafe.ai/v1/systemone'
Q = ('state.app 은 공공조달 학습앱의 정답·해설이고 state.clause 는 현행 법령 조문 원문이다. '
     'app 에 적힌 숫자·기한·기준일·요건·순서가 clause 와 모두 맞는가? 하나라도 조문과 다르거나 조문에 없는 기준을 단정하면 NO.')

def ask(case):
    body = {'model': 'jev-latest', 'state': {'app': case['app'], 'clause': case['clause']},
            'questions': {'matches': {'type': 'noul', 'instructions': Q}}}
    req = urllib.request.Request(URL, json.dumps(body, ensure_ascii=False).encode('utf-8'),
                                 {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode('utf-8', 'replace')}
    except urllib.error.URLError as e:
        return {'error': '접속 실패', 'body': str(e.reason)}

cases = json.loads((R / 'tools' / 'jev-cases.json').read_text(encoding='utf-8'))
rows, log, hit = [], [], 0
for c in cases:
    res = ask(c)
    log.append({'id': c['id'], 'expected': c['expected'], 'question': Q, 'response': res})
    if 'error' in res:
        print(f"{c['id']}: 호출 실패 {res['error']} {res['body'][:300]}"); continue
    p = res.get('answers', {}).get('matches', {}).get('noul')
    if p is None: print(f"{c['id']}: 응답 형식이 예상과 다름 → {json.dumps(res, ensure_ascii=False)[:300]}"); continue
    jev = '일치' if p >= 0.5 else '불일치'
    ok = jev == c['expected']; hit += ok
    rows.append(f"| {c['id']} | {c['expected']} | {jev} | {p:.2f} | {'O' if ok else 'X'} |")
print('| 문항 | Claude 판정 | Jev 판정 | 일치 확률 | 같음 |\n|---|---|---|---|---|\n' + '\n'.join(rows))
print(f'\n{len(rows)}개 중 {hit}개 같음')
out = R / 'reports' / f'jev-test-{datetime.date.today()}.json'
out.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding='utf-8'); print('기록:', out)
