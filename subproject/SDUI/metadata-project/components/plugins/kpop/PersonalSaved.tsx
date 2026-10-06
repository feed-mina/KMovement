'use client';
import {useContext,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {AuthContext} from '@/context/AuthContext';
import Pagination from '@/components/fields/Pagination';
import type {ScreenControllerProps} from '@/components/screens/types';
export type SavedKind='artists'|'events'|'products';
const labels:Record<SavedKind,string>={artists:'아티스트',events:'이벤트',products:'상품'};
const base='/api/v1/kpop/me/saved/';
async function request(url:string,signal:AbortSignal,method='GET') {
 const r=await fetch(url,{method,credentials:'include',cache:'no-store',signal});
 if(!r.ok)throw new Error(String(r.status));return (await r.json()).data;
}
export function SavedToggle({kind,itemRef}:{kind:SavedKind;itemRef:string|number}) {
 const auth=useContext(AuthContext);const identity=auth?.isLoggedIn&&!auth.isLoading?String(auth.user?.userSqno??auth.user?.userId??''):'';
 const key=identity+':'+kind+':'+itemRef;
 const [state,setState]=useState<{key:string;saved:boolean;status:'loading'|'ready'|'error'|'private';busy?:boolean}>({key:'',saved:false,status:'loading'});
 const [retry,setRetry]=useState(0);const live=useRef(key);live.current=key;
 const operation=useRef<AbortController|null>(null);
 useEffect(()=>{if(!identity)return;const abort=new AbortController();setState({key,saved:false,status:'loading'});
  request(base+kind+'/'+encodeURIComponent(itemRef),abort.signal).then(data=>{if(!abort.signal.aborted)setState({key,saved:data.saved,status:'ready'});}).catch(()=>{if(!abort.signal.aborted)setState({key,saved:false,status:'error'});});
  return ()=>{abort.abort();operation.current?.abort();};
 },[key,identity,kind,itemRef,retry]);
 if(!identity)return null;
 const current=state.key===key?state:{key,saved:false,status:'loading' as const};
 const toggle=async()=>{if(current.busy||current.status==='loading')return;const abort=new AbortController();operation.current=abort;setState({...current,busy:true});
  try {const data=await request(base+kind+'/'+encodeURIComponent(itemRef),abort.signal,current.saved?'DELETE':'POST');if(live.current===key&&!abort.signal.aborted)setState({key,saved:data.saved,status:'ready'});}
  catch(e){if(live.current===key&&!abort.signal.aborted)setState({...current,busy:false,status:(e as Error).message==='404'?'private':'error'});}
 };
 return <div className="personal-save-action">
  {current.status==='error'?<><p role="alert">저장 상태를 확인하지 못했어요.</p><button onClick={()=>setRetry(x=>x+1)}>저장 상태 다시 확인</button></>:current.status==='private'?<p role="status">비공개로 전환되어 새로 저장할 수 없어요. 내 목록에서 기존 저장을 관리해 주세요.</p>:<button disabled={current.busy||current.status==='loading'} aria-pressed={current.saved} onClick={toggle}>{current.status==='loading'?'저장 확인 중…':current.busy?'처리 중…':current.saved?'저장 해제':'저장'}</button>}
 </div>;
}
type SavedRow={id:number;itemRef:number;title:string;visibility:'PUBLIC'|'PRIVATE'};
type SavedPage={items:SavedRow[];page:number;pageSize:number;totalCount:number};
export default function PersonalSavedScreen(_props:ScreenControllerProps) {
 const auth=useContext(AuthContext);const identity=auth?.isLoggedIn&&!auth.isLoading?String(auth.user?.userSqno??auth.user?.userId??''):'';
 const router=useRouter(),search=useSearchParams();
 const rawKind=search.get('kind');const kind:SavedKind=rawKind==='events'||rawKind==='products'?rawKind:'artists';
 const rawPage=Number(search.get('page')||1);const page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1;
 const [retry,setRetry]=useState(0);
 const navigate=(nextKind:SavedKind,nextPage:number)=>{focus.current=true;router.push('/view/KPOP_SAVED_ITEMS?kind='+nextKind+'&page='+nextPage,{scroll:false});};
 const key=identity+':'+kind+':'+page;
 const [result,setResult]=useState<{key:string;data?:SavedPage;error?:boolean}>({key:''});
 const [deleting,setDeleting]=useState<number|null>(null),[message,setMessage]=useState('');
 const heading=useRef<HTMLHeadingElement>(null),focus=useRef(false),live=useRef(key);live.current=key;
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>{setMessage('');setDeleting(null);if(!identity)return;const abort=new AbortController();setResult({key});
  request(base+kind+'?page='+page,abort.signal).then(data=>{if(!abort.signal.aborted){setResult({key,data});if(focus.current){focus.current=false;heading.current?.focus();}}}).catch(()=>{if(!abort.signal.aborted)setResult({key,error:true});});
  return ()=>{abort.abort();mutation.current?.abort();};
 },[key,identity,kind,page,retry]);
 if(auth?.isLoading)return <p role="status">로그인을 확인하는 중…</p>;
 if(!identity)return <section className="page-wrap personal-saved"><h1>내 목록</h1><p>로그인한 사람만 자신의 저장 목록을 볼 수 있어요.</p><a href="/view/LOGIN_PAGE">로그인</a></section>;
 const current=result.key===key?result:{key};
 const remove=async(item:SavedRow)=>{if(deleting!==null)return;setDeleting(item.itemRef);setMessage('');const abort=new AbortController();mutation.current=abort;
  try{await request(base+kind+'/'+item.itemRef,abort.signal,'DELETE');if(live.current===key&&!abort.signal.aborted){focus.current=true;setRetry(x=>x+1);}}
  catch{if(live.current===key&&!abort.signal.aborted){setMessage('삭제하지 못했어요. 다시 시도해 주세요.');setDeleting(null);}}
 };
 return <section className="page-wrap personal-saved" aria-label="내 저장 목록"><h1>내 목록</h1><p>나만 볼 수 있는 저장 목록입니다. 한 페이지에 5개씩 표시해요.</p><a href="/view/MY_PAGE">프로필로</a>
  <nav aria-label="저장 종류">{(Object.keys(labels) as SavedKind[]).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{navigate(k,1);}}>{labels[k]}</button>)}</nav>
  <h2 ref={heading} tabIndex={-1}>{labels[kind]} 저장 목록{current.data?` · ${current.data.totalCount}개`:''}</h2>
  {message&&<p role="alert">{message}</p>}
  {current.error?<div role="alert"><p>내 목록을 불러오지 못했어요. 빈 목록과 다른 오류입니다.</p><button onClick={()=>setRetry(x=>x+1)}>다시 시도</button></div>:!current.data?<p role="status">목록을 불러오는 중…</p>:<>
   {current.data.items.length===0?<div className="kride-empty"><p role="status">빈 목록입니다. 아직 저장한 {labels[kind]} 항목이 없어요.</p><Link className="kride-primary-button" href={kind==='artists'?'/view/kpop':kind==='events'?'/view/KPOP_EVENTS':'/view/KPOP_PRODUCTS'}>{labels[kind]} 찾아보기</Link></div>:<ul>{current.data.items.map(item=><li key={item.id}><h3>{item.visibility==='PRIVATE'?'비공개 항목':item.title}</h3><p>{item.visibility==='PRIVATE'?'비공개 · 공개 승인이 취소되었거나 더 이상 제공되지 않는 항목입니다. 저장 기록은 삭제할 수 있어요.':'공개'}</p>
    {item.visibility==='PUBLIC'&&<a href={kind==='artists'?'/view/KPOP_ARTIST_DETAIL/'+item.itemRef:kind==='events'?'/view/KPOP_EVENT_DETAIL/'+item.itemRef:'/view/KPOP_PRODUCTS?itemId='+item.itemRef}>보기</a>}
    <button disabled={deleting!==null} onClick={()=>remove(item)}>{deleting===item.itemRef?'삭제 중…':'삭제'}</button></li>)}</ul>}
   <Pagination totalCount={current.data.totalCount} pageSize={5} currentPage={current.data.page} onPageChange={next=>{navigate(kind,next);}}/>
   <p>{current.data.page}페이지 · 5개씩</p>
  </>}
 </section>;
}
