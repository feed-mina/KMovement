"""Rebuild the self-contained guide: python build_report.py (requires Markdown)."""
from pathlib import Path
import html
import re
import markdown

ROOT = Path(__file__).resolve().parent

def diagram(index, title, nodes, edges, height):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 {height}" role="img" aria-labelledby="svg-title-{index}">',
           f'<title id="svg-title-{index}">{html.escape(title)}</title>',
           f'<defs><marker id="arrow-{index}" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#64756f"/></marker></defs>']
    for source, target, label, dashed in edges:
        x,y,w,h,_ = nodes[source]
        a,b,c,d,_ = nodes[target]
        if b >= y+h:
            x1,y1,x2,y2 = x+w/2,y+h,a+c/2,b
            points = f'{x1},{y1} {x1},{(y1+y2)/2} {x2},{(y1+y2)/2} {x2},{y2}'
        elif a >= x+w:
            x1,y1,x2,y2 = x+w,y+h/2,a,b+d/2
            points = f'{x1},{y1} {(x1+x2)/2},{y1} {(x1+x2)/2},{y2} {x2},{y2}'
        else:
            x1,y1,x2,y2 = x,y+h/2,a,b+d/2
            lane = min(x1,x2)-20
            points = f'{x1},{y1} {lane},{y1} {lane},{y2} {x2},{y2}'
        overrides = {
            (1,'cpu','files'):'180,315 180,500 380,500 380,535',
            (2,'i2v','edit'):'185,240 185,545 450,545 450,575',
            (1,'rp','files'):'565,455 565,535',
            (1,'hg','files'):'895,455 895,500 730,500 730,535',
            (3,'retry','delivering'):'570,605 570,575 180,575 180,605'
        }
        points = overrides.get((index,source,target),points)
        dash = ' stroke-dasharray="6 5"' if dashed else ''
        out.append(f'<polyline points="{points}" fill="none" stroke="#64756f" stroke-width="2"{dash} marker-end="url(#arrow-{index})"/>')
        if label:
            lx,ly=(x1+x2)/2,(y1+y2)/2
            label_width = max(42,len(label)*10+14)
            if y1 == y2:
                ly -= 18
            elif abs(x1-x2)<30:
                lx += label_width/2+10
            if index == 2 and source == 'face':
                lx,ly=620,560
            if index == 3 and source == 'retry':
                lx,ly=455,564
            out.append(f'<rect x="{lx-label_width/2}" y="{ly-14}" width="{label_width}" height="24" rx="6" fill="#f8faf7"/><text x="{lx}" y="{ly+3}" text-anchor="middle" fill="#435b51" font-size="14">{html.escape(label)}</text>')
    for key, (x,y,w,h,lines) in nodes.items():
        fill = '#e4ede6' if key in {'choice','goal','face','unknown','review'} else '#ffffff'
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="#aabbb0" stroke-width="1.5"/>')
        for i,line in enumerate(lines):
            baseline = y+h/2+(i-(len(lines)-1)/2)*24+6
            out.append(f'<text x="{x+w/2}" y="{baseline}" text-anchor="middle" fill="#18372c" font-size="17" font-family="Malgun Gothic, sans-serif">{html.escape(line)}</text>')
    out.append('</svg>')
    return ''.join(out)

diagrams = [
diagram(1, '목표 설계: Hostinger 관리 계층과 GPU 공급자 분리', {
 'web':(355,18,390,60,['Hostinger 웹 · 로그인과 사진 소유자 확인']),
 'choice':(410,125,280,60,['생성 방식 선택']),
 'cpu':(45,245,270,70,['기존 FFmpeg 작업자','사진 확대·이동']),
 'gateway':(500,245,520,70,['Hostinger 영상 중계 API','관리·동의·외부 작업 기록']),
 'rp':(430,385,270,70,['Runpod GPU 작업자','기존 계약 재사용']),
 'hg':(760,385,270,70,['Hostinger GPU 작업자','대안 공급자 · 추가 구현']),
 'files':(270,535,560,65,['개인 영속 저장소 · 소유자 확인 후 재생']),
},[
 ('web','choice','',False),('choice','cpu','사진 모션',False),('choice','gateway','AI 생성 동의',False),
 ('gateway','rp','기본안 A',False),('gateway','hg','대안 B',True),
 ('cpu','files','',False),('rp','files','결과 회수',False),('hg','files','',True)
],630),
diagram(2, '기능별 선택: 일반 영상, 댄스 생성, 실시간 코칭', {
 'goal':(360,20,380,65,['사용자 목적 선택']),
 'i2v':(35,160,300,80,['여행 사진','CogVideoX 또는 Wan/LTX']),
 'pose':(400,160,300,80,['댄스 생성','모델 전용 포즈 전처리']),
 'coach':(765,160,300,80,['실시간 코칭','MediaPipe와 직접 작성한 채점']),
 'dance':(400,300,300,65,['UniAnimate 또는 MimicMotion']),
 'face':(400,420,300,65,['얼굴 후처리 선택']),
 'portrait':(765,420,300,65,['조건 충족 시 LivePortrait']),
 'edit':(320,575,460,65,['FFmpeg 편집 · 완성 영상 저장']),
},[
 ('goal','i2v','',False),('goal','pose','',False),('goal','coach','',False),
 ('pose','dance','',False),('dance','face','',False),('face','portrait','선택',False),
 ('face','edit','생략',False),('portrait','edit','',False),('i2v','edit','',False)
],670),
diagram(3, '제안하는 외부 모델 실행 상태와 복구 분기', {
 'prepared':(40,20,280,60,['PREPARED · 요청 준비']),
 'submitting':(40,135,280,60,['SUBMITTING · 제출 중']),
 'unknown':(430,135,280,60,['SUBMIT_UNKNOWN · 응답 단절']),
 'reconcile':(430,255,280,60,['RECONCILING · 기존 제출 확인']),
 'review':(800,255,270,60,['REVIEW_REQUIRED · 검토']),
 'submitted':(40,365,280,60,['SUBMITTED · 작업 번호 저장']),
 'running':(40,485,280,60,['RUNNING · GPU 실행']),
 'failed':(430,485,280,60,['FAILED · 생성 실패']),
 'delivering':(40,605,280,60,['DELIVERING · 결과 회수']),
 'retry':(430,605,280,60,['DELIVERY_RETRY · 회수 재시도']),
 'complete':(40,735,480,65,['COMPLETED · 파일 검증과 내부 저장 완료']),
},[
 ('prepared','submitting','',False),('submitting','unknown','',False),
 ('unknown','reconcile','',False),('reconcile','review','확인 불가',False),
 ('submitting','submitted','번호 저장',False),('reconcile','submitted','번호 확인',False),
 ('submitted','running','',False),('running','failed','생성 실패',False),
 ('running','delivering','성공',False),('delivering','retry','회수 실패',False),
 ('retry','delivering','같은 결과',True),('delivering','complete','',False)
],830)
]

body = markdown.markdown((ROOT/'README.md').read_text(encoding='utf-8'),
                         extensions=['tables','fenced_code','toc','sane_lists'],
                         extension_configs={'toc':{'permalink':False}})
count = 0
def replace_diagram(match):
    global count
    figure = diagrams[count]
    count += 1
    return f'<figure><div class="diagram" tabindex="0" aria-label="구조도 가로 보기">{figure}</div><figcaption>그림 {count}. 설명용 목표 설계 · 모바일에서는 가로로 이동해 읽을 수 있습니다.</figcaption></figure>'
body = re.sub(r'<pre><code class="language-mermaid">.*?</code></pre>',replace_diagram,body,flags=re.S)
assert count == 3

prototype = '''
<section class="prototype" aria-labelledby="prototype-title">
  <p class="kicker">설명용 선택 도구 · 제품 구현 아님</p>
  <h3 id="prototype-title">목적에 맞는 조합 살펴보기</h3>
  <p>버튼을 누르면 추천 순서만 바뀝니다. 사진 업로드·GPU 요청·계정 연결은 하지 않습니다.</p>
  <div class="choices" role="group" aria-label="만들 기능">
    <button type="button" data-task="travel" aria-pressed="true">여행 사진 영상</button>
    <button type="button" data-task="dance" aria-pressed="false">사진으로 춤 생성</button>
    <button type="button" data-task="coach" aria-pressed="false">카메라 춤 코칭</button>
  </div>
  <div id="recommendation" aria-live="polite"><h4>기존 여행 영상 연결부터 복구</h4><p>Hostinger 중계 + 기존 CogVideoX + FFmpeg. 파일 회수와 개인 재생 경로를 완성한 뒤 Wan·LTX와 비교합니다.</p></div>
</section>'''
body = body.replace('<h2 id="8-', prototype+'<h2 id="8-',1)
if prototype not in body:
    marker = re.search(r'<h2[^>]*>8\.',body)
    assert marker
    body = body[:marker.start()] + prototype + body[marker.start():]

headings = re.findall(r'<h2 id="([^"]+)">(.+?)</h2>',body)
nav = ''.join(f'<a href="#{anchor}">{re.sub("<[^>]+>","",name)}</a>' for anchor,name in headings)
# Each wide object scrolls within its own boundary; the page itself remains responsive.
body = re.sub(r'(<table>.*?</table>)',r'<div class="table-scroll" tabindex="0" aria-label="표 가로 보기">\1</div>',body,flags=re.S)

css = """
:root{--ink:#17372b;--muted:#53685e;--line:#d8e1d8;--paper:#fffefa;--wash:#f1f4ed;--accent:#1d6048}
*{box-sizing:border-box}html{scroll-padding-top:24px}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.85 "Malgun Gothic","Noto Sans KR",sans-serif}a{color:#145e76;text-underline-offset:4px;overflow-wrap:anywhere}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid #a24d27;outline-offset:4px}.skip{position:absolute;left:16px;top:-90px}.skip:focus{top:12px;background:white;padding:10px;z-index:2}
.cover{background:#17392d;color:#fff;padding:54px max(26px,calc((100vw - 1320px)/2));border-bottom:6px solid #c4d3a0}.cover h1{font-size:clamp(28px,4vw,46px);line-height:1.35;max-width:940px;margin:16px 0}.cover p{max-width:840px;color:#d4e3d4}.kicker{letter-spacing:1px;font-size:12px;font-weight:700}.chips{display:flex;flex-wrap:wrap;gap:10px}.chips span{border:1px solid #718d7c;border-radius:24px;padding:4px 13px;font-size:13px}
.shell{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:242px minmax(0,1fr);gap:25px;padding:30px 26px}aside{position:sticky;top:22px;align-self:start;max-height:93vh;overflow:auto}aside a{display:block;border-left:2px solid #cdd8cc;padding:6px 12px;font-size:13px;text-decoration:none;color:var(--muted)}aside a:hover{background:#fffefa;border-color:var(--accent)}main{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:19px;padding:30px 38px}main h1{font-size:28px;line-height:1.45}h2{font-size:25px;line-height:1.55;border-top:1px solid var(--line);padding-top:35px;margin:44px 0 20px}h3{font-size:20px;line-height:1.6;margin:28px 0 12px}h4{font-size:18px;line-height:1.6;margin:0 0 10px}p,li{overflow-wrap:anywhere}li+li{margin-top:8px}.table-scroll{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:12px;margin:22px 0}table{width:100%;border-collapse:collapse;min-width:690px;font-size:14px;line-height:1.8}th,td{padding:13px 15px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf0e4;min-width:125px}tr:last-child td{border-bottom:0}pre{overflow:auto;max-width:100%;background:#18362d;color:#f0f6ec;border-radius:12px;padding:22px;font-size:13px;line-height:1.85}code{font-family:Consolas,monospace}figure{margin:26px 0;border:1px solid var(--line);border-radius:14px;background:#f8faf7;padding:16px}.diagram{overflow:auto;max-width:100%}.diagram svg{display:block;width:100%;height:auto;min-width:790px}figcaption{font-size:12px;color:var(--muted);margin-top:12px}.prototype{background:#edf2e5;border:1px solid #bdcdb8;border-radius:16px;padding:25px;margin:30px 0}.prototype h3{margin-top:4px}.choices{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0}.choices button{font:inherit;min-height:44px;padding:9px 18px;background:#fffefa;color:var(--ink);border:1px solid #98ad99;border-radius:24px;cursor:pointer}.choices button[aria-pressed=true]{background:#1d6048;color:white;border-color:#1d6048}#recommendation{padding:20px;border:1px solid #c8d5c3;border-radius:12px;background:#fffefa}#recommendation p{margin-bottom:0}footer{max-width:1240px;margin:0 auto;padding:20px 26px 40px;color:var(--muted);font-size:13px}
@media(max-width:920px){.shell{display:block;padding:16px}aside{position:static;max-height:none;display:flex;gap:8px;overflow:auto;margin-bottom:15px;padding-bottom:8px}aside a{white-space:nowrap;border:1px solid var(--line);border-radius:20px;padding:7px 13px;background:#fffefa}main{padding:22px 18px}.cover{padding:32px 23px}h2{font-size:23px}main h1{font-size:25px}.prototype{padding:18px}figure{padding:10px}.diagram svg{min-width:760px}pre{padding:16px;font-size:12px}}
@media print{aside,.prototype{display:none}.shell{display:block;padding:0}main{border:0;padding:0}.cover{padding:20px}table{min-width:0}figure{break-inside:avoid}.diagram svg{min-width:0}a{color:inherit}}
"""
script = """
const plans={
travel:['기존 여행 영상 연결부터 복구','Hostinger 중계 + 기존 CogVideoX + FFmpeg. 파일 회수와 개인 재생 경로를 완성한 뒤 Wan·LTX와 비교합니다.'],
dance:['포즈 전처리와 댄스 모델 하나부터','승인된 동작 영상 + 모델 전용 포즈 전처리 + UniAnimate 또는 MimicMotion. LivePortrait는 조건을 확인한 뒤 선택적으로 비교합니다.'],
coach:['생성 서버와 분리한 실시간 코칭','MediaPipe를 브라우저 작업 스레드에서 실행하고 몸 크기·방향·시간을 맞춘 뒤 유사도를 계산합니다. 영상 생성 모델은 필수가 아닙니다.']
};
document.querySelectorAll('[data-task]').forEach(button=>button.addEventListener('click',()=>{
document.querySelectorAll('[data-task]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
const plan=plans[button.dataset.task], panel=document.getElementById('recommendation');
panel.replaceChildren();
const title=document.createElement('h4'), text=document.createElement('p');
title.textContent=plan[0];text.textContent=plan[1];panel.append(title,text);
}));
"""
page = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사진→영상 모델과 Hostinger 전환 가이드</title><style>{css}</style></head>
<body><a class="skip" href="#content">본문으로 이동</a><header class="cover"><div class="kicker">KMOVEMENT · MODEL INTEGRATION GUIDE</div><h1>기존 영상을 되살리고,<br>댄스와 코칭을 단계적으로 연결하기</h1><p>실제 코드에서 찾은 Hostinger 전환 지점과 공개 모델 16개 계열의 역할을 정리했습니다. 현재 구현·앞선 운영 관찰·새 개발 계획을 구분합니다.</p><div class="chips"><span>Hostinger 관리 계층</span><span>GPU 실행 분리</span><span>기존 개인 이력 보존</span><span>문서 작성·배포 계획</span></div></header><div class="shell"><aside aria-label="보고서 목차">{nav}</aside><main id="content">{body}</main></div><footer>설명용 선택 도구는 외부 요청을 보내지 않습니다. 실제 서버 이전과 모델 생성은 별도 구현·검증 단계입니다.</footer><script>{script}</script></body></html>'''
(ROOT/'guide.html').write_text(page,encoding='utf-8')
print(f'Built guide.html: {len(page):,} characters, {count} inline diagrams, {len(headings)} sections')
