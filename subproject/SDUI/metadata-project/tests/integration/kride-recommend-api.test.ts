jest.mock('next/server', () => ({
  NextResponse: { json: jest.fn((body: unknown, init?: ResponseInit) => ({
    status: init?.status ?? 200, json: jest.fn().mockResolvedValue(body),
  })) },
}));
import { POST } from '@/app/api/kride/recommend/itinerary/route';
const request = (body: unknown) => ({headers:new Headers({cookie:'session=fixture'}),text:async()=>JSON.stringify(body)});
const response = (body:unknown,status=200) => ({ok:status<400,status,json:async()=>body});
describe('authenticated public itinerary proxy',()=>{
  // jsdom does not provide Node's AbortSignal.timeout; these tests cover forwarding.
  const originalTimeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
  beforeAll(()=>Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:()=>new AbortController().signal}));
  afterAll(()=>{if(originalTimeout)Object.defineProperty(AbortSignal,'timeout',originalTimeout);else Reflect.deleteProperty(AbortSignal,'timeout');});
  const previous={fetch:global.fetch,fast:process.env.FASTAPI_URL,auth:process.env.AUTH_BACKEND_URL,token:process.env.KRIDE_INTERNAL_TOKEN};
  beforeEach(()=>{jest.clearAllMocks();process.env.FASTAPI_URL='http://fast:8000';process.env.AUTH_BACKEND_URL='http://spring:8080';process.env.KRIDE_INTERNAL_TOKEN='fixture';global.fetch=jest.fn();});
  afterAll(()=>{global.fetch=previous.fetch;for(const [key,value] of Object.entries({FASTAPI_URL:previous.fast,AUTH_BACKEND_URL:previous.auth,KRIDE_INTERNAL_TOKEN:previous.token})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  it('uses server-confirmed identity rather than a submitted user id',async()=>{
    (global.fetch as jest.Mock).mockResolvedValueOnce(response({isLoggedIn:true,userSqno:7})).mockResolvedValueOnce(response({itinerary:[],status:'empty_candidates'}));
    const result=await POST(request({duration:'당일치기',userSqno:99}) as any);
    expect(global.fetch).toHaveBeenNthCalledWith(1,'http://spring:8080/api/auth/me',expect.objectContaining({headers:{cookie:'session=fixture'}}));
    expect(global.fetch).toHaveBeenNthCalledWith(2,'http://fast:8000/api/public/itinerary',expect.objectContaining({headers:{'Content-Type':'application/json','X-Kride-Token':'fixture','X-Kride-User':'7'}}));
    expect(result.status).toBe(200);
  });
  it('does not invoke the provider route for a guest',async()=>{
    (global.fetch as jest.Mock).mockResolvedValue(response({isLoggedIn:false}));
    expect((await POST(request({}) as any)).status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('fails closed without a service token',async()=>{
    delete process.env.KRIDE_INTERNAL_TOKEN;
    expect((await POST(request({}) as any)).status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('preserves quota status',async()=>{
    (global.fetch as jest.Mock).mockResolvedValueOnce(response({isLoggedIn:true,userSqno:7})).mockResolvedValueOnce(response({detail:'추천 한도에 도달했습니다.'},429));
    expect((await POST(request({}) as any)).status).toBe(429);
  });
  it('preserves upstream failure status without exposing its raw page',async()=>{
    (global.fetch as jest.Mock).mockResolvedValueOnce(response({isLoggedIn:true,userSqno:7})).mockResolvedValueOnce({status:503,json:async()=>{throw new Error('private upstream page');}});
    const result=await POST(request({}) as any);
    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toEqual({error:'추천 서버 응답을 확인하지 못했습니다.'});
  });
});
