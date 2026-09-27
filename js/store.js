// v31: localStorage 읽기/쓰기 공용 (손상·차단 시 기본값)
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

// 학습 기록 백업·복원: 이 앱이 쓰는 키만 (같은 github.io 주소의 다른 앱 기록은 건드리지 않음)
const RECORD_KEY=/^(wrong_notes|prac_wrong|qz_recent|sticky_v2|exam_date|step_note_\d+|tab_note_\w+)$/;
function exportRecords(){
  const data={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(RECORD_KEY.test(k))data[k]=localStorage.getItem(k);}
  const blob=new Blob([JSON.stringify({app:'jodal-study',savedAt:new Date().toISOString(),data:data},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='학습기록-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  store.set('rec_saved',{at:Date.now(),size:recordSize()}); recNudge();
}
function recordSize(){let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(RECORD_KEY.test(k))n+=(localStorage.getItem(k)||'').length;}return n;}
// 백업 알림: 기록이 바뀌었는데 마지막 저장이 7일 넘었으면(또는 한 번도 안 했으면) 화면 아래 안내. '나중에'는 3일 뒤 다시
const DAY=864e5;
function recNudge(){
  const el=document.getElementById('recNudge'); if(!el) return;
  const size=recordSize(), saved=store.get('rec_saved',null), snooze=store.get('rec_snooze',0), now=Date.now();
  const wn=Object.keys(store.get('wrong_notes',{})).length+Object.keys(store.get('prac_wrong',{})).length;
  const due=size>200 && (!saved || (now-saved.at>7*DAY && size!==saved.size)) && now>snooze;
  el.hidden=!due; if(!due) return;
  const days=saved?Math.floor((now-saved.at)/DAY):null;
  el.querySelector('.rn-txt').innerHTML=(days==null?'학습 기록을 아직 파일로 저장한 적이 없어요.':'마지막 기록 저장이 <b>'+days+'일 전</b>이에요.')+(wn?' 오답 '+wn+'개와 메모가 이 패드 브라우저에만 있어요.':' 메모와 기록이 이 패드 브라우저에만 있어요.');
}
function importRecords(file){
  file.text().then(t=>{
    const j=JSON.parse(t); if(j.app!=='jodal-study'||!j.data) throw new Error('형식');
    const keys=Object.keys(j.data).filter(k=>RECORD_KEY.test(k));
    if(!confirm((j.savedAt||'').slice(0,10)+'에 저장한 기록 '+keys.length+'가지로 바꿀까요? 지금 이 기기의 같은 기록은 덮어써요.')) return;
    keys.forEach(k=>localStorage.setItem(k,j.data[k])); location.reload();
  }).catch(()=>alert('학습 기록 파일이 아니에요. "기록 저장"으로 만든 .json 파일을 골라 주세요.'));
}

// 클릭 위임: <button data-act="이름" data-x="값"> 클릭 → acts.이름(dataset). onclick="…" 문자열 대신 사용
function bindActs(root,acts){
  root.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-act]');
    if(b&&root.contains(b)&&!b.disabled&&acts[b.dataset.act]) acts[b.dataset.act](b.dataset,b,ev);
  });
}
