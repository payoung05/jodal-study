function shuffled(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function countBy(list,key){const c={};list.forEach(q=>{c[q[key]]=(c[q[key]]||0)+1;});return c;}
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

try{localStorage.removeItem('qz_save');}catch(e){}

// ════════════════════════════════════════
// 필기·실기 공용 출제 엔진: select → solve → result (필기는 review 추가)
// 공통: 상태 · 모드 시작 · 채점 · 오답 저장 · 화면 전환 · 클릭 처리
// 종류별(cfg): pick(문제 고르기) · grade(채점) · noteOf(오답노트에 남길 것) · views(화면) · acts(추가 버튼)
// ════════════════════════════════════════
function QuizEngine(cfg){
  const e={phase:'select',mode:null,qs:[],answers:{},results:{},flagged:new Set(),filter:'wrong',rIdx:0,confirm:false};
  const root=document.getElementById(cfg.root);
  e.render=()=>{ if(root) root.innerHTML=cfg.views[e.phase](e); };
  e.go=phase=>{ e.phase=phase; if(phase==='select') e.mode=null; e.render(); };
  e.start=k=>{ Object.assign(e,{mode:k,qs:cfg.pick(k),answers:{},results:{},flagged:new Set(),rIdx:0,confirm:false}); e.go('solve'); };
  e.wrongCount=()=>Object.keys(store.get(cfg.wrongKey,{})).length;
  e.submit=()=>{
    const notes=store.get(cfg.wrongKey,{});
    e.qs.forEach(q=>{
      const a=e.answers[q.id], r=e.results[q.id]=cfg.grade(q,a);
      if(!r.ok) notes[q.id]=Object.assign({},q,{wrongAt:Date.now()},cfg.noteOf(a,r));
    });
    store.set(cfg.wrongKey,notes);
    e.confirm=false; e.go('result'); wnRender(); renderWeak();
  };
  if(root){
    bindActs(root,Object.assign({start:d=>e.start(d.k), go:d=>e.go(d.to), submit:e.submit}, cfg.acts?cfg.acts(e):{}));
    root.addEventListener('input',ev=>{ const id=ev.target.dataset.ans; if(id) e.answers[id]=ev.target.value; });
  }
  return e;
}

// ─── 화면 조각 (필기·실기·오답노트 공용) ───
const NUM='①②③④';
function renderModeMenu(title,sub,modes,wrongCount){
  const cards=modes.map(m=>{
    const w=m.key==='wrong';
    return `<button class="menu-card" style="--mc:${m.color}" data-act="start" data-k="${m.key}"${w&&!wrongCount?' disabled':''}>
      <span class="menu-ico"></span>
      <span class="menu-body"><span class="menu-ttl">${m.label}${w&&wrongCount?` <span class="menu-n">(${wrongCount})</span>`:''}</span><span class="menu-desc">${m.desc}</span></span>
      <span class="menu-go" aria-hidden="true">›</span></button>`;
  }).join('');
  return `<div class="page-title">${title}</div><div class="page-sub">${sub}</div><div class="menu-list">${cards}</div>`;
}
function solveHead(title,sub,done,total){
  return `<div class="qz-hd">
    <div class="qz-hd-row"><div class="qz-title">${title}</div><button class="btn btn-sm c-ink" data-act="go" data-to="select">← 모드 변경</button></div>
    <div class="qz-sub">${sub}</div>
    <div class="qz-bar"><div class="qz-bar-fill" style="width:${total?done/total*100:0}%"></div></div>
  </div>`;
}
function scoreCard(label,num,max,rate,sub,extra,btns){
  const cls=rate>=0.8?'':rate>=0.6?' mid':' low';
  return `<div class="qz-score-card"><div class="qz-score-lbl">${label}</div>
    <div class="qz-score-num${cls}">${num}<span class="qz-score-max"> / ${max}</span></div>
    <div class="qz-score-sub">${sub}</div>${extra}<div class="qz-score-btns">${btns}</div></div>`;
}
function rvOpts(q,ua){
  return '<div class="rv-opts">'+q.options.map((o,oi)=>{
    const isA=oi===q.answer, wr=oi===ua&&!isA;
    return `<div class="rv-opt${isA?' ok':wr?' ng':''}"><span class="rv-opt-t">${NUM[oi]} ${o}</span>${isA?'<span class="rv-opt-tag">정답</span>':''}${wr?'<span class="rv-opt-tag">내 선택</span>':''}</div>`;
  }).join('')+'</div>';
}
const explain=q=>`<div class="qz-explain"><div class="qz-explain-lbl">해설</div>${q.explanation}</div>`;

// ════════════════════════════════════════
// 필기
// ════════════════════════════════════════
const QZ_SUBJ=['공공조달과 법제도 이해','공공조달계획 수립 및 분석','공공계약관리'];
const QZ_MODE_LABELS = {full80:'전체 모의고사',mini20:'미니 모의고사',s1:'1과목 집중',s2:'2과목 집중',s3:'3과목 집중',flow:'계약 플로우',numbers:'핵심 수치',wrong:'오답 재출제'};
const QZ_MODES = [
  {key:'full80',label:'전체 모의고사',desc:'80문제 · 시험 동일 비율 (1과목30/2과목20/3과목30)',color:'#1F8A4C'},
  {key:'mini20',label:'미니 모의고사',desc:'20문제 · 빠른 점검 (1과목8/2과목5/3과목7)',color:'#3268E8'},
  {key:'s1',label:'1과목 집중',desc:'공공조달과 법제도 이해 · 30문제',color:'#191F28'},
  {key:'s2',label:'2과목 집중',desc:'공공조달계획 수립 및 분석 · 30문제',color:'#D9730D'},
  {key:'s3',label:'3과목 집중',desc:'공공계약관리 · 30문제',color:'#D9730D'},
  {key:'flow',label:'계약 플로우 집중',desc:'절차·이행 위주 · 20문제',color:'#3268E8'},
  {key:'numbers',label:'핵심 수치 집중',desc:'숫자·계산형 위주 · 20문제',color:'#E5484D'},
  {key:'wrong',label:'오답 재출제',desc:'틀린 문제 우선 · 20문제',color:'#1F8A4C'},
];

function qzGetRecent(){return store.get('qz_recent',[]);}
function qzPushRecent(ids){var r=qzGetRecent();r.push({t:Date.now(),ids:ids});store.set('qz_recent',r.slice(-3));}
function qzRecentIds(){var s=new Set();qzGetRecent().forEach(function(r){r.ids.forEach(function(id){s.add(id);});});return s;}

function qzPickQuestions(mode){
  var recent=qzRecentIds();
  var byS={'1':QUESTIONS.filter(q=>q.subject===QZ_SUBJ[0]),'2':QUESTIONS.filter(q=>q.subject===QZ_SUBJ[1]),'3':QUESTIONS.filter(q=>q.subject===QZ_SUBJ[2])};
  function pick(pool,n){
    var fresh=pool.filter(function(q){return !recent.has(q.id);});
    var used=pool.filter(function(q){return recent.has(q.id);});
    var base=fresh.length>=n?fresh:fresh.concat(shuffled(used));
    return shuffled(base).slice(0,n);
  }
  var res=[];
  if(mode==='full80')res=pick(byS['1'],30).concat(pick(byS['2'],20),pick(byS['3'],30));
  else if(mode==='mini20')res=pick(byS['1'],8).concat(pick(byS['2'],5),pick(byS['3'],7));
  else if(mode==='s1')res=pick(byS['1'],30);
  else if(mode==='s2')res=pick(byS['2'],30);
  else if(mode==='s3')res=pick(byS['3'],30);
  else if(mode==='flow'){
    var fk=['절차','이행','공고','낙찰','계약','평가','입찰','검사','지급','하도급','변경'];
    var p=QUESTIONS.filter(function(q){return (q.tag&&q.tag.some(function(t){return fk.indexOf(t)>=0;}))||['계약관리 일반 절차','계약이행 관리','입찰서 제출 및 개찰','낙찰자 결정방법','입찰공고문 분석'].indexOf(q.major)>=0;});
    res=pick(p,Math.min(20,p.length));
  } else if(mode==='numbers'){
    var p2=QUESTIONS.filter(function(q){return q.tag&&q.tag.some(function(t){return t==='숫자'||t==='계산';});});
    res=pick(p2,Math.min(20,p2.length));
  } else if(mode==='wrong'){
    var wi=new Set(Object.keys(store.get('wrong_notes',{})));
    var p3=QUESTIONS.filter(function(q){return wi.has(String(q.id));});
    res=shuffled(p3).slice(0,Math.min(20,p3.length));
  }
  if(res.length>0)qzPushRecent(res.map(function(q){return q.id;}));
  // 모의고사는 실제 시험처럼 1과목→2과목→3과목 순서 유지 (과목 내부는 pick()에서 이미 섞임)
  if(mode==='full80'||mode==='mini20') return res;
  return shuffled(res);
}

const qzOk=(e,q)=>e.answers[q.id]===q.answer;

function qzSolveView(e){
  const n=e.qs.length, done=Object.keys(e.answers).length, left=n-done, f=e.flagged.size;
  const cards=e.qs.map((q,qi)=>{
    const on=e.flagged.has(q.id);
    return `<div class="qz-card">
      <div class="qz-card-hd"><span class="qz-subj">${q.subject}</span>
        <button class="qz-flag${on?' on':''}" data-act="flag" data-id="${q.id}" aria-label="체크" aria-pressed="${on}">★</button></div>
      <div class="qz-q">${qi+1}. ${q.question}</div>
      <div class="qz-opts">${q.options.map((o,oi)=>`<button class="qz-opt${e.answers[q.id]===oi?' sel':''}" data-act="select" data-id="${q.id}" data-i="${oi}">${NUM[oi]} ${o}</button>`).join('')}</div>
    </div>`;
  }).join('');
  const submit = e.confirm
    ? `<div class="qz-confirm">${left}문항 미응답 — 오답 처리 후 채점할까요?
        <div class="qz-confirm-btns"><button class="btn filled" data-act="submit">채점하기</button><button class="btn c-mute" data-act="confirm" data-on="0">취소</button></div></div>`
    : left
    ? `<div class="qz-left">미응답 ${left}문항 · 그래도 채점 가능</div><button class="qz-submit ghost" data-act="confirm" data-on="1">미완성으로 채점</button>`
    : `<button class="qz-submit" data-act="submit">채점하기</button>`;
  const sub=`${done}/${n} 선택 · ★${f}개 체크${f?' <button class="btn btn-sm c-orange" data-act="review" data-f="flagged">★ 체크한 문제 복습</button>':''}`;
  return solveHead(QZ_MODE_LABELS[e.mode]||'모의고사',sub,done,n)+cards+`<div class="qz-submit-wrap">${submit}</div>`;
}

function qzResultView(e){
  const n=e.qs.length, sc=e.qs.filter(q=>qzOk(e,q)).length, wn=n-sc, f=e.flagged.size, rate=sc/n;
  const cards=e.qs.map((q,qi)=>{
    const ua=e.answers[q.id], ok=qzOk(e,q);
    return `<div class="qz-res-card ${ok?'ok':'ng'}">
      <div class="qz-res-hd"><span class="rv-verdict${ok?'':' ng'}">${ua===undefined?'✗ 미응답':ok?'✓ 정답':'✗ 오답'}</span><span class="qz-res-meta">${q.subject}${e.flagged.has(q.id)?' · ★':''}</span></div>
      <div class="rv-q">${qi+1}. ${q.question}</div>${rvOpts(q,ua)}${ok?'':explain(q)}</div>`;
  }).join('');
  // 과목별 점수 + 과락(40점 미만) — 모의고사 모드에서만
  let subj='';
  if(e.mode==='full80'||e.mode==='mini20'){
    const rows=QZ_SUBJ.map((s,i)=>{
      const qs=e.qs.filter(q=>q.subject===s); if(!qs.length) return '';
      const k=qs.filter(q=>qzOk(e,q)).length, pct=Math.round(k/qs.length*100), fail=pct<40;
      return `<div class="qz-subj-row"><span>${i+1}과목 <span class="qz-subj-name">${s}</span></span><b class="${fail?'fail':''}">${k}/${qs.length} · ${pct}점${fail?' <span class="tag-fail">과락</span>':''}</b></div>`;
    }).join('');
    const avg=Math.round(rate*100);
    subj=`<div class="qz-subj-tbl">${rows}<div class="qz-subj-avg"><span>평균</span><span class="${avg>=60?'':'fail'}">${avg}점 ${avg>=60?'· 합격선 통과':'· 60점 미달'}</span></div></div>`;
  }
  const again=`<button class="btn c-mute" data-act="start" data-k="${e.mode}">↺ 새로 풀기</button>`;
  const btns=(wn?`<button class="btn filled c-red" data-act="review" data-f="wrong">✗ 틀린 문제 (${wn})</button>`:'')+
    (f?`<button class="btn c-orange" data-act="review" data-f="flagged">★ 체크 (${f})</button>`:'')+
    `<button class="btn c-olive" data-act="review" data-f="all">전체 다시보기</button>`+again;
  return scoreCard('최종 점수',sc,n,rate,`맞음 ${sc} · 틀림 ${wn} · ★${f}`,subj,btns)+cards+
    `<div class="qz-score-btns qz-foot">${wn?'<button class="btn filled c-red" data-act="review" data-f="wrong">✗ 틀린 문제 복습</button>':''}${f?'<button class="btn c-orange" data-act="review" data-f="flagged">★ 체크한 문제</button>':''}${again}</div>`;
}

function qzReviewView(e){
  const wrong=e.qs.filter(q=>!qzOk(e,q));
  const list=e.filter==='wrong'?wrong:e.filter==='flagged'?e.qs.filter(q=>e.flagged.has(q.id)):e.qs;
  const q=list[e.rIdx];
  const filters=[['wrong',`✗ 틀림 (${wrong.length})`],['flagged',`★ 체크 (${e.flagged.size})`],['all',`전체 (${e.qs.length})`]]
    .map(([f,l])=>`<button class="qz-rv-filter${e.filter===f?' active':''}" data-act="review" data-f="${f}">${l}</button>`).join('');
  const body=!q?'<div class="qz-empty">해당 문제 없음</div>':
    `<div class="rv-card"><div class="rv-card-hd"><span class="qz-subj">${q.subject}</span><span class="qz-res-meta">${e.rIdx+1}/${list.length}</span></div>
      <div class="rv-q">${q.question}</div>${rvOpts(q,e.answers[q.id])}${explain(q)}</div>
    <div class="qz-rv-nav">${e.rIdx>0?'<button class="btn c-mute" data-act="step" data-n="-1">← 이전</button>':''}${e.rIdx<list.length-1?'<button class="btn filled" data-act="step" data-n="1">다음 →</button>':'<button class="btn filled c-ink" data-act="go" data-to="result">완료</button>'}</div>`;
  return `<div class="qz-rv-hd"><div class="qz-rv-title">복습 모드</div><div class="qz-rv-back">
      <button class="btn btn-sm c-ink" data-act="go" data-to="result">← 결과</button><button class="btn btn-sm c-ink" data-act="go" data-to="solve">← 문제</button></div></div>
    <div class="qz-rv-filters">${filters}</div>${body}`;
}

const qz=QuizEngine({
  root:'qz_root', wrongKey:'wrong_notes', pick:qzPickQuestions,
  grade:(q,a)=>({ok:a===q.answer}),
  noteOf:a=>({mySelection:a}),
  views:{
    select:e=>{ const c=countBy(QUESTIONS,'subject');
      return renderModeMenu('필기 모의고사',`${QUESTIONS.length}문제 (법제도 ${c[QZ_SUBJ[0]]||0} / 계획수립 ${c[QZ_SUBJ[1]]||0} / 계약관리 ${c[QZ_SUBJ[2]]||0}) · 모드 선택`,QZ_MODES,e.wrongCount()); },
    solve:qzSolveView, result:qzResultView, review:qzReviewView,
  },
  acts:e=>({
    select:d=>{ e.answers[d.id]=+d.i; e.render(); },
    flag:d=>{ e.flagged.has(d.id)?e.flagged.delete(d.id):e.flagged.add(d.id); e.render(); },
    confirm:d=>{ e.confirm=d.on==='1'; e.render(); },
    review:d=>{ e.filter=d.f; e.rIdx=0; e.go('review'); },
    step:d=>{ e.rIdx+=+d.n; e.render(); },
  }),
});

// ════════════════════════════════════════
// 오답노트 (필기)
// ════════════════════════════════════════
function wnRender(){
  const root=document.getElementById('wn_root');
  if(!root)return;
  const notes=store.get('wrong_notes',{});
  const ids=Object.keys(notes).sort((a,b)=>(notes[b].wrongAt||0)-(notes[a].wrongAt||0));
  if(ids.length===0){
    root.innerHTML=`<div class="qz-hd"><div class="qz-title">오답노트</div><div class="qz-sub">틀린 문제가 자동으로 모입니다</div></div>
      <div class="fc-empty"><div class="wn-empty-t">아직 틀린 문제가 없어요</div><div class="wn-empty-d">모의고사에서 틀린 문제가 여기에 모입니다</div></div>`;
    return;
  }
  const cards=ids.map(id=>{
    // 저장된 사본 대신 지금 문제 데이터를 보여 줌 → 문제·해설이 고쳐지면 오답노트도 따라감
    const saved=notes[id], cur=QUESTIONS.find(x=>x.id===id), q=cur||saved;
    const sameOpts=!cur||JSON.stringify(cur.options)===JSON.stringify(saved.options);
    const updated=cur&&(!sameOpts||cur.answer!==saved.answer||cur.question!==saved.question||cur.explanation!==saved.explanation);
    const date=saved.wrongAt?new Date(saved.wrongAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="qz-res-card ng">
      <div class="qz-res-hd"><span class="rv-verdict ng">✗ 오답${updated?' <span class="wn-upd">문제 수정됨 · 최신 내용</span>':''}</span>
        <span class="wn-date">${q.subject} · ${date}<button class="btn btn-xs" data-act="remove" data-id="${esc(id)}">삭제</button></span></div>
      <div class="rv-q">${q.question}</div>${rvOpts(q,sameOpts?saved.mySelection:undefined)}${explain(q)}</div>`;
  }).join('');
  root.innerHTML=`<div class="qz-hd">
      <div class="qz-title">오답노트 <span class="n">${ids.length}</span></div>
      <div class="qz-sub">최근 틀린 문제부터 표시 · 모의고사 채점 시 자동 추가됨</div>
      <div class="wn-tools"><button class="btn c-red" data-act="clear">↺ 전체 삭제</button></div>
    </div>${cards}`;
}
(function(){
  const root=document.getElementById('wn_root'); if(!root) return;
  const save=d=>{ store.set('wrong_notes',d); wnRender(); renderWeak(); };
  bindActs(root,{
    remove:d=>{ const n=store.get('wrong_notes',{}); delete n[d.id]; save(n); },
    clear:()=>{ if(confirm('오답노트의 모든 문제를 삭제할까요?')) save({}); },
  });
})();

// ════════════════════════════════════════
// 실기 — 키워드 자동채점
// ════════════════════════════════════════
const PRAC_MODES = [
  {key:'dan',label:'단답형 모음',desc:'단답형 10문제 (20문제 풀)',color:'#191F28',type:'단답형',n:10},
  {key:'cal',label:'계산형 모음',desc:'계산형 10문제 (20문제 풀)',color:'#3268E8',type:'계산형',n:10},
  {key:'sul',label:'서술형 모음',desc:'서술형 10문제 (20문제 풀)',color:'#D9730D',type:'서술형',n:10},
  {key:'sarye',label:'사례 판단형',desc:'사례 판단형 5문제',color:'#D9730D',type:'사례판단형',n:5},
  {key:'jeolcha',label:'절차 나열형',desc:'절차 나열형 10문제',color:'#1F8A4C',type:'절차나열형',n:10},
  {key:'seoryu',label:'서류 작성형',desc:'서류 작성형 10문제',color:'#1F8A4C',type:'서류작성형',n:10},
  {key:'risk',label:'리스크 대응형',desc:'',color:'#3268E8',type:'리스크대응형',n:10},
  {key:'edoc',label:'전자조달 실무형',desc:'',color:'#1F8A4C',type:'전자조달실무형',n:10},
  {key:'comp',label:'종합 모의고사',desc:'전 유형 15문제 종합',color:'#E5484D',type:null,n:15},
  {key:'wrong',label:'오답 재출제',desc:'틀린 실기 문제 우선',color:'#E5484D',type:'wrong',n:10},
];

function pracPickQuestions(mode){
  const m = PRAC_MODES.find(x=>x.key===mode);
  if(!m) return [];
  if(m.type === 'wrong'){
    const wids = Object.keys(store.get('prac_wrong',{}));
    const pool = PRAC_QUESTIONS.filter(q=>wids.includes(q.id));
    return shuffled(pool).slice(0,Math.min(m.n,pool.length));
  }
  if(m.key === 'comp'){
    // 종합: 단답2+계산3+서술3+사례2+절차2+서류2+리스크1
    const byT = (t,n)=>shuffled(PRAC_QUESTIONS.filter(q=>q.type===t)).slice(0,n);
    return shuffled([].concat(byT('단답형',2),byT('계산형',3),byT('서술형',3),byT('사례판단형',2),byT('절차나열형',2),byT('서류작성형',2),byT('리스크대응형',1))).slice(0,15);
  }
  const pool = PRAC_QUESTIONS.filter(q=>q.type===m.type);
  return shuffled(pool).slice(0,Math.min(m.n,pool.length));
}

// 핵심 키워드 포함 비율 → 배점. 50% 미만이면 오답
function pracGradeOne(q,answer){
  const kws=q.keywords||[];
  if(!answer||!answer.trim()) return {ok:false,score:0,hit:[],miss:kws,pct:0};
  const norm=s=>s.toLowerCase().replace(/\s+/g,''), ans=norm(answer);
  const hit=kws.filter(k=>ans.indexOf(norm(k))>=0), miss=kws.filter(k=>ans.indexOf(norm(k))<0);
  const pct=kws.length>0?hit.length/kws.length:0;
  return {ok:pct>=0.5, score:Math.round(pct*q.maxScore*10)/10, hit:hit, miss:miss, pct:Math.round(pct*100)};
}

function pracSolveView(e){
  const qs=e.qs, done=qs.filter(q=>(e.answers[q.id]||'').trim()).length;
  const m=PRAC_MODES.find(x=>x.key===e.mode);
  const cards=qs.map((q,i)=>`<div class="pr-card">
      <div class="qz-card-hd"><span class="qz-subj">${q.type} · ${q.major}</span><span class="pr-meta">${i+1}/${qs.length} · 배점 ${q.maxScore}</span></div>
      <div class="qz-q">${i+1}. ${q.question}</div>
      <textarea class="pr-ta" data-ans="${q.id}" aria-label="${i+1}번 답안" placeholder="답안을 입력하세요...">${esc(e.answers[q.id])}</textarea>
    </div>`).join('');
  return solveHead('실기 · '+(m?m.label:''),`${done}/${qs.length} 작성 완료 · 키워드 자동채점`,done,qs.length)+cards+
    '<div class="qz-submit-wrap"><button class="qz-submit" data-act="submit">채점하기</button></div>';
}

function pracResultView(e){
  const qs=e.qs;
  let total=0, max=0;
  qs.forEach(q=>{ total+=e.results[q.id].score; max+=q.maxScore; });
  const rate=max>0?total/max:0;
  const cards=qs.map((q,i)=>{
    const r=e.results[q.id], rc=r.pct>=80?'ok':r.pct>=50?'mid':'ng';
    const kws=(lbl,list,cls,mark)=>list.length?`<div class="pr-kws"><span class="pr-lbl">${lbl}</span>${list.map(k=>`<span class="kw ${cls}">${mark} ${k}</span>`).join('')}</div>`:'';
    return `<div class="qz-res-card ${rc}">
      <div class="qz-res-hd"><span class="rv-verdict ${rc}">${r.score} / ${q.maxScore}점 (${r.pct}%)</span><span class="qz-subj">${q.type} · ${q.major}</span></div>
      <div class="rv-q">${i+1}. ${q.question}</div>
      <div class="pr-ans"><div class="pr-lbl">내 답안</div><div class="pr-txt">${esc(e.answers[q.id]||'(미응답)')}</div></div>
      ${kws('포함 키워드',r.hit,'ok','✓')}${kws('누락 키워드',r.miss,'ng','✗')}
      <div class="pr-model"><div class="pr-lbl">모범답안</div><div class="pr-txt">${q.modelAnswer}</div></div>
      ${explain(q)}</div>`;
  }).join('');
  return scoreCard('실기 점수',total.toFixed(1),max,rate,`정답률 ${Math.round(rate*100)}%`,'',
    `<button class="btn filled" data-act="start" data-k="${e.mode}">↺ 같은 모드 새로</button><button class="btn" data-act="go" data-to="select">다른 모드</button>`)+cards;
}

const prac=QuizEngine({
  root:'prac_root', wrongKey:'prac_wrong', pick:pracPickQuestions, grade:pracGradeOne,
  noteOf:(a,r)=>({myAnswer:a||'',score:r.score,pct:r.pct}),
  views:{
    select:e=>{ const c=countBy(PRAC_QUESTIONS,'type');
      const modes=PRAC_MODES.map(m=>c[m.type]?Object.assign({},m,{desc:m.label.replace(/ 모음$/,'')+' '+Math.min(m.n,c[m.type])+'문제 ('+c[m.type]+'문제 풀)'}):m);
      const sub=Object.keys(c).map(t=>t.replace(/(실무형|대응형|판단형|나열형|작성형|형)$/,'')+c[t]).join('·');
      return renderModeMenu('실기 문제',PRAC_QUESTIONS.length+'문제 ('+sub+') · 키워드 자동채점',modes,e.wrongCount()); },
    solve:pracSolveView, result:pracResultView,
  },
});
