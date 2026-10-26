from pathlib import Path
import re,markdown
ROOT=Path(__file__).resolve().parent
body=markdown.markdown((ROOT/'models-explained.md').read_text(encoding='utf-8'),extensions=['tables','toc','sane_lists'])
headings=re.findall(r'<h2 id="([^"]+)">(.+?)</h2>',body)
nav=''.join(f'<a href="#{a}">{t}</a>' for a,t in headings)
body=re.sub(r'(<table>.*?</table>)',r'<div class="table-scroll" tabindex="0" aria-label="표 가로 보기">\1</div>',body,flags=re.S)
css=re.search(r'<style>(.*?)</style>',(ROOT/'guide.html').read_text(encoding='utf-8'),re.S).group(1)
page=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>공개 모델 16개와 영상 연결 계획 자연어 해설</title><style>{css}</style></head><body><a class="skip" href="#content">본문으로 이동</a><header class="cover"><p class="kicker">KMOVEMENT · MODELS IN PLAIN KOREAN</p><h1>기존 영상을 되살리고,<br>댄스와 코칭을 연결하는 방법</h1><p>공개 모델 16개 계열에 무엇을 넣고, 무엇이 나오며, KMovement의 어느 기능에 쓰는지 쉬운 말과 사례로 설명합니다.</p><div class="chips"><span>댄스 5개</span><span>일반 영상 4개 계열</span><span>얼굴·음성 3개</span><span>포즈·3D 도구 4개</span></div></header><div class="shell"><aside aria-label="모델 해설 목차">{nav}</aside><main id="content">{body}</main></div><footer>원래 기술 보고서의 자연어 해설입니다. 모델 실행·품질 실측·서버 이전 결과가 아닙니다.</footer></body></html>'''
(ROOT/'models-explained.html').write_text(page,encoding='utf-8')
print(len(page),len(headings))
