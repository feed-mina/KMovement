import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import TravelVideoPage from '../../app/travel/video/page';
import {AuthContext} from '@/context/AuthContext';
import {PHOTO_VIDEO_CONTEXT_KEY} from '@/lib/kride/personalLibrary';
jest.mock('@/context/AuthContext',()=>({AuthContext:require('react').createContext(undefined)}));
let mockQuery='';const mockListeners=new Set<(q:string)=>void>();
const mockPush=jest.fn(),mockReplace=jest.fn();
jest.mock('next/navigation',()=>({useRouter:()=>({push:(url:string)=>{mockPush(url);mockQuery=url.split('?')[1]||'';mockListeners.forEach(set=>set(mockQuery));},replace:(url:string)=>{mockReplace(url);mockQuery=url.split('?')[1]||'';mockListeners.forEach(set=>set(mockQuery));}}),useSearchParams:()=>{const React=require('react');const [q,set]=React.useState(mockQuery);React.useEffect(()=>{mockListeners.add(set);return()=>mockListeners.delete(set)},[]);return new URLSearchParams(q);}}));
const fetchMock=jest.fn();
const id='1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82',second='2b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
const job={jobId:id,photoId:id,status:'COMPLETED',createdAt:'2026-10-26 01:00:00',methodLabel:'사진 확대·이동 영상 (생성형 AI 아님)',videoUrl:`/api/travel-video/jobs/${id}/video`};
const json=(data:unknown,status=200)=>Promise.resolve({ok:status>=200&&status<300,status,json:async()=>data});
const auth=(owner=1,extra={})=>({user:{userSqno:owner,isLoggedIn:true},isLoggedIn:true,isLoading:false,...extra} as any);
const wrap=(value:any=auth())=><AuthContext.Provider value={value}><TravelVideoPage/></AuthContext.Provider>;
beforeEach(()=>{
    process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED='true'; sessionStorage.clear();mockQuery='';mockListeners.clear();mockPush.mockReset();mockReplace.mockReset();fetchMock.mockReset();global.fetch=fetchMock;
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:jest.fn(()=> 'blob:test')});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:jest.fn()});
    Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>second});
    fetchMock.mockImplementation((url:string)=>url.includes('?')?json({items:[],page:Number(new URL('https://test'+url).searchParams.get('page'))}):json(job));
});
afterEach(()=>{delete process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED;});
function selectPhoto(){fireEvent.change(screen.getByLabelText(/여행 사진 선택/),{target:{files:[new File(['test'],'travel.png',{type:'image/png'})]}});}
test('uploads and creates only on explicit actions, then rechecks the job before playback',async()=>{
    fetchMock.mockImplementation((url:string,init?:RequestInit)=>url.endsWith('/photos')?json({photoId:id}):url.includes('?')?json({items:[],page:1}):json(job));
    render(wrap()); expect(fetch).not.toHaveBeenCalled();selectPhoto();fireEvent.click(screen.getByRole('button',{name:'사진 올리기'}));
    await screen.findByText('사진을 저장했습니다.');fireEvent.click(screen.getByRole('button',{name:'영상 만들기'}));
    expect(await screen.findByRole('link',{name:'영상 다운로드'})).toHaveAttribute('href',job.videoUrl);
    expect(fetchMock.mock.calls.some(([url,init])=>url===`/api/travel-video/jobs/${id}`&&!init.method)).toBe(true);
    expect(document.querySelector('video')).toHaveAttribute('controls');expect(document.querySelector('video')).not.toHaveAttribute('autoplay');
    expect(mockQuery).toContain('job='+id);
});
test('retains rejected course selection and never silently retries or drops it',async()=>{
    sessionStorage.setItem(PHOTO_VIDEO_CONTEXT_KEY,JSON.stringify({owner:'1',courseContext:'signed',places:[{id:'poi:17',name:'서울 장소'}]}));
    fetchMock.mockImplementation((url:string)=>url.endsWith('/photos')?json({photoId:id}):json({detail:'코스가 만료됐습니다.'},409));
    render(wrap());selectPhoto();fireEvent.click(screen.getByRole('button',{name:'사진 올리기'}));await screen.findByText('사진을 저장했습니다.');
    expect(screen.getByRole('button',{name:'영상 만들기'})).toBeDisabled();fireEvent.change(screen.getByLabelText('장소 선택'),{target:{value:'poi:17'}});
    fireEvent.click(screen.getByRole('button',{name:'영상 만들기'}));await screen.findByText('코스가 만료됐습니다.');
    expect(fetchMock.mock.calls.filter(([url,init])=>url.endsWith('/jobs')&&init.method==='POST')).toHaveLength(1);
    expect(screen.getByLabelText('장소 선택')).toHaveValue('poi:17');
});
test('history selection always fetches the owner-scoped detail instead of trusting a row',async()=>{
    mockQuery='view=history&page=2';
    fetchMock.mockImplementation((url:string)=>url.includes('?')?json({items:[job],page:2}):json({detail:'not found'},404));
    render(wrap()); const link=await screen.findByRole('link',{name:/영상 생성 완료 ·/});fireEvent.click(link);
    await act(async()=>{mockQuery=`view=history&page=2&job=${id}`;mockListeners.forEach(set=>set(mockQuery));});
    await screen.findByText('작업을 찾을 수 없습니다.'); expect(document.querySelector('video')).toBeNull();
    expect(fetchMock.mock.calls.every(([_u,init])=>!init.method)).toBe(true);
});
test('restores a direct job URL, page and the saved-list return without generating anything',async()=>{
    mockQuery=`view=history&page=2&job=${id}&returnTo=${encodeURIComponent('/view/KPOP_SAVED_ITEMS?kind=events&page=3')}`;
    render(wrap());await screen.findByRole('link',{name:'영상 다운로드'});
    expect(screen.getByRole('link',{name:'내 목록'})).toHaveAttribute('href','/view/KPOP_SAVED_ITEMS?kind=events&page=3');
    expect(fetchMock.mock.calls.every(([_u,init])=>!init.method)).toBe(true);
    expect(screen.getByRole('heading',{name:'이전 작업 · 2페이지'})).toHaveFocus();
});
test('requires an explicit retry, keeps the original identifier and restores the new job URL',async()=>{
    mockQuery=`view=history&page=1&job=${id}`;
    fetchMock.mockImplementation((url:string)=>url.endsWith('/retry')?json({...job,jobId:second}):url===`/api/travel-video/jobs/${id}`?json({...job,status:'FAILED',videoUrl:null}):url.includes('?')?json({items:[],page:1}):json({...job,jobId:second}));
    render(wrap());fireEvent.click(await screen.findByRole('button',{name:'실패한 영상 다시 만들기'}));
    await screen.findByRole('link',{name:'영상 다운로드'});expect(mockQuery).toContain('job='+second);
    expect(fetchMock.mock.calls.filter(([url])=>url.endsWith('/retry'))).toHaveLength(1);
});
test('shows loading, errors, and empty page 2 independently and retries GET only',async()=>{
    mockQuery='view=history&page=2';let resolve:(v:any)=>void=()=>{};
    fetchMock.mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockImplementationOnce(()=>json({items:[],page:2}));
    render(wrap());expect(screen.queryByText(/작업 기록이 없습니다/)).toBeNull();expect(screen.getByText('불러오는 중입니다.')).toBeInTheDocument();
    await act(async()=>{resolve(await json({detail:'이력 조회 실패'},500));});await screen.findByRole('alert');expect(screen.queryByText(/작업 기록이 없습니다/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'다시 불러오기'}));await screen.findByText('이 페이지에는 작업 기록이 없습니다.');
    expect(fetchMock.mock.calls.every(([_u,init])=>!init.method)).toBe(true);
});
test('an account switch hides old video immediately, cancels requests, and drops old course names',async()=>{
    mockQuery=`view=history&page=1&job=${id}`;
    const view=render(wrap());await screen.findByRole('link',{name:'영상 다운로드'});
    let late:(v:any)=>void=()=>{};fetchMock.mockImplementation(()=>new Promise(r=>{late=r;}));
    view.rerender(wrap(auth(2)));expect(document.querySelector('video')).toBeNull();expect(screen.queryByRole('link',{name:'영상 다운로드'})).toBeNull();
    view.unmount(); await act(async()=>{late(await json(job));});
    sessionStorage.setItem(PHOTO_VIDEO_CONTEXT_KEY,JSON.stringify({owner:'1',courseContext:'old',places:[{id:'poi:17',name:'이전 계정 장소'}]}));mockQuery='view=create';render(wrap(auth(2)));
    expect(screen.queryByText('이전 계정 장소')).toBeNull();expect(sessionStorage.getItem(PHOTO_VIDEO_CONTEXT_KEY)).toBeNull();
});
test('disabled and anonymous screens do not issue private reads and preserve the login return',()=>{
    mockQuery=`view=history&page=2&job=${id}`;process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED='false';const view=render(wrap());expect(screen.getByText(/내 영상 기능을 준비/)).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED='true';view.rerender(wrap({user:null,isLoggedIn:false,isLoading:false}));
    expect(screen.getByRole('link',{name:'로그인하고 돌아오기'}).getAttribute('href')).toContain(encodeURIComponent(`job=${id}`));expect(fetch).not.toHaveBeenCalled();
});
test('401 expires client state and 503 is a readiness message, not empty history',async()=>{
    mockQuery='view=history&page=1';const expired=jest.fn();fetchMock.mockImplementation(()=>json({detail:'login'},401));
    const view=render(wrap(auth(1,{markSessionExpired:expired})));await waitFor(()=>expect(expired).toHaveBeenCalled());expect(screen.queryByText('아직 작업 기록이 없습니다.')).toBeNull();view.unmount();
    fetchMock.mockImplementation(()=>json({detail:'unavailable'},503));render(wrap());await screen.findByText(/내 영상 기능을 준비 중입니다. 잠시/);expect(screen.queryByText('아직 작업 기록이 없습니다.')).toBeNull();
});
