import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AuthContext} from '@/context/AuthContext';
import PersonalSavedScreen,{SavedToggle} from '@/components/plugins/kpop/PersonalSaved';
jest.mock('@/context/AuthContext',()=>({AuthContext:require('react').createContext(undefined)}));
let mockQuery='';const mockListeners=new Set<(s:string)=>void>();
jest.mock('next/navigation',()=>({useRouter:()=>({push:(url:string)=>{mockQuery=url.split('?')[1]||'';mockListeners.forEach(set=>set(mockQuery));}}),useSearchParams:()=>{const React=require('react');const [q,set]=React.useState(mockQuery);React.useEffect(()=>{mockListeners.add(set);return()=>{mockListeners.delete(set)}},[]);return new URLSearchParams(q)}}));
const auth=(id=101)=>({user:{userSqno:id,isLoggedIn:true},isLoggedIn:true,isLoading:false} as any);
const response=(data:any,status=200)=>Promise.resolve({ok:status===200,status,json:async()=>({data})} as Response);
const page=(items:any[]=[],totalCount=items.length,n=1)=>({items,totalCount,page:n,pageSize:5});
const row=(id=1,visibility='PUBLIC')=>({id,itemRef:id,title:'테스트 '+id,visibility});
const wrap=(child:React.ReactNode,id=101)=><AuthContext.Provider value={auth(id)}>{child}</AuthContext.Provider>;
beforeEach(()=>{mockQuery='';mockListeners.clear();global.fetch=jest.fn();});
test('anonymous public save button makes no personal request',()=>{
 render(<SavedToggle kind="artists" itemRef={1}/>);expect(screen.queryByRole('button')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
test.each(['artists','events','products'] as const)('%s state, save and unsave use private authenticated requests',async kind=>{
 (fetch as jest.Mock).mockReturnValueOnce(response({saved:false})).mockReturnValueOnce(response({saved:true})).mockReturnValueOnce(response({saved:false}));
 render(wrap(<SavedToggle kind={kind} itemRef={1}/>));
 fireEvent.click(await screen.findByRole('button',{name:'저장'}));
 fireEvent.click(await screen.findByRole('button',{name:'저장 해제'}));
 await screen.findByRole('button',{name:'저장'});
 expect((fetch as jest.Mock).mock.calls.map(c=>c[1].method)).toEqual(['GET','POST','DELETE']);
 expect(fetch).toHaveBeenCalledWith('/api/v1/kpop/me/saved/'+kind+'/1',expect.objectContaining({credentials:'include',cache:'no-store'}));
});
test('revoked approval prevents save and explains private state',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response({saved:false})).mockReturnValueOnce(response({},404));
 render(wrap(<SavedToggle kind="artists" itemRef={1}/>));fireEvent.click(await screen.findByRole('button',{name:'저장'}));
 expect(await screen.findByRole('status')).toHaveTextContent('비공개로 전환');
});
test('private item has no detail link and final deletion shows explicit empty state',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(page([row(1,'PRIVATE')]))).mockReturnValueOnce(response({saved:false})).mockReturnValueOnce(response(page()));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));
 await screen.findByRole('heading',{name:'비공개 항목'});expect(screen.queryByText('테스트 1')).toBeNull();expect(screen.queryByRole('link',{name:'보기'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'삭제'}));expect(await screen.findByText(/아직 저장한 .*가 없어요/)).toBeInTheDocument();
});
test('106 records are five per page with independent category reset',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(page([1,2,3,4,5].map(i=>row(i)),106))).mockReturnValueOnce(response(page([6,7,8,9,10].map(i=>row(i)),106,2))).mockReturnValueOnce(response(page()));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));
 expect(await screen.findAllByRole('listitem')).toHaveLength(5);fireEvent.click(screen.getByRole('button',{name:'다음'}));await screen.findByText('테스트 6');
 expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('artists?page=2'),expect.anything());
 fireEvent.click(screen.getByRole('button',{name:'이벤트'}));await screen.findByText(/아직 저장한 .*가 없어요/);
 expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('events?page=1'),expect.anything());
});
test('switching account masks previous list and ignores stale response',async()=>{
 let late:(value:any)=>void=()=>{};
 (fetch as jest.Mock).mockReturnValueOnce(new Promise(r=>{late=r;})).mockReturnValueOnce(response(page([row(2)])));
 const view=render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));
 view.rerender(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>,202));await screen.findByText('테스트 2');
 await act(async()=>late(await response(page([row(1)]))));expect(screen.queryByText('테스트 1')).toBeNull();expect(screen.getByText('테스트 2')).toBeInTheDocument();
});
test('read failure is distinct from empty and retry recovers',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response({},500)).mockReturnValueOnce(response(page()));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));await screen.findByRole('alert');expect(screen.queryByText(/아직 저장한 .*가 없어요/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByText(/아직 저장한 .*가 없어요/);
});
test('delete failure preserves the item',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(page([row()]))).mockReturnValueOnce(response({},500));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));fireEvent.click(await screen.findByRole('button',{name:'삭제'}));
 await screen.findByRole('alert');expect(screen.getByText('테스트 1')).toBeInTheDocument();
});
// 벤치마킹 G6: 페이지네이션은 넘칠 때만, 탭 카운트는 방문한 탭만, 삭제 후 되돌리기
test('pagination text is hidden for a short list and tab count follows the visited tab',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(page([row(1),row(2)],2)));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));
 await screen.findByText('테스트 1');expect(screen.queryByText(/페이지 · 5개씩/)).toBeNull();
 expect(screen.getByRole('button',{name:/아티스트/})).toHaveTextContent('2');expect(screen.getByRole('button',{name:'이벤트'})).toHaveTextContent('이벤트');
});
test('deleting offers undo which re-saves the item',async()=>{
 (fetch as jest.Mock).mockReturnValueOnce(response(page([row(1)]))).mockReturnValueOnce(response({saved:false})).mockReturnValueOnce(response(page())).mockReturnValueOnce(response({saved:true})).mockReturnValueOnce(response(page([row(1)])));
 render(wrap(<PersonalSavedScreen screenId="KPOP_SAVED_ITEMS" refId={null}/>));
 fireEvent.click(await screen.findByRole('button',{name:'삭제'}));
 fireEvent.click(await screen.findByRole('button',{name:'되돌리기'}));
 await screen.findByText('테스트 1');
 expect((fetch as jest.Mock).mock.calls.map(c=>c[1].method)).toEqual(['GET','DELETE','GET','POST','GET']);
});
