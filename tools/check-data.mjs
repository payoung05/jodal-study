// 데이터 검사: 빌드(build.py)와 GitHub 자동 테스트가 먼저 돌린다. 문제가 있으면 종료 코드 1.
//   node tools/check-data.mjs
// 개수는 고정값과 비교하지 않고 출력만 한다(문제 추가 때마다 깨지지 않게). 바뀐 개수는 PR 요약에 보인다.
import fs from 'fs';
import vm from 'vm';
const R = new URL('../', import.meta.url), read = f => fs.readFileSync(new URL(f, R), 'utf8');
const ctx = {}; vm.createContext(ctx);
for (const f of ['data/steps.js', 'data/cards.js', 'data/questions.js', 'data/prac.js', 'data/law-log.js', 'data/syllabus.js'])
  vm.runInContext(read(f).replace(/^const (\w+)/gm, 'var $1'), ctx, { filename: f });
const { STEPS, CARDS, QUESTIONS, PRAC_QUESTIONS, LAW_LOG, SYLLABUS_ITEMS } = ctx;
const err = [], warn = [];
const uniq = (list, name) => { const seen = new Set(); list.forEach(x => { if (seen.has(x.id)) err.push(`${name}: 번호 중복 ${x.id}`); seen.add(x.id); }); };

// 필기
uniq(QUESTIONS, '필기');
QUESTIONS.forEach(q => {
  if (!q.question || !q.explanation) err.push(`필기 ${q.id}: 문제 또는 해설 비어 있음`);
  if (!Array.isArray(q.options) || q.options.length < 2) err.push(`필기 ${q.id}: 보기 부족`);
  else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err.push(`필기 ${q.id}: 정답 번호 ${q.answer}가 보기 범위 밖`);
  else if (new Set(q.options).size !== q.options.length) err.push(`필기 ${q.id}: 같은 보기가 두 번`);
});
// 출제기준: 필기 문제마다 세세항목 번호(ss) 하나. 문제 0개인 세세항목은 개수만 출력(빈 곳 = 보충할 곳)
const ssIds = new Set(SYLLABUS_ITEMS.map(i => i.id)), ssN = {};
QUESTIONS.forEach(q => { if (!ssIds.has(q.ss)) err.push(`필기 ${q.id}: 출제기준 번호(ss) "${q.ss || ''}"가 syllabus.js에 없음`); else ssN[q.ss] = (ssN[q.ss] || 0) + 1; });
const ssEmpty = SYLLABUS_ITEMS.filter(i => !ssN[i.id]);
// 근거 조문 링크는 법제처 주소만
[...QUESTIONS, ...PRAC_QUESTIONS].forEach(q => {
  if (q.basis && !/^https:\/\/www\.law\.go\.kr\//.test(q.basisUrl || '')) err.push(`${q.id}: 근거(basis)는 있는데 법제처 원문 링크(basisUrl)가 없음`);
});
// 실기
uniq(PRAC_QUESTIONS, '실기');
PRAC_QUESTIONS.forEach(q => {
  if (!q.question || !q.modelAnswer) err.push(`실기 ${q.id}: 문제 또는 모범답안 비어 있음`);
  if (!Array.isArray(q.keywords) || !q.keywords.length) err.push(`실기 ${q.id}: 채점 키워드 없음`);
  if (!(q.maxScore > 0)) err.push(`실기 ${q.id}: 배점 없음`);
});
// 카드·단계
CARDS.forEach((c, i) => { if (!c.cat || !c.term || !c.def) err.push(`카드 ${i + 1}번째: 분류·용어·뜻 중 빈 칸`); });
if (STEPS.length !== 20 || STEPS.some((s, i) => s.id !== i + 1)) err.push(`단계: 1~20 순서가 아님 (${STEPS.length}개)`);
if (!Array.isArray(LAW_LOG) || !LAW_LOG.length) err.push('법령 반영 기록이 비어 있음');
// constraints.md 의 '금지:' 문구가 앱에 남아 있으면 실패
const files = ['index.html', ...fs.readdirSync(new URL('data/', R)).map(f => 'data/' + f), ...fs.readdirSync(new URL('js/', R)).map(f => 'js/' + f)].filter(f => /\.(js|html)$/.test(f) && f !== 'data/law-log.js');
let rules = 0, examples = 0;
for (const sec of read('constraints.md').split(/^## /m).slice(1)) {
  const title = sec.split('\n')[0], rule = sec.match(/^- 금지: \/(.+)\/([a-z]*)$/m);
  if (!rule) continue;
  rules++; const re = new RegExp(rule[1], rule[2]);
  const ex = k => ((sec.match(new RegExp('^- ' + k + ' 예: (.+)$', 'm')) || [])[1] || '').split(' | ').filter(Boolean);
  const bad = ex('금지'), good = ex('허용'); examples += bad.length + good.length;
  if (!bad.length || !good.length) err.push(`constraints "${title}": 금지 예·허용 예가 없음 (규칙 자체를 시험할 수 없음)`);
  bad.forEach(s => { if (!re.test(s)) err.push(`constraints "${title}": 규칙이 틀린 문장을 놓침(미탐) — "${s}"`); });
  good.forEach(s => { if (re.test(s)) err.push(`constraints "${title}": 규칙이 옳은 문장을 막음(오탐) — "${s}"`); });
  for (const f of files) read(f).split('\n').forEach((line, i) => { const hit = line.match(re); if (hit) err.push(`constraints "${title}": ${f}:${i + 1} 에 "${hit[0]}"`); });
}

const withBasis = [...QUESTIONS, ...PRAC_QUESTIONS].filter(q => q.basis).length;
const summary = [
  `필기 ${QUESTIONS.length} · 실기 ${PRAC_QUESTIONS.length} (근거 조문 ${withBasis}개) · 카드 ${CARDS.length} · 단계 ${STEPS.length}`,
  `출제기준 세세항목 ${SYLLABUS_ITEMS.length}개 중 문제 있는 곳 ${SYLLABUS_ITEMS.length - ssEmpty.length}개 · 빈 곳 ${ssEmpty.length}개` + (process.env.SS_LIST ? ':\n  ' + ssEmpty.map(i => i.id + ' ' + i.name).join('\n  ') : ' (SS_LIST=1 로 목록)'),
  `constraints 금지 규칙 ${rules}개 · 규칙 시험 예시 ${examples}개 검사`,
];
console.log(summary.join('\n'));
warn.forEach(w => console.log('주의', w));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### 데이터 검사\n' + summary.map(s => '- ' + s).join('\n') + '\n' + (err.length ? '\n**실패 ' + err.length + '건**\n' + err.map(e => '- ' + e).join('\n') + '\n' : '\n통과\n'));
if (err.length) { console.error(`\n실패 ${err.length}건:\n` + err.join('\n')); process.exit(1); }
console.log('통과');
