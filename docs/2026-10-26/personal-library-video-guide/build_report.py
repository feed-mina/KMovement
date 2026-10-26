"""Rebuild the self-contained HTML and SVG assets from README.md. Requires Python markdown."""
from pathlib import Path
import html,re
import markdown

ROOT=Path(__file__).resolve().parent
A=ROOT/'assets';A.mkdir(exist_ok=True)
esc=html.escape
FONT="'Malgun Gothic','Noto Sans KR',sans-serif"

def svg_begin(title,w=1140,h=640):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}"><title>{esc(title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs><rect width="{w}" height="{h}" rx="18" fill="#f5f5f0"/><g font-family="{FONT}" fill="#15212c">'
def txt(x,y,t,size=17,weight=400,color='#15212c'):
 return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}">{esc(t)}</text>'
def box(x,y,w,h,label,detail='',fill='white',stroke='#ccd4d9'):
 s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}"/>'
 s+=txt(x+18,y+31,label,18,700)
 if detail:s+=txt(x+18,y+59,detail,14,color='#52606d')
 return s
def arrow(x1,y1,x2,y2,label='',dash=False):
 s=f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#475569" stroke-width="2" fill="none" marker-end="url(#arrow)"'+(' stroke-dasharray="7 5"' if dash else '')+'/>'
 if label:s+=txt((x1+x2)/2+8,(y1+y2)/2-7,label,13,color='#475569')
 return s

def screens(proposed=False):
 s=svg_begin('G2 개선 예상 모형' if proposed else 'G1 코드 기반 현재 화면 재구성',1140,700)
 s+=txt(30,42,'G2 · 개선 예상 모형 / 미구현' if proposed else 'G1 · 현재 코드 기반 재구성 / 운영 캡처 아님',24,700)
 s+=txt(30,72,'모든 이름·숫자·작업 상태는 설명용 예시입니다.',15,color='#586875')
 for x,name in [(28,'마이페이지'),(404,'내 목록'),(780,'내 영상')]:
  s+=f'<rect x="{x}" y="100" width="332" height="558" rx="18" fill="white" stroke="#cfd7dc"/>'
  s+=txt(x+22,138,name,23,700)
  if proposed:
   s+=box(x+20,158,292,53,'내 목록     /     내 영상',fill='#f0f3e6')
  elif name=='마이페이지':s+=txt(x+22,180,'설명용 회원',17)
 if proposed:
  x=28;s+=txt(x+22,248,'나의 보관함',16,700)
  s+=box(x+20,270,292,74,'저장한 목록 보기','아티스트 · 일정 · 상품')
  s+=box(x+20,362,292,74,'A1  내 영상 보기','이전 작업을 확인하고 이어 보기',fill='#fce8dd')
  s+=txt(x+22,480,'총 영상 건수는 표시하지 않음',14,color='#52606d')
  x=404;s+=txt(x+22,249,'아티스트   일정   상품',16,700)
  s+=box(x+20,273,292,88,'설명용 팬 일정','공개     보기     저장 해제')
  s+=txt(x+22,398,'A2  종류·페이지 보존',16,700)
  s+=txt(x+22,430,'내 영상으로 이동해도 원본 유지',14,color='#52606d')
  s+=txt(x+22,602,'이전     2페이지     다음',15)
  x=780;s+=txt(x+22,248,'만들기     이전 작업',16,700)
  s+=box(x+20,270,292,87,'A3  여행 영상 · 완료','2026.10.26 · 사진 확대·이동')
  s+=f'<rect x="{x+20}" y="375" width="292" height="145" rx="12" fill="#dde6e5"/>'
  s+=txt(x+46,450,'선택한 영상 재생 영역',18,700)
  s+=txt(x+22,558,'A4  오류와 빈 상태 분리',16,700)
  s+=txt(x+22,601,'A5  선택 작업 주소 복원',15)
 else:
  x=28;s+=box(x+20,220,292,77,'저장 아티스트  3','저장 일정  2   /   상품  1')
  s+=box(x+20,323,292,58,'내 목록 보기')
  s+=box(x+20,396,292,58,'홈으로')
  s+=txt(x+22,510,'C1  개인 영상 진입 없음',16,700,color='#9d432f')
  x=404;s+=txt(x+22,182,'아티스트   일정   상품',16,700)
  s+=box(x+20,220,292,86,'설명용 팬 일정','공개     보기     삭제')
  s+=txt(x+22,352,'마이페이지로 돌아가기',15)
  s+=txt(x+22,510,'C2  개인 영상 이동 없음',16,700,color='#9d432f')
  x=780;s+=txt(x+22,183,'로그인 · 여행 코스로 돌아가기',14)
  s+=box(x+20,218,292,94,'여행 사진 선택','사진 올리기  /  영상 만들기')
  s+=box(x+20,334,292,92,'이전 작업','생성 완료 · 설명용 작업')
  s+=txt(x+22,488,'C3  이력 상태 표시 보강 필요',15,700,color='#9d432f')
  s+=txt(x+22,521,'로그인 후 영상 복귀도 보강',14,color='#52606d')
 s+='</g></svg>';return s

(A/'current-screens.svg').write_text(screens(),encoding='utf-8')
(A/'proposed-screens.svg').write_text(screens(True),encoding='utf-8')
s=svg_begin('F1 화면 이동과 조회 분기',1140,720)
s+=txt(32,44,'F1–F5 · 제안하는 이동·조회 흐름',24,700)
s+=box(395,80,350,76,'F1 공통 메뉴 선택','내 목록 또는 내 영상',fill='#f0f3e6')
s+=arrow(570,156,570,202,'이동')
s+=box(395,202,350,78,'F2 기능·인증 확인','서버 허용과 로그인 상태')
s+=arrow(395,241,300,241,'미준비·비로그인')
s+=box(32,202,265,98,'안내·로그인','허용된 복귀 주소만 보존',fill='#fce8dd')
s+=arrow(570,280,570,327,'준비·인증됨')
s+=box(395,327,350,77,'F3 해당 화면만 조회','목록과 영상 요청은 독립')
s+=arrow(570,404,570,448,'응답')
s+=box(395,448,350,77,'F4 응답 상태 분리','성공 · 빈 결과 · 조회 실패')
s+=arrow(745,488,814,488,'빈 결과·실패')
s+=box(817,448,293,97,'상태별 안내','해당 조회만 재시도',fill='#fce8dd')
s+=arrow(570,525,570,574,'작업 선택')
s+=box(395,574,350,95,'F5 소유자 재조회·재생','완료 + 권한 + 파일 확인',fill='#e4efec')
s+='</g></svg>'
(A/'navigation-flow.svg').write_text(s,encoding='utf-8')
s=svg_begin('D1 화면 연결과 기존 저장 경계',1140,650)
s+=txt(30,43,'D1 · 화면은 연결하고 저장소는 유지',24,700)
s+=txt(30,71,'점선: 제안 탐색 의존   실선: 현재 요청·조회·반환 / 외래키 그림이 아님',14,color='#52606d')
s+=box(390,103,360,70,'제안: 공통 탐색 메뉴',fill='#f0f3e6')
s+=box(60,229,410,77,'현재: 내 목록 화면','PersonalSavedScreen')
s+=box(670,229,410,77,'현재: 개인 영상 화면','TravelVideoPage')
s+=arrow(435,173,265,229,'이동',True);s+=arrow(705,173,875,229,'이동',True)
s+=box(60,363,410,77,'Spring 저장 목록 API','인증 사용자 + 종류·페이지')
s+=box(670,363,410,77,'Next.js 프록시 → 개인 API','Spring 신원 확인 → owner 전달')
s+=arrow(265,306,265,363,'요청·반환');s+=arrow(875,306,875,363,'요청·반환')
s+=box(60,497,410,94,'PostgreSQL 카탈로그 저장','artist_follow · event_bookmark · saved_item',fill='#e4efec')
s+=box(670,497,410,94,'SQLite + JPEG·MP4','photos · jobs · 파일 저장 폴더',fill='#e4efec')
s+=arrow(265,440,265,497,'조회');s+=arrow(875,440,875,497,'조회·파일 제공')
s+='</g></svg>'
(A/'storage-boundary.svg').write_text(s,encoding='utf-8')

s=svg_begin('R1 소스 기준 Tora 단일과 미디어·배치 분기',1140,820)
s+=txt(30,44,'R1 · 작업 종류와 엔드포인트를 구분',24,700)
s+=txt(30,72,'코드의 분기 / 운영 ID·이미지·최근 작업은 미확인',15,color='#8a432f')
s+=box(390,105,360,76,'Spring 영상 요청','POST /jobs/runpod 또는 /batch')
s+=box(55,239,460,76,'단일 route = tora_cogvideox_i2v','대체 생성 허용 안 함')
s+=box(625,239,460,76,'일반 단일 또는 batch_video','배치는 미디어 엔드포인트 사용')
s+=arrow(450,181,285,239,'Tora 단일');s+=arrow(695,181,855,239,'그 외·배치')
s+=box(55,371,460,80,'Tora ID 또는 레거시 ID','/v2/{endpoint}/run',fill='#fce8dd')
s+=box(625,371,460,80,'Media ID 또는 레거시 ID','/v2/{endpoint}/run',fill='#e4efec')
s+=arrow(285,315,285,371,'제출');s+=arrow(855,315,855,371,'제출')
s+=box(625,500,460,106,'배치: 같은 작업자 안에서 처리','auto: Tora 선택 없음 / 명시 Tora: 로컬 시도')
s+=txt(646,585,'Tora 실패 → CogVideoX → 3d_photo_light',15,color='#52606d')
s+=arrow(855,451,855,500,'batch_video일 때')
s+=box(260,680,620,85,'결과: /v2/{endpoint}/status/{job_id}','Spring은 작업 ID·route 저장 / endpoint ID 전용 저장 없음')
s+=arrow(285,451,380,680,'상태 조회');s+=arrow(855,606,760,680,'상태 조회')
s+='</g></svg>'
(A/'runpod-routing.svg').write_text(s,encoding='utf-8')

sourcebase='https://github.com/feed-mina/KMovement/blob/46a2d5ae83451befb0fa465acffe96257b7811d6/'
w='subproject/SDUI/metadata-project/'
j='subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/'
refs={'profile':w+'components/screens/AuthFlowScreen.tsx','saved':w+'components/plugins/kpop/PersonalSaved.tsx','video':w+'app/travel/video/page.tsx','return':w+'lib/kride/loginReturn.ts','auth':w+'context/AuthContext.tsx','proxy':w+'app/api/travel-video/%5B...path%5D/route.ts','private':'deploy/photo_video/app.py','savedservice':j+'domain/kpop/service/PersonalSavedService.java'}
mdpath=ROOT/'README.md';md=mdpath.read_text(encoding='utf-8-sig')
if '<!-- SOURCE_LINKS -->' in md:
 md=md.replace('<!-- SOURCE_LINKS -->','\n'.join(f'[{k}]: {sourcebase}{v}' for k,v in refs.items()))
 mdpath.write_text(md,encoding='utf-8')

CSS='''
:root{--ink:#1c2a35;--muted:#536471;--line:#dce2e5;--paper:#fff;--accent:#b94d31;--wash:#f4f5ef;--soft:#fbe9df;--mint:#e5efeb}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;color:var(--ink);font:16px/1.8 "Malgun Gothic","Noto Sans KR",sans-serif;background:var(--wash)}a{color:#235e7d;text-decoration-thickness:1px;text-underline-offset:3px}button,select{font:inherit}button,a,select{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #a23d28;outline-offset:4px}header.cover{padding:58px max(28px,calc((100vw - 1200px)/2));background:#1c2d35;color:#fff;border-bottom:6px solid #e8bb8f}header.cover p{max-width:760px;color:#d5e0e1}header.cover h1{font-size:clamp(28px,4vw,48px);margin:10px 0;line-height:1.35}.eyebrow{letter-spacing:2px;font-size:13px}.shell{max-width:1370px;margin:auto;display:grid;grid-template-columns:218px minmax(0,1fr);gap:24px;padding:28px}aside{position:sticky;top:20px;align-self:start}aside a{display:block;padding:7px 12px;color:var(--muted);text-decoration:none;border-left:2px solid var(--line);font-size:14px}aside a:hover{background:#fff;border-color:var(--accent)}main{min-width:0;background:var(--paper);padding:36px 42px;border:1px solid var(--line);border-radius:20px}main h1{font-size:30px;line-height:1.45}h2{font-size:25px;border-top:1px solid var(--line);padding-top:38px;margin:44px 0 20px;line-height:1.5}h3{font-size:20px;margin-top:26px}p,li{overflow-wrap:anywhere}li+li{margin-top:8px}strong{font-weight:750}.table-wrap{overflow-x:auto;margin:20px 0;border:1px solid var(--line);border-radius:12px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.75}th,td{padding:13px 15px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);overflow-wrap:anywhere}th{background:#edf2ef;min-width:110px}tr:last-child td{border:0}td code{overflow-wrap:anywhere;white-space:normal}pre{padding:22px;background:#162831;color:#edf6f5;border-radius:12px;overflow-x:auto;font-size:13px;line-height:1.75}code{font-family:Consolas,monospace;font-size:.9em;background:#eff2f2;padding:2px 4px;border-radius:4px}pre code{background:none;padding:0;color:inherit}figure{margin:26px 0;padding:14px;background:#f5f5f0;border:1px solid var(--line);border-radius:16px}figure svg{width:100%;height:auto;display:block}figcaption{font-size:13px;color:var(--muted);margin-top:12px;display:flex;gap:12px;justify-content:space-between;align-items:center}.quiet{border:1px solid #bbc6ca;background:white;border-radius:8px;padding:7px 12px;color:var(--ink)}.notice{padding:18px 22px;background:var(--soft);border-left:4px solid var(--accent);border-radius:8px}.prototype{border:1px solid var(--line);border-radius:18px;padding:24px;background:#fafbf7;margin:24px 0}.proto-nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}.proto-nav button{background:white;border:1px solid #bcc8cd;border-radius:24px;padding:8px 22px}.proto-nav button[aria-selected=true]{background:#233c40;color:#fff;border-color:#233c40}.demo-row{padding:18px;background:white;border:1px solid var(--line);border-radius:12px;margin-top:12px}.demo-row p{margin:4px 0}.small{color:var(--muted);font-size:13px}.inspect{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;padding:20px;background:#edf3ef;border-radius:16px}.inspect-detail{background:white;border-radius:12px;padding:20px;border:1px solid var(--line)}.inspect-map{display:grid;grid-template-columns:1fr 1fr;gap:10px}.inspect-map button{border:1px solid #aebdb6;background:#fff;padding:13px 10px;border-radius:10px;font-size:14px;text-align:left}.inspect-map button[aria-pressed=true]{background:#243d38;color:#fff}.inspect-detail h4{margin:0 0 8px;font-size:19px}.skip{position:absolute;top:-80px;left:15px}.skip:focus{top:12px;background:white;padding:10px;z-index:10}dialog{border:1px solid #b5bfc3;border-radius:14px;max-width:96vw;width:1250px;padding:18px}dialog::backdrop{background:#15212bba}.dialog-bar{display:flex;justify-content:space-between;gap:12px;position:sticky;top:0;background:white;padding:5px}.zoom-stage{max-height:80vh;overflow:auto}.zoom-stage svg{width:100%;min-width:600px;height:auto}.qa{font-size:14px;padding:15px;background:var(--mint);border-radius:10px}footer{max-width:1200px;margin:0 auto 40px;padding:20px;color:var(--muted);font-size:13px}@media(max-width:850px){.shell{display:block;padding:16px}aside{position:static;display:flex;gap:5px;overflow-x:auto;margin-bottom:16px}aside a{white-space:nowrap;border:1px solid var(--line);border-radius:18px;padding:6px 12px;background:white}main{padding:23px 18px;border-radius:14px}header.cover{padding:32px 22px}.inspect{grid-template-columns:1fr}.prototype{padding:16px}table{min-width:580px}h2{font-size:22px}main h1{font-size:26px}pre{font-size:12px;padding:14px}figcaption{align-items:flex-start;flex-direction:column}.dialog-bar{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{aside,.quiet,.prototype,dialog{display:none}.shell{display:block;padding:0}main{border:0;padding:0}header.cover{padding:20px}a{color:inherit}figure,table{break-inside:avoid}}
'''
DEMO='''<section class="prototype" aria-label="개선 예상 체험"><p class="small">설명용 모형 · 실제 요청 없음</p><h3>나의 보관함</h3><div class="proto-nav" role="tablist" aria-label="문서 체험 화면"><button id="demo-saved" role="tab" aria-selected="true" aria-controls="demo-panel" tabindex="0" data-demo="saved">내 목록</button><button id="demo-videos" role="tab" aria-selected="false" aria-controls="demo-panel" tabindex="-1" data-demo="videos">내 영상</button></div><label for="demo-state">조회 상태 예시 </label><select id="demo-state"><option value="ready">조회 성공</option><option value="loading">조회 중</option><option value="empty">빈 목록</option><option value="error">조회 실패</option><option value="guest">로그인 필요</option><option value="unavailable">기능 준비 중</option></select><div id="demo-panel" role="tabpanel" aria-labelledby="demo-saved" tabindex="0" aria-live="polite"></div></section>'''
DETAILS=[('A1 마이페이지','ProfileScreen에 개인 영상 진입을 추가한다. 현재 개인 영상 API는 총 건수를 반환하지 않으므로 숫자를 만들어 넣지 않는다.'),('A2 내 목록','PersonalSavedScreen의 종류·페이지·공개 여부·삭제 처리를 유지한다. 공통 메뉴는 링크만 제공한다.'),('A3 개인 영상','TravelVideoPage의 생성·이력·선택 작업을 구분한다. 제안한 view/page/job 쿼리는 새 구현이 필요하다.'),('A4 로그인 복귀','safeLoginReturn의 정확한 /travel/video 허용과 복귀 문구·힌트 소비를 함께 바꾼다. 외부 주소는 거절한다.'),('A5 독립 조회','각 화면은 자기 API를 호출한다. 목록 응답의 data.items와 영상 응답의 items를 구분한다.'),('A6 저장 경계','PostgreSQL 후보와 SQLite 작업·파일을 유지한다. 화면 연결에 새 외래키·Cloudinary 업로드는 필요하지 않다.')]
MAP='<section class="inspect" aria-label="역할별 상세 그림"><div id="inspect-detail" class="inspect-detail" aria-live="polite"><h4>'+DETAILS[0][0]+'</h4><p>'+DETAILS[0][1]+'</p></div><div class="inspect-map" aria-label="역할 선택">'+''.join(f'<button data-inspect="{i}" aria-pressed="{str(i==0).lower()}">{esc(t)}</button>' for i,(t,d) in enumerate(DETAILS))+'</div></section>'
JS='''
const details=DETAILS_JSON;
for(const b of document.querySelectorAll('[data-inspect]'))b.addEventListener('click',()=>{for(const x of document.querySelectorAll('[data-inspect]'))x.setAttribute('aria-pressed',String(x===b));const [title,copy]=details[Number(b.dataset.inspect)];const d=document.getElementById('inspect-detail');d.replaceChildren(Object.assign(document.createElement('h4'),{textContent:title}),Object.assign(document.createElement('p'),{textContent:copy}));});
let demo='saved';const state=document.getElementById('demo-state');
function renderDemo(){const p=document.getElementById('demo-panel');const v=state.value;let title,copy;if(v==='loading'){title='불러오는 중';copy='이전 계정의 결과를 표시하지 않습니다.';}else if(v==='empty'){title=demo==='saved'?'아직 저장한 목록이 없습니다':'아직 영상 작업이 없습니다';copy='조회에 성공한 뒤에만 빈 목록을 안내합니다.';}else if(v==='error'){title='불러오지 못했습니다';copy='해당 목록 조회만 다시 시도합니다. 생성 요청은 하지 않습니다.';}else if(v==='guest'){title='로그인이 필요합니다';copy='로그인 후 허용된 원래 화면으로 돌아옵니다.';}else if(v==='unavailable'){title='내 영상 기능을 준비 중입니다';copy='현재 가능한 내 목록은 계속 사용할 수 있습니다.';}else{title=demo==='saved'?'설명용 팬 일정 · 공개':'설명용 여행 영상 · 완료';copy=demo==='saved'?'종류·페이지를 유지하며 내 영상으로 이동합니다.':'사진 확대·이동 영상 / 재생은 실제 서비스에서 소유자를 확인합니다.';}p.replaceChildren();const row=document.createElement('div');row.className='demo-row';const h=document.createElement('strong');h.textContent=title;const t=document.createElement('p');t.textContent=copy;row.append(h,t);p.append(row);}
const tabs=[...document.querySelectorAll('[data-demo]')];function chooseTab(b){demo=b.dataset.demo;for(const t of tabs){t.setAttribute('aria-selected',String(t===b));t.tabIndex=t===b?0:-1;}document.getElementById('demo-panel').setAttribute('aria-labelledby',b.id);renderDemo();}for(const b of tabs){b.addEventListener('click',()=>chooseTab(b));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[(tabs.indexOf(b)+1)%tabs.length];chooseTab(next);next.focus();}});}state.addEventListener('change',renderDemo);renderDemo();
const dialog=document.getElementById('zoom-dialog');for(const b of document.querySelectorAll('[data-zoom]'))b.addEventListener('click',()=>{document.getElementById('zoom-stage').innerHTML=document.getElementById(b.dataset.zoom).querySelector('svg').outerHTML;dialog.showModal();});document.getElementById('zoom-close').addEventListener('click',()=>dialog.close());document.getElementById('zoom-plus').addEventListener('click',()=>document.querySelector('#zoom-stage svg').style.width='160%');document.getElementById('zoom-reset').addEventListener('click',()=>document.querySelector('#zoom-stage svg').style.width='100%');
'''
import json
JS=JS.replace('DETAILS_JSON',json.dumps(DETAILS,ensure_ascii=False))
text=md.replace('<!-- INTERACTIVE_DEMO -->',DEMO).replace('<!-- INTERACTIVE_MAP -->',MAP)
text=text.replace('<!-- QA_RESULT -->','정적 문서 생성 완료. 브라우저 검수 결과는 최종 작성 시 반영한다.')
body=markdown.markdown(text,extensions=['tables','fenced_code','sane_lists'])
def embed(m):
 f=m.group(1);alt=html.unescape(m.group(2));name=Path(f).stem
 return f'<figure id="fig-{name}">{(ROOT/f).read_text(encoding="utf-8")}<figcaption><span>{esc(alt)}</span><button class="quiet" data-zoom="fig-{name}" type="button">그림 크게 보기</button></figcaption></figure>'
body=re.sub(r'<img alt="([^"]*)" src="([^"]*)"\s*/?>',lambda m:embed(type('M',(),{'group':lambda self,i:m.group(2 if i==1 else 1)})()),body)
body=re.sub(r'(?s)<table>(.*?)</table>',r'<div class="table-wrap"><table>\1</table></div>',body)
nav=[('scope','목표·범위'),('current','현재 화면'),('after','개선 화면'),('flow','이동·조회 흐름'),('files','함수·수정 파일'),('login','로그인 복귀'),('history','조회 상태'),('contracts','API·저장 경계'),('steps','구현 순서'),('tests','시험 계획'),('maintenance','진단·복구'),('verification','확인 범위'),('runpod-operations','RunPod 운영 분석')]
page='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>내 목록과 내 영상 연결 가이드</title><style>'+CSS+'</style></head><body><a class="skip" href="#content">본문으로 이동</a><header class="cover"><span class="eyebrow">KMOVEMENT / IMPLEMENTATION GUIDE</span><h1>내 목록에서 내 영상까지</h1><p>같은 보관 경험으로 이어지는 화면 연결 가이드. 현재 구현과 다음 변경을 구분하고, 기존 데이터와 소유권을 유지합니다.</p></header><div class="shell"><aside aria-label="보고서 목차">'+''.join(f'<a href="#{k}">{v}</a>' for k,v in nav)+'</aside><main id="content">'+body+'</main></div><dialog id="zoom-dialog" aria-label="그림 확대"><div class="dialog-bar"><span>그림 확대</span><div><button id="zoom-plus" class="quiet">확대</button> <button id="zoom-reset" class="quiet">원래 크기</button> <button id="zoom-close" class="quiet">닫기</button></div></div><div id="zoom-stage" class="zoom-stage"></div></dialog><footer>현재 화면은 코드 기반 재구성, 개선 화면은 미구현 모형입니다. 체험은 문서 내부에서만 동작합니다.</footer><script>'+JS+'</script></body></html>'
(ROOT/'guide.html').write_text(page,encoding='utf-8')
print('Generated guide.html and',len(list(A.glob('*.svg'))),'SVG assets')
