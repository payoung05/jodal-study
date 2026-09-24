// v31: localStorage 읽기/쓰기 공용 (손상·차단 시 기본값)
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

// 클릭 위임: <button data-act="이름" data-x="값"> 클릭 → acts.이름(dataset). onclick="…" 문자열 대신 사용
function bindActs(root,acts){
  root.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-act]');
    if(b&&root.contains(b)&&!b.disabled&&acts[b.dataset.act]) acts[b.dataset.act](b.dataset,b,ev);
  });
}
