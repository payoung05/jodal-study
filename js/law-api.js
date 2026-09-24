(function(){
  /* ── 설정 ── */
  var LAWAPI_OC = 'ayoungprocurelaw';            // 법제처 Open API 인증키(OC)
  var BASE = 'https://www.law.go.kr/DRF/';

  /* 약칭 → 정식 법령명 (검색 정확도용) */
  var ALIAS = {
    '국가계약법':'국가를 당사자로 하는 계약에 관한 법률',
    '지방계약법':'지방자치단체를 당사자로 하는 계약에 관한 법률',
    '조달사업법':'조달사업에 관한 법률',
    '전자조달법':'전자조달의 이용 및 촉진에 관한 법률',
    '판로지원법':'중소기업제품 구매촉진 및 판로지원에 관한 법률',
    '하도급법':'하도급거래 공정화에 관한 법률'
  };
  /* 행정규칙(예규·고시)은 이 API(target=law) 대상이 아님 */
  var ADMRUL_RE = /(예규|유의서|일반조건|집행기준|심사기준|고시|훈령|지침|계약사무규칙)/;

  var mstCache = {}, lawCache = {};

  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function arr(x){return x==null?[]:(Array.isArray(x)?x:[x])}
  function fmtD(d){d=String(d||'');return d.length===8?d.slice(0,4)+'.'+d.slice(4,6)+'.'+d.slice(6):d}
  function fullName(n){
    n=n.trim().replace(/\s+/g,' ');
    var m=n.match(/^(\S+)(\s+(시행령|시행규칙))?$/);
    if(m && ALIAS[m[1]]) return ALIAS[m[1]]+(m[3]?' '+m[3]:'');
    return n;
  }

  async function getJSON(url){
    var r;
    try{ r = await fetch(url); }
    catch(e){ throw new Error('법제처 서버에 연결하지 못했습니다 (인터넷 연결 확인)'); }
    var t = await r.text();
    try{ return JSON.parse(t); }
    catch(e){
      var msg = t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
      throw new Error('API 응답 오류: '+(msg||('HTTP '+r.status))+' — OC 키 또는 등록 IP/도메인을 확인하세요');
    }
  }

  async function searchLaw(q){
    var j = await getJSON(BASE+'lawSearch.do?OC='+LAWAPI_OC+'&target=law&type=JSON&display=30&query='+encodeURIComponent(q));
    var ls = j && j.LawSearch ? arr(j.LawSearch.law) : [];
    return ls.filter(function(x){return x['현행연혁코드']!=='연혁'});
  }

  async function resolveMST(name){
    var full = fullName(name);
    if(mstCache[full]) return mstCache[full];
    var ls = await searchLaw(full);
    var norm=function(s){return String(s||'').replace(/\s/g,'')};
    var hit = ls.find(function(x){return norm(x['법령명한글'])===norm(full)})
           || ls.find(function(x){return norm(x['법령약칭명'])===norm(name)})
           || ls[0];
    if(!hit) throw new Error('"'+name+'" 법령을 찾지 못했습니다');
    mstCache[full] = hit['법령일련번호'];
    return mstCache[full];
  }

  async function loadLaw(mst){
    if(lawCache[mst]) return lawCache[mst];
    var j = await getJSON(BASE+'lawService.do?OC='+LAWAPI_OC+'&target=law&type=JSON&MST='+mst);
    if(!j || !j['법령']) throw new Error('법령 본문을 불러오지 못했습니다');
    var L = j['법령'], info = L['기본정보']||{};
    var arts = arr(L['조문'] && L['조문']['조문단위']).filter(function(a){return a['조문여부']==='조문'});
    lawCache[mst] = {name:info['법령명_한글'], abbr:info['법령명약칭'], ef:info['시행일자'], pr:info['공포일자'], kind:info['제개정구분'], arts:arts};
    return lawCache[mst];
  }

  function artKey(a){return a['조문번호']+(a['조문가지번호']?'의'+a['조문가지번호']:'')}
  function artLink(law,a){
    return 'https://www.law.go.kr/법령/'+encodeURIComponent(String(law.name).replace(/\s/g,''))+'/'+encodeURIComponent('제'+artKey(a)+'조');
  }
  function hl(s,kw){ s=esc(s); if(!kw) return s;
    var k=esc(kw).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return s.replace(new RegExp(k,'g'),'<mark>$&</mark>'); }

  function renderArt(law,a,kw){
    var hasP = arr(a['항']).length>0;
    var h = '<div class="la-art"><span class="la-h"'+(hasP?'':' style="font-weight:500"')+'>'+hl(a['조문내용'],kw)+'</span>';
    arr(a['항']).forEach(function(p){
      if(p['항내용']) h += '<span class="la-p">'+hl(p['항내용'],kw)+'</span>';
      arr(p['호']).forEach(function(i){
        h += '<span class="la-i">'+hl(i['호내용'],kw)+'</span>';
        arr(i['목']).forEach(function(m){ h += '<span class="la-m">'+hl(m['목내용'],kw)+'</span>'; });
      });
    });
    h += '<span class="la-meta" style="display:block;margin:4px 0 0">조문 시행 '+fmtD(a['조문시행일자'])
       + ' · <a href="'+artLink(law,a)+'" target="_blank" rel="noopener">국가법령정보센터에서 보기 ↗</a></span></div>';
    return h;
  }
  function artText(a){
    var t=a['조문내용']||'';
    arr(a['항']).forEach(function(p){t+=' '+(p['항내용']||'');arr(p['호']).forEach(function(i){t+=' '+(i['호내용']||'');arr(i['목']).forEach(function(m){t+=' '+(m['목내용']||'')})})});
    return t;
  }
  function metaLine(law){
    return '<div class="la-meta"><b>'+esc(law.name)+'</b>'+(law.abbr?' ('+esc(law.abbr)+')':'')
         + ' · 시행 <b>'+fmtD(law.ef)+'</b> · 공포 '+fmtD(law.pr)+(law.kind?' · '+esc(law.kind):'')+' · 조문 '+law.arts.length+'개</div>';
  }

  /* ── ① 법령 원문 검색 패널 ── */
  var cur = null;
  function panelHTML(){
    return '<div class="lawapi" id="lawApi">'
      + '<h3>법령 원문 조회 <span style="font-size:13px;color:var(--text-3)">· 법제처 국가법령정보 API (실시간 현행 법령)</span></h3>'
      + '<div class="la-sub">법령명 검색 → 법령 선택 → 조문번호(예: 12, 26의2) 또는 키워드(예: 지체상금)로 찾기</div>'
      + '<div class="la-row"><input id="laQ" placeholder="법령명 (예: 국가계약법, 지방계약법 시행령, 조달사업법)" value="국가계약법">'
      + '<button id="laGo">검색</button></div>'
      + '<div class="la-list" id="laList"></div>'
      + '<div id="laLaw" style="display:none">'
      + '<div id="laMeta"></div>'
      + '<div class="la-row"><input id="laArt" placeholder="조문번호 (예: 12, 64~66, 26의2)" style="max-width:220px">'
      + '<input id="laKw" placeholder="키워드 (예: 지연이자, 100분의 5)">'
      + '<button id="laFind">찾기</button><button class="ghost" id="laClose">닫기</button></div>'
      + '<div id="laOut"></div></div>'
      + '<div class="la-msg" id="laMsg"></div></div>';
  }
  function msg(t,err){var m=document.getElementById('laMsg');m.textContent=t||'';m.className='la-msg'+(err?' err':'')}

  async function doSearch(){
    var q=document.getElementById('laQ').value.trim(); if(!q) return;
    msg('검색 중…');
    try{
      var ls = await searchLaw(fullName(q));
      if(!ls.length && fullName(q)!==q) ls = await searchLaw(q);
      var box=document.getElementById('laList');
      box.innerHTML = ls.slice(0,12).map(function(x){
        return '<button class="la-item" data-mst="'+esc(x['법령일련번호'])+'">'+esc(x['법령명한글'])
          + '<small>'+esc(x['법령구분명'])+' · 시행 '+fmtD(x['시행일자'])+(x['법령약칭명']?' · '+esc(x['법령약칭명']):'')+'</small></button>';
      }).join('');
      msg(ls.length? ls.length+'건 — 법령을 선택하세요' : '검색 결과가 없습니다');
    }catch(e){ msg(e.message,true); }
  }
  async function openLaw(mst,btn){
    msg('본문 불러오는 중…');
    try{
      cur = await loadLaw(mst);
      document.querySelectorAll('#laList .la-item').forEach(function(b){b.classList.toggle('on',b===btn)});
      document.getElementById('laLaw').style.display='';
      document.getElementById('laMeta').innerHTML = metaLine(cur);
      document.getElementById('laOut').innerHTML='';
      msg('');
      document.getElementById('laArt').focus();
    }catch(e){ msg(e.message,true); }
  }
  function parseNums(s){
    var out=[]; String(s).split(/[,·\s]+/).forEach(function(tok){
      tok=tok.replace(/[제조§]/g,''); if(!tok) return;
      var r=tok.match(/^(\d+)[~\-](\d+)$/);
      if(r){ for(var i=+r[1];i<=+r[2]&&i-r[1]<15;i++) out.push(String(i)); }
      else out.push(tok);
    }); return out;
  }
  function find(){
    if(!cur) return;
    var an=document.getElementById('laArt').value.trim(), kw=document.getElementById('laKw').value.trim();
    var list=cur.arts;
    if(an){ var ns=parseNums(an); list=list.filter(function(a){return ns.indexOf(artKey(a))>=0}); }
    if(kw){ list=list.filter(function(a){return artText(a).indexOf(kw)>=0}); }
    if(!an && !kw){ document.getElementById('laOut').innerHTML='<div class="la-msg">조문번호나 키워드를 입력하세요</div>'; return; }
    var more = list.length>40 ? '<div class="la-msg">'+list.length+'개 중 40개만 표시 — 검색어를 좁혀 보세요</div>' : '';
    document.getElementById('laOut').innerHTML = list.length
      ? '<div class="la-msg">'+list.length+'개 조문</div>'+list.slice(0,40).map(function(a){return renderArt(cur,a,kw)}).join('')+more
      : '<div class="la-msg">해당 조문이 없습니다 (삭제·이동되었을 수 있음)</div>';
  }

  /* ── ② 발췌 조문 옆 "원문" 버튼 ── */
  function parseRefs(src){
    src = src.replace(/\(발췌[^)]*\)/g,'').replace(/[—–].*$/,'').trim();
    var refs=[], base=null;
    src.split('+').forEach(function(seg){
      seg=seg.trim(); if(!seg) return;
      var m = seg.match(/^([^§]*?)\s*§\s*(.+)$/);
      var name = (m?m[1]:seg).trim(), nums = m?m[2]:'';
      if(/^(시행령|시행규칙)$/.test(name)) name = (base||'국가계약법')+' '+name;
      else if(!name) name = base||'';
      else if(!ADMRUL_RE.test(name)) base = name.replace(/\s+(시행령|시행규칙)$/,'');
      if(!name) return;
      if(ADMRUL_RE.test(name)){ refs.push({name:name, admrul:true}); return; }
      var below = /이하/.test(nums);
      var ns = parseNums(nums.replace(/이하.*/,'').replace(/§/g,''));
      if(below && ns.length===1){ var s=+ns[0]; ns=[]; for(var i=s;i<s+3;i++) ns.push(String(i)); }
      refs.push({name:name, nums:ns});
    });
    return refs;
  }
  async function showOrig(cite,btn){
    var box = cite.querySelector('.la-orig');
    if(box){ box.remove(); btn.textContent='원문'; return; }
    box=document.createElement('div'); box.className='la-orig'; box.innerHTML='<div class="la-msg">법제처에서 원문 불러오는 중…</div>';
    cite.appendChild(box); btn.textContent='원문 닫기';
    var refs = parseRefs(cite.querySelector('.src').textContent.replace(/원문( 닫기)?$/,''));
    var html='';
    for(var k=0;k<refs.length;k++){
      var r=refs[k];
      if(r.admrul){ html+='<div class="la-msg">「'+esc(r.name)+'」은 행정규칙(예규·고시)이라 이 조회 대상이 아닙니다 — '
        +'<a href="https://www.law.go.kr/admRulSc.do?query='+encodeURIComponent(r.name.replace(/\s*§.*$/,''))+'" target="_blank" rel="noopener">국가법령정보센터 검색 ↗</a></div>'; continue; }
      if(!r.nums.length){ html+='<div class="la-msg">「'+esc(r.name)+'」 — 조문번호가 표기되지 않아 자동 조회 불가 (위 원문 조회에서 키워드로 찾으세요)</div>'; continue; }
      try{
        var law = await loadLaw(await resolveMST(r.name));
        var hits = law.arts.filter(function(a){return r.nums.indexOf(artKey(a))>=0});
        html += '<span class="la-tag">원문 · 현행</span>'+metaLine(law);
        html += hits.length ? hits.map(function(a){return renderArt(law,a,'')}).join('')
                            : '<div class="la-msg err">제'+esc(r.nums.join('·'))+'조를 찾지 못했습니다 — 조문 번호가 바뀌었는지 확인 필요</div>';
      }catch(e){ html += '<div class="la-msg err">「'+esc(r.name)+'」: '+esc(e.message)+'</div>'; }
    }
    box.innerHTML = html || '<div class="la-msg">조회할 조문 표기를 찾지 못했습니다</div>';
  }

  function init(){
    var tab=document.getElementById('law_tab'); if(!tab || document.getElementById('lawApi')) return;
    var subs=tab.querySelectorAll('.page-sub'), anchor=subs[subs.length-1];
    var wrap=document.createElement('div'); wrap.innerHTML=panelHTML();
    anchor.parentNode.insertBefore(wrap.firstChild, anchor.nextSibling);
    document.getElementById('laGo').onclick=doSearch;
    document.getElementById('laQ').onkeydown=function(e){if(e.key==='Enter')doSearch()};
    document.getElementById('laFind').onclick=find;
    document.getElementById('laArt').onkeydown=document.getElementById('laKw').onkeydown=function(e){if(e.key==='Enter')find()};
    document.getElementById('laClose').onclick=function(){document.getElementById('laLaw').style.display='none';document.querySelectorAll('#laList .la-item').forEach(function(b){b.classList.remove('on')})};
    document.getElementById('laList').onclick=function(e){var b=e.target.closest('.la-item'); if(b) openLaw(b.dataset.mst,b)};
    tab.querySelectorAll('.law-cite .src').forEach(function(src){
      var b=document.createElement('button'); b.className='la-src-btn'; b.textContent='원문'; b.title='법제처 API로 현행 조문 원문 보기';
      b.onclick=function(){showOrig(src.parentNode,b)}; src.appendChild(b);
    });
  }
  window.lawApi = {search:searchLaw, load:loadLaw, resolve:resolveMST, parseRefs:parseRefs};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
