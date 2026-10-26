"""Build the natural-language companion without modifying the original guide."""
from pathlib import Path
import html
import re
import markdown

ROOT=Path(__file__).resolve().parent

def box(x,y,w,h,text,soft=False):
    fill='#e4ede6' if soft else '#fffefa'
    lines=text.split('|')
    out=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="13" fill="{fill}" stroke="#a7b8a9" stroke-width="1.5"/>'
    for i,line in enumerate(lines):
        yy=y+h/2+(i-(len(lines)-1)/2)*24+6
        out+=f'<text x="{x+w/2}" y="{yy}" text-anchor="middle" font-size="17" fill="#17372b" font-family="Malgun Gothic,sans-serif">{html.escape(line)}</text>'
    return out

def arrow(points,label='',tx=0,ty=0,dashed=False):
    out=f'<polyline points="{points}" fill="none" stroke="#64786b" stroke-width="2" marker-end="url(#tip)"'
    if dashed:out+=' stroke-dasharray="6 5"'
    out+='/>'
    if label:
        width=len(label)*12+16
        out+=f'<rect x="{tx-width/2}" y="{ty-17}" width="{width}" height="24" fill="#f8faf7"/><text x="{tx}" y="{ty}" text-anchor="middle" font-size="14" fill="#435b51">{html.escape(label)}</text>'
    return out

def start(title,height):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 {height}" role="img" aria-label="{title}"><title>{title}</title><defs><marker id="tip" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#64786b"/></marker></defs>'

flow=start('현재 코드: 기능 설정과 로그인 및 내부 소유자 검사',1050)
flow+=arrow('280,94 280,130')
flow+=arrow('490,162 715,162','준비 안 됨',600,146)
flow+=arrow('280,194 280,260','준비됨',330,232)
flow+=arrow('280,324 280,365')
flow+=arrow('490,397 715,397','실패',600,381)
flow+=arrow('280,429 280,500','로그인 확인',350,465)
flow+=arrow('280,564 280,615')
flow+=arrow('280,679 280,725')
flow+=arrow('490,757 715,757','실패',600,741)
flow+=arrow('280,789 280,875','통과',330,838)
flow+=box(70,30,420,64,'F1 기능과 연결 설정 확인')
flow+=box(70,130,420,64,'요청할 준비가 되었는가?',True)
flow+=box(715,130,315,64,'503 · 준비 안내')
flow+=box(70,260,420,64,'F2 Spring에 로그인 확인')
flow+=box(70,365,420,64,'로그인 사용자가 확인됐는가?',True)
flow+=box(715,365,315,64,'401 · 로그인 안내|또는 503 · 장애 안내')
flow+=box(70,500,420,64,'F3 확인된 사용자 번호 전달')
flow+=box(70,615,420,64,'F4 내부 키와 소유자 검사')
flow+=box(70,725,420,64,'내부 확인을 통과했는가?',True)
flow+=box(715,725,315,64,'401 · 거절|또는 503 · 설정 안내')
flow+=box(70,875,420,74,'사진·작업 요청 처리')
flow+='<text x="70" y="1000" font-size="15" fill="#53685e">신원 확인의 핵심 분기입니다. 파일·입력·요청 출처 검사는 본문에서 이어 설명합니다.</text></svg>'

erd=start('SQLite의 실제 연결: 사진과 작업의 주인이 함께 일치해야 함',630)
erd+=box(35,70,350,240,'photos · 사진 기록|사진 번호 id|주인 owner|등록 시각 created_at',True)
erd+=box(620,70,410,400,'jobs · 영상 작업 기록|작업 번호 id|주인 owner|사진 번호 photo_id|요청 번호 request_id|작업 상태 status|재시도 원본 retry_of|코스 설명 trip_json')
erd+=arrow('620,205 385,205')
erd+='<text x="502" y="164" text-anchor="middle" font-size="16" fill="#435b51">사진 번호 + 주인</text><text x="502" y="188" text-anchor="middle" font-size="14" fill="#53685e">하나의 사진에 여러 작업</text>'
erd+=arrow('1030,215 1070,215 1070,515 825,515 825,470')
erd+='<text x="620" y="564" font-size="16" fill="#435b51">재시도 연결: 원본 작업 번호 + 주인 + 사진 번호</text>'
erd+='<text x="35" y="605" font-size="14" fill="#53685e">실선 화살표: jobs가 참조하는 대상. 실제 복합 외래키이며 파일 자체의 저장 위치는 별도입니다.</text></svg>'
flow=flow.replace('id="tip"','id="tip-auth"').replace('url(#tip)','url(#tip-auth)')
erd=erd.replace('id="tip"','id="tip-data"').replace('url(#tip)','url(#tip-data)')
figures=[flow,erd]

raw=(ROOT/'code-explained.md').read_text(encoding='utf-8')
body=markdown.markdown(raw,extensions=['tables','fenced_code','toc','sane_lists'])
index=0
def convert(match):
    global index
    svg=figures[index]
    index+=1
    return f'<figure><div class="diagram" tabindex="0" aria-label="그림 가로 보기">{svg}</div><figcaption>그림 {index}. 실제 코드에 근거한 흐름·관계 설명. 운영 화면 캡처가 아닙니다.</figcaption></figure>'
body=re.sub(r'<pre><code class="language-mermaid">.*?</code></pre>',convert,body,flags=re.S)
assert index==2
body=re.sub(r'(<table>.*?</table>)',r'<div class="table-scroll" tabindex="0" aria-label="표 가로 보기">\1</div>',body,flags=re.S)

explorer='''
<section class="prototype" aria-labelledby="explain-stage-title"><p class="kicker">코드에 근거한 과정 설명도 · 실제 작업 실행 아님</p>
<h3 id="explain-stage-title">사진 한 장이 지나가는 다섯 단계</h3>
<p>단계를 선택하면 담당 함수와 돌아오는 값을 읽을 수 있습니다. 버튼은 설명만 바꿉니다.</p>
<div class="choices" role="group" aria-label="설명할 단계">
<button type="button" data-stage="choose" aria-pressed="true">1 사진 선택</button>
<button type="button" data-stage="upload" aria-pressed="false">2 서버 업로드</button>
<button type="button" data-stage="queue" aria-pressed="false">3 작업 접수</button>
<button type="button" data-stage="render" aria-pressed="false">4 영상 생성</button>
<button type="button" data-stage="play" aria-pressed="false">5 본인 재생</button>
</div><div id="stage-detail" aria-live="polite"><h4>사진 선택은 브라우저 안의 준비</h4><p>VideoCreator가 선택 파일을 검사하고 미리보기를 만듭니다. 이 단계에서는 서버의 사진 번호가 생기지 않습니다.</p><p><strong>돌아오는 것:</strong> 화면의 미리보기 · <strong>남는 변화:</strong> 브라우저 안의 선택 상태</p></div></section>'''
marker=re.search(r'<h2[^>]*>4\.',body)
assert marker
body=body[:marker.start()]+explorer+body[marker.start():]
headings=re.findall(r'<h2 id="([^"]+)">(.+?)</h2>',body)
nav=''.join(f'<a href="#{anchor}">{re.sub("<[^>]+>","",name)}</a>' for anchor,name in headings)
original=(ROOT/'guide.html').read_text(encoding='utf-8')
css=re.search(r'<style>(.*?)</style>',original,re.S).group(1)
css+='#stage-detail{padding:20px;background:#fffefa;border:1px solid #c8d5c3;border-radius:12px}#stage-detail p:last-child{margin-bottom:0}.cover h1{max-width:1040px}aside{font-size:13px}.diagram svg{min-width:790px}'
script="""
const steps={
choose:['사진 선택은 브라우저 안의 준비','VideoCreator가 선택 파일을 검사하고 미리보기를 만듭니다. 이 단계에서는 서버의 사진 번호가 생기지 않습니다.','화면의 미리보기','브라우저 안의 선택 상태'],
upload:['사진을 저장하고 사진 번호를 받음','Next가 로그인 사용자를 확인하고 개인 API의 upload()가 사진을 다시 읽어 JPEG로 저장합니다.','photoId라는 사진 번호','JPEG 파일과 photos 기록'],
queue:['영상 대신 작업 대기표를 받음','enqueue()가 본인 사진·중복 요청·한도를 확인하고 대기 작업을 기록합니다.','jobId와 현재 상태를 담은 작업 정보','jobs 기록. 아직 완성 영상 없음'],
render:['반환값 없이 영상 파일을 만듦','render_photo()는 FFmpeg를 실행해 임시 MP4를 만들고 형식·길이를 확인한 뒤 최종 이름으로 바꿉니다.','None. 영상 바이트를 직접 돌려주지 않음','MP4 파일. run_once()가 상태와 시간을 기록'],
play:['본인인지 다시 확인하고 파일을 보냄','video()가 주인·완료 상태·실제 파일을 확인합니다. 준비가 끝났을 때 재생 가능한 파일을 보냅니다.','JSON이 아닌 영상 바이트','재생 요청. 새 생성 작업을 만들지 않음']
};
document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{
document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
const values=steps[button.dataset.stage],panel=document.getElementById('stage-detail');
panel.replaceChildren();
const title=document.createElement('h4');title.textContent=values[0];panel.append(title);
for(const line of [values[1],'돌아오는 것: '+values[2],'남는 변화: '+values[3]]){const p=document.createElement('p');p.textContent=line;panel.append(p);}
}));
"""
result=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사진→영상 코드 자연어 해설</title><style>{css}</style></head><body><a class="skip" href="#content">본문으로 이동</a>
<header class="cover"><p class="kicker">KMOVEMENT · CODE IN PLAIN KOREAN</p><h1>사진 한 장이 영상으로 돌아오기까지,<br>코드를 쉬운 말로 읽기</h1><p>누가 확인하고, 무엇을 기록하고, 어떤 값을 돌려주는지 한 단계씩 설명합니다. 현재 코드와 Hostinger·AI 확장 제안을 구분했습니다.</p><div class="chips"><span>사진·요청·작업 번호 구분</span><span>함수와 저장 효과</span><span>Java·Docker 설정 해설</span><span>현재 구현·새 제안 구분</span></div></header>
<div class="shell"><aside aria-label="해설 목차">{nav}</aside><main id="content">{body}</main></div><footer>그림과 단계 선택은 코드에 근거한 설명입니다. 실제 운영 사진 업로드·서버 변경·GPU 생성은 실행하지 않습니다.</footer><script>{script}</script></body></html>'''
(ROOT/'code-explained.html').write_text(result,encoding='utf-8')
print(f'Built code-explained.html: {len(result)} characters, {index} diagrams, {len(headings)} sections')
