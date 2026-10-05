'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {normalizeCandidate,ProductCard,ProductCandidate} from './KpopProducts';
import type {ScreenControllerProps} from '@/components/screens/types';
type Result={key:string;status:'loading'|'ready'|'error'|'invalid';items?:ProductCandidate[]};
const LIST='/view/KPOP_PRODUCTS';
export default function PublicProductCatalogScreen(_props:ScreenControllerProps) {
    const router=useRouter(),search=useSearchParams(),query=search.get('q')?.trim()||'';
    const artistId=search.get('artistId')||'',eventId=search.get('eventId')||'';
    const key=JSON.stringify([query,artistId,eventId]);
    const [draft,setDraft]=useState(query),[inputError,setInputError]=useState(''),[retry,setRetry]=useState(0);
    const [result,setResult]=useState<Result>({key,status:'loading'});
    const current:Result=result.key===key?result:{key,status:'loading'};
    const heading=useRef<HTMLHeadingElement>(null),focus=useRef(false);
    useEffect(()=>{setDraft(query);setInputError('');},[query]);
    useEffect(()=>{
        let active=true;const abort=new AbortController();
        if(query.length>120){setResult({key,status:'invalid'});return ()=>{active=false;};}
        setResult({key,status:'loading'});
        const params=new URLSearchParams({view:'public',limit:'20'});
        if(query)params.set('q',query);if(artistId)params.set('artistId',artistId);if(eventId)params.set('eventId',eventId);
        const timer=setTimeout(()=>abort.abort(),15000);
        (async()=>{try{
            const response=await fetch('/api/v1/kpop/product-candidates?'+params,{signal:abort.signal,credentials:'omit',cache:'no-store'});
            if(response.status===400){if(active)setResult({key,status:'invalid'});return;}
            if(!response.ok)throw new Error('candidate read failed');
            const {data}=await response.json();
            if(!Array.isArray(data)||response.headers.get('X-Candidate-Policy')!=='public-evidence-v1')throw new Error('invalid public contract');
            if(active)setResult({key,status:'ready',items:data.map(normalizeCandidate)});
        }catch{if(active)setResult({key,status:'error'});}finally{clearTimeout(timer);}})();
        return ()=>{active=false;clearTimeout(timer);abort.abort();};
    },[key,retry,query,artistId,eventId]);
    useEffect(()=>{if(current.status!=='loading'&&focus.current){focus.current=false;heading.current?.focus();}},[current.status]);
    const navigate=(value:string,reset=false)=>{
        const q=value.trim();if(q.length>120){setInputError('검색어는 120자 이내로 입력해 주세요.');return;}
        setInputError('');focus.current=true;
        const params=new URLSearchParams();if(q)params.set('q',q);
        if(!reset){if(artistId)params.set('artistId',artistId);if(eventId)params.set('eventId',eventId);}
        if(q===query&&(!reset||!artistId&&!eventId))setRetry(x=>x+1);
        else router.push(LIST+(params.toString()?'?'+params:''),{scroll:false});
    };
    const submit=(e:FormEvent)=>{e.preventDefault();navigate(draft);};
    return <section className="page-wrap kpop-screen public-products" aria-label="공개 상품 후보">
        <p className="kpop-eyebrow">K-POP · 공개 상품 후보</p><h1>상품명·브랜드로 후보 찾기</h1>
        <p>검색 결과는 후보이며 동일 상품·정품·구매 적합성을 보증하지 않습니다. 현재 재고와 가격도 보증하지 않아요.</p>
        <p>승인된 후보 중 근거 설명·출처·확인 시각이 있고, 근거 등급이 ‘근거가 비교적 강한 후보’ 또는 ‘유사 후보’인 항목만 보여요. 근거 부족의 빈 결과도 정상입니다.</p>
        <p>확인 시각은 카탈로그에 기록된 값이에요. 원본에 시간대가 없어 한국 시간으로 바꾸지 않았어요.</p>
        <form role="search" onSubmit={submit} className="public-product-search">
            <label htmlFor="public-product-query">상품명 또는 브랜드</label><div><input id="public-product-query" type="search" value={draft} onChange={e=>{setDraft(e.target.value);setInputError('');}} aria-describedby="public-product-help"/>
                <button type="submit">후보 검색</button><button type="button" onClick={()=>{setDraft('');navigate('',true);}}>초기화</button></div>
            <p id="public-product-help">검색어는 120자까지 입력할 수 있어요. 한 번에 최대 20개 후보를 보여요.</p>
            {inputError&&<p role="alert">{inputError}</p>}
        </form>
        <h2 ref={heading} tabIndex={-1} aria-live="polite">{current.status==='loading'?'후보를 찾는 중…':current.status==='error'?'불러오기 오류':current.status==='invalid'?'검색 조건 확인':`공개 후보 ${current.items?.length??0}개`}</h2>
        {current.status==='invalid'&&<p role="alert">검색어는 120자 이내로 입력해 주세요. 주소의 아티스트·이벤트 번호도 올바른 양수여야 해요.</p>}
        {current.status==='error'&&<div role="alert"><p>상품 후보를 불러오지 못했어요. 빈 후보와 다른 오류이며 검색 조건은 유지됩니다.</p><button onClick={()=>{focus.current=true;setRetry(x=>x+1);}}>다시 시도</button></div>}
        {current.status==='ready'&&(current.items?.length?<div role="list" className="kpop-product-list" aria-label="읽기 전용 상품 후보">{current.items.map(item=><ProductCard key={item.id} candidate={item} readOnly/>)}</div>:<p role="status">조건에 맞고 공개 근거가 충분한 후보가 없어요. 상품이 없다는 뜻은 아니며, 근거 부족도 정상적인 결과입니다. 검색어를 바꾸거나 초기화해 주세요.</p>)}
    </section>;
}
