// 법령 대조 수정 목록(JSON)을 적용하고, PR 본문용 표(파일:줄 | 전 | 후 | 근거 조문 | 원문 링크)를 만든다.  (tools/jev-plan.md 5단계)
//   node tools/apply-fixes.mjs 목록.json [--dry] [--table 표.md]
// 목록 항목 두 가지:
//   {"file":"data/prac.js","id":"S-W04","set":{"modelAnswer":"…","keywords":[…]},"delete":false,"basis":"국가계약법 제11조①","url":"https://www.law.go.kr/…"}
//      → 한 줄에 한 문항인 데이터 파일(questions.js·prac.js)에서 id 줄을 찾아 필드만 바꾼다(한 줄 형식 유지). delete:true 면 그 줄 삭제
//   {"file":"index.html","from":"정확한 옛 문구","to":"새 문구","basis":"…","url":"…"}
//      → from 이 파일에 정확히 한 번 있을 때만 바꾼다(없거나 여러 번이면 실패 — 엉뚱한 곳을 고치지 않게)
// 하나라도 실패하면 아무 파일도 쓰지 않는다.
import fs from 'fs';
const R = new URL('../', import.meta.url);
const [list, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry'), tableOut = rest.includes('--table') ? rest[rest.indexOf('--table') + 1] : null;
const fixes = JSON.parse(fs.readFileSync(list, 'utf8'));
const files = {}, errs = [], rows = [];
const load = f => files[f] ??= fs.readFileSync(new URL(f, R), 'utf8');
const ser = o => JSON.stringify(o).replace(/"(\w+)":/g, '$1:');
const lineOf = (s, i) => s.slice(0, i).split('\n').length;
const cell = v => String(Array.isArray(v) ? v.join(', ') : v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const varOf = { 'data/questions.js': 'QUESTIONS', 'data/prac.js': 'PRAC_QUESTIONS' };

for (const x of fixes) {
  let s = load(x.file);
  if (x.id) {
    const re = new RegExp('^\\{id:"' + x.id.replace(/[-]/g, '\\-') + '".*$', 'm'), m = s.match(re);
    if (!m) { errs.push(`${x.file} ${x.id}: 문항 줄 없음`); continue; }
    const line = lineOf(s, m.index);
    const old = new Function('return ' + m[0].replace(/,\s*$/, ''))();
    if (x.delete) { files[x.file] = s.replace(m[0] + '\n', ''); rows.push([`${x.file}:${line}`, x.id, '(문항 삭제)', cell(old.question), '삭제', x.basis, x.url]); continue; }
    const bad = Object.keys(x.set || {}).filter(k => !(k in old) && !['basis', 'basisUrl'].includes(k));
    if (bad.length) { errs.push(`${x.file} ${x.id}: 없는 필드 ${bad.join(',')}`); continue; }
    const nu = { ...old, ...x.set };
    if (varOf[x.file] === 'QUESTIONS' && (!Array.isArray(nu.options) || !(nu.answer >= 0 && nu.answer < nu.options.length))) { errs.push(`${x.id}: 정답 번호가 보기 범위 밖`); continue; }
    const same = Object.keys(x.set).filter(k => JSON.stringify(old[k]) === JSON.stringify(x.set[k]));
    if (same.length === Object.keys(x.set).length) { errs.push(`${x.file} ${x.id}: 바뀌는 것이 없음`); continue; }
    files[x.file] = s.replace(m[0], ser(nu) + (m[0].trimEnd().endsWith(',') ? ',' : ''));
    for (const k of Object.keys(x.set)) if (!same.includes(k)) rows.push([`${x.file}:${line}`, x.id, k, cell(old[k]), cell(x.set[k]), x.basis, x.url]);
  } else {
    const n = s.split(x.from).length - 1;
    if (n !== 1) { errs.push(`${x.file}: 옛 문구가 ${n}번 있음 — "${x.from.slice(0, 50)}"`); continue; }
    rows.push([`${x.file}:${lineOf(s, s.indexOf(x.from))}`, '', '', cell(x.from), cell(x.to), x.basis, x.url]);
    files[x.file] = s.replace(x.from, x.to);
  }
}
if (errs.length) { console.error(`실패 ${errs.length}건 — 아무 파일도 쓰지 않음:\n` + errs.join('\n')); process.exit(1); }
if (!dry) for (const [f, s] of Object.entries(files)) fs.writeFileSync(new URL(f, R), s);
const table = ['| 파일:줄 | 문항 | 필드 | 전 | 후 | 근거 조문 | 원문 |', '|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.slice(0, 6).map(cell).join(' | ')} | ${r[6] ? `[법제처](${r[6]})` : ''} |`)].join('\n');
if (tableOut) fs.writeFileSync(tableOut, table + '\n');
console.log(`${dry ? '[시험] ' : ''}${fixes.length}건 적용 · 바뀐 칸 ${rows.length}개 · 파일 ${Object.keys(files).length}개`);
