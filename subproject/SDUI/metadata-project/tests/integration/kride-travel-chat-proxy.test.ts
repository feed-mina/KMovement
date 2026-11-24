/** @jest-environment node */
import {POST} from '@/app/api/kride/chat/route';
const saved={...process.env};const original=global.fetch;
beforeEach(()=>{process.env.FASTAPI_URL='http://cpu';process.env.AUTH_BACKEND_URL='http://auth';process.env.KRIDE_INTERNAL_TOKEN='fixture';process.env.KRIDE_SITE_ORIGIN='https://site.test';global.fetch=jest.fn()});
afterEach(()=>{process.env={...saved};global.fetch=original});
const req=(body:any,origin='https://site.test')=>new Request('http://internal/api/kride/chat',{method:'POST',headers:{origin},body:JSON.stringify(body)}) as any;
test('keeps authenticated identity and pilot duration while ignoring client ID and provider settings',async()=>{
 (fetch as jest.Mock).mockResolvedValueOnce(Response.json({isLoggedIn:true,userSqno:3})).mockResolvedValueOnce(Response.json({intent:'recommend',pois:[]}));
 expect((await POST(req({message:'서울 추천',intent:'recommend',duration:1,userSqno:999,model:'fake'}))).status).toBe(200);
 const call=(fetch as jest.Mock).mock.calls[1];expect(call[0]).toBe('http://cpu/api/public/chat');expect(call[1].headers['X-Kride-User']).toBe('3');
 expect(JSON.parse(call[1].body)).toEqual({message:'서울 추천',intent:'recommend',duration:'당일치기',regions:['서울'],artists:[],purposes:[],artistIds:[],visitDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),budget:{min:0,max:2000000}});
});
test('blocks foreign origins and guests before CPU',async()=>{
 expect((await POST(req({message:'서울 추천',intent:'recommend'},'https://foreign.test'))).status).toBe(403);
 expect(fetch).not.toHaveBeenCalled();(fetch as jest.Mock).mockResolvedValueOnce(Response.json({isLoggedIn:false}));
 expect((await POST(req({message:'서울 추천',intent:'recommend'}))).status).toBe(401);expect(fetch).toHaveBeenCalledTimes(1);
});
test('fills the itinerary fields the CPU validates so chat courses are not rejected',async()=>{
 (fetch as jest.Mock).mockResolvedValueOnce(Response.json({isLoggedIn:true,userSqno:3})).mockResolvedValueOnce(Response.json({intent:'itinerary'}));
 await POST(req({message:'서울 당일치기 코스 짜줘',intent:'itinerary',duration:1,regions:['서울'],artists:['BTS'],artistIds:[7,'x',-1],budget:[30000,150000],visitDate:'2026-12-01'}));
 const sent=JSON.parse((fetch as jest.Mock).mock.calls[1][1].body);
 expect(sent).toMatchObject({artists:['BTS'],artistIds:[7],budget:{min:30000,max:150000},visitDate:'2026-12-01'});
 (fetch as jest.Mock).mockResolvedValueOnce(Response.json({isLoggedIn:true,userSqno:3})).mockResolvedValueOnce(Response.json({intent:'itinerary'}));
 await POST(req({message:'서울 코스',intent:'itinerary',budget:{min:5,max:1},visitDate:'2026-02-31'}));
 const fallback=JSON.parse((fetch as jest.Mock).mock.calls[3][1].body);
 expect(fallback.budget).toEqual({min:0,max:2000000});expect(fallback.visitDate).not.toBe('2026-02-31');
});
