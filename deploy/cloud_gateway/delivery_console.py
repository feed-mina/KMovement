"""Internal operator console. The key stays in page memory and is never saved."""
PAGE = r"""<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>영상 작업 전달 상태</title>
<style>body{font:16px/1.7 system-ui;max-width:760px;margin:40px auto;padding:20px}
input,button{font:inherit;margin:8px;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}
label{display:block}</style>
<h1>영상 작업 전달 상태</h1>
<p>운영자용 화면입니다. 생성 요청은 실행하지 않습니다. 보관된 영상의 전달만 다시 시도합니다.</p>
<p>개인 영상: CPU로 사진 확대·이동 처리. 생성형 AI를 실행하지 않습니다.<br>
모델 실행: 작업 결과의 실행 기록으로 판정합니다. 실행 기록이 없으면 미확인으로 표시합니다.</p>
<label>내부 인증키 <input id="key" type="password" autocomplete="off"></label>
<label>RunPod 작업 번호 <input id="job" autocomplete="off"></label>
<button id="load">상태 조회</button><button id="retry" disabled>보관된 영상 전달만 재시도</button>
<pre id="state" role="status">작업 번호를 입력해주세요.</pre>
<script>
const get = id => document.getElementById(id);
const modes = {model_executed:'실제 모델 실행 기록 있음',model_not_executed:'모델 미실행',
simulation:'모의 처리',fallback:'대체 처리 사용',unknown:'실제 모델 실행 여부 미확인'};
let busy = false;
async function call(retry) {
 if(busy) return; busy=true; get('load').disabled=true; get('retry').disabled=true;
 const job=get('job').value.trim(), key=get('key').value;
 try {
  if(!job || !key) throw Error('작업 번호와 인증키를 입력해주세요.');
  const base='/jobs/runpod/'+encodeURIComponent(job);
  let response = await fetch(base+(retry?'/delivery-retry':''), {
   method:retry?'POST':'GET',headers:{'X-Internal-Api-Key':key},cache:'no-store'});
  let data=await response.json();
  if(!response.ok) throw Error(data.detail || '상태 조회 실패');
  const d=retry?data:data.delivery;
  if(!d) {get('state').textContent='RunPod 상태: '+data.status+'\n아직 보관된 최종 결과가 없습니다.';return;}
  get('state').textContent=JSON.stringify({
   작업번호:d.job_id, 생성상태:d.generation_status, 전달상태:d.delivery_status,
   실패단계:d.failure_stage || '없음', 실행방식:modes[d.execution_mode] || '미확인',
   전달재시도가능:d.retry_available, 전달재시도횟수:d.attempts,
   재시도불가사유:d.retry_unavailable_reason, 결과주소:d.output.result_url || null
  },null,2);
  get('retry').disabled=!d.retry_available || get('job').value.trim()!==job;
 } catch(e) {get('state').textContent=e.message;}
 finally {busy=false;get('load').disabled=false;}
}
get('load').onclick=()=>call(false);get('retry').onclick=()=>call(true);
get('job').oninput=()=>{get('retry').disabled=true;};
</script></html>"""
