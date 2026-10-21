import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import FanEventFeed, {presetRange,dateParts} from '@/components/plugins/kpop/FanEventFeed';
import {AuthContext} from '@/context/AuthContext';
let query='';const push=jest.fn();
jest.mock('next/navigation',()=>({usePathname:()=>'/view/KPOP_EVENTS',useRouter:()=>({push}),useSearchParams:()=>new URLSearchParams(query)}));
jest.mock('@/context/AuthContext',()=>({AuthContext:jest.requireActual('react').createContext(undefined)}));
jest.mock('@/components/plugins/kpop/PersonalSaved',()=>({SavedToggle:()=> <button>일정 저장</button>}));
const item={id:2,artistId:1,artistNameKo:'BTS',titleKo:'서울 팬 일정',date:'2026-10-07',region:'서울',venue:'공연장',geography:'domestic'};
const feed=(extra:any={})=>({items:[item],totalCount:1,page:1,pageSize:12,artists:[{id:1,name:'BTS'}],counts:{all:1,domestic:1,overseas:0,online:0,unknown:0},countries:{JP:'일본'},audience:'all',...extra});
const response=(data:any,status=200)=>Promise.resolve({ok:status===200,status,headers:{get:()=> 'fan-events-v1'},json:async()=>({data})} as unknown as Response);
const auth=(id:number)=>({isLoading:false,isLoggedIn:true,user:{userSqno:id}} as any);
beforeEach(()=>{query='';push.mockReset();global.fetch=jest.fn();});
test('guest reads public feed, filters reset page and country, detail returns to exact filters',async()=>{
 query='scope=all&geography=overseas&countryCode=JP&page=2';(fetch as jest.Mock).mockReturnValue(response(feed()));render(<FanEventFeed/>);
 const link=await screen.findByRole('link',{name:'서울 팬 일정'});expect(new URL(link.getAttribute('href')!,'https://test').searchParams.get('returnEvents')).toContain('countryCode=JP&page=2');
 expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/kpop/event-feed?'),expect.objectContaining({credentials:'omit',cache:'no-store'}));
 fireEvent.click(screen.getByRole('button',{name:/국내 · 대한민국/}));const p=new URL(push.mock.calls[0][0],'https://test').searchParams;expect(p.get('geography')).toBe('domestic');expect(p.has('page')).toBe(false);expect(p.has('countryCode')).toBe(false);
});
test('guest mine has login return and never makes private request',async()=>{
 query='scope=mine&geography=online';render(<FanEventFeed/>);expect(await screen.findByRole('link',{name:'로그인하고 돌아오기'})).toHaveAttribute('href',expect.stringContaining(encodeURIComponent('scope=mine&geography=online')));expect(fetch).not.toHaveBeenCalled();
});
test('account switches hide previous owner data immediately and discard delayed response',async()=>{
 let old:(v:any)=>void=()=>{};(fetch as jest.Mock).mockReturnValueOnce(new Promise(r=>old=r)).mockReturnValue(response(feed({audience:'mine',items:[{...item,titleKo:'새 계정 일정'}]})));
 const view=render(<AuthContext.Provider value={auth(1)}><FanEventFeed/></AuthContext.Provider>);
 view.rerender(<AuthContext.Provider value={auth(2)}><FanEventFeed/></AuthContext.Provider>);await screen.findByText('새 계정 일정');await act(async()=>old(await response(feed({audience:'mine'}))));expect(screen.queryByText('서울 팬 일정')).toBeNull();expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/me/event-feed?'),expect.objectContaining({credentials:'include'}));
});
test('errors are not empty; retry uses same filters',async()=>{
 query='artistId=1';(fetch as jest.Mock).mockReturnValueOnce(response(null,500)).mockReturnValue(response(feed({items:[],totalCount:0})));render(<FanEventFeed/>);expect(await screen.findByRole('alert')).toHaveTextContent('조회 오류');fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByText('이 조건의 일정이 아직 없어요');expect((fetch as jest.Mock).mock.calls[0][0]).toBe((fetch as jest.Mock).mock.calls[1][0]);
});
test('invalid ranges do not navigate, pagination uses full result count',async()=>{
 (fetch as jest.Mock).mockReturnValue(response(feed({totalCount:90})));render(<FanEventFeed/>);await screen.findByText('서울 팬 일정');expect(screen.getByText('1 / 8')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-10-08'}});fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-10-07'}});fireEvent.click(screen.getByRole('button',{name:'날짜 적용'}));expect(screen.getByRole('alert')).toHaveTextContent('종료일');expect(push).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'다음'}));expect(push).toHaveBeenCalledWith(expect.stringContaining('page=2'),{scroll:false});
});
test('empty favorites differs from filtered zero and server invalid input',async()=>{
 (fetch as jest.Mock).mockReturnValue(response(feed({audience:'mine',artists:[],items:[],totalCount:0})));const v=render(<AuthContext.Provider value={auth(1)}><FanEventFeed/></AuthContext.Provider>);await screen.findByText('좋아하는 아티스트부터 담아볼까요?');v.unmount();(fetch as jest.Mock).mockReturnValue(response(null,400));render(<FanEventFeed/>);expect(await screen.findByRole('alert')).toHaveTextContent('날짜와 검색 조건');
});


// 벤치마킹 H7: 기간 프리셋은 즉시 반영 · 비로그인 배너 · 월 헤더 + 요일 · 면책은 상단 1회
test('period presets navigate immediately with a computed range',async()=>{
 (fetch as jest.Mock).mockReturnValue(response(feed()));render(<FanEventFeed/>);await screen.findByText('서울 팬 일정');
 fireEvent.click(screen.getByRole('button',{name:'이번 달'}));const {from,to}=presetRange('month');
 const p=new URL(push.mock.calls[0][0],'https://test').searchParams;expect(p.get('from')).toBe(from);expect(p.get('to')).toBe(to);expect(p.has('page')).toBe(false);
 const week=presetRange('week',new Date(2026,9,21));expect(week).toEqual({from:'2026-10-21',to:'2026-10-27'});
 expect(presetRange('month',new Date(2026,9,21))).toEqual({from:'2026-10-21',to:'2026-10-31'});
});
test('guest on the public feed sees a login banner, rows are grouped by month with weekdays, and the disclaimer appears once',async()=>{
 (fetch as jest.Mock).mockReturnValue(response(feed({items:[item,{...item,id:3,titleKo:'도쿄 팬 일정',date:'2026-11-02',geography:'overseas'}],totalCount:2})));render(<FanEventFeed/>);
 await screen.findByText('서울 팬 일정');
 expect(screen.getByRole('link',{name:'로그인'})).toHaveAttribute('href',expect.stringContaining('/view/LOGIN_PAGE?returnTo='));
 expect(screen.getByRole('heading',{level:3,name:/2026년 10월/})).toHaveTextContent('1건');
 expect(screen.getByRole('heading',{level:3,name:/2026년 11월/})).toHaveTextContent('1건');
 expect(dateParts('2026-10-07')).toEqual({month:'2026년 10월',day:'7',weekday:'수'});
 expect(screen.getAllByText(/시간·변경 여부는/)).toHaveLength(1);
});
test('signed-in default feed shows no login banner',async()=>{
 (fetch as jest.Mock).mockReturnValue(response(feed({audience:'mine'})));render(<AuthContext.Provider value={auth(1)}><FanEventFeed/></AuthContext.Provider>);
 await screen.findByText('서울 팬 일정');expect(screen.queryByRole('link',{name:'로그인'})).toBeNull();
});
