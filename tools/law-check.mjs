// 법령 개정 점검: 법제처 Open API의 현재 시행일자·일련번호를 data/law-baseline.json과 비교
//   node tools/law-check.mjs           → 바뀐 것만 JSON으로 출력 (없으면 {"changed":[],"upcoming":[]})
//   node tools/law-check.mjs --update  → 기준값을 지금 값으로 갱신
import fs from 'fs';
const FILE = new URL('../data/law-baseline.json', import.meta.url);
const base = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const OC = 'ayoungprocurelaw', API = 'https://www.law.go.kr/DRF/';
const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];
const norm = s => String(s || '').replace(/^\([^)]*\)/, '').replace(/[\sㆍ·]/g, '');
async function search(target, name) {
  const r = await fetch(`${API}lawSearch.do?OC=${OC}&target=${target}&type=JSON&display=30&query=${encodeURIComponent(norm(name))}`);
  const j = JSON.parse(await r.text());
  const list = target === 'law' ? arr(j.LawSearch && j.LawSearch.law) : arr(j.AdmRulSearch && j.AdmRulSearch.admrul);
  return list.filter(x => norm(x['법령명한글'] || x['행정규칙명']) === norm(name));
}
const changed = [], upcoming = [];
for (const b of base.laws) {
  const hits = await search('law', b.name);
  const cur = hits.find(x => x['현행연혁코드'] === '현행');
  if (!cur) { changed.push({ kind: '법령', name: b.name, error: '검색 결과 없음 (폐지·제명 변경 가능)' }); continue; }
  if (cur['법령일련번호'] !== b.mst) changed.push({ kind: '법령', name: b.name, oldMst: b.mst, newMst: cur['법령일련번호'], old시행일자: b.시행일자, new시행일자: cur['시행일자'], 공포일자: cur['공포일자'], 제개정: cur['제개정구분명'] });
  hits.filter(x => x['현행연혁코드'] === '시행예정').forEach(x => upcoming.push({ kind: '법령', name: b.name, mst: x['법령일련번호'], 시행일자: x['시행일자'], 공포일자: x['공포일자'] }));
  if (process.argv.includes('--update')) Object.assign(b, { mst: cur['법령일련번호'], 시행일자: cur['시행일자'], 공포일자: cur['공포일자'], 공포번호: cur['공포번호'], 제개정: cur['제개정구분명'] });
}
for (const b of base.admrul) {
  const hits = await search('admrul', b.name);
  const cur = hits.find(x => x['현행연혁구분'] === '현행');
  if (!cur) { changed.push({ kind: '예규', name: b.name, error: '검색 결과 없음 (폐지·제명 변경 가능)' }); continue; }
  if (cur['행정규칙일련번호'] !== b.id) changed.push({ kind: '예규', name: b.name, oldId: b.id, newId: cur['행정규칙일련번호'], old시행일자: b.시행일자, new시행일자: cur['시행일자'], 발령일자: cur['발령일자'] });
  if (process.argv.includes('--update')) Object.assign(b, { id: cur['행정규칙일련번호'], 시행일자: cur['시행일자'], 발령일자: cur['발령일자'] });
}
if (process.argv.includes('--update')) { base.checkedAt = new Date().toISOString().slice(0, 10); fs.writeFileSync(FILE, JSON.stringify(base, null, 1) + '\n'); }
console.log(JSON.stringify({ checkedAt: new Date().toISOString().slice(0, 10), changed, upcoming }, null, 1));
