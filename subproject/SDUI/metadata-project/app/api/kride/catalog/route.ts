export async function GET(){
 const base=process.env.FASTAPI_URL??process.env.KRIDE_FASTAPI_URL;
 if(!base)return Response.json({error:'자료 준비 중입니다.'},{status:503});
 try{
  const response=await fetch(`${base}/api/public/catalog`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  return Response.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'자료 연결을 확인해 주세요.'},{status:503})}
}
