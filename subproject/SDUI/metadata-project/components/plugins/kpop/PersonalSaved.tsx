'use client';
import {useContext,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {AuthContext} from '@/context/AuthContext';
import Pagination from '@/components/fields/Pagination';
import KrideStatePanel from '@/components/fields/kride/atoms/KrideStatePanel';
import Skeleton from '@/components/utils/Skeleton';
import type {ScreenControllerProps} from '@/components/screens/types';
export type SavedKind='artists'|'events'|'products';
const labels:Record<SavedKind,string>={artists:'아티스트',events:'이벤트',products:'상품'};
const browse:Record<SavedKind,string>={artists:'/view/kpop',events:'/view/KPOP_EVENTS',products:'/view/KPOP_PRODUCTS'};
const icons:Record<SavedKind,string>={artists:'🎤',events:'📅',products:'🛍️'};
const PAGE_SIZE=5;
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
/**
 * 내 목록 (벤치마킹 G6).
 * 레퍼런스 4/4 공통: 탭에 카운트 · 카드 목록 · 첫 방문 Empty = 아이콘 + 왜 + "둘러보기" 1개 ·
 * 로딩 = 카드 Skeleton · 오류 = 원인 + Retry · 페이지네이션은 넘칠 때만 · 저장 해제 Undo.
 * 탭 카운트는 추가 요청 없이 방문한 탭의 totalCount 를 기억해 보여준다.
 */
export default function PersonalSavedScreen(_props:ScreenControllerProps) {
 const auth=useContext(AuthContext);const identity=auth?.isLoggedIn&&!auth.isLoading?String(auth.user?.userSqno??auth.user?.userId??''):'';
 const router=useRouter(),search=useSearchParams();
 const rawKind=search.get('kind');const kind:SavedKind=rawKind==='events'||rawKind==='products'?rawKind:'artists';
 const rawPage=Number(search.get('page')||1);const page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1;
 const [retry,setRetry]=useState(0);
 const navigate=(nextKind:SavedKind,nextPage:number)=>{focus.current=true;router.push('/view/KPOP_SAVED_ITEMS?kind='+nextKind+'&page='+nextPage,{scroll:false});};
 const key=identity+':'+kind+':'+page;
 const [result,setResult]=useState<{key:string;data?:SavedPage;error?:boolean}>({key:''});
 const [counts,setCounts]=useState<Partial<Record<SavedKind,number>>>({});
 const [deleting,setDeleting]=useState<number|null>(null),[message,setMessage]=useState('');
 const [undo,setUndo]=useState<{item:SavedRow;kind:SavedKind;busy?:boolean}|null>(null);
 const heading=useRef<HTMLHeadingElement>(null),focus=useRef(false),live=useRef(key);live.current=key;
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>{setMessage('');setDeleting(null);if(!identity)return;const abort=new AbortController();setResult({key});
  request(base+kind+'?page='+page,abort.signal).then(data=>{if(!abort.signal.aborted){setResult({key,data});setCounts(c=>({...c,[kind]:data.totalCount}));if(focus.current){focus.current=false;heading.current?.focus();}}}).catch(()=>{if(!abort.signal.aborted)setResult({key,error:true});});
  return ()=>{abort.abort();mutation.current?.abort();};
 },[key,identity,kind,page,retry]);
 useEffect(()=>{if(!undo||undo.busy)return;const t=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(t);},[undo]);
 if(auth?.isLoading)return <section className="page-wrap personal-saved"><div className="personal-saved-skeleton" role="status" aria-label="로그인을 확인하는 중"><Skeleton height={28} width="40%"/><Skeleton height={88}/><Skeleton height={88}/></div></section>;
 if(!identity)return <section className="page-wrap personal-saved"><h1>내 목록</h1><KrideStatePanel kind="forbidden" title="로그인이 필요해요" description="저장 목록은 나만 볼 수 있어서 로그인 뒤에 열려요." primaryAction={{label:'로그인',href:'/view/LOGIN_PAGE?returnTo='+encodeURIComponent('/view/KPOP_SAVED_ITEMS')}}/></section>;
 const current=result.key===key?result:{key};
 const remove=async(item:SavedRow)=>{if(deleting!==null)return;setDeleting(item.itemRef);setMessage('');const abort=new AbortController();mutation.current=abort;
  try{await request(base+kind+'/'+item.itemRef,abort.signal,'DELETE');if(live.current===key&&!abort.signal.aborted){focus.current=true;setUndo({item,kind});setRetry(x=>x+1);}}
  catch{if(live.current===key&&!abort.signal.aborted){setMessage('삭제하지 못했어요. 다시 시도해 주세요.');setDeleting(null);}}
 };
 const restore=async()=>{if(!undo||undo.busy)return;setUndo({...undo,busy:true});const abort=new AbortController();mutation.current=abort;
  try{await request(base+undo.kind+'/'+undo.item.itemRef,abort.signal,'POST');if(!abort.signal.aborted){setUndo(null);setRetry(x=>x+1);}}
  catch{if(!abort.signal.aborted){setUndo(null);setMessage('되돌리지 못했어요. 탐색 화면에서 다시 저장해 주세요.');}}
 };
 const total=current.data?.totalCount??0;
 return <section className="page-wrap personal-saved" aria-label="내 저장 목록">
  <div className="personal-saved-head"><Link className="personal-saved-back" href="/view/MY_PAGE">← 마이페이지</Link><h1>내 목록</h1><p>나만 볼 수 있는 저장 목록이에요.</p></div>
  <nav className="personal-saved-tabs" aria-label="저장 종류">{(Object.keys(labels) as SavedKind[]).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{navigate(k,1);}}>{labels[k]}{counts[k]!==undefined&&<b className="personal-saved-tabs__count">{counts[k]}</b>}</button>)}</nav>
  <h2 ref={heading} tabIndex={-1} className="personal-saved-title">{labels[kind]} 저장 목록{current.data?` · ${total}개`:''}</h2>
  {message&&<p role="alert" className="personal-saved-alert">{message}</p>}
  {current.error?<KrideStatePanel kind="error" title="내 목록을 불러오지 못했어요" description="빈 목록이 아니라 불러오기에 실패한 거예요. 네트워크를 확인하고 다시 시도해 주세요." primaryAction={{label:'다시 시도',onClick:()=>setRetry(x=>x+1)}}/>
  :!current.data?<div className="personal-saved-skeleton" role="status" aria-label={labels[kind]+' 저장 목록을 불러오는 중'}><Skeleton height={88}/><Skeleton height={88}/><Skeleton height={88}/></div>
  :<>
   {current.data.items.length===0
    ?<KrideStatePanel kind="empty-first" icon={icons[kind]} title={`아직 저장한 ${labels[kind]}가 없어요`} description={`K-pop 탭에서 관심 있는 ${labels[kind]}의 저장 버튼을 누르면 여기에 모여요.`} primaryAction={{label:`${labels[kind]} 둘러보기`,href:browse[kind]}}/>
    :<ul className="personal-saved-list">{current.data.items.map(item=><li key={item.id} className={'personal-saved-item'+(item.visibility==='PRIVATE'?' is-private':'')}>
     <div className="personal-saved-item__body"><h3>{item.visibility==='PRIVATE'?'비공개 항목':item.title}</h3><p>{item.visibility==='PRIVATE'?'비공개 · 공개 승인이 취소되었거나 더 이상 제공되지 않는 항목입니다. 저장 기록은 삭제할 수 있어요.':'공개'}</p></div>
     <div className="personal-saved-item__actions">
      {item.visibility==='PUBLIC'&&<a className="personal-saved-item__link" href={kind==='artists'?'/view/KPOP_ARTIST_DETAIL/'+item.itemRef:kind==='events'?'/view/KPOP_EVENT_DETAIL/'+item.itemRef:'/view/KPOP_PRODUCTS?itemId='+item.itemRef}>보기</a>}
      <button className="personal-saved-item__remove" disabled={deleting!==null} onClick={()=>remove(item)}>{deleting===item.itemRef?'삭제 중…':'삭제'}</button>
     </div></li>)}</ul>}
   {total>PAGE_SIZE&&<><Pagination totalCount={total} pageSize={PAGE_SIZE} currentPage={current.data.page} onPageChange={next=>{navigate(kind,next);}}/><p className="personal-saved-pageinfo">{current.data.page}페이지 · {PAGE_SIZE}개씩</p></>}
  </>}
  {undo&&<div className="kride-undo-toast" role="status"><span>저장을 취소했어요</span><button type="button" onClick={restore} disabled={undo.busy}>{undo.busy?'되돌리는 중…':'되돌리기'}</button></div>}
 </section>;
}
