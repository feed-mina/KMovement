'use client';
import {FormEvent, useEffect, useRef, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import type {ScreenControllerProps} from '@/components/screens/types';
import {KpopEventCard} from './KpopCards';
type Filters = {from:string; to:string; region:string};
type Item = {id:number; date:string; ended:boolean; [key:string]:unknown};
type Result = {key:string; status:'loading'|'ready'|'error'|'missing'|'invalid'; items?:Item[]; item?:Item; today?:string};
const LIST='/view/KPOP_EVENTS';
function params(filters:Filters) {
    const search=new URLSearchParams();
    for(const name of ['from','to','region'] as const) if(filters[name].trim()) search.set(name,filters[name].trim());
    return search.toString();
}
function validDate(value:string) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000')) return false;
    const date=new Date(value+'T00:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function eventFilterError(filters:Filters,today?:string) {
    if([filters.from,filters.to].some(value=>value&&!validDate(value))) return '유효한 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.';
    if(filters.from&&filters.to&&filters.from>filters.to) return '종료일은 시작일보다 빠를 수 없어요.';
    if(!filters.from&&filters.to&&today&&filters.to<today) return '종료일이 한국 시간 오늘보다 이전이에요. 과거 일정은 시작일도 입력해 주세요.';
    if(filters.region.trim().length>100) return '지역은 100자 이내로 입력해 주세요.';
    return '';
}
export default function EventCatalogScreen({screenId,refId}:ScreenControllerProps) {
    const router=useRouter(),search=useSearchParams();
    const applied:Filters={from:search.get('from')?.trim()||'',to:search.get('to')?.trim()||'',region:search.get('region')?.trim()||''};
    const filterKey=params(applied),detail=screenId==='KPOP_EVENT_DETAIL',key=JSON.stringify([detail,refId,filterKey]);
    const [draft,setDraft]=useState(applied),[inputError,setInputError]=useState(''),[retry,setRetry]=useState(0);
    const [result,setResult]=useState<Result>({key,status:'loading'});
    const current:Result=result.key===key?result:{key,status:'loading'};
    const heading=useRef<HTMLHeadingElement>(null),focus=useRef(false);
    useEffect(()=>{setDraft({from:search.get('from')?.trim()||'',to:search.get('to')?.trim()||'',region:search.get('region')?.trim()||''});setInputError('');},[filterKey]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(()=>{
        let active=true;
        const abort=new AbortController();
        if(!detail&&eventFilterError(applied)){setResult({key,status:'invalid'});return ()=>{active=false;};}
        if(detail&&!/^\d+$/.test(String(refId??''))){setResult({key,status:'missing'});return ()=>{active=false;};}
        setResult({key,status:'loading'});
        const timer=setTimeout(()=>abort.abort(),15000);
        const url=detail?`/api/v1/kpop/events/${encodeURIComponent(String(refId))}`:`/api/v1/kpop/events${filterKey?'?'+filterKey:''}`;
        (async()=>{try{
            const response=await fetch(url,{signal:abort.signal,credentials:'omit',cache:'no-store'});
            if(detail&&response.status===404){if(active)setResult({key,status:'missing'});return;}
            if(response.status===400){if(active)setResult({key,status:'invalid'});return;}
            if(!response.ok)throw new Error('event read failed');
            const {data}=await response.json(),today=response.headers.get('X-Kpop-Today')??'';
            if(!validDate(today)||response.headers.get('X-Kpop-Time-Zone')!=='Asia/Seoul'||(detail?!data?.id:!Array.isArray(data)))throw new Error('invalid event contract');
            if(active)setResult(detail?{key,status:'ready',item:data,today}:{key,status:'ready',items:data,today});
        }catch{if(active)setResult({key,status:'error'});}finally{clearTimeout(timer);}})();
        return ()=>{active=false;clearTimeout(timer);abort.abort();};
    },[key,retry]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(()=>{if(current.status!=='loading'&&focus.current){focus.current=false;heading.current?.focus();}},[current.status]);
    const navigate=(filters:Filters)=>{setInputError('');focus.current=true;const next=params(filters);if(next===filterKey)setRetry(x=>x+1);else router.push(LIST+(next?'?'+next:''),{scroll:false});};
    const apply=(e:FormEvent)=>{e.preventDefault();const error=eventFilterError(draft,current.today);setInputError(error);if(!error)navigate(draft);};
    const open=(meta:Record<string,any>)=>router.push(meta.actionUrl+(filterKey?'?'+filterKey:''));
    return <section className="page-wrap kpop-screen event-catalog" aria-label="이벤트 공개 목록">
        <p className="kpop-eyebrow">K-POP · 이벤트</p><h1>{detail?'이벤트 상세':'이벤트 일정 찾기'}</h1>
        <p>로그인 없이 검수된 일정을 확인해요. 이벤트와 연결 아티스트가 모두 공개 승인된 일정만 보여요.</p>
        <p>날짜는 한국 시간(Asia/Seoul) 기준이에요. {current.today?`서버 기준 오늘: ${current.today}. `:''}시작일과 종료일을 모두 포함하며, 시작일을 비우면 오늘부터 찾아요.</p>
        <p>‘종료된 일정’은 행사 날짜가 지난 뜻이에요. 오늘 행사의 실제 종료 시각은 공식 안내를 확인해 주세요.</p>
        {detail?<a href={LIST+(filterKey?'?'+filterKey:'')}>이벤트 목록으로</a>:<form onSubmit={apply} noValidate className="event-filters" aria-label="이벤트 조건">
            {(['from','to','region'] as const).map(name=><label key={name} htmlFor={'event-'+name}>{name==='from'?'시작일':name==='to'?'종료일':'지역'}
                <input id={'event-'+name} type={name==='region'?'text':'date'} value={draft[name]} maxLength={name==='region'?100:undefined} placeholder={name==='region'?'예: 서울 (지역명 일치)':undefined} onChange={e=>{setDraft(v=>({...v,[name]:e.target.value}));setInputError('');}} aria-describedby="event-input-help"/>
            </label>)}
            <div className="event-filter-actions"><button type="submit">적용</button><button type="button" onClick={()=>{setDraft({from:'',to:'',region:''});navigate({from:'',to:'',region:''});}}>초기화</button></div>
            <p id="event-input-help">지역은 앞뒤 공백을 뺀 이름이 정확히 같은 일정만 찾아요. 과거 일정은 시작일을 입력해 주세요.</p>
            {inputError&&<p role="alert">{inputError}</p>}
        </form>}
        <h2 tabIndex={-1} ref={heading} aria-live="polite">{current.status==='loading'?'일정을 불러오는 중…':current.status==='error'?'불러오기 오류':current.status==='invalid'?'검색 조건 확인':detail?'상세 정보':`검색 결과 ${current.items?.length??0}건`}</h2>
        <div aria-busy={current.status==='loading'}>
            {current.status==='error'&&<div role="alert"><p>일정을 불러오지 못했어요. 조건을 유지한 채 다시 시도해 주세요.</p><button onClick={()=>{focus.current=true;setRetry(x=>x+1);}}>다시 시도</button></div>}
            {current.status==='invalid'&&<p role="alert">날짜 형식과 순서를 확인해 주세요. 종료일만 입력할 때는 한국 시간 오늘 이후여야 해요. 과거 일정은 시작일도 입력해 주세요.</p>}
            {current.status==='missing'&&<p role="status">공개된 이벤트를 찾을 수 없어요. 주소를 확인하거나 목록으로 돌아가 주세요.</p>}
            {current.status==='ready'&&detail&&current.item&&<KpopEventCard data={current.item} meta={{componentId:'kpop_event_detail'}} readOnly/>}
            {current.status==='ready'&&!detail&&(current.items?.length?<div className="kpop-grid event-grid">{current.items.map(item=><KpopEventCard key={item.id} data={item} readOnly onAction={open}/>)}</div>:<p role="status">{filterKey?'선택한 기간·지역에 공개된 일정이 없어요. 조건을 바꾸거나 초기화해 주세요.':'오늘 이후 공개된 일정이 아직 없어요. 과거 일정은 시작일을 입력해 확인할 수 있어요.'}</p>)}
        </div>
    </section>;
}
