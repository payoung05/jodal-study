"""앱의 법령 발췌·문제 해설·수치 탭을 법제처 Open API 원문과 대조한다.

    python tools/check_law.py              # 차이 나는 것만 표로 출력
    python tools/check_law.py --out r.md   # 표를 파일로도 저장
    python tools/check_law.py --all        # 대조한 전체 개수·근거 없는 항목까지 출력

- 숫자·기간·비율(%, 100분의 N, 1천분의 N, 'N일 이내/전/마다', 'N억원 미만' 같은 규칙 값)을 뽑아
  인용된 조문 원문에 같은 값이 있는지 본다. 계산 문제의 주어진 값(계약금액 8천만원 등)은 규칙이 아니라 건너뛴다.
- 인용 조문은 문구 속 '국가계약법 시행령 §33·§35', '제50조①', 'basis' 필드, 수치 탭 카드는 아래 CARD_REFS 에서 온다.
- 차이가 있으면 종료 코드 1 (GitHub Actions 에 걸기 좋게).
"""
import datetime, html, json, pathlib, re, subprocess, sys, urllib.parse, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
OC, API = 'ayoungprocurelaw', 'https://www.law.go.kr/DRF/'
CACHE = R / 'tools' / '.law-cache'
sys.stdout.reconfigure(encoding='utf-8')

# 약칭 → (종류, 정식 명칭). 긴 이름부터 맞춘다.
ALIAS = {
    '특정조달을 위한 국가를 당사자로 하는 계약에 관한 법률 시행령 특례규정': ('law', '특정조달을 위한 국가를 당사자로 하는 계약에 관한 법률 시행령 특례규정'),
    '특례규정': ('law', '특정조달을 위한 국가를 당사자로 하는 계약에 관한 법률 시행령 특례규정'),
    '지방자치단체를 당사자로 하는 계약에 관한 법률 시행규칙': ('law', '지방자치단체를 당사자로 하는 계약에 관한 법률 시행규칙'),
    '지방자치단체를 당사자로 하는 계약에 관한 법률 시행령': ('law', '지방자치단체를 당사자로 하는 계약에 관한 법률 시행령'),
    '물품구매계약 품질관리 특수조건': ('admrul', '물품구매계약 품질관리 특수조건'),
    '국가계약법 시행령': ('law', '국가를 당사자로 하는 계약에 관한 법률 시행령'),
    '국가계약법 시행규칙': ('law', '국가를 당사자로 하는 계약에 관한 법률 시행규칙'),
    '국가계약법': ('law', '국가를 당사자로 하는 계약에 관한 법률'),
    '국가를 당사자로 하는 계약에 관한 법률 시행령': ('law', '국가를 당사자로 하는 계약에 관한 법률 시행령'),
    '국가를 당사자로 하는 계약에 관한 법률 시행규칙': ('law', '국가를 당사자로 하는 계약에 관한 법률 시행규칙'),
    '국가를 당사자로 하는 계약에 관한 법률': ('law', '국가를 당사자로 하는 계약에 관한 법률'),
    '지방계약법 시행령': ('law', '지방자치단체를 당사자로 하는 계약에 관한 법률 시행령'),
    '지방계약법 시행규칙': ('law', '지방자치단체를 당사자로 하는 계약에 관한 법률 시행규칙'),
    '지방계약법': ('law', '지방자치단체를 당사자로 하는 계약에 관한 법률'),
    '조달사업법 시행령': ('law', '조달사업에 관한 법률 시행령'),
    '조달사업법': ('law', '조달사업에 관한 법률'),
    '전자조달법': ('law', '전자조달의 이용 및 촉진에 관한 법률'),
    '판로지원법 시행령': ('law', '중소기업제품 구매촉진 및 판로지원에 관한 법률 시행령'),
    '판로지원법': ('law', '중소기업제품 구매촉진 및 판로지원에 관한 법률'),
    '건설산업기본법 시행령': ('law', '건설산업기본법 시행령'),
    '건설산업기본법': ('law', '건설산업기본법'),
    '건산법': ('law', '건설산업기본법'),
    '건설기술 진흥법 시행령': ('law', '건설기술 진흥법 시행령'),
    '건설기술진흥법 시행령': ('law', '건설기술 진흥법 시행령'),
    '부가가치세법': ('law', '부가가치세법'),
    '정부 입찰·계약 집행기준': ('admrul', '정부 입찰ㆍ계약 집행기준'),
    '정부 입찰ㆍ계약 집행기준': ('admrul', '정부 입찰ㆍ계약 집행기준'),
    '집행기준': ('admrul', '정부 입찰ㆍ계약 집행기준'),
    '공사계약일반조건': ('admrul', '공사계약일반조건'),
    '물품구매(제조)계약일반조건': ('admrul', '물품구매(제조)계약일반조건'),
    '용역계약일반조건': ('admrul', '용역계약일반조건'),
    '협상에 의한 계약체결기준': ('admrul', '협상에 의한 계약체결기준'),
    '협상기준': ('admrul', '협상에 의한 계약체결기준'),
    '적격심사기준': ('admrul', '적격심사기준'),
    '공사계약 종합심사낙찰제 심사기준': ('admrul', '공사계약 종합심사낙찰제 심사기준'),
    '입찰참가자격사전심사요령': ('admrul', '입찰참가자격사전심사요령'),
    'PQ요령': ('admrul', '입찰참가자격사전심사요령'),
    '조달청 내자구매업무 처리규정': ('admrul', '조달청 내자구매업무 처리규정'),
    '내자구매업무 처리규정': ('admrul', '조달청 내자구매업무 처리규정'),
    '공사입찰유의서': ('admrul', '공사입찰유의서'),
}
# 수치 탭 카드 → 근거 조문 (카드 문구에 조문 번호가 없어서 여기서 정함). image=별표가 그림이라 텍스트 대조 불가
CARD_REFS = {
    '입찰보증금': [('국가계약법 시행령', '37')],
    '계약보증금': [('국가계약법 시행령', '50')],
    '용역 이행보증 (계약보증금 방식)': [('용역계약일반조건', '10'), ('국가계약법 시행령', '50')],
    '공사이행보증서': [('국가계약법 시행령', '52'), ('국가계약법 시행령', '50')],
    '저가낙찰 이행보증': [('국가계약법 시행령', '52')],
    '하자보수보증금 (물품)': [('조달청 내자구매업무 처리규정', '59')],
    '하자보수보증금 (용역)': [('조달청 내자구매업무 처리규정', '59')],
    '선금 총 한도': [('집행기준', '34')],
    **{k: [('집행기준', '34')] for k in ['100억 이상 공사', '20억 ~ 100억 미만', '20억 미만 공사', '10억 이상', '3억 ~ 10억 미만', '3억 미만']},
    **{k: [('국가계약법 시행규칙', '75')] for k in ['공사', '물품 제조·구매', '용역·수리·가공·대여·기타', '군용 음식료품', '운송·보관·양곡가공']},
    '지체상금 한도': [('국가계약법 시행령', '74')],
    '검사 처리': [('국가계약법 시행령', '55')],
    '대금 지급 (원칙)': [('국가계약법 시행령', '58')],
    '대금 지급 (검사 후 청구)': [('국가계약법 시행령', '58')],
    '불가항력 지급': [('국가계약법 시행령', '58')],
    '기성대가 지급 주기': [('국가계약법 시행령', '58')],
    '입찰공고 최소 기간': [('국가계약법 시행령', '35')],
    '사전규격공개': [('집행기준', '77')],
    '계약 체결 기한': [('국가계약법 시행령', '48')],
    '조정 가능 시점': [('국가계약법 시행령', '64')],
    '변동 기준': [('국가계약법 시행령', '64')],
    '철근콘크리트·철골': 'image', '방수공사': 'image', '일반 마감': 'image',  # 건설산업기본법 시행령 제30조 [별표 4]
    '적격심사 낙찰하한율 (공사)': 'image',
    '저가낙찰 기준': [('국가계약법 시행령', '52')],
    '종합심사낙찰제': [('국가계약법 시행령', '42')],
    'PQ 대상': [('입찰참가자격사전심사요령', '6')],
}


# ── 법제처 원문 ─────────────────────────────────────────
def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


norm = lambda s: re.sub(r'^\([^)]*\)\s*|[\sㆍ·]', '', s or '')
flat = lambda o: o if isinstance(o, str) else ' '.join(map(flat, o)) if isinstance(o, list) else ' '.join(map(flat, o.values())) if isinstance(o, dict) else ''
arr = lambda x: [] if x is None else x if isinstance(x, list) else [x]
_docs = {}


def articles(kind, name):
    """{조번호(가지번호는 'N의M'): 조문 전체 텍스트}. 하루 단위 캐시."""
    if (kind, name) in _docs: return _docs[kind, name]
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f'{datetime.date.today()}_{kind}_{norm(name)}.json'
    if f.exists():
        _docs[kind, name] = json.loads(f.read_text(encoding='utf-8')); return _docs[kind, name]
    q = urllib.parse.quote(name)
    out = {}
    try:
        if kind == 'law':
            hits = arr(get(f'{API}lawSearch.do?OC={OC}&target=law&type=JSON&display=30&query={q}')['LawSearch'].get('law'))
            hit = next((h for h in hits if norm(h['법령명한글']) == norm(name) and h['현행연혁코드'] == '현행'), None)
            if hit:
                for u in arr(get(f'{API}lawService.do?OC={OC}&target=law&type=JSON&MST={hit["법령일련번호"]}')['법령']['조문']['조문단위']):
                    if u.get('조문여부') == '조문':
                        no = u['조문번호'] + (f"의{u['조문가지번호']}" if u.get('조문가지번호') else '')
                        out[no] = re.sub(r'\s+', ' ', flat(u))
        else:
            hits = arr(get(f'{API}lawSearch.do?OC={OC}&target=admrul&type=JSON&display=30&query={q}')['AdmRulSearch'].get('admrul'))
            hit = next((h for h in hits if norm(h['행정규칙명']) == norm(name) and h.get('현행연혁구분') == '현행'), None)
            if hit:
                for t in arr(get(f'{API}lawService.do?OC={OC}&target=admrul&type=JSON&ID={hit["행정규칙일련번호"]}')['AdmRulService'].get('조문내용')):
                    t = re.sub(r'\s+', ' ', flat(t)).strip()
                    m = re.match(r'제(\d+)조(?:의(\d+))?', t)
                    if m: out.setdefault(m[1] + (f'의{m[2]}' if m[2] else ''), t)
    except Exception as e:  # 네트워크·형식 오류는 '조문 못 찾음'으로 보고
        print(f'  ! {name}: {e}', file=sys.stderr)
    if out: f.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    _docs[kind, name] = out
    return out


# ── 조문 인용 읽기 ──────────────────────────────────────
NAMES = sorted(ALIAS, key=len, reverse=True)
TOK = re.compile('(' + '|'.join(map(re.escape, NAMES)) + r'|시행령|시행규칙)'
                 r'|§\s*(\d+)(?:의(\d+))?(?:\s*[~∼]\s*(\d+))?|제?\s*(\d+)조(?:의(\d+))?(?:\s*[~∼]\s*(\d+)조?)?')


def refs(text, default=None):
    """글 속 '법령명 … §N / 제N조' → [(약칭, 조번호)]. '시행령'만 쓰면 앞의 법의 시행령."""
    out, cur, base = [], default, '국가계약법'
    for m in TOK.finditer(text or ''):
        if m[1]:
            name = m[1]
            if name in ('시행령', '시행규칙'): name = f'{base} {name}'
            elif ALIAS.get(name, ('', ''))[0] == 'law': base = re.sub(r'\s*시행(령|규칙)$', '', name)
            cur = name if name in ALIAS else None
            continue
        start, gaji, end = (m[2], m[3], m[4]) if m[2] else (m[5], m[6], m[7])
        if not cur: continue
        nums = range(int(start), min(int(end), int(start) + 5) + 1) if end else [int(start)]
        out += [(cur, f'{n}의{gaji}' if gaji and not end else str(n)) for n in nums]
    return out


# ── 숫자·기간·비율 ───────────────────────────────────────
KOR = {'조': 10**12, '억': 10**8, '천만': 10**7, '백만': 10**6, '만': 10**4, '천': 10**3}
AMT = re.compile(r'((?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|천만|백만|만|천)\s*)+)원?')
# 적격심사 낙찰하한율은 적격심사기준 [별표] 평점식(그림)에서 계산한 값이라 텍스트에 없음 (2026-09-25 검증자 3명이 식으로 확인)
DERIVED = {('%', 89.745), ('%', 88.745), ('%', 87.495), ('%', 86.245), ('%', 82.495), ('%', 89.995)}  # 86.245: 조달청 물품구매적격심사 세부기준 [별표3] (2026-09-25 Claude 확인)
# 이 문서들의 숫자는 표·별표(그림)에 있어 텍스트에 없을 수 있음 → 못 찾으면 '대조 불가'로
IMAGE_DOCS = {'적격심사기준', '건설산업기본법 시행령'}
QUAL = r'\s*(?:이내|이상|이하|미만|초과|전|마다|경과|간|까지|↑|↓|을\s*초과|이\s*지난)'


def won(s):
    total = 0
    for n, u in re.findall(r'(\d[\d,]*(?:\.\d+)?)\s*(조|억|천만|백만|만|천)', s):
        total += float(n.replace(',', '')) * KOR[u]
    return int(round(total))


def values(text, rule_only=True):
    """[(종류, 값, 원래 문구)] 종류: % · 일 · 년 · 개월 · 원. rule_only면 계산식(×÷=) 옆 숫자·'아님'은 뺀다"""
    t, out = text or '', []
    if rule_only:
        found = values(t, False)
        def arith(s):
            i = t.find(s)
            return re.search(r'[×÷=→]', t[max(0, i - 8): i]) or re.match(r'\s*[×÷=]|[^.]{0,6}(아님|아니)', t[i + len(s):])
        return [v for v in found if not arith(v[2]) and (v[0] != '일' or re.match(QUAL, t[t.find(v[2]) + len(v[2]):])) and (v[0] != '원' or re.match(QUAL, t[t.find(v[2]) + len(v[2]):]))]
    for m in re.finditer(r'100\s*분의\s*(\d+(?:\.\d+)?)', t): out.append(('%', float(m[1]), m[0]))
    for m in re.finditer(r'(?:1,?000|1천|천)\s*분의\s*(\d+(?:\.\d+)?)', t): out.append(('%', round(float(m[1]) / 10, 4), m[0]))
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*/\s*100(?!\d)', t): out.append(('%', float(m[1]), m[0]))
    for m in re.finditer(r'(?<![\d.])(\d+(?:\.\d+)?)\s*%', t): out.append(('%', float(m[1]), m[0]))
    for unit, pat in (('일', r'(?<![\d.])(\d{1,3})\s*일(?!반|부|정|괄|체|자|수|시)'), ('년', r'(?<![\d.])(\d{1,2})\s*년'), ('개월', r'(?<![\d.])(\d{1,2})\s*개월')):
        for m in re.finditer(pat, t):
            out.append((unit, float(m[1]), m[0]))
    for m in AMT.finditer(t):
        out.append(('원', won(m[1]), m[0].strip()))
    return out


def snippet(text, s, w=28):
    i = text.find(s)
    return (('…' if i > w else '') + text[max(0, i - w): i] + '**' + s + '**' + text[i + len(s): i + len(s) + w] + ('…' if i + len(s) + w < len(text) else '')).replace('|', '/')


def closest(arts, kind, app_snip):
    """원문에서 같은 종류의 값을 담은 문장 중 앱 문구와 가장 많이 겹치는 것."""
    grams = lambda s: {s[i:i + 2] for i in range(len(s) - 1)}
    g, best = grams(re.sub(r'\s', '', app_snip)), ('', -1)
    for no, txt in arts:
        for sent in re.split(r'(?<=다\.)\s|(?=[②③④⑤⑥⑦⑧⑨⑩])', txt):
            if any(k == kind for k, _, _ in values(sent, False)):
                sc = len(g & grams(re.sub(r'\s', '', sent)))
                if sc > best[1]: best = (f'제{no}조: ' + sent.strip()[:140].replace('|', '/'), sc)
    return best[0] or '(같은 종류의 값이 원문에 없음)'


# ── 앱에서 대조할 문구 모으기 ─────────────────────────────
def app_items():
    items = []
    page = (R / 'index.html').read_text(encoding='utf-8')
    clean = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()
    for src, txt in re.findall(r'<div class="law-cite"><div class="src">(.*?)</div>\s*<div class="txt">(.*?)</div>', page, re.S):
        items.append((f'법령 탭 · {clean(src)}', clean(txt), refs(clean(src) + ' ' + clean(txt)), False))
    num = page[page.find('id="num_tab"'): page.find('id="fc_tab"')]
    for n, u, label, desc in re.findall(r'<div class="num">([^<]*)<span class="unit">([^<]*)</span></div><div class="card-label">([^<]*)</div><div class="card-desc">([^<]*)</div>', num):
        r = CARD_REFS.get(label)
        items.append((f'수치 탭 · {label}', f'{n}{u} {clean(desc)}', r if r != 'image' else 'image', False))
    data = json.loads(subprocess.run(['node', '-e', '''
const vm=require("vm"),fs=require("fs"),c={};vm.createContext(c);
for(const f of ["data/questions.js","data/prac.js"])vm.runInContext(fs.readFileSync(f,"utf8").replace(/^const (\\w+)/gm,"var $1"),c);
console.log(JSON.stringify({q:c.QUESTIONS,p:c.PRAC_QUESTIONS}))'''], cwd=R, capture_output=True, text=True, encoding='utf-8').stdout)
    calc = lambda q: '계산' in (q.get('tag') or []) or q.get('type') == '계산형'  # 계산 문제는 주어진 값·결과가 많아 규칙 문구(이상·미만…) 붙은 값만
    for q in data['q']:  # 필기: 오답 보기는 일부러 틀린 값이라 빼고, 정답 보기 + 해설만
        text = q['options'][q['answer']] + ' / ' + q['explanation']
        items.append((f'필기 {q["id"]}', text, refs((q.get('basis') or '') + ' ' + q['explanation']), calc(q)))
    for q in data['p']:
        text = q['modelAnswer'] + ' / ' + q['explanation']
        items.append((f'실기 {q["id"]}', text, refs((q.get('basis') or '') + ' ' + q['explanation'] + ' ' + q['modelAnswer']), calc(q)))
    return items


def main():
    rows, checked, noref, image, missing = [], 0, [], [], []
    for where, text, rf, calc in app_items():
        if rf == 'image': image.append(where); continue
        vals = values(text)
        if calc: vals = [v for v in vals if re.match(QUAL, text[text.find(v[2]) + len(v[2]):])]
        if not vals: continue
        if not rf: noref.append(where); continue
        arts = []
        for ab, no in dict.fromkeys(rf):
            kind, name = ALIAS[ab]
            a = articles(kind, name)
            if no in a: arts.append((no, a[no]))
            else: missing.append(f'{where}: {ab} 제{no}조')
        if not arts: continue
        checked += 1
        have = {(k, v) for _, t in arts for k, v, _ in values(t, False)}
        cite = ', '.join(f'{ab} 제{no}조' for ab, no in dict.fromkeys(rf))
        for k, v, s in dict.fromkeys(vals):
            if (k, v) in DERIVED: image.append(f'{where} ({s})'); continue
            if (k, v) not in have and any(ALIAS[ab][1] in IMAGE_DOCS for ab, _ in rf): image.append(f'{where} ({s})'); continue
            if (k, v) not in have:
                rows.append((where, cite, snippet(text, s), closest(arts, k, snippet(text, s))))
    out = ['| 위치 | 조문 | 앱 문구 | 원문 문구 |', '|---|---|---|---|'] + [f'| {a} | {b} | {c} | {d} |' for a, b, c, d in rows]
    head = f'## 법령 원문 대조 — {datetime.date.today()}\n\n대조한 항목 {checked}개 · **차이 {len(rows)}건**'
    extra = []
    if missing: extra += ['', f'인용한 조문을 원문에서 못 찾음 {len(missing)}건:'] + [f'- {m}' for m in missing]
    if image: extra += ['', f'별표가 그림이라 텍스트 대조 불가 {len(image)}건 (사람이 별표 확인): ' + ', '.join(dict.fromkeys(image))]
    if '--all' in sys.argv: extra += ['', f'숫자는 있는데 인용 조문이 없어 대조 못 한 항목 {len(noref)}개:', ', '.join(noref)]
    report = '\n'.join([head, ''] + (out if rows else ['차이 없음']) + extra) + '\n'
    print(report)
    if '--out' in sys.argv: pathlib.Path(sys.argv[sys.argv.index('--out') + 1]).write_text(report, encoding='utf-8')
    sys.exit(1 if rows else 0)


if __name__ == '__main__':
    main()
