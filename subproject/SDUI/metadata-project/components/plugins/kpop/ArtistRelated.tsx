'use client';
import {useEffect,useState} from 'react';
import {usePathname,useSearchParams,useRouter} from 'next/navigation';
type Item={id:number;artistId:number;title?:string;titleKo?:string;name?:string;date?:string};
export default function ArtistRelated({id,name}:{id:number;name:string}) {
    const pathname=usePathname(), search=useSearchParams(),router=useRouter();
    const back=pathname+(search.toString()?'?'+search.toString():'');
    const tab=search.get('section')==='products'?'products':'events';
    const setTab=(value:'events'|'products')=>{const params=new URLSearchParams(search.toString());params.set('section',value);router.replace(pathname+'?'+params.toString(),{scroll:false});};
    const [retry,setRetry]=useState(0);
    const key=id+':'+tab;
    const [result,setResult]=useState<{key:string;state:'loading'|'ready'|'error';items:Item[]}>({key:'',state:'loading',items:[]});
    const current=result.key===key?result:{key,state:'loading',items:[]};
    useEffect(()=>{
        const abort=new AbortController();let active=true;
        setResult({key,state:'loading',items:[]});
        const timer=setTimeout(()=>abort.abort(),15000);
        const url=tab==='events'?'/api/v1/kpop/events':`/api/v1/kpop/product-candidates?view=public&artistId=${id}&limit=30`;
        (async()=>{try{
            const response=await fetch(url,{signal:abort.signal,credentials:'omit',cache:'no-store'});
            if(!response.ok)throw new Error('read');
            if(tab==='products'&&response.headers.get('X-Candidate-Policy')!=='public-evidence-v1')throw new Error('contract');
            const {data}=await response.json();if(!Array.isArray(data))throw new Error('shape');
            if(!data.every((item:Item)=>Number.isSafeInteger(item.id)&&item.id>0))throw new Error('items');
            if(active)setResult({key,state:'ready',items:tab==='events'?data.filter((item:Item)=>Number(item.artistId)===id):data});
        }catch{if(active)setResult({key,state:'error',items:[]});}finally{clearTimeout(timer);}})();
        return()=>{active=false;abort.abort();clearTimeout(timer);};
    },[id,key,tab,retry]);
    return <section className="artist-related" aria-label={`${name}의 소식과 상품`}>
        <h2>다음에 함께하고 싶은 순간</h2>
        <p className="artist-related-intro">{name}의 소식만 모았어요. 마음에 드는 일정을 찾아보세요.</p>
        <div className="artist-section-buttons" aria-label="보기 선택">
            <button aria-pressed={tab==='events'} onClick={()=>setTab('events')}>소식·일정</button>
            <button aria-pressed={tab==='products'} onClick={()=>setTab('products')}>관련 상품</button>
        </div>
        <div aria-live="polite" aria-busy={current.state==='loading'}>
            {current.state==='loading'&&<p>소식을 불러오고 있어요…</p>}
            {current.state==='error'&&<div role="alert"><p>소식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p><button onClick={()=>setRetry(x=>x+1)}>다시 시도</button></div>}
            {current.state==='ready'&&(current.items.length?<ul>{current.items.map(item=><li key={item.id}><a href={(tab==='events'?`/view/KPOP_EVENT_DETAIL/${item.id}?`:`/view/KPOP_PRODUCTS?itemId=${item.id}&`)+new URLSearchParams({returnArtist:back}).toString()}>{item.titleKo||item.title||item.name||'상세 보기'}</a>{item.date&&<span> · {item.date}</span>}</li>)}</ul>:<p>{tab==='events'?'아직 확인된 새 일정이 없어요. 공식 채널에서 다음 소식을 만나보세요.':'아직 연결된 공개 상품이 없어요. 새로운 소식을 기다려 주세요.'}</p>)}
        </div>
        {tab==='events'&&<a className="artist-all-events" href={'/view/KPOP_EVENTS?'+new URLSearchParams({scope:'all',artistId:String(id),returnArtist:back})}>{name} 일정 · 국내/해외로 보기 →</a>}
        {tab==='products'&&<p className="artist-related-note">공개된 상품 정보이며 아티스트의 실제 사용·협찬·정품을 의미하지는 않아요.</p>}
    </section>;
}
