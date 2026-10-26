import {act, renderHook, waitFor} from '@testing-library/react';
import {usePrivateVideoHistory} from '@/lib/hooks/usePrivateVideoHistory';
const id='1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
const item={jobId:id,photoId:id,status:'FAILED',methodLabel:'사진'};
const response=(items: unknown[],page=1,status=200)=>({ok:status===200,status,json:async()=>({items,page,detail:'서버 오류'})});
beforeEach(()=>{global.fetch=jest.fn();});
test('cancels old owner/page reads and rejects a late result even when transport ignores abort',async()=>{
    let late:(v:unknown)=>void=()=>{}; let signal:AbortSignal;
    (fetch as jest.Mock).mockImplementationOnce((_u,init)=>{signal=init.signal;return new Promise(resolve=>{late=resolve;});}).mockResolvedValueOnce(response([],2));
    const view=renderHook(({owner,page})=>usePrivateVideoHistory(owner,page,true),{initialProps:{owner:'1',page:1}});
    expect(view.result.current.kind).toBe('loading');
    view.rerender({owner:'2',page:2}); await waitFor(()=>expect(view.result.current).toEqual({kind:'ready',data:[]}));
    expect(signal!.aborted).toBe(true);
    await act(async()=>{late(response([item]));});
    expect(view.result.current).toEqual({kind:'ready',data:[]});
    expect(fetch).toHaveBeenLastCalledWith('/api/travel-video/jobs?page=2',expect.objectContaining({cache:'no-store',credentials:'include'}));
});
test.each([[401,'unauthenticated'],[503,'unavailable'],[500,'error']])('keeps HTTP %s separate from an empty history',async(status,kind)=>{
    (fetch as jest.Mock).mockResolvedValue(response([],1,status as number));
    const {result}=renderHook(()=>usePrivateVideoHistory('1',1,true));
    await waitFor(()=>expect(result.current.kind).toBe(kind));
    expect('data' in result.current).toBe(false);
});
test('does not read private history before authentication or while disabled',()=>{
    renderHook(()=>usePrivateVideoHistory('',1,true));renderHook(()=>usePrivateVideoHistory('1',1,false));expect(fetch).not.toHaveBeenCalled();
});
