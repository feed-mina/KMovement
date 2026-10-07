import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {LegacyEventCatalogScreen as EventCatalogScreen,eventFilterError} from '@/components/plugins/kpop/EventCatalogScreen';
let query='';const push=jest.fn();
jest.mock('next/navigation',()=>({usePathname:()=>'/view/KPOP_EXPLORE',useRouter:()=>({push}),useSearchParams:()=>new URLSearchParams(query)}));
const item={id:2,titleKo:'오늘 서울 일정',date:'2026-10-05',region:'서울',ended:false};
const response=(data:any,status=200)=>Promise.resolve({ok:status===200,status,headers:{get:(name:string)=>name==='X-Kpop-Today'?'2026-10-05':'Asia/Seoul'},json:async()=>({data})} as Response);
beforeEach(()=>{query='';push.mockReset();global.fetch=jest.fn();});
test('B01-B03 date and exact region conditions travel together in URL and no save is offered',async()=>{
    (fetch as jest.Mock).mockReturnValue(response([item]));
    render(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);
    await screen.findByText('오늘 서울 일정');
    fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-10-04'}});
    fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-10-07'}});
    fireEvent.change(screen.getByLabelText('지역'),{target:{value:' 서울 '}});
    fireEvent.submit(screen.getByRole('form'));
    expect(push).toHaveBeenLastCalledWith('/view/KPOP_EVENTS?from=2026-10-04&to=2026-10-07&region=%EC%84%9C%EC%9A%B8',{scroll:false});
    expect(screen.queryByRole('button',{name:'일정 저장'})).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/v1/kpop/events',expect.objectContaining({credentials:'omit',cache:'no-store'}));
});
test.each([
    [{from:'2026-10-07',to:'2026-10-06',region:''},'빠를 수'],
    [{from:'',to:'2026-10-04',region:''},'오늘보다'],
    [{from:'2026-02-30',to:'',region:''},'유효한 날짜'],
])('invalid input is distinct: %s',(filters,copy)=>expect(eventFilterError(filters,'2026-10-05')).toContain(copy));
test('reversed range is blocked before a request and leaves previous results intact',async()=>{
    (fetch as jest.Mock).mockReturnValue(response([item]));render(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);
    await screen.findByText('오늘 서울 일정');
    fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-10-07'}});fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-10-06'}});
    fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('빠를 수');expect(push).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(1);
});
test('B04 detail and return link preserve filters and missing is not a blank card',async()=>{
    query='region=서울';(fetch as jest.Mock).mockReturnValue(response(null,404));
    render(<EventCatalogScreen screenId="KPOP_EVENT_DETAIL" refId="999"/>);
    await screen.findByText(/공개된 이벤트를 찾을 수 없어요/);
    expect(screen.getByRole('link',{name:'이벤트 목록으로'})).toHaveAttribute('href','/view/KPOP_EVENTS?region=%EC%84%9C%EC%9A%B8');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
test('B05 ended badge comes from server even if client has a different calendar day',async()=>{
    (fetch as jest.Mock).mockReturnValue(response({...item,ended:true}));
    render(<EventCatalogScreen screenId="KPOP_EVENT_DETAIL" refId="2"/>);
    await screen.findByText('종료된 일정 · 행사 날짜 지남');
    expect(screen.getByText(/서버 기준 오늘: 2026-10-05/)).toBeInTheDocument();
});
test.each([['','오늘 이후 공개된 일정이 아직 없어요'],['from=2026-11-01&to=2026-11-30','선택한 기간·지역에 공개된 일정이 없어요']])('B06 empty states %s',async(q,copy)=>{
    query=q;(fetch as jest.Mock).mockReturnValue(response([]));render(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);
    expect(await screen.findByRole('status')).toHaveTextContent(copy);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'초기화'}));
    if(q)expect(push).toHaveBeenLastCalledWith('/view/KPOP_EVENTS',{scroll:false});
});
test('500 retries identical conditions and never claims an empty period',async()=>{
    query='from=2026-10-05';(fetch as jest.Mock).mockReturnValueOnce(response(null,500)).mockReturnValue(response([item]));
    render(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);
    await screen.findByRole('alert');expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByText('오늘 서울 일정');
    expect((fetch as jest.Mock).mock.calls[0][0]).toEqual((fetch as jest.Mock).mock.calls[1][0]);
});
test('old response cannot replace newer region response',async()=>{
    let old:(x:any)=>void=()=>{};(fetch as jest.Mock).mockReturnValueOnce(new Promise(r=>old=r)).mockReturnValue(response([{...item,titleKo:'부산 일정'}]));
    const view=render(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);query='region=부산';view.rerender(<EventCatalogScreen screenId="KPOP_EVENTS" refId={null}/>);
    await screen.findByText('부산 일정');await act(async()=>old(await response([item])));expect(screen.queryByText('오늘 서울 일정')).not.toBeInTheDocument();
});
test('event detail return accepts the fan filter route and rejects external destinations',async()=>{
 query='returnEvents='+encodeURIComponent('/view/KPOP_EVENTS?scope=all&geography=overseas&countryCode=JP&page=2');(fetch as jest.Mock).mockReturnValue(response(null,404));
 const v=render(<EventCatalogScreen screenId="KPOP_EVENT_DETAIL" refId="999"/>);await screen.findByText(/공개된 이벤트를 찾을 수 없어요/);expect(screen.getByRole('link',{name:'이벤트 목록으로'})).toHaveAttribute('href','/view/KPOP_EVENTS?scope=all&geography=overseas&countryCode=JP&page=2');
 v.unmount();query='returnEvents='+encodeURIComponent('https://evil.example');render(<EventCatalogScreen screenId="KPOP_EVENT_DETAIL" refId="999"/>);await screen.findByText(/공개된 이벤트를 찾을 수 없어요/);expect(screen.getByRole('link',{name:'이벤트 목록으로'})).toHaveAttribute('href','/view/KPOP_EVENTS');
});
