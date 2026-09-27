"""앱 문장 ↔ 근거 조문 일치 판정을 Jev(TypeSafe)에 묻고 기록한다.  (tools/jev-plan.md 4단계)

    python tools/jev-check.py --coverage      # 근거 조문이 연결된 문항 / 안 된 문항 수만 (API 호출 없음)
    python tools/jev-check.py                 # 연결된 문항 전부 판정 → reports/jev-judge-날짜.json + 요약표
    python tools/jev-check.py --only S-S34,P1-097   # 일부만

- 문항 수집·조문 인용 해석·원문 받기는 tools/check_law.py 를 그대로 쓴다(basis·해설의 조문 + data/law-refs.js).
- 조문이 길면 앱 문장과 겹치는 항만 골라 넣는다(Jev는 상태가 길수록 정확도가 흔들림).
- 판정 2개(한 요청): 어긋남 ≥ 0.5 → 수정 후보 / 아니고 뒷받침 < 0.5 → 사람 검토 / 그 외 통과. 별표 값(낙찰하한율 등)이 든 문항은 묻지 않고 '별표 확인'.
- '옳지 않은 것' 같은 부정형 필기는 정답 보기가 일부러 틀린 문장이라 해설만 앱 주장으로 쓴다.
  판정은 1차 필터. 수정 후보·검토 문항의 최종 확인은 사람이 원문 링크로.
"""
import datetime, json, os, pathlib, re, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R / 'tools'))
import check_law as C  # noqa: E402

MODEL, URL = 'jev-1.13.0', 'https://api.typesafe.ai/v1/systemone'   # 경계값을 이 버전으로 잡았으니 고정
CONTRA, SUPPORT = 0.5, 0.5
# 두 판정을 한 요청에: 어긋남(높으면 수정 후보) / 뒷받침(낮으면 사람 검토 — 조문 밖 내용·근거 없는 단정)
QS = {
    'contradicts': ('state.app 은 공공조달 학습앱의 정답·해설이고 state.clause 는 현행 법령 조문 원문이다. '
                    'app 의 숫자·기한·기준일·요건·순서 가운데 clause 에도 나오는 내용이 clause 와 어긋나는가? '
                    'clause 가 다루지 않는 내용은 판단하지 말고, 같은 뜻의 다른 표현(예: 1천분의 0.5 = 0.05%, 100분의 10 = 10%)은 어긋남이 아니다.'),
    'supported': ('state.app 은 공공조달 학습앱의 정답·해설이고 state.clause 는 현행 법령 조문 원문이다. '
                  'app 에 적힌 숫자·기한·기준일·요건·순서가 모두 clause 로 뒷받침되는가? clause 에 없는 기준을 단정하면 NO.'),
}
NEG = C.NEG
MAX_CLAUSE = 5000


def plain(t):
    """Jev에 넘길 조문 정리: 앞머리 메타데이터(조번호·시행일자·변경여부·조문키) 제거, 분수 표기에 % 병기(단위 변환은 코드 몫)."""
    t = re.sub(r'^\s*\d+(?:의\d+)?\s+\d{8}\s+[YN]\s+\d{7}\s*', '', t)
    t = re.sub(r'(?:1,?000|1천|천)\s*분의\s*(\d+(?:\.\d+)?)', lambda m: f'{m[0]}(={float(m[1]) / 10:g}%)', t)
    return re.sub(r'100\s*분의\s*(\d+(?:\.\d+)?)', lambda m: f'{m[0]}(={float(m[1]):g}%)', t)


def pick(text, arts):
    """조문들에서 app 의 숫자가 든 항, 그다음 app 문장과 2글자 조각이 많이 겹치는 항부터 MAX_CLAUSE 자까지."""
    grams = lambda s: {s[i:i + 2] for i in range(len(s) - 1)}
    g, vals = grams(re.sub(r'\s', '', text)), {(k, v) for k, v, _ in C.values(text, False)}
    segs = []
    for (ab, no), t in arts:
        for k, p in enumerate(re.split(r'(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])', t)):
            if p.strip():
                hit = len(vals & {(kk, vv) for kk, vv, _ in C.values(p, False)})
                segs.append((hit * 1000 + len(g & grams(re.sub(r'\s', '', p))), f'[{ab} 제{no}조]', k, plain(p.strip())))
    total, keep = 0, []
    for sc, head, k, p in sorted(segs, key=lambda x: -x[0]):
        if total + len(p) > MAX_CLAUSE and keep: continue
        keep.append((head, k, p)); total += len(p)
    keep.sort(key=lambda x: (x[0], x[1]))   # 원래 순서로
    return ' '.join(f'{h} {p}' for h, _, p in keep)


def items():
    out, none = [], []
    neg = {q['id']: q for q in C_Q()}
    for where, text, rf, calc in C.app_items():
        if rf == 'image': continue
        qid = where.split()[-1]
        if qid in neg and NEG.search(neg[qid]['question']): text = neg[qid]['explanation']   # 부정형: 정답 보기는 일부러 틀린 문장
        if any(f'{v:g}%' in text for k, v in C.DERIVED): out.append({'where': where, 'app': text, 'cite': '별표', 'clause': '', 'route': '별표 확인(사람)'}); continue
        if not rf: none.append(where); continue
        arts = []
        for ab, no in dict.fromkeys(rf):
            a = C.articles(*C.ALIAS[ab])
            if no in a: arts.append(((ab, no), a[no]))
        if arts: out.append({'where': where, 'app': text, 'cite': ', '.join(f'{ab} 제{no}조' for ab, no in dict.fromkeys(rf)), 'clause': pick(text, arts)})
        else: none.append(where + ' (인용 조문을 원문에서 못 찾음)')
    return out, none


def C_Q():  # 필기 문항(부정형 판단용)
    import subprocess
    return json.loads(subprocess.run(['node', '-e', 'console.log(JSON.stringify(new Function(require("fs").readFileSync("data/questions.js","utf8")+";return QUESTIONS")()))'], cwd=R, capture_output=True, text=True, encoding='utf-8').stdout)


def ask(key, it):
    if it.get('route'): return it
    body = {'model': MODEL, 'state': {'app': it['app'], 'clause': it['clause']}, 'questions': {k: {'type': 'noul', 'instructions': v} for k, v in QS.items()}}
    for wait in (0, 2, 5, 15):
        time.sleep(wait)
        req = urllib.request.Request(URL, json.dumps(body, ensure_ascii=False).encode('utf-8'), {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: res = json.loads(r.read().decode('utf-8'))
            a = res['answers']
            return {**it, 'contra': a['contradicts']['noul'], 'p': a['supported']['noul'], 'model': res.get('model'), 'usage': res.get('usage')}
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500: return {**it, 'error': f'{e.code} {e.read().decode("utf-8", "replace")[:200]}'}
        except Exception as e:  # 네트워크 오류는 재시도
            err = str(e)
    return {**it, 'error': 'retry 실패 ' + locals().get('err', '')}


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    its, none = items()
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
        its = [i for i in its if i['where'].split()[-1] in only]
    print(f'근거 조문 연결됨 {len(its)}개 · 연결 안 됨 {len(none)}개')
    if '--coverage' in sys.argv:
        print('\n연결 안 됨:\n' + '\n'.join(none)); return
    key = os.environ.get('TYPESAFE_API_KEY') or ((R / 'tools' / '.jev-key').read_text(encoding='utf-8').strip() if (R / 'tools' / '.jev-key').exists() else '')
    if not key: sys.exit('키가 없습니다. TYPESAFE_API_KEY 또는 tools/.jev-key')
    with ThreadPoolExecutor(8) as ex: res = list(ex.map(lambda i: ask(key, i), its))
    for r in res:
        if 'p' in r: r['route'] = '수정 후보' if r['contra'] >= CONTRA else '사람 검토' if r['p'] < SUPPORT else '통과'
    out = R / 'reports' / f'jev-judge-{datetime.date.today()}.json'
    out.write_text(json.dumps({'model': MODEL, 'questions': QS, 'thresholds': {'contradicts': CONTRA, 'supported': SUPPORT}, 'unlinked': none, 'results': res}, ensure_ascii=False, indent=1), encoding='utf-8')
    cnt = {}
    for r in res: cnt[r.get('route', '오류')] = cnt.get(r.get('route', '오류'), 0) + 1
    print(' · '.join(f'{k} {v}' for k, v in cnt.items()), f'· 입력 토큰 {sum((r.get("usage") or {}).get("input_tokens", 0) for r in res):,}')
    for r in sorted((r for r in res if r.get('route') == '수정 후보'), key=lambda r: -r['contra']):
        print(f"  어긋남 {r['contra']:.2f} 뒷받침 {r['p']:.2f}  {r['where']}  ({r['cite']})  {r['app'][:60]}")
    for r in res:
        if 'error' in r: print('  오류', r['where'], r['error'])
    print('기록:', out)


if __name__ == '__main__':
    main()
