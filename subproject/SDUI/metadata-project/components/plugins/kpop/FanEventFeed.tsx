"use client";
import {FormEvent,useContext,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AuthContext} from '@/context/AuthContext';
import KpopNav from './KpopNav';
import ArtistReturn from './ArtistReturn';
import {SavedToggle} from './PersonalSaved';
import Skeleton from '@/components/utils/Skeleton';
import KrideStatePanel from '@/components/fields/kride/atoms/KrideStatePanel';

type Event={id:number;artistId:number;artistNameKo:string;titleKo:string;date:string;region:string;venue:string;officialUrl:string;geography:string};
type Feed={items:Event[];totalCount:number;page:number;pageSize:number;artists:{id:number;name:string}[];counts:Record<string,number>;countries:Record<string,string>;audience:string};
const areas:Record<string,string>={all:'전체',domestic:'국내 · 대한민국',overseas:'해외',online:'온라인',unknown:'위치 미확인'};
const WEEKDAYS=['일','월','화','수','목','금','토'];

// 벤치마킹 H7 (2026-10-20): 기간은 프리셋으로 즉시 반영한다. 시작일은 오늘(로컬 날짜), 종료일은 프리셋 끝.
export type PeriodPreset='week'|'month'|'quarter';
export const PERIOD_PRESETS:{key:PeriodPreset;label:string}[]=[{key:'week',label:'이번 주'},{key:'month',label:'이번 달'},{key:'quarter',label:'3개월'}];
const pad=(n:number)=>String(n).padStart(2,'0');
export const toDateInput=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export function presetRange(kind:PeriodPreset,now=new Date()):{from:string;to:string}{
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const end=new Date(start);
 if(kind==='week')end.setDate(start.getDate()+6);
 else if(kind==='month'){end.setMonth(start.getMonth()+1,0);}
 else end.setDate(start.getDate()+90);
 return {from:toDateInput(start),to:toDateInput(end)};
}
/** "2026-10-24" → {month:'2026년 10월', day:'24', weekday:'금'} */
export function dateParts(date:string){
 const parsed=new Date(date+'T00:00:00');
 const valid=!Number.isNaN(parsed.getTime());
 return {month:`${date.slice(0,4)}년 ${Number(date.slice(5,7))}월`,day:String(Number(date.slice(8,10))||date.slice(8)),weekday:valid?WEEKDAYS[parsed.getDay()]:''};
}

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
 const activePreset=PERIOD_PRESETS.find(p=>{const r=presetRange(p.key);return r.from===from&&r.to===to;})?.key;
 const data=current.data,artists=data?.artists??[],back='/view/KPOP_EVENTS?'+new URLSearchParams({...Object.fromEntries(search),scope});
 const guest=!auth?.isLoading&&!identity&&scope==='all';
 // 월 구분 헤더: 등록 날짜순 목록을 순서대로 읽으며 달이 바뀔 때만 헤더를 넣는다.
 const monthCounts=(data?.items??[]).reduce<Record<string,number>>((acc,e)=>{const m=dateParts(e.date).month;acc[m]=(acc[m]??0)+1;return acc;},{});
 return <section className="page-wrap fan-events" aria-label="팬 일정">
  <KpopNav counts={{events:data?.totalCount}}/><ArtistReturn/><div className="fan-event-intro"><div><p className="kpop-eyebrow">FAN MOMENTS · 팬 일정</p><h1>좋아하는 아티스트와 <br/>다음에 만날 순간</h1><p>내 아티스트의 일정을, 원하는 나라와 날짜로 찾아보세요.</p></div><a href={"/view/KPOP_SAVED_ITEMS?kind=artists&returnEvents="+encodeURIComponent(back)}>♡ 내 아티스트 관리</a></div>
  <div className="fan-filters">
   <div className="fan-seg" role="group" aria-label="일정 대상"><button aria-pressed={scope==='mine'} onClick={()=>navigate({scope:'mine',artistId:''})}>내 아티스트</button><button aria-pressed={scope==='all'} onClick={()=>navigate({scope:'all',artistId:''})}>전체 아티스트</button></div>
   {current.state!=='login'&&<label className="fan-filters__select"><span className="fan-sr-only">누구의 일정을 볼까요?</span><select id="fan-artist" aria-label="누구의 일정을 볼까요?" value={artist} onChange={e=>navigate({artistId:e.target.value})}><option value="">아티스트 전체</option>{artists.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   <div className="fan-filter-row" role="group" aria-label="개최 구분">{Object.entries(areas).map(([value,label])=><button key={value} aria-pressed={geo===value} onClick={()=>navigate({geography:value,countryCode:''})}>{label}{data?.counts[value]!==undefined&&<span> {data.counts[value]}</span>}</button>)}</div>
   {geo==='overseas'&&<label className="fan-filters__select"><span className="fan-sr-only">국가·지역</span><select aria-label="해외 국가·지역" value={country} onChange={e=>navigate({countryCode:e.target.value})}><option value="">국가 전체</option>{Object.entries(data?.countries??{}).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>}
   <div className="fan-filter-row fan-presets" role="group" aria-label="기간">{PERIOD_PRESETS.map(p=><button key={p.key} aria-pressed={activePreset===p.key} onClick={()=>navigate(presetRange(p.key))}>{p.label}</button>)}
    <details className="fan-custom-range" open={Boolean(from||to)&&!activePreset}><summary>직접 입력{from&&!activePreset?` · ${from}${to?' ~ '+to:' ~'}`:''}</summary>
     <form onSubmit={apply}><label>시작일<input type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label><label>종료일<input type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label><button type="submit">날짜 적용</button>{inputError&&<p role="alert">{inputError}</p>}</form>
    </details>
    <button className="fan-reset" onClick={()=>{setDraft({from:'',to:''});setInputError('');navigate({},true);}}>조건 초기화</button>
   </div>
  </div>
  {guest&&<div className="fan-guest-banner"><p><b>내 아티스트</b> 일정만 모아보려면 로그인하세요</p><a href={'/view/LOGIN_PAGE?returnTo='+encodeURIComponent(back)}>로그인</a></div>}
  {auth?.isLoading?<FanSkeleton label="로그인을 확인하고 있어요"/>:current.state==='login'?<KrideStatePanel kind="forbidden" title="내 아티스트의 일정을 모아보세요" description="로그인하면 저장한 아티스트의 일정을 볼 수 있어요. 전체 일정에서는 로그인 없이 직접 아티스트를 고를 수 있어요." primaryAction={{label:'로그인하고 돌아오기',href:'/view/LOGIN_PAGE?returnTo='+encodeURIComponent(back)}} secondaryAction={{label:'전체 일정 둘러보기',onClick:()=>navigate({scope:'all'})}}/>:
   <div className="fan-event-results">
    <div className="fan-results-heading"><h2>다가오는 팬 일정</h2></div>
    <p className="fan-result-summary" aria-live="polite">{scope==='mine'?'내 아티스트':'전체 아티스트'} · {areas[geo]||'조건 확인'} {data?'· '+data.totalCount+'건':''} · 등록 날짜순 · 시간·변경 여부는 <a href="#fan-notice">공식 안내</a>에서 확인</p>
    {current.state==='loading'&&<FanSkeleton label="일정을 불러오고 있어요"/>}
    {current.state==='error'&&<KrideStatePanel kind="error" title="일정을 불러오지 못했어요" description="빈 목록이 아니라 조회 오류예요. 조건은 그대로 두고 다시 시도해 주세요." primaryAction={{label:'다시 시도',onClick:()=>setRetry(v=>v+1)}}/>}
    {current.state==='invalid'&&<p role="alert">날짜와 검색 조건을 확인해 주세요. 조건 초기화로 다시 볼 수 있어요.</p>}
    {current.state==='ready'&&(scope==='mine'&&!artists.length?<KrideStatePanel kind="empty-first" icon="💜" title="좋아하는 아티스트부터 담아볼까요?" description="아직 공개된 내 아티스트가 없어요." primaryAction={{label:'아티스트 고르기',href:'/view/kpop'}}/>:!data!.items.length?<KrideStatePanel kind="empty-filtered" icon="📅" title={Number(page)>1?'이 페이지에 일정이 없어요':'이 조건의 일정이 아직 없어요'} description="아티스트·개최 구분·날짜 조건을 바꿔보세요." primaryAction={Number(page)>1?{label:'첫 페이지로',onClick:()=>navigate({page:'1'})}:undefined}/>:data!.items.map((event,index)=>{
     const parts=dateParts(event.date);const prev=index>0?dateParts(data!.items[index-1].date).month:null;
     return <div key={event.id}>
      {parts.month!==prev&&<h3 className="fan-month"><span>{parts.month}</span><small>{monthCounts[parts.month]}건</small></h3>}
      <article className="fan-event-row"><time className="fan-event-date" dateTime={event.date}><b>{parts.day}</b><small>{parts.weekday}</small></time><div><p className="fan-event-artist">{event.artistNameKo} <span>{areas[event.geography]}</span></p><h4><a href={'/view/KPOP_EVENT_DETAIL/'+event.id+'?'+new URLSearchParams({returnEvents:back})}>{event.titleKo}</a></h4><p>{event.region||'위치 미확인'} · {event.venue||'장소 확인 필요'}</p></div><div className="fan-event-actions"><SavedToggle kind="events" itemRef={event.id} guestPrompt saveLabel="♡ 일정 저장" savedLabel="저장됨 · 해제"/>{event.officialUrl?.startsWith('https://')&&<a href={event.officialUrl} target="_blank" rel="noreferrer">공식 안내 ↗</a>}</div></article>
     </div>;}))}
    {data&&data.totalCount>12&&<nav className="fan-pagination" aria-label="일정 페이지"><button disabled={data.page<=1} onClick={()=>navigate({page:String(data.page-1)})}>이전</button><span>{data.page} / {Math.ceil(data.totalCount/12)}</span><button disabled={data.page*12>=data.totalCount} onClick={()=>navigate({page:String(data.page+1)})}>다음</button></nav>}
    <details id="fan-notice" className="fan-notice"><summary>지역·날짜 안내</summary><p>국내는 대한민국입니다. 지역 구분은 등록 정보 기준이며 개최지와 변경 여부는 공식 안내를 확인해 주세요.</p><p>등록된 날짜순으로 표시합니다. 시간·현지 시간대가 확인되지 않아 한국 시간으로 변환하지 않습니다. 시작일을 비우면 한국 날짜 기준 오늘부터 조회합니다.</p></details>
   </div>}
 </section>;
}

function FanSkeleton({label}:{label:string}){
 return <div className="fan-event-skeleton" role="status" aria-live="polite" aria-label={label}><Skeleton height={72}/><Skeleton height={72}/><Skeleton height={72}/></div>;
}
