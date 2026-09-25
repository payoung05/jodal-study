// v31: localStorage 읽기/쓰기 공용 (손상·차단 시 기본값)
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

// 학습 기록 백업·복원: 이 앱이 쓰는 키만 (같은 github.io 주소의 다른 앱 기록은 건드리지 않음)
const RECORD_KEY=/^(wrong_notes|prac_wrong|qz_recent|sticky_v2|exam_date|jodal_game_v1|step_note_\d+|tab_note_\w+)$/;
function exportRecords(){
  const data={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(RECORD_KEY.test(k))data[k]=localStorage.getItem(k);}
  const blob=new Blob([JSON.stringify({app:'jodal-study',savedAt:new Date().toISOString(),data:data},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='학습기록-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
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
