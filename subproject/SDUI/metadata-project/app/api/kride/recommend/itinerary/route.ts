import {NextRequest,NextResponse} from 'next/server';
export async function POST(request:NextRequest){
 const base=process.env.FASTAPI_URL??process.env.KRIDE_FASTAPI_URL??process.env.GCP_FASTAPI_URL;
 const auth=process.env.AUTH_BACKEND_URL??process.env.BACKEND_URL;
 const token=process.env.KRIDE_INTERNAL_TOKEN;
 const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 if(!base||!auth||!token)return reply({error:'추천 서버를 준비 중입니다.'},503);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);
 try{
  const identity=await fetch(`${auth}/api/auth/me`,{headers:{cookie:request.headers.get('cookie')??''},signal:AbortSignal.timeout(8000),cache:'no-store'});
  if(!identity.ok)return reply({error:'로그인이 필요합니다.'},identity.status>=500?503:401);
  const user=await identity.json();if(!user.isLoggedIn||!Number.isSafeInteger(user.userSqno))return reply({error:'로그인이 필요합니다.'},401);
  const text=await request.text();if(text.length>8000)return reply({error:'입력이 너무 깁니다.'},413);
  let body;try{body=JSON.parse(text);}catch{return reply({error:'입력을 확인해 주세요.'},400);}
  const result=await fetch(`${base}/api/public/itinerary`,{method:'POST',headers:{'Content-Type':'application/json','X-Kride-Token':token,'X-Kride-User':String(user.userSqno)},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
  const payload=await result.json().catch(()=>({error:'추천 서버 응답을 확인하지 못했습니다.'}));
  return reply(payload,result.status);
 }catch(e){return reply({error:e instanceof Error&&e.name==='AbortError'?'추천 시간이 초과됐습니다.':'추천 서버에 연결하지 못했습니다.'},e instanceof Error&&e.name==='AbortError'?504:502);}finally{clearTimeout(timer);}
}
