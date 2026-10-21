'use client';
import KpopNav from './KpopNav';

import {FormEvent, useEffect, useRef, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import type {ScreenControllerProps} from '@/components/screens/types';
import {KpopArtistCard} from './KpopCards';
import Skeleton from '@/components/utils/Skeleton';
import KrideStatePanel from '@/components/fields/kride/atoms/KrideStatePanel';

type Artist = {id: number; slug?: string; nameKo?: string; nameEn?: string; [key: string]: unknown};
type ArtistPage = {items: Artist[]; totalCount: number; page: number; pageSize: number; query: string};
type Result = {key: string; status: 'loading' | 'ready' | 'error' | 'missing'; page?: ArtistPage; artist?: Artist};
const LIST = '/view/KPOP_EXPLORE';
const PAGE_SIZE = 8;

export default function ArtistCatalogScreen({screenId, refId}: ScreenControllerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get('q') ?? '';
    const requestedPage = Number(searchParams.get('page') || 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000 ? requestedPage : 1;
    const detail = screenId === 'KPOP_ARTIST_DETAIL';
    const [draft, setDraft] = useState(query);
    const [retry, setRetry] = useState(0);
    // 벤치마킹 H6: 입력 즉시 검색(300ms 디바운스) · "더 보기"로 페이지를 이어 붙인다
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const accumulated = useRef<{query: string; upToPage: number; items: Artist[]}>({query: '', upToPage: 0, items: []});
    const title = useRef<HTMLHeadingElement>(null);
    const shouldFocus = useRef(false);
    const key = JSON.stringify([detail, refId, query, page]);
    const [result, setResult] = useState<Result>({key, status: 'loading'});
    const current = result.key === key ? result : {key, status: 'loading' as const};

    useEffect(() => {setDraft(query);}, [query]);
    useEffect(() => () => {if (debounce.current) clearTimeout(debounce.current);}, []);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setResult({key, status: 'loading'});
        if (detail && (refId == null || refId === '')) {
            setResult({key, status: 'missing'});
            return () => {active = false; controller.abort();};
        }
        const params = new URLSearchParams({q: query, page: String(page), pageSize: String(PAGE_SIZE)});
        const url = detail
            ? `/api/v1/kpop/artists/${encodeURIComponent(String(refId))}?view=profile`
            : `/api/v1/kpop/artists?${params}`;
        // Abort plus active guard protects against both cancellable and already-resolved older requests.
        const timeout = setTimeout(() => controller.abort(), 15000);
        (async () => {
            try {
                const response = await fetch(url, {signal: controller.signal, cache: 'no-store', credentials: 'omit'});
                if (detail && response.status === 404) {
                    if (active) setResult({key, status: 'missing'});
                    return;
                }
                if (!response.ok) throw new Error('artist read failed');
                const body = await response.json();
                const data = body.data;
                if (detail ? !data || data.id == null : !data || !Array.isArray(data.items) || !Number.isFinite(data.totalCount)) {
                    throw new Error('invalid artist response');
                }
                if (active) setResult(detail ? {key, status: 'ready', artist: data} : {key, status: 'ready', page: data});
            } catch {
                if (active) setResult({key, status: 'error'});
            } finally {clearTimeout(timeout);}
        })();
        return () => {active = false; clearTimeout(timeout); controller.abort();};
    }, [key, detail, refId, query, page, retry]);

    useEffect(() => {
        if (current.status !== 'loading' && shouldFocus.current) {
            shouldFocus.current = false;
            title.current?.focus();
        }
    }, [current.status]);

    const listUrl = (nextQuery: string, nextPage: number) => {
        const params = new URLSearchParams();
        if (nextQuery) params.set('q', nextQuery);
        if (nextPage > 1) params.set('page', String(nextPage));
        return LIST + (params.toString() ? `?${params}` : '');
    };
    const navigate = (nextQuery: string, nextPage: number) => {
        shouldFocus.current = true;
        router.push(listUrl(nextQuery, nextPage), {scroll: false});
    };
    const search = (event: FormEvent) => {
        event.preventDefault();
        if (debounce.current) {clearTimeout(debounce.current); debounce.current = null;}
        const trimmed = draft.trim();
        if (trimmed === query && page === 1) {shouldFocus.current = true; setRetry(value => value + 1);}
        else navigate(trimmed, 1);
    };
    const typeQuery = (value: string) => {
        setDraft(value);
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => {
            debounce.current = null;
            const trimmed = value.trim();
            if (trimmed !== query) navigate(trimmed, 1);
        }, 300);
    };
    const clearQuery = () => {
        if (debounce.current) {clearTimeout(debounce.current); debounce.current = null;}
        setDraft('');
        if (!query && page === 1) setRetry(x => x + 1); else navigate('', 1);
    };
    // 같은 검색어로 바로 다음 페이지를 받으면 이어 붙이고, 그 밖에는 그 페이지만 보여준다 (딥링크 포함).
    const shownItems = (() => {
        if (current.status !== 'ready' || detail || !current.page) return [] as Artist[];
        const acc = accumulated.current;
        const items = acc.query === query && page === acc.upToPage + 1 && acc.upToPage > 0
            ? [...acc.items, ...current.page.items]
            : current.page.items;
        accumulated.current = {query, upToPage: page, items};
        return items;
    })();
    const totalCount = current.page?.totalCount ?? 0;
    const remaining = Math.max(0, totalCount - page * PAGE_SIZE);
    const openArtist = (meta: Record<string, any>) => {
        const suffix = new URLSearchParams();
        if (query) suffix.set('q', query);
        if (page > 1) suffix.set('page', String(page));
        router.push(meta.actionUrl + (suffix.toString() ? `?${suffix}` : ''));
    };

    return <section className={`page-wrap kpop-screen artist-catalog${detail?' artist-detail-screen':''}`} aria-label="아티스트 공개 카탈로그">
        <KpopNav counts={{artists: !detail && current.status === 'ready' ? totalCount : undefined}}/>{!detail&&<><p className="kpop-eyebrow">K-POP · 아티스트</p><h1>좋아하는 아티스트를 만나보세요</h1><p>공식 소식을 살펴보고, 함께하고 싶은 순간을 내 목록에 담아요.</p></>}
        {detail ? <a href={listUrl(query, page)}>아티스트 목록으로</a> : <form onSubmit={search} role="search" className="artist-catalog-search">
            <label htmlFor="artist-query" className="artist-catalog-search__label">아티스트 이름</label>
            <div className="artist-catalog-inputs">
                <span className="artist-catalog-inputs__icon" aria-hidden="true">🔍</span>
                <input id="artist-query" type="search" maxLength={120} value={draft} onChange={e => typeQuery(e.target.value)} placeholder="이름으로 바로 찾기 (한/영)" autoComplete="off" />
                {(draft || query) && <button type="button" className="artist-catalog-inputs__clear" onClick={clearQuery}>초기화</button>}
            </div>
        </form>}
        <h2 tabIndex={-1} ref={title} className={`artist-catalog-results${detail&&current.status==='ready'?' artist-sr-only':''}`} aria-live="polite">
            {current.status === 'loading' ? '아티스트를 불러오는 중…' : current.status === 'error' ? '불러오기 오류' : detail ? '상세 정보' : `${query ? `“${query}” 검색 · ` : ''}${current.page?.totalCount ?? 0}명의 아티스트`}
        </h2>
        <div aria-busy={current.status === 'loading'}>
            {current.status === 'loading' && <div className={`artist-catalog-skeleton${detail ? '' : ' artist-catalog-grid artist-catalog-grid--compact'}`} aria-hidden="true">
                {Array.from({length: detail ? 1 : 6}, (_, i) => <Skeleton key={i} height={detail ? 320 : 150} />)}
            </div>}
            {current.status === 'error' && <KrideStatePanel kind="error" title="아티스트를 불러오지 못했어요" description="검색 조건은 유지됩니다. 잠시 후 다시 시도해 주세요." primaryAction={{label: '다시 시도', onClick: () => {shouldFocus.current = true; setRetry(x => x + 1);}}} />}
            {current.status === 'missing' && <KrideStatePanel kind="empty-filtered" title="아티스트를 찾을 수 없어요" description="주소를 확인하거나 목록으로 돌아가 주세요." />}
            {current.status === 'ready' && detail && current.artist && <KpopArtistCard data={current.artist} variant="detail" meta={{componentId: 'kpop_artist_detail'}} readOnly personalSave />}
            {current.status === 'ready' && !detail && current.page && <>
                {current.page.items.length === 0 ? <KrideStatePanel kind={query ? 'empty-filtered' : 'empty-first'} icon="🎤" title={page > 1 ? '이 페이지에 아티스트가 없어요' : query ? '조건에 맞는 아티스트가 없어요' : '아직 공개된 아티스트가 없어요'} description={page > 1 ? '첫 페이지로 돌아가 주세요.' : query ? '이름을 바꾸거나 초기화해 주세요.' : '공개 승인된 아티스트가 등록되면 여기에 보여요.'} />
                    : <div className="artist-catalog-grid artist-catalog-grid--compact">{shownItems.map(artist => <KpopArtistCard key={artist.id} data={artist} variant="compact" readOnly personalSave onAction={openArtist} />)}</div>}
                {page > Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) ? <button onClick={() => navigate(query, 1)}>첫 페이지로</button>
                    : remaining > 0 && <div className="artist-catalog-more"><button type="button" onClick={() => navigate(query, page + 1)}>더 보기 · {remaining}명 남음</button></div>}
                {shownItems.length > 0 && <p className="artist-catalog-shown">{shownItems.length}명 표시 · 전체 {totalCount}명</p>}
            </>}
        </div>
    </section>;
}
