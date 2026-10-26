from pathlib import Path
import re,markdown
ROOT=Path(__file__).resolve().parent
from html import escape

def starting_flow():
    out=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 1260" role="img" aria-labelledby="start-flow-title"><title id="start-flow-title">F4 병합 후 시작 순서: 기본 영상 확인, 영상·댄스와 코칭 두 갈래</title><defs><marker id="start-flow-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#607568"/></marker></defs><rect width="1120" height="1260" rx="20" fill="#f6f8f3"/><g font-family="Malgun Gothic,Noto Sans KR,sans-serif" fill="#203e32">']
    def text(x,y,t,size=18,weight=400):
        out.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}">{escape(t)}</text>')
    def box(x,y,w,title,detail,fill='white',height=80):
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{height}" rx="14" fill="{fill}" stroke="#b2c2b5" stroke-width="1.5"/>')
        text(x+20,y+32,title,21,700);text(x+20,y+62,detail,17)
    def arrow(points,label='',x=0,y=0,dashed=False):
        dash=' stroke-dasharray="7 6"' if dashed else ''
        out.append(f'<polyline points="{points}" fill="none" stroke="#607568" stroke-width="2.2"{dash} marker-end="url(#start-flow-arrow)"/>')
        if label:text(x,y,label,16)
    text(30,42,'F4 · 지금은 기본 영상부터 확인한다',27,700)
    text(30,74,'다음 개발의 실행 계획 / 운영 성공 화면이나 현재 함수 호출도가 아님',17)
    box(380,105,360,'S0  운영 연결표 확인','버전 · 플래그 · 목적지 · 보관 폴더')
    arrow('560,185 560,230')
    box(380,230,360,'S1  기본 사진 영상 한 건','업로드 → 5초 영상 → 이력·재생')
    arrow('560,310 560,355')
    box(380,355,360,'본인 계정에서 끝까지 되나?','새로고침 복원 · 다른 계정 차단',fill='#e5eee4')
    box(20,355,285,'안 되면 연결부터 수정','인증 · 작업자 · 볼륨 · 재생',fill='#fbebdf',height=100)
    arrow('380,395 305,395','실패',320,381)
    arrow('160,355 160,270 380,270','다시 확인',190,258,True)
    box(380,505,360,'기본 흐름 통과','이후 두 갈래는 별도로 진행',fill='#dfeee8')
    arrow('560,435 560,505','통과',580,475)
    arrow('560,585 560,620 270,620 270,685')
    arrow('560,620 850,620 850,685')
    text(28,662,'A · 영상과 댄스',21,700)
    text(608,662,'C · 카메라 코칭',21,700)
    box(20,685,500,'A1  Hostinger 영상 중계 분리','기존 코스·채팅 주소는 유지')
    box(20,830,500,'A2  기존 CogVideoX 단일 복구','실제 실행 모델 · 결과 보관 · 재생 확인')
    arrow('270,765 270,830','모형 확인 후 GPU 시험',295,803)
    box(20,975,500,'A3  개인 사진 AI 연결','본인 확인 · 전송 동의 · 비공개 결과 회수')
    arrow('270,910 270,975','시험 입력 한 건 통과',295,947)
    box(20,1120,500,'A4  댄스 모델 하나 연결','UniAnimate-DiT 우선 검토 · 공식 전처리')
    arrow('270,1055 270,1120','개인 보관 계약 확인',295,1092)
    box(600,685,500,'C1  MediaPipe로 관절 읽기','카메라 허용/거절 · 별도 계산 스레드')
    box(600,830,500,'C2  한 동작의 차이 설명','몸 크기 · 좌우 방향 · 동작 시간 맞춤')
    arrow('850,765 850,830','관절이 안정적으로 보이면',865,803)
    text(620,980,'생성형 GPU 준비와 별개로 시험 가능',20,700)
    text(620,1020,'원본 기준 동작과 비교하고,',18)
    text(620,1050,'잘 안 보이는 구간은 판단을 보류한다.',18)
    text(30,1235,'각 단계의 통과 기준은 아래 표에서 확인한다. 모델 16개는 역할별 후보이며 한 번에 연결하지 않는다.',17)
    out.append('</g></svg>')
    return ''.join(out)

(ROOT/'assets').mkdir(exist_ok=True)
(ROOT/'assets'/'starting-flow.svg').write_text(starting_flow(),encoding='utf-8')

body=markdown.markdown((ROOT/'models-explained.md').read_text(encoding='utf-8'),extensions=['tables','toc','sane_lists'])
def embed_start(match):
    alt,source=match.groups()
    if source!='assets/starting-flow.svg':return match.group(0)
    svg=(ROOT/source).read_text(encoding='utf-8')
    return f'<figure class="start-figure" id="starting-flow-figure">{svg}<figcaption><span>{escape(alt)}</span><button type="button" id="start-zoom-open">흐름도 크게 보기</button></figcaption></figure>'
body=re.sub(r'<img alt="([^"]*)" src="([^"]*)"\s*/?>',embed_start,body)

headings=re.findall(r'<h2 id="([^"]+)">(.+?)</h2>',body)
nav=''.join(f'<a href="#{a}">{t}</a>' for a,t in headings)
body=re.sub(r'(<table>.*?</table>)',r'<div class="table-scroll" tabindex="0" aria-label="표 가로 보기">\1</div>',body,flags=re.S)
css=re.search(r'<style>(.*?)</style>',(ROOT/'guide.html').read_text(encoding='utf-8'),re.S).group(1)
css += """
.start-figure{margin:28px 0;padding:12px;border:1px solid #cad6cc;border-radius:18px;background:#f6f8f3}
.start-figure>svg{width:100%;height:auto;display:block}.start-figure figcaption{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-top:12px;font-size:14px}
#start-zoom-open,.start-zoom button{min-height:44px;padding:9px 14px;border:1px solid #9daf9d;border-radius:10px;background:#fff;color:#203e32;font:inherit;cursor:pointer}
#start-zoom-open:focus-visible,.start-zoom button:focus-visible,.start-zoom-stage:focus-visible{outline:3px solid #1a6750;outline-offset:3px}
.start-zoom{width:min(1160px,96vw);max-width:96vw;height:90vh;border:1px solid #9daf9d;border-radius:18px;padding:16px;background:#f6f8f3;color:#203e32}.start-zoom::backdrop{background:#13271fc9}
.start-zoom-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px}.start-zoom-stage{height:calc(100% - 88px);overflow:auto;background:#fff;border-radius:12px}.start-zoom-stage img{display:block;width:1120px;max-width:none;height:auto}
"""
zoom = '''<dialog class="start-zoom" id="start-zoom" aria-labelledby="start-zoom-title"><div class="start-zoom-bar"><strong id="start-zoom-title">시작 흐름도 확대</strong><div><button type="button" id="start-zoom-plus">더 크게</button> <button type="button" id="start-zoom-reset">원래 크기</button> <button type="button" id="start-zoom-close">닫기</button></div></div><div class="start-zoom-stage" tabindex="0" aria-label="확대 흐름도 가로·세로 스크롤"><img id="start-zoom-image" alt="F4 병합 후 시작 순서 확대"/></div></dialog><script>
const zoom=document.getElementById('start-zoom');const zoomImage=document.getElementById('start-zoom-image');
document.getElementById('start-zoom-open').addEventListener('click',()=>{zoomImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(document.querySelector('#starting-flow-figure svg').outerHTML);zoom.showModal();});
document.getElementById('start-zoom-close').addEventListener('click',()=>zoom.close());
document.getElementById('start-zoom-plus').addEventListener('click',()=>zoomImage.style.width='1500px');
document.getElementById('start-zoom-reset').addEventListener('click',()=>zoomImage.style.width='1120px');
</script>'''
page=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>공개 모델 16개와 영상 연결 계획 자연어 해설</title><style>{css}</style></head><body><a class="skip" href="#content">본문으로 이동</a><header class="cover"><p class="kicker">KMOVEMENT · MODELS IN PLAIN KOREAN</p><h1>기존 영상을 되살리고,<br>댄스와 코칭을 연결하는 방법</h1><p>공개 모델 16개 계열에 무엇을 넣고, 무엇이 나오며, KMovement의 어느 기능에 쓰는지 쉬운 말과 사례로 설명합니다.</p><div class="chips"><span>댄스 5개</span><span>일반 영상 4개 계열</span><span>얼굴·음성 3개</span><span>포즈·3D 도구 4개</span></div></header><div class="shell"><aside aria-label="모델 해설 목차">{nav}</aside><main id="content">{body}</main></div><footer>원래 기술 보고서의 자연어 해설입니다. 모델 실행·품질 실측·서버 이전 결과가 아닙니다.</footer>{zoom}</body></html>'''
(ROOT/'models-explained.html').write_text(page,encoding='utf-8')
print(len(page),len(headings))
