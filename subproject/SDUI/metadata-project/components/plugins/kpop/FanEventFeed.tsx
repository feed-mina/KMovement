"use client";
import {FormEvent,useContext,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AuthContext} from '@/context/AuthContext';
import KpopNav from './KpopNav';
import {SavedToggle} from './PersonalSaved';
import {reviewedPhoto} from './ArtistMedia';

type Event={id:number;artistId:number;artistNameKo:string;titleKo:string;date:string;region:string;venue:string;officialUrl:string;geography:string};
type Feed={items:Event[];totalCount:number;page:number;pageSize:number;artists:{id:number;name:string}[];counts:Record<string,number>;countries:Record<string,string>;audience:string};
const areas:Record<string,string>={all:'전체',domestic:'국내 · 대한민국',overseas:'해외',online:'온라인',unknown:'위치 미확인'};
export default function FanEventFeed(){
 const auth=useContext(AuthContext),search=useSearchParams(),router=useRouter();
 const identity=auth?.isLoggedIn?String(auth.user?.userSqno??auth.user?.userId??''):'';
 const scope=search.get('scope')==='all'?'all':search.get('scope')==='mine'?'mine':identity?'mine':'all';
 const geo=search.get('geography')||'all',artist=search.get('artistId')||'',country=search.get('countryCode')||'';
 const from=search.get('from')||'',to=search.get('to')||'',page=search.get('page')||'1';
 const [draft,setDraft]=useState({from,to});const [retry,setRetry]=useState(0);
 const params=new URLSearchParams({geography:geo,page});if(artist)params.set('artistId',artist);if(country)params.set('countryCode',country);if(from)params.set('from',from);if(to)params.set('to',to);
 const requestKey=params.toString(),key=identity+':'+scope+':'+requestKey;
 const [result,setResult]=useState<{key:string;state:'loading'|'ready'|'error'|'invalid'|'login';data?:Feed}>({key:'',state:'loading'});
 const current=result.key===key?result:{key,state:'loading' as const};
 const [inputError,setInputError]=useState('');
 useEffect(()=>setDraft({from,to}),[from,to]);
 useEffect(()=>{
  if(auth?.isLoading)return;
  if(scope==='mine'&&!identity){setResult({key,state:'login'});return;}
  let active=true;const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),15000);setResult({key,state:'loading'});
  (async()=>{try{const response=await fetch('/api/v1/kpop/'+(scope==='mine'?'me/':'')+'event-feed?'+requestKey,{credentials:scope==='mine'?'include':'omit',cache:'no-store',signal:abort.signal});
   if(!active)return;if(response.status===401||response.status===403){setResult({key,state:'login'});return;}if(response.status===400){setResult({key,state:'invalid'});return;}if(!response.ok)throw Error('read');
   const {data}=await response.json();if(response.headers.get('X-Event-Feed-Policy')!=='fan-events-v1'||!Array.isArray(data?.items)||!Array.isArray(data?.artists)||data.audience!==scope||!Number.isInteger(data.totalCount))throw Error('contract');
   if(active)setResult({key,state:'ready',data});
  }catch{if(active)setResult({key,state:'error'});}finally{clearTimeout(timeout);}})();
  return()=>{active=false;abort.abort();clearTimeout(timeout);};
 },[key,scope,identity,requestKey,retry,auth?.isLoading]);
 const navigate=(changes:Record<string,string>,reset=false)=>{const p=new URLSearchParams(reset?'':search.toString());p.set('scope',scope);p.delete('page');for(const [k,v]of Object.entries(changes)){if(v)p.set(k,v);else p.delete(k);}router.push('/view/KPOP_EVENTS?'+p.toString(),{scroll:false});};
 const apply=(e:FormEvent)=>{e.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to){setInputError('종료일을 시작일 이후로 선택해 주세요.');return;}setInputError('');navigate(draft);};
 const data=current.data,artists=data?.artists??[],top=artists.slice(0,6),back='/view/KPOP_EVENTS?'+new URLSearchParams({...Object.fromEntries(search),scope});
 return <section className="page-wrap fan-events" aria-label="팬 일정">
  <KpopNav/><div className="fan-event-intro"><div><p className="kpop-eyebrow">FAN MOMENTS · 팬 일정</p><h1>좋아하는 아티스트와 <br/>다음에 만날 순간</h1><p>내 아티스트의 일정을, 원하는 나라와 날짜로 찾아보세요.</p></div><a href={"/view/KPOP_SAVED_ITEMS?kind=artists&returnEvents="+encodeURIComponent(back)}>♡ 내 아티스트 관리</a></div>
  <div className="fan-filter-row" aria-label="일정 대상"><button aria-pressed={scope==='mine'} onClick={()=>navigate({scope:'mine',artistId:''})}>내 아티스트</button><button aria-pressed={scope==='all'} onClick={()=>navigate({scope:'all',artistId:''})}>전체 아티스트</button></div>
  {auth?.isLoading?<p role="status">로그인을 확인하고 있어요…</p>:current.state==='login'?<div className="fan-event-notice"><h2>내 아티스트의 일정을 모아보세요</h2><p>로그인하면 저장한 아티스트의 일정을 볼 수 있어요. 전체 일정에서는 로그인 없이 직접 아티스트를 고를 수 있어요.</p><a href={'/view/LOGIN_PAGE?returnTo='+encodeURIComponent(back)}>로그인하고 돌아오기</a><button onClick={()=>navigate({scope:'all'})}>전체 일정 둘러보기</button></div>:<>
   <div className="fan-artists"><label htmlFor="fan-artist">누구의 일정을 볼까요?</label><select id="fan-artist" value={artist} onChange={e=>navigate({artistId:e.target.value})}><option value="">함께 보기</option>{artists.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><div className="fan-artist-chips">{top.map(a=><button key={a.id} aria-pressed={artist===String(a.id)} onClick={()=>navigate({artistId:artist===String(a.id)?'':String(a.id)})}>{reviewedPhoto(a.id)&&<img src={reviewedPhoto(a.id)!.src} alt="" onError={e=>{e.currentTarget.hidden=true;}}/>}{a.name}</button>)}</div>{top.some(a=>reviewedPhoto(a.id))&&<details className="fan-photo-credit"><summary>사진 출처</summary>{top.map(a=>{const p=reviewedPhoto(a.id);return p?<p key={a.id}>{a.name} · {p.credit} · <a href={p.sourceUrl} target="_blank" rel="noreferrer">원본</a> · <a href={p.licenseUrl} target="_blank" rel="noreferrer">{p.license}</a></p>:null;})}</details>}</div>
   <div className="fan-filter-row" aria-label="개최 구분">{Object.entries(areas).map(([value,label])=><button key={value} aria-pressed={geo===value} onClick={()=>navigate({geography:value,countryCode:''})}>{label}{data?.counts[value]!==undefined&&<span> {data.counts[value]}</span>}</button>)}</div>
   <div className="fan-event-board"><aside><h2>언제 함께할까요?</h2><form onSubmit={apply}><label>시작일<input type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label><label>종료일<input type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label><button type="submit">날짜 적용</button>{inputError&&<p role="alert">{inputError}</p>}</form><button onClick={()=>{setDraft({from:'',to:''});setInputError('');navigate({},true);}}>조건 초기화</button><details><summary>지역·날짜 안내</summary><p>국내는 대한민국입니다. 지역 구분은 등록 정보 기준이며 개최지와 변경 여부는 공식 안내를 확인해 주세요.</p><p>등록된 날짜순으로 표시합니다. 시간·현지 시간대가 확인되지 않아 한국 시간으로 변환하지 않습니다. 시작일을 비우면 한국 날짜 기준 오늘부터 조회합니다.</p></details></aside>
    <div className="fan-event-results"><div className="fan-results-heading"><h2>다가오는 팬 일정</h2>{geo==='overseas'&&<label>국가·지역<select aria-label="해외 국가·지역" value={country} onChange={e=>navigate({countryCode:e.target.value})}><option value="">전체</option>{Object.entries(data?.countries??{}).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>}</div>
    <p className="fan-result-summary" aria-live="polite">{scope==='mine'?'내 아티스트':'전체 아티스트'} · {areas[geo]||'조건 확인'} {data?'· '+data.totalCount+'건':''}</p>
    {current.state==='loading'&&<p role="status">일정을 불러오고 있어요…</p>}
    {current.state==='error'&&<div role="alert"><p>일정을 불러오지 못했어요. 빈 목록이 아니라 조회 오류예요.</p><button onClick={()=>setRetry(v=>v+1)}>다시 시도</button></div>}
    {current.state==='invalid'&&<p role="alert">날짜와 검색 조건을 확인해 주세요. 조건 초기화로 다시 볼 수 있어요.</p>}
    {current.state==='ready'&&(scope==='mine'&&!artists.length?<div className="fan-event-notice"><h3>좋아하는 아티스트부터 담아볼까요?</h3><p>아직 공개된 내 아티스트가 없어요.</p><a href="/view/kpop">아티스트 고르기</a></div>:!data!.items.length?<div className="fan-event-notice"><h3>{Number(page)>1?'이 페이지에 일정이 없어요':'이 조건의 일정이 아직 없어요'}</h3><p>아티스트·개최 구분·날짜 조건을 바꿔보세요.</p>{Number(page)>1&&<button onClick={()=>navigate({page:'1'})}>첫 페이지로</button>}</div>:data!.items.map(event=><article className="fan-event-row" key={event.id}><time className="fan-event-date" dateTime={event.date}><small>{event.date.slice(5,7)}월</small><b>{event.date.slice(8)}</b><small>{event.date.slice(0,4)}</small></time><div><p className="fan-event-artist">{event.artistNameKo} <span>{areas[event.geography]}</span></p><h3><a href={'/view/KPOP_EVENT_DETAIL/'+event.id+'?'+new URLSearchParams({returnEvents:back})}>{event.titleKo}</a></h3><p>{event.region||'위치 미확인'} · {event.venue||'장소 확인 필요'}</p><small>등록 날짜 · 시간·변경 여부는 공식 안내 확인</small></div><div className="fan-event-actions"><SavedToggle kind="events" itemRef={event.id} guestPrompt saveLabel="♡ 일정 저장" savedLabel="저장됨 · 해제"/>{event.officialUrl?.startsWith('https://')&&<a href={event.officialUrl} target="_blank" rel="noreferrer">공식 안내 ↗</a>}</div></article>))}
    {data&&data.totalCount>12&&<nav className="fan-pagination" aria-label="일정 페이지"><button disabled={data.page<=1} onClick={()=>navigate({page:String(data.page-1)})}>이전</button><span>{data.page} / {Math.ceil(data.totalCount/12)}</span><button disabled={data.page*12>=data.totalCount} onClick={()=>navigate({page:String(data.page+1)})}>다음</button></nav>}
    </div></div>
  </>}
 </section>;
}
