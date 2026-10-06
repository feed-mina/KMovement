import {NextRequest} from 'next/server';
export async function POST(request:NextRequest) {
 const base=process.env.FASTAPI_URL??process.env.KRIDE_FASTAPI_URL;
 const auth=process.env.AUTH_BACKEND_URL??process.env.BACKEND_URL;
 const token=process.env.KRIDE_INTERNAL_TOKEN;
 const reply=(body:unknown,status:number)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 let expected:string;try{expected=new URL(process.env.KRIDE_SITE_ORIGIN??process.env.NEXT_PUBLIC_SITE_URL??request.url).origin}catch{return reply({error:'서버 주소를 확인해 주세요.'},503)}
 if(request.headers.get('origin')&&request.headers.get('origin')!==expected)return reply({error:'허용된 사이트에서 요청해 주세요.'},403);
 if(!base||!auth||!token)return reply({error:'답변 연결을 준비 중입니다.'},503);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(110000)]);
 try{
  const identity=await fetch(`${auth}/api/auth/me`,{headers:{cookie:request.headers.get('cookie')??''},signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),cache:'no-store'});
  if(!identity.ok)return reply({error:'로그인을 확인해 주세요.'},identity.status>=500?503:401);
  const user=await identity.json();if(!user.isLoggedIn||!Number.isSafeInteger(user.userSqno)||user.userSqno<=0)return reply({error:'로그인이 필요합니다.'},401);
  const text=await request.text();if(text.length>16000)return reply({error:'입력이 너무 깁니다.'},413);
  let body;try{body=JSON.parse(text)}catch{return reply({error:'입력을 확인해 주세요.'},400)}
  if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>4000||!['recommend','itinerary'].includes(body.intent))return reply({error:'질문을 확인해 주세요.'},422);
  const result=await fetch(`${base}/api/public/chat`,{method:'POST',headers:{'Content-Type':'application/json','X-Kride-Token':token,'X-Kride-User':String(user.userSqno)},body:JSON.stringify({message:body.message,intent:body.intent,duration:body.duration===undefined||body.duration===1?'당일치기':body.duration===2?'1박2일':'2박3일',artists:body.artists??[],regions:body.regions?.length?body.regions:['서울'],purposes:body.purposes??[],budget:{}}),signal,cache:'no-store'});
  return reply(await result.json().catch(()=>({error:'답변 형식을 확인해 주세요.'})),result.status);
 }catch{return reply({error:signal.aborted?'답변 시간이 초과됐습니다.':'답변 서버에 연결하지 못했습니다.'},signal.aborted?504:502)}
}
