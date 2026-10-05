import { NextRequest,NextResponse } from 'next/server';
export async function GET(request:NextRequest,{params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;if(!['weather','facilities','pois','ready'].includes(kind))return NextResponse.json({detail:'지원하지 않는 조회입니다.'},{status:404});
 const base=process.env.FASTAPI_URL??process.env.KRIDE_FASTAPI_URL??process.env.GCP_FASTAPI_URL;
 if(!base)return NextResponse.json({detail:'길 찾기 서버를 준비 중입니다.'},{status:503});
 const query=new URLSearchParams();for(const key of ['lat','lon','radius_km']){const v=request.nextUrl.searchParams.get(key);if(v!==null)query.set(key,v);}
 try{const r=await fetch(`${base}/api/${kind}?${query}`,{signal:AbortSignal.timeout(8000),cache:'no-store'});return NextResponse.json(await r.json(),{status:r.status,headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({detail:'주변 정보를 확인하지 못했습니다.'},{status:502});}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;if(!['route','course'].includes(kind))return NextResponse.json({detail:'지원하지 않는 경로입니다.'},{status:404});
 const base=process.env.FASTAPI_URL??process.env.KRIDE_FASTAPI_URL??process.env.GCP_FASTAPI_URL;
 if(!base)return NextResponse.json({detail:'길 찾기 서버를 준비 중입니다.'},{status:503});
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),28000);
 try{let body;try{body=await request.json();}catch{return NextResponse.json({detail:'입력을 확인해 주세요.'},{status:400});}
 const response=await fetch(`${base}/api/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
 return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({detail:e instanceof Error&&e.name==='AbortError'?'경로 계산 시간이 초과됐습니다.':'길 찾기 서버에 연결할 수 없습니다.'},{status:e instanceof Error&&e.name==='AbortError'?504:502});}finally{clearTimeout(timer);}
}
