import {NextRequest} from 'next/server';
// The CPU itinerary validates visitDate, a {min,max} budget and artistIds; the chat UI only knows the message.
const DEFAULT_BUDGET={min:0,max:2000000};
const seoulToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
function budgetOf(v:unknown){
 const [min,max]=Array.isArray(v)?v:[(v as {min?:unknown})?.min,(v as {max?:unknown})?.max];
 return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&(min as number)>=0&&(min as number)<=(max as number)&&(max as number)<=100000000?{min:min as number,max:max as number}:DEFAULT_BUDGET;
}
const artistIdsOf=(v:unknown)=>Array.isArray(v)?v.filter((id):id is number=>Number.isSafeInteger(id)&&id>0).slice(0,5):[];
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
  const result=await fetch(`${base}/api/public/chat`,{method:'POST',headers:{'Content-Type':'application/json','X-Kride-Token':token,'X-Kride-User':String(user.userSqno)},body:JSON.stringify({message:body.message,intent:body.intent,duration:body.duration===undefined||body.duration===1?'당일치기':body.duration===2?'1박2일':'2박3일',artists:body.artists??[],regions:body.regions?.length?body.regions:['서울'],purposes:body.purposes??[],artistIds:artistIdsOf(body.artistIds),visitDate:isoDate(body.visitDate)?body.visitDate:seoulToday(),budget:budgetOf(body.budget)}),signal,cache:'no-store'});
  return reply(await result.json().catch(()=>({error:'답변 형식을 확인해 주세요.'})),result.status);
 }catch{return reply({error:signal.aborted?'답변 시간이 초과됐습니다.':'답변 서버에 연결하지 못했습니다.'},signal.aborted?504:502)}
}
