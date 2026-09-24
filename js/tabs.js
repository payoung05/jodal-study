
// ════════════════════════════════════════════════
// 탭 전환
// ════════════════════════════════════════════════
function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  sideMemoFor(id);
  var gf = document.getElementById('gameFrame');   // 게임에서 나가면 시간제 게임 멈춤
  if (id !== 'game_tab' && gf && gf.contentWindow) gf.contentWindow.postMessage('jodal:leave', '*');
  if (id === 'game_tab') {
    var fr = document.getElementById('gameFrame');
    if (!fr.dataset.loaded) {
      var tpl = document.getElementById('gameTpl');   // build.py 단일 파일엔 template로 들어 있음
      if (tpl) fr.srcdoc = tpl.innerHTML; else fr.src = 'game.html';
      fr.dataset.loaded = '1';
    }
  }
  if (id === 'search_tab') {
    var si = document.getElementById('srchInput');
    if (si) setTimeout(function(){ si.focus(); }, 50);
  }
}
// 넓은 화면 오른쪽 메모: 탭마다 따로 저장 (개념 탭은 단계 메모, 게임은 제외)
var MEMO_TABS={num_tab:'수치',law_tab:'법령',quiz_tab:'문제',fc_tab:'카드',weak_tab:'약점',search_tab:'검색'};
function sideMemoFor(id){
  var ed=document.getElementById('sideMemo'); if(!ed) return;
  if(!MEMO_TABS[id]){ delete document.body.dataset.memo; return; }
  document.body.dataset.memo=id;
  document.getElementById('sideMemoLbl').textContent=MEMO_TABS[id]+' 메모';
  try{ ed.innerHTML=localStorage.getItem('tab_note_'+id)||''; }catch(e){ ed.innerHTML=''; }
}
function switchSub(btn){
  var tab=btn.closest('.tab-content');
  tab.querySelectorAll('.sub-content').forEach(function(c){c.classList.remove('active');});
  tab.querySelectorAll('.sub-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById(btn.dataset.sub).classList.add('active');
  btn.classList.add('active');
}

// ═══════════════════════════════════════
// 전체 플로우 타임라인
// ═══════════════════════════════════════
var FLOW_FILTER = 'all'; // all | gs | mp | yy
function setFlowFilter(f){ FLOW_FILTER=f; renderFlow(); }

// ═══════════════════════════════════════
// 계약 흐름 — 통독형 페이지 (STEP 8 + SVG 도해)
// ═══════════════════════════════════════
var FE_C = {ink:'#191F28', dim:'#4E5968', soft:'#8B95A1', line:'#191F28', red:'#E5484D', gs:'#FFC94D', mp:'#86D4A0', yy:'#9DB8FF', bg:'#FFFFFF', surf:'#F2F4F6', blue:'#1F8A4C', gold:'#D9730D'};
function feSvg(w,h,inner){ return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" class="fe-svg">'+inner+'</svg>'; }
function feT(x,y,s,o){ o=o||{}; return '<text x="'+x+'" y="'+y+'" font-size="'+(o.fs||14)+'" font-weight="'+(o.fw||500)+'" fill="'+(o.c||FE_C.ink)+'" text-anchor="'+(o.a||'start')+'"'+(o.op?' opacity="'+o.op+'"':'')+'>'+s+'</text>'; }
function feBox(x,y,w,h,fill,stroke){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+(fill||FE_C.bg)+'" stroke="'+(stroke||FE_C.line)+'" stroke-width="2"/>'; }
function feArrow(x1,y1,x2,y2){ return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+FE_C.ink+'" stroke-width="2"/><polygon points="'+x2+','+y2+' '+(x2-8)+','+(y2-5)+' '+(x2-8)+','+(y2+5)+'" fill="'+FE_C.ink+'"/>'; }

// 01 준비: 금액 파이프라인
function feFigPre(){
  var items=[['추정가격','부가세 제외','계약방법·공고기간 결정'],['기초금액','설계금액 기반','복수예비가격 ±2%'],['예정가격','비공개','낙찰자 결정 기준'],['낙찰금액','낙찰률=낙찰÷예정','70% 미만은 저가낙찰'],['계약금액','= 낙찰금액 (부가세 포함)','보증금·지체상금의 기준']];
  var s='', W=880, bw=150, gap=30, x0=10, y=40;
  items.forEach(function(it,i){
    var x=x0+i*(bw+gap);
    s+=feBox(x,y,bw,60,i===2?FE_C.ink:FE_C.bg);
    s+=feT(x+bw/2,y+27,it[0],{fs:17,fw:800,a:'middle',c:i===2?'#fff':FE_C.ink});
    s+=feT(x+bw/2,y+47,it[1],{fs:12,a:'middle',c:i===2?'#fff':FE_C.dim});
    s+=feT(x+bw/2,y+90,it[2],{fs:12,a:'middle',c:FE_C.dim});
    if(i<items.length-1) s+=feArrow(x+bw+2,y+30,x+bw+gap-2,y+30);
  });
  s+='<line x1="10" y1="150" x2="'+(W-10)+'" y2="150" stroke="'+FE_C.ink+'" stroke-width="1" opacity=".25"/>';
  s+=feT(10,175,'수요 발생 → 예산 확보 → 발주문서 → 계약방법 결정 → 사전규격공개(5천만↑, 5일) → 입찰공고(7일) → 개찰·평가 → 낙찰',{fs:13,c:FE_C.dim});
  return feSvg(W,190,s);
}
// 02 체결: 보증금 비율 막대
function feFigSign(){
  var rows=[['입찰보증금','입찰금액',5,FE_C.surf],['계약보증금 (공사 포함)','계약금액',10,FE_C.mp],['공사이행보증서','계약금액',40,FE_C.gs],['저가낙찰 이행보증 (예정가 70% 미만)','계약금액',50,FE_C.red]];
  var s='', W=880, lx=300, maxw=520, rh=44, y0=14;
  rows.forEach(function(r,i){
    var y=y0+i*rh; var w=maxw*r[2]/50;
    s+=feT(lx-12,y+22,r[0],{fs:14,fw:700,a:'end'});
    s+=feT(lx-12,y+38,r[1]+'의',{fs:11,a:'end',c:FE_C.soft});
    s+='<rect x="'+lx+'" y="'+(y+6)+'" width="'+w+'" height="26" fill="'+r[3]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+=feT(lx+w+10,y+25,r[2]+'%',{fs:18,fw:800,c:i===4?FE_C.red:FE_C.ink});
  });
  return feSvg(W,y0+rows.length*rh+4,s);
}
// 03 착수: 선금 계단 + 70% 한도
function feFigStart(){
  var s='', W=880; var cols=[['공사',[['100억↑',30],['20~100억',40],['20억↓',50]],FE_C.gs],['물품 · 용역',[['10억↑',30],['3~10억',40],['3억↓',50]],FE_C.mp]];
  var chartH=160, base=200, unit=chartH/70;
  s+='<line x1="60" y1="'+(base-70*unit)+'" x2="'+(W-20)+'" y2="'+(base-70*unit)+'" stroke="'+FE_C.red+'" stroke-width="2" stroke-dasharray="6 4"/>';
  s+=feT(W-20,base-70*unit-8,'선금 총 한도 70%',{fs:13,fw:700,c:FE_C.red,a:'end'});
  cols.forEach(function(c,ci){
    var x0=70+ci*420;
    s+=feT(x0,base+44,c[0],{fs:15,fw:800});
    c[1].forEach(function(b,bi){
      var x=x0+bi*120, h=b[1]*unit;
      s+='<rect x="'+x+'" y="'+(base-h)+'" width="96" height="'+h+'" fill="'+c[2]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
      s+=feT(x+48,base-h-8,b[1]+'%',{fs:16,fw:800,a:'middle'});
      s+=feT(x+48,base+20,b[0],{fs:12,a:'middle',c:FE_C.dim});
    });
  });
  s+=feT(60,base+44+22,'의무지급률: 금액이 작을수록 높다 · 요청 후 14일 내 지급 · 선급금보증서(동액) 필수',{fs:12,c:FE_C.dim});
  return feSvg(W,base+80,s);
}
// 04 이행: 분기도
function feFigPerform(){
  var s='', W=880, y=40;
  s+='<line x1="20" y1="'+y+'" x2="'+(W-20)+'" y2="'+y+'" stroke="'+FE_C.ink+'" stroke-width="3"/>';
  s+=feT(20,y-14,'계약이행 본선  ·  기성대가 30일마다  ·  시공일지·중간보고',{fs:13,fw:700});
  var br=[['설계변경','최초 계약 단가 적용','신규 비목은 협의',FE_C.surf],['물가변동(ESC)','90일 경과 + 3% 변동','둘 다 충족해야 청구',FE_C.surf],['지체 발생','공사 0.05 / 물품 0.075 / 용역 0.125 %·일','한도 30% · 불가항력 면제',FE_C.red],['계약 해지','보증금 국고 귀속','기성 정산 후 재발주',FE_C.surf]];
  br.forEach(function(b,i){
    var x=40+i*212;
    s+='<line x1="'+(x+80)+'" y1="'+y+'" x2="'+(x+80)+'" y2="'+(y+40)+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+='<circle cx="'+(x+80)+'" cy="'+y+'" r="5" fill="'+FE_C.ink+'"/>';
    s+=feBox(x,y+40,160,78,b[3]);
    var dark=b[3]===FE_C.red;
    s+=feT(x+80,y+64,b[0],{fs:16,fw:800,a:'middle',c:dark?'#fff':FE_C.ink});
    s+=feT(x+80,y+84,b[1],{fs:11,a:'middle',c:dark?'#fff':FE_C.dim});
    s+=feT(x+80,y+102,b[2],{fs:11,a:'middle',c:dark?'#fff':FE_C.dim});
  });
  s+=feT(40,y+150,'변경은 전부 변경계약서(서면). 구두 합의는 효력 없음',{fs:13,fw:700,c:FE_C.red});
  return feSvg(W,y+170,s);
}
// 05 검사: 타임라인 14일
function feFigInspect(){
  var s='', W=880, y=70;
  var pts=[[40,'이행완료 통지'],[330,'검사 (14일 이내)'],[560,'검사조서'],[820,'대금 청구 가능']];
  s+='<line x1="40" y1="'+y+'" x2="820" y2="'+y+'" stroke="'+FE_C.ink+'" stroke-width="3"/>';
  pts.forEach(function(p,i){ s+='<circle cx="'+p[0]+'" cy="'+y+'" r="8" fill="'+(i===1?FE_C.red:FE_C.bg)+'" stroke="'+FE_C.ink+'" stroke-width="2"/>'; s+=feT(p[0],y+32,p[1],{fs:13,fw:700,a:i===0?'start':i===3?'end':'middle'}); });
  s+='<rect x="140" y="'+(y-46)+'" width="90" height="28" fill="'+FE_C.red+'"/>'+feT(185,y-27,'14일',{fs:16,fw:800,a:'middle',c:'#fff'});
  s+=feT(690,y-26,'불합격 → 보완·재검사',{fs:12,a:'middle',c:FE_C.dim});
  s+=feT(40,y+70,'검사 ≠ 검수: 물품은 납품검수(수량·규격), 공사는 준공검사, 용역은 완료보고 검사',{fs:12,c:FE_C.dim});
  return feSvg(W,y+90,s);
}
// 06 대금: 5일 · 3일 · 30일
function feFigPay(){
  var s='', W=880, y=60;
  function tl(y,a,b,days,note,red){
    s+='<line x1="60" y1="'+y+'" x2="'+(W-60)+'" y2="'+y+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+='<circle cx="60" cy="'+y+'" r="7" fill="'+FE_C.bg+'" stroke="'+FE_C.ink+'" stroke-width="2"/><circle cx="'+(W-60)+'" cy="'+y+'" r="7" fill="'+FE_C.ink+'"/>';
    s+=feT(60,y+26,a,{fs:13,fw:700}); s+=feT(W-60,y+26,b,{fs:13,fw:700,a:'end'});
    s+='<rect x="'+(W/2-45)+'" y="'+(y-16)+'" width="90" height="32" fill="'+(red?FE_C.red:FE_C.ink)+'"/>'+feT(W/2,y+6,days,{fs:17,fw:800,a:'middle',c:'#fff'});
    s+=feT(W/2,y+44,note,{fs:12,a:'middle',c:FE_C.dim});
  }
  tl(y,'검사완료일 · 청구일','대금 지급','5일','초과 시 지연이자 (금융기관 대출평균금리)',true);
  tl(y+95,'불가항력 사유 소멸','대금 지급','3일','천재지변 등으로 지급 불가했던 경우');
  tl(y+190,'장기계속계약 기성','기성대가 지급','30일마다','선금 수령분은 비율만큼 공제');
  return feSvg(W,y+250,s);
}
// 07 하자: 담보기간 막대
function feFigDefect(){
  var rows=[['철근콘크리트 · 철골',10],['방수 · 방습',5],['배관 · 전기',2],['도장 · 타일 마감',1]];
  var s='', W=880, lx=230, maxw=560, rh=40, y0=12;
  rows.forEach(function(r,i){ var y=y0+i*rh, w=maxw*r[1]/10;
    s+=feT(lx-12,y+24,r[0],{fs:14,fw:700,a:'end'});
    s+='<rect x="'+lx+'" y="'+(y+6)+'" width="'+w+'" height="26" fill="'+(i===0?FE_C.gs:FE_C.surf)+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+=feT(lx+w+10,y+25,r[1]+'년',{fs:17,fw:800});
  });
  var yb=y0+rows.length*rh+16;
  s+='<line x1="20" y1="'+yb+'" x2="'+(W-20)+'" y2="'+yb+'" stroke="'+FE_C.ink+'" stroke-width="1" opacity=".25"/>';
  s+=feT(20,yb+28,'하자보수보증금',{fs:13,fw:700});
  var bs=[['공사','공종별 2~10%',FE_C.gs],['물품','3% (필요 시)',FE_C.mp],['용역','2% (필요 시)',FE_C.yy]];
  bs.forEach(function(b,i){ var x=180+i*230; s+='<rect x="'+x+'" y="'+(yb+12)+'" width="14" height="14" fill="'+b[2]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>'; s+=feT(x+22,yb+24,b[0]+'  '+b[1],{fs:13}); });
  s+=feT(20,yb+56,'담보기간 종료 → 보증금 반환. 보수 거부 시 보증금으로 발주기관이 직접 집행',{fs:12,c:FE_C.dim});
  return feSvg(W,yb+70,s);
}
// 08 사후: 이의신청 흐름
function feFigAfter(){
  var s='', W=880, y=56;
  var st=[['이의신청','행위일 30일 / 안 날 25일'],['중앙관서 심사','15일 이내 통지'],['재심 청구','통지 후 30일'],['분쟁조정위 조정','50일 이내 · 재판상 화해 효력'],['소송','행정·민사']];
  var bw=150, gap=30;
  st.forEach(function(p,i){ var x=20+i*(bw+gap);
    s+=feBox(x,y,bw,54,i===3?FE_C.ink:FE_C.bg);
    s+=feT(x+bw/2,y+24,p[0],{fs:15,fw:800,a:'middle',c:i===3?'#fff':FE_C.ink});
    s+=feT(x+bw/2,y+43,p[1],{fs:10.5,a:'middle',c:i===3?'#fff':FE_C.dim});
    if(i<st.length-1) s+=feArrow(x+bw+2,y+27,x+bw+gap-2,y+27);
  });
  s+=feT(20,y+90,'부정당업자 제재: 담합·허위서류·불이행 → 최대 2년 입찰참가 제한 (기존 계약은 자동 무효 아님)',{fs:13,fw:700,c:FE_C.red});
  s+=feT(20,y+114,'부당이득 → 환수 + 가산금 · 정산금액 최종 확정 · 계약이행실적증명 발급',{fs:12,c:FE_C.dim});
  return feSvg(W,y+130,s);
}

var FE_EV = {
  sungum:{ n:'선금 지급', docs:['선금 청구서','선급금보증서 (선금과 동액)'],
    rows:[['한도','계약금액의 70% 초과 불가'],['공사','100억↑ 30% / 20~100억 40% / 20억↓ 50%'],['물품','10억↑ 30% / 3~10억 40% / 3억↓ 50%'],['용역','10억↑ 30% / 3~10억 40% / 3억↓ 50%'],['기한','요청 후 14일 이내 지급']]},
  haeje:{ n:'계약 해제', docs:['계약 해제 통보서','계약보증금 귀속 통보서'],
    rows:[['조건','이행 착수 전 또는 이행 불능'],['공사·물품·용역','계약보증금(계약금액의 10%) 국고 귀속'],['공사 이행보증서','보증기관이 이행하거나 보증금(40%) 납부'],['제재','손해배상·부정당업자 제재 가능']]},
  design:{ n:'설계변경 / 규격·과업 변경', docs:['설계변경 계획서·수량 산출서 (공사)','과업변경지시서 (용역)','변경계약서'],
    rows:[['공사','현장조건 불일치·발주자 요구 → 수량·단가 재산출 → 계약금액 조정'],['물품','사양·규격 변경 합의 → 단가·수량 조정'],['용역','과업지시서 수정 → 과업 추가·삭제·변경'],['단가','최초 계약 단가 적용, 신규 비목은 협의']]},
  esc:{ n:'물가변동 (ESC)', docs:['물가변동 조정 신청서','지수산출내역서 (ES) 또는 품목별 조정내역서','변경계약서'],
    rows:[['조건','계약 후 90일 경과 + 지수 3% 이상 변동'],['방법','품목조정률 또는 지수조정률(ES)'],['공사','자재·노무·경비 지수 적용'],['용역','노무비 비중 높은 용역 적용'],['효력','조정기준일 이후 이행분 소급']]},
  jiche:{ n:'지체 → 지체상금', docs:['지체상금 계산서 (발주기관)','지체 소명서 (면제 신청 시)'],
    rows:[['공사','0.05% / 일 (=1/2000)'],['물품','0.075% / 일'],['용역','0.125% / 일'],['한도','계약금액의 30% · 초과 시 해지 가능'],['면제','천재지변·불가항력·발주자 귀책은 지체일수 제외']]},
  haiji:{ n:'계약 해지', docs:['계약 해지 통보서','기성금·납품분 정산서','부정당업자 제재 요청서 (필요 시)'],
    rows:[['조건','계속 지체·부정당행위·부도·이행포기'],['공사','기성 정산 후 종결, 잔여 공사 재발주'],['물품','납품분 정산, 미납품분 손해배상'],['용역','완료 부분 정산, 미완료 과업 손해배상'],['제재','입찰참가 제한 1개월~2년']]},
  recheck:{ n:'검사 불합격 → 재검사', docs:['불합격 통보서','재시공·반품 요청서','보완 완료 확인서'],
    rows:[['공사','시공 불량 → 재시공 후 재검사'],['물품','수량 부족·품질 불량 → 반품 후 재납품'],['용역','산출물 미흡 → 보완 후 재검수'],['기한','기한 내 보완, 초과 시 지체상금']]},
  haja:{ n:'하자보수', docs:['하자 보수 요청서 (발주기관→업체)','하자보수 착수 신고서','하자보수 완료 확인서'],
    rows:[['공사','철근콘크리트 10년 / 방수 5년 / 배관·전기 2년 / 마감 1년'],['물품','통상 1년'],['용역','3~6개월 (SW 등 별도 약정)'],['미이행','보수 거부 시 보증금으로 직접 집행']]},
  dispute:{ n:'분쟁 → 조정', docs:['조정 신청서 (국가계약분쟁조정위원회)','증거서류·분쟁경위서'],
    rows:[['신청','국가계약분쟁조정위원회'],['공사하자','공사하자심의위원회'],['효력','조정 성립 시 재판상 화해 효력']]},
  jungsan:{ n:'정산 · 환수', docs:['최종 정산서','부당이득 환수 통보서 (필요 시)'],
    rows:[['정산','설계변경·물가변동 모두 반영해 최종 확정'],['지연이자','지급기한 5일 초과 시 대출평균금리로 발생'],['부당이득','과다지급·부정수급 → 환수 + 가산금']]}
};

// ─── 추가 도해: 계약방법 · 공고기간 · 지체상금 ───
function feFigMethod(){
  var s='', W=880;
  var cols=[['공사',FE_C.gs,[['종합공사','4억 이하'],['전문공사','2억 이하'],['그 밖의 공사','1.6억 이하']]],['물품',FE_C.mp,[['일반','2천만 이하'],['우대기업','1억 이하 (1인 견적 5천만)'],['MAS·혁신·우수제품','금액 무관 수의']]],['용역',FE_C.yy,[['일반','2천만 이하'],['우대기업','1억 이하 (1인 견적 5천만)'],['전문용역','협상에 의한 계약']]]];
  s+=feT(20,24,'수의계약 가능 한도 (추정가격 기준)',{fs:14,fw:700});
  cols.forEach(function(c,ci){ var x=20+ci*285;
    s+='<rect x="'+x+'" y="38" width="265" height="30" fill="'+c[1]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>'+feT(x+132,59,c[0],{fs:15,fw:800,a:'middle'});
    c[2].forEach(function(r,ri){ var y=68+ri*40; s+='<rect x="'+x+'" y="'+y+'" width="265" height="40" fill="'+FE_C.bg+'" stroke="'+FE_C.ink+'" stroke-width="1"/>'; s+=feT(x+10,y+17,r[0],{fs:12,c:FE_C.dim}); s+=feT(x+10,y+33,r[1],{fs:14,fw:700}); });
  });
  s+='<line x1="20" y1="205" x2="'+(W-20)+'" y2="205" stroke="'+FE_C.ink+'" stroke-width="1" opacity=".25"/>';
  s+=feT(20,228,'그 위는 경쟁입찰 (원칙 일반경쟁 · 제한 · 지명)  →  공사는 100억↑ 종합심사낙찰제, 200억↑ 주요공종 PQ',{fs:13,fw:700});
  s+=feT(20,250,'금액 판단은 항상 추정가격(부가세 제외). 사전규격공개는 5천만↑ 물품·용역, 최소 5일',{fs:12,c:FE_C.dim});
  return feSvg(W,262,s);
}
function feFigNotice(){
  var rows=[['일반 (마감일 전날 기산)',7,FE_C.surf],['긴급 · 재공고',5,FE_C.surf],['공사 현장설명 無 · 10억↓',7,FE_C.gs],['공사 현장설명 無 · 10~50억',15,FE_C.gs],['공사 현장설명 無 · 50억↑',40,FE_C.gs],['공사 PQ (현장설명일 전)',30,FE_C.gs],['협상계약 제안서 (단축 시 10일)',40,FE_C.yy],['국제입찰 (GPA)',40,FE_C.mp]];
  var s='', W=880, lx=300, maxw=520, rh=36, y0=10;
  rows.forEach(function(r,i){ var y=y0+i*rh, w=maxw*r[1]/40;
    s+=feT(lx-12,y+23,r[0],{fs:13,fw:700,a:'end'});
    s+='<rect x="'+lx+'" y="'+(y+6)+'" width="'+w+'" height="22" fill="'+r[2]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+=feT(lx+w+10,y+23,r[1]+'일',{fs:15,fw:800});
  });
  return feSvg(W,y0+rows.length*rh+6,s);
}
function feFigDelay(){
  var rows=[['공사',0.05,FE_C.gs,'= 1/2000'],['물품 제조·구매',0.075,FE_C.mp,''],['용역·수리·가공·대여',0.125,FE_C.yy,'= 1/800'],['군용 음식료품',0.15,FE_C.surf,''],['운송·보관·양곡가공',0.25,FE_C.surf,'가장 높음']];
  var s='', W=880, lx=260, maxw=460, rh=38, y0=44;
  s+='<rect x="20" y="8" width="'+(W-40)+'" height="28" fill="'+FE_C.ink+'"/>'+feT(W/2,27,'지체상금 = 계약금액 × 지체상금률(1일) × 지체일수   ·   누적 한도 계약금액의 30%',{fs:14,fw:700,a:'middle',c:'#fff'});
  rows.forEach(function(r,i){ var y=y0+i*rh, w=maxw*r[1]/0.25;
    s+=feT(lx-12,y+23,r[0],{fs:13,fw:700,a:'end'});
    s+='<rect x="'+lx+'" y="'+(y+6)+'" width="'+w+'" height="22" fill="'+r[2]+'" stroke="'+FE_C.ink+'" stroke-width="2"/>';
    s+=feT(lx+w+10,y+23,r[1]+'%'+(r[3]?'  '+r[3]:''),{fs:14,fw:800});
  });
  var yb=y0+rows.length*rh+8;
  s+=feT(20,yb+14,'예) 1억 물품 8일 지체 → 1억 × 0.00075 × 8 = 600,000원  ·  천재지변·불가항력·발주자 귀책은 지체일수 제외',{fs:12,c:FE_C.dim});
  return feSvg(W,yb+26,s);
}

// 단계별 부가정보: 도해 · 분기 이벤트 · 시험 함정 매핑
var FE_STEP_EXTRA = {
  doc:{fig:feFigPre},
  method:{fig:feFigMethod},
  notice:{fig:feFigNotice},
  sign:{fig:feFigSign, ev:['sungum','haeje']},
  start:{fig:feFigStart},
  change:{fig:feFigPerform, ev:['design','esc']},
  delay:{fig:feFigDelay, ev:['jiche','haiji']},
  inspect:{fig:feFigInspect, ev:['recheck']},
  pay:{fig:feFigPay},
  defect:{fig:feFigDefect, ev:['haja']},
  after:{fig:feFigAfter, ev:['dispute','jungsan']}
};
var FE_ZONES=[['발주','01–05 · 무엇을 얼마에 어떻게 살지 정한다'],['입찰','06–10 · 공고에서 낙찰까지'],['계약·이행','11–16 · 체결하고, 시작하고, 변경하고, 검사한다'],['대금·사후','17–20 · 돈을 닫고 하자와 분쟁을 처리한다']];

function renderFlow(){
  var root=document.getElementById('flow_root'); if(!root) return;
  var TYPE={gs:'공사',mp:'물품',yy:'용역'};
  function rowType(l){ if(l.indexOf('공사')>=0)return 'gs'; if(l.indexOf('물품')>=0)return 'mp'; if(l.indexOf('용역')>=0)return 'yy'; return null; }
  function hl(v){ return String(v).replace(/(\d+(?:\.\d+)?\s*%|\d+억|\d+일|\d+년|\d+개월|\d+천만)/g,'<b class="fl-hl">$1</b>'); }
  function evHtml(keys){
    if(!keys) return '';
    return '<div class="fe-evs"><div class="fe-lbl">이 단계에서 갈라지는 일</div>'+keys.map(function(k){
      var e=FE_EV[k]; var rows=e.rows.slice();
      if(FLOW_FILTER!=='all') rows=rows.filter(function(r){var t=rowType(r[0]);return !t||t===FLOW_FILTER;});
      return '<div class="fe-ev"><div class="fe-ev-n">'+e.n+'</div>'+rows.map(function(r){var t=rowType(r[0]);return '<div class="fe-ev-row"><span class="fl-chip '+(t||(/면제|한도|미이행|제재/.test(r[0])?'warn':''))+'">'+r[0]+'</span><span class="fl-val">'+hl(r[1])+'</span></div>';}).join('')+
        (e.docs?'<div class="fe-ev-docs">'+e.docs.join(' · ')+'</div>':'')+'</div>';
    }).join('')+'</div>';
  }
  function cmpHtml(c){
    var cols=[['gs','공사',c.gs],['mp','물품',c.mp],['yy','용역',c.yy]];
    return '<div class="fe-cmp">'+cols.map(function(k){ var dim=(FLOW_FILTER!=='all'&&FLOW_FILTER!==k[0]); return '<div class="fe-cmp-cell c-'+k[0]+(dim?' dim':'')+'"><div class="cmp-type">'+k[1]+'</div><div class="cmp-text">'+hl(k[2])+'</div></div>'; }).join('')+'</div>';
  }
  var h='<div class="page-title">계약 흐름 <span>20단계</span></div><div class="page-sub">수요 발생부터 사후관리까지. 모든 단계에 공사·물품·용역을 나란히 놓았다</div>';
  h+='<div class="fl-filters">';
  [['all','전체'],['gs','공사'],['mp','물품'],['yy','용역']].forEach(function(f){ h+='<button class="'+(FLOW_FILTER===f[0]?'active':'')+'" data-act="flowFilter" data-f="'+f[0]+'">'+f[1]+'</button>'; });
  h+='</div>';
  if(FLOW_FILTER!=='all') h+='<div class="fl-filter-note">'+TYPE[FLOW_FILTER]+' 강조 중 · 다른 유형은 흐리게 표시</div>';
  // 한눈에 보는 흐름도: 구역 4개를 화살표 블록으로, 안에 단계 이름(누르면 이동)
  h+='<div class="fe-map">'+FE_ZONES.map(function(z,zi){
    var ss=STEPS.filter(function(s,i){return STEP_ZONE[i]===z[0];}), rng=z[1].split(' · ');
    return '<div class="fm-z" style="--zc:'+ZONE_COLOR[z[0]]+';--k:'+zi+'"><div class="fm-no"><small>STEP</small>'+rng[0]+'</div>'+
      '<div class="fm-body"><b>'+z[0]+'</b><p>'+rng[1]+'</p><ol>'+ss.map(function(s){return '<li><a href="#fe_'+s.key+'" data-act="feJump" data-key="'+s.key+'"><span>'+String(s.id).padStart(2,'0')+'</span>'+s.name+'</a></li>';}).join('')+'</ol></div></div>';
  }).join('')+'</div>';
  h+='<nav class="fe-index" id="fe_index">'+STEPS.map(function(s){return '<a href="#fe_'+s.key+'" data-act="feJump" data-key="'+s.key+'"><b>'+String(s.id).padStart(2,'0')+'</b>'+s.name+'</a>';}).join('')+'</nav>';
  var lastZone='';
  STEPS.forEach(function(s,i){
    var zone=STEP_ZONE[i];
    if(zone!==lastZone){ lastZone=zone; var z=FE_ZONES.find(function(x){return x[0]===zone;})||[zone,''];
      h+='<div class="fe-zone" style="--zc:'+(ZONE_COLOR[zone]||'var(--p-green)')+'"><span class="fe-zone-mark"></span><span class="fe-zone-n">'+z[0]+'</span><span class="fe-zone-d">'+z[1]+'</span></div>'; }
    var ex=FE_STEP_EXTRA[s.key]||{}; var extra=STEP_EXTRA[s.key]||{};
    h+='<section class="fe-step" id="fe_'+s.key+'">';
    h+='<div class="fe-hd"><div class="fe-num">'+String(s.id).padStart(2,'0')+'</div><div><div class="fe-ttl">'+s.name+'</div><div class="fe-thesis">'+s.tagline+'</div></div></div>';
    if(ex.fig) h+='<div class="fe-fig">'+ex.fig()+'</div>';
    h+='<div class="fe-body"><p>'+hl(s.desc)+'</p></div>';
    h+='<div class="fe-kv"><div class="fe-kv-row"><span class="fe-lbl">핵심 수치</span><div>'+numTable(s.numbers)+'</div></div><div class="fe-kv-row"><span class="fe-lbl">관련 문서</span>'+docChips(s.docs)+'</div><div class="fe-kv-row"><span class="fe-lbl">시험 포인트</span>'+pointList(s.examPoint)+'</div></div>';
    h+='<div class="fe-lbl mt-20">공사 · 물품 · 용역</div>'+cmpHtml(s.compare);
    if(extra.trap&&extra.trap.length) h+='<blockquote class="fe-trap"><span class="fe-lbl">시험 함정</span>'+extra.trap.map(function(t){return '<div>'+hl(t)+'</div>';}).join('')+'</blockquote>';
    h+=evHtml(ex.ev);
    h+='</section>';
  });
  root.innerHTML=h;
}
function feJump(ev,key){ ev.preventDefault(); var el=document.getElementById('fe_'+key); if(!el) return; var sc=el.closest('.sub-content')||el.closest('.tab-content'); var idx=document.getElementById('fe_index'); var off=(idx?idx.offsetHeight:0)+52; if(sc){ sc.scrollTo({top:el.offsetTop-off,behavior:'smooth'}); } }

let STEP_SEL = 1;
function selectStep(id){ STEP_SEL = id; renderStepDetail(); var d=document.getElementById('step_root'); if(d) d.scrollTop=0; }
const STEP_ZONE = ['발주','발주','발주','발주','발주','입찰','입찰','입찰','입찰','입찰','계약·이행','계약·이행','계약·이행','계약·이행','계약·이행','계약·이행','대금·사후','대금·사후','대금·사후','대금·사후'];
const ZONE_COLOR = {'발주':'var(--z1)','입찰':'var(--z2)','계약·이행':'var(--z3)','대금·사후':'var(--z4)'};
function renderStepIndex(){
  const root = document.getElementById('step_index'); if(!root) return;
  let x = '<div class="sp-head"><div class="kicker">'+STEPS.length+'단계</div><div class="ttl">계약 흐름</div></div><div class="sp-tiles">';
  STEPS.forEach((s,i)=>{
    const z=STEP_ZONE[i]||'발주', zc=ZONE_COLOR[z];
    if(z!==STEP_ZONE[i-1]) x += '<div class="sp-zone" style="--zc:'+zc+'">'+z+'<span>'+((FE_ZONES.find(f=>f[0]===z)||['',''])[1].split(' · ')[0])+'</span></div>';
    x += '<button class="sp-tile'+(s.id===STEP_SEL?' sel':'')+'" style="--zc:'+zc+'" data-act="goStep" data-id="'+s.id+'">'+
      '<span class="tn"><span>'+String(s.id).padStart(2,'0')+'</span><span class="tz"></span></span>'+
      '<span class="tl">'+s.name+'</span></button>';
  });
  x += '</div>';
  root.innerHTML = x;
}
function setExamDate(){ var cur=localStorage.getItem('exam_date')||''; var v=prompt('시험일을 입력하세요 (YYYY-MM-DD)', cur); if(v===null) return; if(v.trim()==='') localStorage.removeItem('exam_date'); else localStorage.setItem('exam_date', v.trim()); renderDday(); }
function renderDday(){ var el=document.getElementById('ddayN'); if(!el) return; var d=localStorage.getItem('exam_date'); if(!d){ el.textContent='설정'; return; } var t=new Date(d); if(isNaN(t)){ el.textContent='설정'; return; } var diff=Math.ceil((t - new Date().setHours(0,0,0,0))/86400000); el.textContent = diff>=0 ? 'D-'+diff : 'D+'+(-diff); }


// 단계별 보강 데이터: 실무 체크리스트 + 시험 함정
const STEP_EXTRA = {
  need:{check:['차년도 사업계획에 수요 반영 여부 확인','소요량 산출 근거 문서화','기존 계약(MAS·단가계약)으로 충당 가능한지 검토'],
        trap:['수요 단계에서는 금액 미확정 — 추정가격 산정은 예산 단계','과다 산정 → 예산 불용 / 과소 산정 → 추가 발주 문제']},
  budget:{check:['추정가격 = 부가세 제외로 산정했는지','원가계산서·산출 근거 보관','회계연도 내 집행 가능 여부 검토'],
        trap:['추정가격(부가세 제외·계약방법 기준) vs 예정가격(낙찰자 결정 기준) 구분','계상·책정·산정 용어 바꿔치기 출제 단골']},
  doc:{check:['특정 업체에 유리한 규격·사양 배제','업종 매칭: 공사→설계서 / 물품→규격서 / 용역→과업지시서','내역서 물량·단가 교차 검증'],
        trap:['RFP(제안요청서)는 용역·협상계약에서 사용','설계서 = 설계도면 + 시방서 + 내역서 구성 출제']},
  method:{check:['추정가격 기준으로 계약방법 판단','수의계약 시 사유서 필수 작성','소액 기준 암기: 종합공사 4억 / 전문공사 2억 / 기타 1억6천 / 물품·용역 2천만원'],
        trap:['원칙은 일반경쟁 — 제한·지명·수의는 예외','금액 판단 기준은 추정가격(부가세 제외)']},
  pre:{check:['나라장터 사전규격공개 등록','의견 접수 기간 확보(최소 5일)','접수 의견 검토·회신 기록 보관'],
        trap:['사전규격공개 ≠ 입찰공고 — 별도 절차','합리적 의견은 규격 수정에 반영 가능']},
  notice:{check:['공고기간: 일반 7일 / 긴급·재공고 5일 / 협상계약 40일 충족 확인','공사: 현장설명 유무·PQ 여부로 기간 달라짐 (7일 / 30일 / 금액별 7·15·40일)','공고 내용과 발주문서 일치 확인'],
        trap:['기산 기준은 마감일 전날부터 — 공고일 아님','협상계약 40일은 제안서 마감 기준 (단축 시 10일)','정정공고는 남은 기간에 5일 이상 추가','현장설명 없는 공사: 10억↓ 7일 / 10~50억 15일 / 50억↑ 40일 바꿔치기 출제']},
  submit:{check:['마감 시각 엄수(전자입찰 서버 시간 기준)','입찰보증금 납부 또는 면제 확인','제안서 필수 서식 누락 점검'],
        trap:['마감 후 제출은 무효','입찰보증금 미납은 입찰 무효 사유']},
  open:{check:['개찰 일시·장소 공고 내용 확인','전자개찰 자동 진행 확인','유효 입찰 수 충족 확인'],
        trap:['개찰 ≠ 낙찰 — 개찰 후 적격심사 등 절차가 남음']},
  eval:{check:['사전 공개한 평가 기준 그대로 적용','적격심사·기술평가 점수 산정 검증','평가위원 제척·기피 사유 확인'],
        trap:['적격심사(공사·물품 위주) vs 협상에 의한 계약(용역) 평가 방식 구분']},
  win:{check:['낙찰자 결정 통보','계약 체결 기한 안내','계약보증금 납부 안내'],
        trap:['낙찰 후 정당한 사유 없이 계약 미체결 시 부정당업자 제재 대상']},
  sign:{check:['계약서·계약보증금 납부 확인','청렴계약 이행 서약','선금 신청 여부 확인'],
        trap:['계약보증금은 공사도 10% — "공사 15%"는 틀린 보기 (15%는 용역계약일반조건의 용역 이행보증 방식)','구두 약정은 효력 없음 — 서면 원칙']},
  start:{check:['착공계/착수계 제출','선금 청구 시 선급금보증서(선금과 동액) 첨부','산재·고용보험 가입증명 확인'],
        trap:['선금은 요청 후 14일 이내 지급','선금 비율은 계약금액 구간별 차등(30/40/50%)']},
  perform:{check:['기성검사·진행보고 주기 관리','현장 기록(사진·일지) 유지','세금계산서 발행 시점 확인'],
        trap:['기성금은 기성검사 후 지급','공사=기성검사 / 용역=진행보고 매칭 출제']},
  change:{check:['변경계약서 서면 작성(구두 합의 무효)','설계변경·물가변동·기간연장 사유 구분','변경 내역서 첨부'],
        trap:['물가변동(ESC): 90일 경과 + 3% 변동 동시 충족','설계변경 vs 계약변경 vs 물가변동 구분 출제 단골']},
  delay:{check:['지체일수 산정 시 면제 사유 제외','요율 적용: 공사 0.05 / 물품 0.075 / 용역 0.125 (%/일)','한도 30% 초과 시 해지 검토'],
        trap:['천재지변·발주자 귀책은 지체일수에서 제외','업종별 요율 바꿔치기 출제 단골']},
  inspect:{check:['검사 신청 접수일 기록','검사(검수)조서 작성','불합격 시 보완 기한 통보'],
        trap:['검사 합격이 대금 청구의 전제','재검사 기간과 지체상금 관계 출제']},
  claim:{check:['검사(검수) 완료 후 청구','세금계산서·청구서 금액 일치 확인','계좌 정보 확인(초회)'],
        trap:['대금 청구는 검사 합격 후 가능 — 순서 문제 출제']},
  pay:{check:['청구 접수 후 5일 이내 지급','선금·기성금 기지급분 공제 확인','지연 시 지연이자 발생 인지'],
        trap:['지급기한 5일 / 초과 시 지연이자 발생','선금 기지급분 공제 누락 주의']},
  defect:{check:['하자보수보증금 증권 확인','하자담보책임기간 기산일 관리','보수 완료 확인서 수령'],
        trap:['공사 하자기간 공종별 상이: 철근콘크리트 10년 / 방수 5년 / 일반마감 1년','보증금률: 공사 2~10% / 물품 3% / 용역 2%']},
  after:{check:['최종 정산서 작성(설계변경·ESC 반영)','계약이행실적증명 발급 대응','계약 문서 보존'],
        trap:['부당이득 → 환수 + 가산금','분쟁조정 신청은 90일 이내']},
};

// 수치 자동 강조: 숫자+단위를 pill로
function hlNum(t){
  return String(t)
    .replace(/(\d+(?:[.,]\d+)?\s*(?:%|억원|억|만원|천만원|년|개월|일|원|개)|1\/\d+)/g,
      '<span class="num-pill">$1</span>')
    .replace(/\s+\/\s+/g,'<br>');
}

// "A / B / C" → 조각들 (괄호 안의 구분자는 나누지 않음)
function splitTop(s,seps){
  const out=[]; let d=0, cur=''; s=String(s);
  for(let i=0;i<s.length;i++){
    const c=s[i]; if(c==='(') d++; else if(c===')') d--;
    const sep=d===0&&seps.find(x=>s.startsWith(x,i));
    if(sep){ out.push(cur.trim()); cur=''; i+=sep.length-1; } else cur+=c;
  }
  if(cur.trim()) out.push(cur.trim());
  return out;
}
// 핵심 수치: 여러 개거나 "구분: 값"이면 표, 하나뿐이면 글 상자
function numTable(s){
  const items=splitTop(s,[' / ']);
  if(items.length<2&&s.indexOf(': ')<0) return '<div class="sd-num-box">'+hlNum(s)+'</div>';
  return '<table class="kv-tbl">'+items.map(it=>{
    let m=it.match(/^([^:]+):\s*(.+)$/)||it.match(/^(.*?[^\d\s(])\s+((?:최대|최소|적어도)?\s*\(?\d.*)$/);
    if(m&&m[1].split('(').length!==m[1].split(')').length) m=null; // "회계연도(매년 1.1~12.31)"처럼 괄호 안에서 자르지 않게
    return m?'<tr><th>'+m[1]+'</th><td>'+hlNum(m[2].replace(/^\((.*)\)$/,'$1'))+'</td></tr>':'<tr><td colspan="2">'+hlNum(it)+'</td></tr>';
  }).join('')+'</table>';
}
const pointList=s=>'<ul class="pt-list">'+splitTop(s,[' / ']).map(p=>'<li>'+p+'</li>').join('')+'</ul>';
const docChips=s=>'<div class="doc-chips">'+splitTop(s,[', ',' / ']).map(p=>'<span>'+p+'</span>').join('')+'</div>';
// 발주 → 입찰 → 계약·이행 → 대금·사후 중 지금 단계 위치 (단계 하나 = 막대 한 칸)
function zoneBar(idx){
  return '<div class="zone-bar" aria-label="전체 20단계 중 '+(idx+1)+'단계">'+[...new Set(STEP_ZONE)].map(z=>{
    const bars=STEP_ZONE.map((x,i)=>x!==z?'':'<i class="'+(i<idx?'done':i===idx?'cur':'')+'"></i>').join('');
    return '<div class="zb-seg'+(STEP_ZONE[idx]===z?' on':'')+'" style="--zc:'+ZONE_COLOR[z]+';flex:'+STEP_ZONE.filter(x=>x===z).length+'"><div class="zb-bars">'+bars+'</div><span>'+z+'</span></div>';
  }).join('')+'</div>';
}

// ═══════════════════════════════════════
// 단계별 상세
// ═══════════════════════════════════════
function renderStepDetail() {
  const root = document.getElementById('step_root');
  if (!root) return;
  renderStepIndex();
  let html = '';
  const curIdx = STEPS.findIndex(s => s.id === STEP_SEL);
  STEPS.filter(s => s.id === STEP_SEL).forEach(s => {
    const amts = STEP_AMOUNTS[s.key] || [];
    const savedNote = (()=>{ try{ return localStorage.getItem('step_note_'+s.id)||''; }catch(e){return '';} })();

    // 실무 체크리스트 + 시험 함정
    const ex = STEP_EXTRA[s.key];
    let extraHtml = '';
    if (ex) {
      const hlNum = v => v.replace(/(\d+\.?\d*%|\d+억|\d+일|\d+년|\d+개월|\d+천만원|\d+억6천|1억6천)/g,
        '<span class="hl-num">$1</span>');
      const trapNum = v => v.replace(/(\d+\.?\d*%|\d+억|\d+일|\d+년|\d+개월|\d+천만원|\d+억6천|1억6천)/g,
        '<span class="hl-trap">$1</span>');
      if (ex.check && ex.check.length) {
        extraHtml += '<div class="sd-sec-title">실무 체크리스트</div>';
        extraHtml += '<div class="sd-check">';
        ex.check.forEach(c => {
          extraHtml += '<div class="sd-check-row"><span></span><span>'+hlNum(c)+'</span></div>';
        });
        extraHtml += '</div>';
      }
      if (ex.trap && ex.trap.length) {
        extraHtml += '<div class="sd-sec-title">시험 함정</div>';
        extraHtml += '<div class="sd-trap">';
        ex.trap.forEach((c,ci) => {
          extraHtml += '<div class="sd-trap-row"><b>'+(ci+1)+'</b><span>'+trapNum(c)+'</span></div>';
        });
        extraHtml += '</div>';
      }
    }

    // 핵심 용어 버튼
    let termsHtml = s.terms.map((t,ti) =>
      `<button class="sd-term" data-act="term" data-key="${s.id}_${ti}">${t.w}</button>`
    ).join('');
    let termDetailsHtml = s.terms.map((t,ti) =>
      `<div class="sd-term-detail" id="td_${s.id}_${ti}">${t.d}</div>`
    ).join('');

    // 오른쪽 사이드바: 금액 용어 + 고정 메모
    const amtBlock = amts.length ?
      '<div class="sd-amt"><div class="sd-amt-ttl">금액 용어</div>'+
      amts.map(a=>
        '<div class="sd-amt-item"><div class="sd-amt-hd">'+
        '<span class="sd-amt-act">'+a.action+'</span><span class="sd-amt-term">'+a.term+'</span>'+
        (a.sub?'<span class="sd-amt-sub">('+a.sub+')</span>':'')+
        '</div><div class="sd-amt-desc">'+a.desc+'</div>'+
        '</div>'
      ).join('')+
      '</div>' : '';

    const noteBlock =
      '<div class="sd-note"><div class="sd-note-hd"><span class="sd-note-lbl">메모</span>'+
        '<button class="sd-note-bold" data-act="bold" aria-label="굵게">B</button></div>'+
      '<div class="sd-note-ed" id="snote_'+s.id+'" data-step="'+s.id+'" contenteditable="true" data-placeholder="여기에 메모...">'+savedNote+'</div>'+
      '</div>';

    html += `
      <div class="sd-card sd-layout" style="--sc:${s.color}" id="sd_${s.id}">

        <!-- 왼쪽 본문 -->
        <div class="sd-main">
          <div class="sd-head">${zoneBar(curIdx)}<div class="sd-kicker">${s.id}단계 · ${STEP_ZONE[curIdx]||''}</div><div class="sd-name">${s.name}</div><div class="sd-tagline">${s.tagline}</div></div>
          <div class="sd-body">
            <div class="sd-sec-title">개요</div>
            <div class="sd-desc">${s.desc}</div>
            <div class="sd-sec-title">핵심 용어</div>
            <div class="sd-terms">${termsHtml}</div>
            <div>${termDetailsHtml}</div>
            <div class="sd-sec-title">관련 문서</div>
            ${docChips(s.docs)}
            <div class="sd-sec-title">핵심 수치</div>
            ${numTable(s.numbers)}
            <div class="sd-sec-title">시험 포인트</div>
            ${pointList(s.examPoint)}
            ${extraHtml}
            <div class="sd-sec-title">공사 · 물품 · 용역 차이</div>
            <div class="cmp-grid">
              <div class="cmp-cell c-gs"><div class="cmp-type">공사</div><div class="cmp-text">${s.compare.gs}</div></div>
              <div class="cmp-cell c-mp"><div class="cmp-type">물품</div><div class="cmp-text">${s.compare.mp}</div></div>
              <div class="cmp-cell c-yy"><div class="cmp-type">용역</div><div class="cmp-text">${s.compare.yy}</div></div>
            </div>
          </div>
        </div>

        <!-- 오른쪽 사이드바 -->
        <div class="sd-side">
          ${amtBlock}${noteBlock}
        </div>

      </div>`;
  });
  const prev = STEPS[curIdx-1], next = STEPS[curIdx+1];
  html += '<div class="sp-nav">'+(prev?'<button data-act="goStep" data-id="'+prev.id+'">← '+String(prev.id).padStart(2,'0')+' '+prev.name+'</button>':'<span></span>')+(next?'<button class="next" data-act="goStep" data-id="'+next.id+'">'+String(next.id).padStart(2,'0')+' '+next.name+' →</button>':'')+'</div>';
  root.innerHTML = html;
}


function toggleTerm(key, el) {
  const detail = document.getElementById('td_' + key);
  if (!detail) return;
  const isOpen = detail.classList.contains('show');
  const card = el.closest('.sd-card');
  card.querySelectorAll('.sd-term-detail.show').forEach(d => d.classList.remove('show'));
  card.querySelectorAll('.sd-term.active').forEach(t => t.classList.remove('active'));
  if (!isOpen) {
    detail.classList.add('show');
    el.classList.add('active');
  }
}

// ═══════════════════════════════════════
// 공사·물품·용역 비교 (테이블)
// ═══════════════════════════════════════
// 사업 유형별 절차 매트릭스 데이터
const BIZ_MATRIX = [
  { type:'공사', icon:'', color:'#D9730D',
    items:[
      { name:'일반 공사', tag:'기본형',
        rows:[
          ['계약방법','종합공사 4억원↓ / 전문공사 2억원↓ / 기타 1억6천만원↓ 수의 / 그 외 경쟁입찰'],
          ['사전심사','200억원 이상 주요 공종 PQ 적용'],
          ['낙찰자 결정','100억 미만 적격심사 / 100억↑ 종합심사낙찰제'],
          ['발주문서','설계서 · 도면 · 시방서 · 물량내역서'],
          ['보증금','입찰 5% / 계약 10% / 이행보증서 40% / 저가낙찰 50%'],
          ['지체상금률','0.05% / 일 (한도 30%)'],
          ['하자담보','1~10년 공종별 (철근콘크리트 10년)'],
          ['선금 의무','100억↑ 30% / 20~100억 40% / 20억 미만 50%'],
        ]},
      { name:'일괄입찰 (턴키)', tag:'설계+시공',
        rows:[
          ['특징','설계와 시공을 하나의 업체가 일괄 수행'],
          ['적용','대형·복잡 공사'],
          ['평가','기술제안서 + 가격 종합 평가'],
        ]},
      { name:'대안입찰', tag:'대안 허용',
        rows:[
          ['특징','원안 외에 업체 대안설계 제안 가능'],
          ['장점','비용 절감액 발주기관·업체 분배'],
          ['적용','일정 규모 이상 공사에 선택적'],
        ]},
      { name:'기술제안입찰', tag:'기술 평가 중심',
        rows:[
          ['특징','기술제안서 평가를 통해 낙찰자 결정'],
          ['적용','기술집약 대형 공사'],
        ]},
    ]},
  { type:'물품', icon:'', color:'#191F28',
    items:[
      { name:'일반 물품 (제조·구매)', tag:'기본형',
        rows:[
          ['계약방법','2천만원 이하 수의 / 그 외 경쟁입찰'],
          ['낙찰자 결정','최저가 또는 적격심사 (물품 낙찰하한율 86.245%·조달청 고시금액 미만)'],
          ['발주문서','규격서 · 구매사양서 · 시방서'],
          ['보증금','입찰 5% / 계약 10%'],
          ['지체상금률','0.075% / 일 (군용음식료 0.15%, 운송 0.25%)'],
          ['하자보수보증금','필요시 3%'],
          ['선금 의무','10억↑ 30% / 3~10억 40% / 3억 미만 50%'],
        ]},
      { name:'MAS (다수공급자계약)', tag:'쇼핑몰',
        rows:[
          ['특징','다수 공급자와 미리 계약 → 수요기관이 종합쇼핑몰에서 선택'],
          ['2단계경쟁','일정 금액 이상 의무 (재해복구·방역 긴급 예외)'],
          ['관련','카탈로그계약 · 디지털서비스계약 포함'],
        ]},
      { name:'외자구매', tag:'수입',
        rows:[
          ['특징','해외 물품 구매'],
          ['요건','수입 가능성·관세·규격 사전 검토'],
        ]},
      { name:'혁신·우수조달물품', tag:'수의 가능',
        rows:[
          ['혁신제품','지정 후 수의계약 가능 / 혁신장터 거래 / 지정 기간 통상 3년'],
          ['우수조달물품','조달청 지정 / 종합쇼핑몰 우선구매'],
          ['벤처나라','벤처기업 인증 제품 우선구매'],
        ]},
    ]},
  { type:'용역', icon:'', color:'#1F8A4C',
    items:[
      { name:'일반 용역', tag:'기본형',
        rows:[
          ['계약방법','2천만원 이하 수의 / 그 외 경쟁입찰'],
          ['낙찰자 결정','적격심사'],
          ['발주문서','과업지시서 · 제안요청서(RFP)'],
          ['보증금','입찰 5% / 계약 10%'],
          ['지체상금률','0.125% / 일 (수리·가공·대여 등 동일)'],
          ['하자보수보증금','필요시 2%'],
          ['선금 의무','10억↑ 30% / 3~10억 40% / 3억 미만 50%'],
        ]},
      { name:'협상에 의한 계약', tag:'전문용역',
        rows:[
          ['특징','기술평가 후 고득점자 순으로 가격협상'],
          ['배점','통상 기술 60 + 가격 40'],
          ['체결','협상 성립 후 10일 이내 계약'],
          ['적용','컨설팅 · IT개발 · 연구 등 전문용역'],
        ]},
      { name:'경쟁적 대화 방식', tag:'복잡 과업',
        rows:[
          ['특징','발주자와 입찰자가 대화를 통해 과업 구체화'],
          ['적용','복잡·혁신 과업 (사양 사전 확정 어려운 경우)'],
        ]},
      { name:'기술용역 (설계·감리)', tag:'건진법',
        rows:[
          ['특징','설계·감리 등 건설기술 용역'],
          ['낙찰','협상에 의한 계약 활용'],
          ['법령','건설기술진흥법 적용'],
        ]},
      { name:'e-발주 시스템', tag:'전자화',
        rows:[
          ['특징','용역 발주 전 과정 전자적 처리'],
          ['지원','제안서 접수·평가·결과 통보 자동화'],
        ]},
    ]},
];

function renderCmp() {
  const root = document.getElementById('cmp_root');
  if (!root) return;
  const CLS={'공사':'gs','물품':'mp','용역':'yy'};
  // 1. 사업 유형별 매트릭스
  let matrixHtml = BIZ_MATRIX.map(b => {
    const c=CLS[b.type]||'';
    let items = b.items.map(it => {
      let rows = it.rows.map(r => '<tr><th>'+r[0]+'</th><td>'+r[1]+'</td></tr>').join('');
      return '<div class="bm-item"><div class="bm-item-hd"><span class="bm-name">'+it.name+'</span><span class="bm-tag">'+it.tag+'</span></div><table class="bm-kv">'+rows+'</table></div>';
    }).join('');
    return '<div class="bm-card '+c+'"><div class="bm-hd">'+b.type+' 사업별 절차</div>'+items+'</div>';
  }).join('');
  // 2. 20단계 비교 테이블
  let rows = STEPS.map(s => '<tr><td>'+s.id+'. '+s.name+'</td><td>'+s.compare.gs+'</td><td>'+s.compare.mp+'</td><td>'+s.compare.yy+'</td></tr>').join('');
  root.innerHTML = '<div class="page-title">물품 · 용역 · 공사 비교</div>'+
    '<div class="page-sub">사업 유형별로 따라붙는 절차 한눈에 + 20단계 비교</div>'+
    '<div class="section-hd">사업 유형별 절차 매트릭스</div>'+
    matrixHtml+
    '<div class="section-hd">20단계 비교 테이블</div>'+
    '<div class="tbl-wrap"><table class="cmptab"><thead><tr><th class="th-step">단계</th><th class="gs">공사</th><th class="mp">물품</th><th class="yy">용역</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

const FC_ALL_CATS=['전체','모른 것만',...[...new Set(CARDS.map(c=>c.cat))]];
const CAT_COLORS={'영어 약어':'#3268E8','공공조달 개요':'#3268E8','공공조달 원칙':'#191F28','전자조달':'#1F8A4C','전략적 조달':'#D9730D','민법·계약':'#E5484D','공정조달':'#D9730D','입찰공고':'#3268E8','낙찰방법':'#191F28','계약관리':'#1F8A4C','MAS':'#D9730D','공사계약':'#E5484D','회계 기초':'#D9730D'};

let fcState={cat:'전체',idx:0,flipped:false,known:new Set(),unk:new Set()};

function fcGetPool(cat){
  if(cat==='모른 것만') return CARDS.filter((_,i)=>fcState.unk.has(i));
  const base=cat==='전체'?CARDS:CARDS.filter(c=>c.cat===cat);
  return base.filter(c=>!fcState.known.has(CARDS.indexOf(c)));
}

function fcRender(){
  const root=document.getElementById('fc_root');
  const pool=fcGetPool(fcState.cat);
  const si=pool.length>0?fcState.idx%pool.length:0;
  const cur=pool[si];
  const ri=cur?CARDS.indexOf(cur):-1;
  const isUnk=fcState.unk.has(ri);
  const total=fcState.cat==='전체'?CARDS.length:fcState.cat==='모른 것만'?fcState.unk.size:CARDS.filter(c=>c.cat===fcState.cat).length;
  const knownN=fcState.cat==='전체'?fcState.known.size:fcState.cat==='모른 것만'?0:CARDS.filter((c,i)=>c.cat===fcState.cat&&fcState.known.has(i)).length;
  const prog=total>0?Math.round(knownN/total*100):0;
  const ac=cur?(CAT_COLORS[cur.cat]||'#3268E8'):'#3268E8';

  let catsHtml=FC_ALL_CATS.map(c=>{
    const isU=c==='모른 것만';
    const sel=fcState.cat===c;
    const col=isU?'#E5484D':'#3268E8';
    return `<button class="fc-cat${sel?' sel':''}" style="--ac:${col}" data-act="fcCat" data-cat="${c}">${c}${isU&&fcState.unk.size>0?' ('+fcState.unk.size+')':''}</button>`;
  }).join('');

  let cardHtml='';
  if(pool.length===0){
    cardHtml=`<div class="fc-empty"><div class="fc-empty-ico"></div><div class="fc-empty-t">${fcState.cat==='모른 것만'?'모른 카드 없음!':'모두 완료!'}</div></div>`;
  } else {
    cardHtml=`<div class="fc-card${fcState.flipped?' flipped':isUnk?' unk':''}" style="--ac:${ac}" data-act="fcFlip">
      <span class="fc-card-cat">${cur.cat}</span>
      ${isUnk?'<span class="fc-unk">✗ 모름</span>':''}
      <span class="fc-card-hint">${fcState.flipped?'앞면':'탭→정답'}</span>
      <span class="fc-card-pos">${si+1}/${pool.length}</span>
      ${!fcState.flipped
        ?`<div class="fc-term">${cur.term}</div>`
        :`<div><div class="fc-term-sm">${cur.term}</div><div class="fc-def">${cur.def}</div></div>`
      }
    </div>`;
  }

  let btnsHtml=pool.length>0?`<div class="fc-btns">
    <button class="btn c-text" data-act="fcKnow">✓ 알았어</button>
    <button class="btn c-red" data-act="fcUnknow">✗ 몰라</button>
    <button class="btn c-gray" data-act="fcNext">→ 다음</button>
    <button class="btn c-ink" data-act="fcReset">↺ 초기화</button>
  </div>`:'';

  root.innerHTML=`
    <div class="fc-cats">${catsHtml}</div>
    <div class="fc-stats">
      <span>전체 ${total}</span>
      <span class="ok">✓ ${knownN}</span>
      <span class="ng">✗ ${fcState.unk.size}</span>
      <span>남은 ${pool.length}</span>
    </div>
    <div class="fc-bar"><div class="fc-bar-fill" style="width:${prog}%"></div></div>
    ${cardHtml}
    ${btnsHtml}
  `;
}

function fcSetCat(c){fcState={...fcState,cat:c,idx:0,flipped:false};fcRender();}
function fcFlip(){fcState.flipped=!fcState.flipped;fcRender();}
function fcNext(){fcState.flipped=false;const pool=fcGetPool(fcState.cat);fcState.idx=(fcState.idx+1)%Math.max(pool.length,1);fcRender();}
function fcKnow(){
  const pool=fcGetPool(fcState.cat);
  const cur=pool[fcState.idx%Math.max(pool.length,1)];
  if(!cur)return;
  const ri=CARDS.indexOf(cur);
  fcState.known.add(ri);fcState.unk.delete(ri);
  fcState.flipped=false;
  const newPool=fcGetPool(fcState.cat);
  fcState.idx=fcState.idx%Math.max(newPool.length,1);
  fcRender();
}
function fcUnknow(){
  const pool=fcGetPool(fcState.cat);
  const cur=pool[fcState.idx%Math.max(pool.length,1)];
  if(!cur)return;
  fcState.unk.add(CARDS.indexOf(cur));
  fcState.flipped=false;
  fcState.idx=(fcState.idx+1)%Math.max(pool.length,1);
  fcRender();
}
function fcReset(){fcState={...fcState,known:new Set(),unk:new Set(),idx:0,flipped:false};fcRender();}

// ─────────────────────────────────────
// 약점분석
// ─────────────────────────────────────
function renderWeak(){
  const r=document.getElementById('weak_root');
  if(!r) return;
  const pNotes=store.get('wrong_notes',{}),sNotes=store.get('prac_wrong',{});
  
  // 필기 통계: 과목별·태그별 오답수
  const pBySubj={}, pByTag={}, pByMajor={};
  Object.values(pNotes).forEach(function(q){
    pBySubj[q.subject]=(pBySubj[q.subject]||0)+1;
    pByMajor[q.major]=(pByMajor[q.major]||0)+1;
    (q.tag||[]).forEach(function(t){pByTag[t]=(pByTag[t]||0)+1;});
  });
  // 실기 통계
  const sByType={}, sByMajor={};
  Object.values(sNotes).forEach(function(q){
    sByType[q.type]=(sByType[q.type]||0)+1;
    sByMajor[q.major]=(sByMajor[q.major]||0)+1;
  });
  
  function topN(obj,n){
    return Object.entries(obj).sort(function(a,b){return b[1]-a[1];}).slice(0,n);
  }
  // 가로 막대: 한 색(파랑)만, 1위만 진하게 · 값은 막대 끝 글자로 (dataviz: 크기 비교 = 한 색 순차)
  function bars(arr,unit,max){
    if(!arr.length||!arr.some(function(e){return e[1];})) return '<div class="wk-empty">아직 틀린 문제가 없어요.</div>';
    const top=Math.max.apply(null,arr.map(function(e){return e[1];})); max=max||top;
    return '<div class="wk-chart">'+arr.map(function(e,i){
      return '<div class="wk-bar" title="'+e[0]+' — '+e[1]+unit+'"><span class="wk-lbl">'+e[0]+'</span>'+
        '<span class="wk-track"><i class="'+(e[1]===top?'top':'')+'" style="width:'+(e[1]?Math.max(e[1]/max*100,2):0)+'%"></i></span><span class="wk-val">'+e[1]+unit+'</span></div>';
    }).join('')+'</div>';
  }
  const subjTotal={}; QUESTIONS.forEach(function(q){subjTotal[q.subject]=(subjTotal[q.subject]||0)+1;});
  const subjRate=Object.keys(subjTotal).map(function(s){return [s,Math.round((pBySubj[s]||0)/subjTotal[s]*100)];}).sort(function(a,b){return b[1]-a[1];});
  const pN=Object.keys(pNotes).length, sN=Object.keys(sNotes).length, both={}; [pByMajor,sByMajor].forEach(function(o){for(var k in o) both[k]=(both[k]||0)+o[k];}); const worst=topN(both,1)[0];
  
  // 추천 복습
  let recs=[];
  if(worst) recs.push('약한 영역 "'+worst[0]+'" 집중 복습');
  const topTag = topN(pByTag,3);
  if(topTag.length>0){
    if(topTag.some(function(t){return t[0]==='숫자'||t[0]==='계산';}))
      recs.push('필기 "핵심 수치 집중 모드" 20문제');
    if(topTag.some(function(t){return t[0]==='절차'||t[0]==='이행';}))
      recs.push('필기 "계약 플로우 집중 모드" 20문제');
  }
  if(Object.keys(pNotes).length>0) recs.push('필기 "오답 재출제" 모드');
  if(Object.keys(sNotes).length>0) recs.push('실기 "오답 재출제" 모드');
  if(recs.length===0) recs=['아직 데이터가 부족해. 모의고사를 풀어보세요.'];
  
  r.innerHTML = '<div class="flow-title">약점 <span>분석</span></div><div class="flow-sub">오답노트로 본 자주 틀리는 곳</div>'+
    '<div class="wk-kpis">'+
      '<div class="wk-kpi"><div class="k">필기 오답</div><div class="v">'+pN+'<small>/ '+QUESTIONS.length+'문항</small></div></div>'+
      '<div class="wk-kpi"><div class="k">실기 오답</div><div class="v">'+sN+'<small>/ '+PRAC_QUESTIONS.length+'문항</small></div></div>'+
      '<div class="wk-kpi"><div class="k">가장 약한 영역</div><div class="v sm">'+(worst?worst[0]:'—')+'</div></div>'+
    '</div>'+
    (pN+sN===0?'<div class="box wk-start"><div>아직 틀린 문제가 없어요. 모의고사를 풀면 여기에 약한 곳이 쌓여요.</div><button class="btn filled" data-act="tab" data-tab="quiz_tab">모의고사 풀기</button></div>':'')+
    (pN+sN===0?'':'<div class="wk-grid">'+
    '<div class="box"><div class="box-ttl">필기 과목별 틀린 비율</div>'+bars(subjRate,'%',100)+'</div>'+
    '<div class="box"><div class="box-ttl">필기 많이 틀린 영역 TOP 5</div>'+bars(topN(pByMajor,5),'회')+'</div>'+
    '<div class="box"><div class="box-ttl">자주 틀리는 주제 TOP 5</div>'+bars(topN(pByTag,5),'회')+'</div>'+
    '<div class="box"><div class="box-ttl">실기 유형별 오답</div>'+bars(topN(sByType,5),'회')+'</div>'+'</div>'+
    '<div class="box">'+
      '<div class="box-ttl">추천 복습</div>'+
      '<div class="wk-recs">'+recs.map(function(t,i){return (i+1)+'. '+t;}).join('<br>')+'</div>'+
    '</div>')+
    '<div class="box"><div class="box-ttl">학습 기록 옮기기</div>'+
      '<div class="rec-desc">오답노트·메모·포스트잇·게임 기록은 이 기기의 브라우저에만 저장돼요. 파일로 저장해 두면 브라우저를 정리해도 되살리고, PC↔패드로 옮길 수 있어요.</div>'+
      '<div class="rec-btns"><button class="btn filled" data-act="exportRec">기록 저장</button><button class="btn" data-act="importRec">기록 불러오기</button></div>'+
      '<input type="file" id="recFile" accept=".json,application/json" hidden>'+
      '<div class="rec-desc mt-10">앱 버전: '+buildLabel()+'</div>'+
    '</div>';
}


// ─── 자유 배치 포스트잇 ───
var SCOLS=['#fff176','#f8bbd0','#b2f0b2','#b3e5fc','#ffe0b2','#e1bee7'];
var SHDRS=['#f9e84e','#f48fb1','#81c784','#3268E8','#ffb74d','#ce93d8'];
var sZMax=9000;
function sLoad(){return store.get('sticky_v2',[]);}
function sSave(d){store.set('sticky_v2',d);}
function sRenderAll(){
  document.querySelectorAll('.sticky-note').forEach(function(el){el.remove();});
  sLoad().forEach(function(m){sMakeEl(m);});
}
function sMakeEl(m){
  var el=document.createElement('div');
  el.className='sticky-note';
  el.id='s'+m.id;
  el.style.cssText='left:'+m.x+'px;top:'+m.y+'px;background:'+m.color+';z-index:'+sZMax+';';
  // 헤더
  var hd=document.createElement('div');
  hd.className='sticky-header';
  hd.style.background=SHDRS[SCOLS.indexOf(m.color)>=0?SCOLS.indexOf(m.color):0];
  // 색상 도트
  var dots=document.createElement('div');dots.className='sticky-dots';
  SCOLS.forEach(function(col,ci){
    var d=document.createElement('div');
    d.className='sticky-dot';
    d.style.background=col;
    d.style.borderColor=col===m.color?'#191F28':'transparent';
    d.addEventListener('click',function(e){
      e.stopPropagation();
      var arr=sLoad();
      var idx=arr.findIndex(function(n){return n.id===m.id;});
      if(idx>=0){arr[idx].color=col;sSave(arr);sRenderAll();}
    });
    dots.appendChild(d);
  });
  // 삭제
  var del=document.createElement('button');
  del.className='sticky-del';del.innerHTML='';
  del.addEventListener('click',function(e){
    e.stopPropagation();
    sSave(sLoad().filter(function(n){return n.id!==m.id;}));
    el.remove();
  });
  hd.appendChild(dots);hd.appendChild(del);
  // 텍스트
  var ta=document.createElement('textarea');
  ta.className='sticky-ta';ta.value=m.text;ta.placeholder='메모...';
  ta.addEventListener('blur',function(){
    var arr=sLoad();
    var idx=arr.findIndex(function(n){return n.id===m.id;});
    if(idx>=0){arr[idx].text=ta.value;sSave(arr);}
  });
  ta.addEventListener('mousedown',function(e){e.stopPropagation();});
  ta.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
  el.appendChild(hd);el.appendChild(ta);
  // 드래그
  function drag(cx,cy){
    sZMax++;el.style.zIndex=sZMax;
    var ox=cx-el.offsetLeft,oy=cy-el.offsetTop;
    function mv(nx,ny){
      var x=Math.max(0,Math.min(window.innerWidth-el.offsetWidth,nx-ox));
      var y=Math.max(0,Math.min(window.innerHeight-el.offsetHeight,ny-oy));
      el.style.left=x+'px';el.style.top=y+'px';
    }
    function end(nx,ny){
      mv(nx,ny);
      var arr=sLoad();
      var idx=arr.findIndex(function(n){return n.id===m.id;});
      if(idx>=0){arr[idx].x=parseInt(el.style.left);arr[idx].y=parseInt(el.style.top);sSave(arr);}
      document.removeEventListener('mousemove',mM);document.removeEventListener('mouseup',mU);
      document.removeEventListener('touchmove',tM);document.removeEventListener('touchend',tE);
    }
    function mM(e){mv(e.clientX,e.clientY);}
    function mU(e){end(e.clientX,e.clientY);}
    function tM(e){e.preventDefault();mv(e.touches[0].clientX,e.touches[0].clientY);}
    function tE(e){end(e.changedTouches[0].clientX,e.changedTouches[0].clientY);}
    document.addEventListener('mousemove',mM);
    document.addEventListener('mouseup',mU);
    document.addEventListener('touchmove',tM,{passive:false});
    document.addEventListener('touchend',tE);
  }
  hd.addEventListener('mousedown',function(e){drag(e.clientX,e.clientY);});
  hd.addEventListener('touchstart',function(e){e.stopPropagation();drag(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
  document.body.appendChild(el);
}
function stickyNew(){
  var arr=sLoad();
  var col=SCOLS[arr.length%SCOLS.length];
  var m={id:Date.now(),text:'',color:col,
    x:Math.min(60+arr.length*18,window.innerWidth-200),
    y:Math.min(80+arr.length*18,window.innerHeight-150)};
  arr.push(m);sSave(arr);sMakeEl(m);
}

sRenderAll();

function saveStepNote(id, val){
  try{ localStorage.setItem('step_note_'+id, val); }catch(e){}
}

// 초기 렌더

// ═══════ 검색 엔진 ═══════
var SRCH_FILTER='all';
function setSrchFilter(btn){
  document.querySelectorAll('#srchFilters button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  SRCH_FILTER=btn.dataset.f;
  runSearch();
}
function srchEsc(t){return (t==null?'':String(t)).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function srchHi(text,q){
  var e=srchEsc(text);
  if(!q) return e;
  var terms=q.split(/\s+/).filter(Boolean);
  terms.forEach(function(t){
    var rx=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
    e=e.replace(rx,'<mark>$1</mark>');
  });
  return e;
}
function buildSrchIndex(){
  var idx=[];
  QUESTIONS.forEach(function(q){
    idx.push({type:'q', id:q.id,
      title:q.question,
      meta:q.subject+' › '+q.major+(q.sub?' › '+q.sub:'')+'  ['+q.difficulty+']',
      body:(q.options?q.options.join(' '):'')+' '+(q.explanation||''),
      ans:'정답: '+(q.options?q.options[q.answer]:'')+' — '+(q.explanation||''),
      hay:(q.question+' '+(q.options?q.options.join(' '):'')+' '+(q.explanation||'')+' '+q.subject+' '+q.major+' '+(q.sub||'')+' '+(q.tag?q.tag.join(' '):'')).toLowerCase()});
  });
  PRAC_QUESTIONS.forEach(function(q){
    idx.push({type:'p', id:q.id,
      title:q.question,
      meta:q.major+(q.sub?' › '+q.sub:'')+'  ['+q.type+' · '+q.difficulty+']',
      body:(q.modelAnswer||'')+' '+(q.explanation||''),
      ans:'모범답안: '+(q.modelAnswer||'')+(q.explanation?' — '+q.explanation:''),
      hay:(q.question+' '+(q.modelAnswer||'')+' '+(q.explanation||'')+' '+q.major+' '+(q.sub||'')+' '+(q.tag?q.tag.join(' '):'')).toLowerCase()});
  });
  CARDS.forEach(function(c){
    idx.push({type:'c', id:c.term,
      title:c.term,
      meta:c.cat,
      body:c.def,
      ans:c.def,
      hay:(c.term+' '+c.def+' '+c.cat).toLowerCase()});
  });
  return idx;
}
var SRCH_INDEX=null;
function runSearch(){
  if(!SRCH_INDEX) SRCH_INDEX=buildSrchIndex();
  var qraw=document.getElementById('srchInput').value.trim();
  var q=qraw.toLowerCase();
  var hint=document.getElementById('srchHint');
  var res=document.getElementById('srchRes');
  if(q.length<1){ res.innerHTML=''; hint.textContent='키워드를 입력하면 필기·실기 문제와 단어카드를 한 번에 찾습니다.'; return; }
  var terms=q.split(/\s+/).filter(Boolean);
  var hits=SRCH_INDEX.filter(function(it){
    if(SRCH_FILTER!=='all' && it.type!==SRCH_FILTER) return false;
    return terms.every(function(t){return it.hay.indexOf(t)>=0;});
  });
  var labels={q:'필기',p:'실기',c:'카드'};
  hint.textContent='검색 결과 '+hits.length+'건'+(SRCH_FILTER!=='all'?' ('+labels[SRCH_FILTER]+'만)':'');
  if(hits.length===0){ res.innerHTML='<div class="srch-empty">일치하는 내용이 없습니다.<br>다른 키워드로 검색해 보세요.</div>'; return; }
  var typName={q:'필기',p:'실기',c:'카드'};
  res.innerHTML=hits.slice(0,80).map(function(it){
    return '<div class="srch-card">'+
      '<span class="typ '+it.type+'">'+typName[it.type]+'</span>'+
      '<div class="ttl">'+srchHi(it.title,q)+'</div>'+
      '<div class="meta">'+srchEsc(it.meta)+'</div>'+
      '<div class="ans">'+srchHi(it.ans,q)+'</div>'+
    '</div>';
  }).join('')+(hits.length>80?'<div class="srch-empty">상위 80건만 표시 — 키워드를 더 구체적으로 입력하세요.</div>':'');
}

// ─── 빌드 표시: 사이트·오프라인 파일 중 어느 게 최신인지 (js/version.js) ───
const buildLabel=()=>BUILD.commit?'빌드 '+BUILD.time+' · '+BUILD.commit:'개발 버전 (빌드 전 파일)';
function renderBuildStamp(){ const el=document.getElementById('buildStamp'); if(el) el.textContent=buildLabel(); }

// ─── 법령 반영 기록 (data/law-log.js, 매주 점검이 개정을 찾으면 맨 위에 추가) ───
function renderLawLog(){
  const el=document.getElementById('lawLog'); if(!el||typeof LAW_LOG==='undefined'||!LAW_LOG.length) return;
  const d=s=>String(s||'').replace(/^(\d{4})(\d{2})(\d{2})$/,(m,y,mo,da)=>y+'.'+(+mo)+'.'+(+da));
  const last=LAW_LOG[0], news=LAW_LOG.filter(e=>e.kind!=='기준').length;
  el.innerHTML='<summary><b>법령 반영 기록</b><span>'+(news?'개정 '+news+'건 · ':'')+'마지막 '+last.date+'</span></summary>'+
    LAW_LOG.map(e=>'<div class="ll-entry"><div class="ll-hd"><span class="ll-kind k-'+e.kind+'">'+e.kind+'</span>'+e.date+' · '+e.title+'</div>'+
      '<div class="tbl-wrap"><table><thead><tr><th>법령·예규</th><th>시행일</th>'+(e.kind==='기준'?'':'<th>바뀐 내용</th><th>앱 반영</th>')+'</tr></thead><tbody>'+
      e.items.map(i=>'<tr><td>'+i.name+'</td><td class="ll-date">'+d(i.시행일자)+(i.이전?'<br><small>이전 '+d(i.이전)+'</small>':'')+'</td>'+
        (e.kind==='기준'?'':'<td>'+(i.요약||i.제개정||'')+'</td><td>'+(i.앱반영||'확인 중')+'</td>')+'</tr>').join('')+
      '</tbody></table></div></div>').join('');
}

// ─── 화면 버튼 연결: onclick="…" 문자열 대신 data-act (bindActs는 store.js) ───
bindActs(document.body,{
  tab:(d,b)=>switchTab(d.tab,b),
  sub:(d,b)=>switchSub(b),
  examDate:setExamDate,
  stickyNew:stickyNew,
  srchFilter:(d,b)=>setSrchFilter(b),
  flowFilter:d=>setFlowFilter(d.f),
  feJump:(d,b,ev)=>feJump(ev,d.key),
  goStep:d=>selectStep(+d.id),
  term:(d,b)=>toggleTerm(d.key,b),
  bold:()=>document.execCommand('bold'),
  exportRec:exportRecords,
  importRec:()=>document.getElementById('recFile').click(),
  fcCat:d=>fcSetCat(d.cat), fcFlip:fcFlip, fcKnow:fcKnow, fcUnknow:fcUnknow, fcNext:fcNext, fcReset:fcReset,
});
document.addEventListener('mousedown',ev=>{ if(ev.target.closest('[data-act=bold]')) ev.preventDefault(); }); // 메모 포커스 유지
document.getElementById('srchInput').addEventListener('input',runSearch);
document.addEventListener('change',ev=>{ if(ev.target.id==='recFile'&&ev.target.files[0]) importRecords(ev.target.files[0]); });
document.getElementById('sideMemo').addEventListener('input',ev=>{ const id=document.body.dataset.memo; if(id) try{ localStorage.setItem('tab_note_'+id, ev.target.innerHTML); }catch(e){} });
// 단계 메모: 포커스 잃으면 저장, 누르기는 위로 안 올려보냄
(function(){
  const r=document.getElementById('step_root'); if(!r) return;
  r.addEventListener('focusout',ev=>{ const ed=ev.target.closest('.sd-note-ed'); if(ed) saveStepNote(+ed.dataset.step, ed.innerHTML); });
  ['mousedown','touchstart'].forEach(t=>r.addEventListener(t,ev=>{ if(ev.target.closest('.sd-note-ed')) ev.stopPropagation(); }));
})();
