// 조문 개정 감지: data/law-refs.js 가 가리키는 조문의 현행 원문을 data/law-snap.json(저장본)과 글자 단위로 비교한다.
//   node tools/clause-check.mjs               # 달라진 조문과 거기 걸린 문항 ID 출력. 달라졌으면 종료 코드 1
//   node tools/clause-check.mjs --init        # 저장본에 없는 조문만 채움(있는 것은 안 건드림)
//   node tools/clause-check.mjs --accept      # 사람이 확인한 뒤 현행 원문으로 저장본을 갱신
//   node tools/clause-check.mjs --fixture DIR # 법제처 대신 DIR/clauses.json({"키": "조문 텍스트"})을 현행으로 사용(시험용)
// 비교 텍스트 = 조문 제목 + 항·호·목 내용. 조문시행일자·조문변경여부 같은 메타데이터는 빼서 타법개정 헛경보를 막는다.
// AI 판단 없음: 한 글자라도 바뀌면 반드시 걸린다. 약칭표는 tools/check_law.py 의 ALIAS 를 읽어 쓴다(한 벌만 관리).
import fs from 'fs';
import vm from 'vm';
const R = new URL('../', import.meta.url), read = f => fs.readFileSync(new URL(f, R), 'utf8');
const OC = 'ayoungprocurelaw', API = 'https://www.law.go.kr/DRF/';
const args = process.argv.slice(2), has = a => args.includes(a);
const fixture = has('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const SNAP = new URL('data/law-snap.json', R);

// 약칭 → [종류, 정식 명칭]
const ALIAS = Object.fromEntries([...read('tools/check_law.py').matchAll(/^\s*'([^']+)':\s*\('(law|admrul)',\s*'([^']+)'\)/gm)].map(m => [m[1], [m[2], m[3]]]));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(read('data/law-refs.js').replace(/^const (\w+)/gm, 'var $1'), ctx);

// (정식 명칭, 조) → 이 조문을 근거로 쓰는 문항 ID들
const want = new Map(), bad = [];
for (const [id, { refs = [] }] of Object.entries(ctx.LAW_REFS)) for (const r of refs) {
  const a = ALIAS[r.law]; if (!a) { bad.push(`${id}: 약칭표에 없는 법령 "${r.law}"`); continue; }
  const key = `${a[1]}#${r.jo}`;
  if (!want.has(key)) want.set(key, { kind: a[0], name: a[1], jo: String(r.jo), ids: [] });
  want.get(key).ids.push(id);
}

const norm = s => (s || '').replace(/^\([^)]*\)\s*|[\sㆍ·]/g, '');
const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];
const ws = s => s.replace(/\s+/g, ' ').trim();
const get = async u => (await fetch(u)).json();
// 법령 조문단위에서 내용 필드만 순서대로
const TEXT_KEYS = new Set(['조문제목', '조문내용', '항내용', '호내용', '목내용']);
const body = o => Array.isArray(o) ? o.map(body).join(' ') : o && typeof o === 'object'
  ? Object.entries(o).map(([k, v]) => TEXT_KEYS.has(k) ? arr(v).map(x => typeof x === 'string' ? x : body(x)).join(' ') : typeof v === 'object' ? body(v) : '').join(' ') : '';

const docs = {};
async function articles(kind, name) {                 // {조번호: 비교 텍스트}
  if (docs[name]) return docs[name];
  const out = {}, q = encodeURIComponent(name);
  if (kind === 'law') {
    const hit = arr((await get(`${API}lawSearch.do?OC=${OC}&target=law&type=JSON&display=30&query=${q}`)).LawSearch?.law)
      .find(h => norm(h['법령명한글']) === norm(name) && h['현행연혁코드'] === '현행');
    if (hit) for (const u of arr((await get(`${API}lawService.do?OC=${OC}&target=law&type=JSON&MST=${hit['법령일련번호']}`))['법령']['조문']['조문단위']))
      if (u['조문여부'] === '조문') out[u['조문번호'] + (u['조문가지번호'] ? `의${u['조문가지번호']}` : '')] = ws(body(u));
  } else {
    const hit = arr((await get(`${API}lawSearch.do?OC=${OC}&target=admrul&type=JSON&display=30&query=${q}`)).AdmRulSearch?.admrul)
      .find(h => norm(h['행정규칙명']) === norm(name) && h['현행연혁구분'] === '현행');
    if (hit) for (const t of arr((await get(`${API}lawService.do?OC=${OC}&target=admrul&type=JSON&ID=${hit['행정규칙일련번호']}`)).AdmRulService?.['조문내용'])) {
      const s = ws(typeof t === 'string' ? t : body(t)), m = s.match(/^제(\d+)조(?:의(\d+))?/);
      if (m) out[m[1] + (m[2] ? `의${m[2]}` : '')] ??= s;
    }
  }
  return docs[name] = out;
}

const current = fixture ? JSON.parse(fs.readFileSync(`${fixture}/clauses.json`, 'utf8')) : null;
const snap = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : {};
const today = new Date().toLocaleDateString('sv-SE'); // 한국 날짜 YYYY-MM-DD
const changed = [], missingNow = [], added = [], noSnap = [];
for (const [key, w] of want) {
  let now;
  try { now = current ? current[key] : (await articles(w.kind, w.name))[w.jo]; }
  catch (e) { missingNow.push(`${key} (${e.message})`); continue; }
  if (now == null) { missingNow.push(key); continue; }
  const old = snap[key];
  if (!old) { if (has('--init') || has('--accept')) { snap[key] = { text: now, at: today }; added.push(key); } else noSnap.push(key); continue; }
  if (old.text !== now) {
    let i = 0; while (i < old.text.length && old.text[i] === now[i]) i++;   // 처음 달라지는 곳 앞뒤로 보여 줌
    changed.push({ key, ids: w.ids, at: old.at, was: old.text.slice(Math.max(0, i - 30), i + 50), now: now.slice(Math.max(0, i - 30), i + 50) });
    if (has('--accept')) snap[key] = { text: now, at: today };
  }
}
if (!fixture && (added.length || (has('--accept') && changed.length)))
  fs.writeFileSync(SNAP, JSON.stringify(Object.fromEntries(Object.entries(snap).sort()), null, 1) + '\n');

console.log(`조문 ${want.size}개 비교 · 달라짐 ${changed.length} · 현행에서 못 찾음 ${missingNow.length} · 저장본 없음 ${noSnap.length}` + (added.length ? ` · 새로 저장 ${added.length}` : ''));
for (const c of changed) console.log(`\n■ ${c.key} (저장 ${c.at}) → 문항 ${c.ids.join(', ')}\n  전: …${c.was}…\n  후: …${c.now}…`);
if (missingNow.length) console.log('\n현행에서 못 찾음(조 번호 이동·삭제 또는 이름 불일치): ' + missingNow.join(' / '));
if (noSnap.length) console.log('\n저장본 없음 → --init 으로 채우기: ' + noSnap.join(' / '));
if (bad.length) console.log('\n' + bad.join('\n'));
if (has('--accept') && changed.length) console.log('\n--accept: 달라진 조문을 현행 원문으로 저장함');
process.exit(changed.length && !has('--accept') || missingNow.length || bad.length ? 1 : 0);
