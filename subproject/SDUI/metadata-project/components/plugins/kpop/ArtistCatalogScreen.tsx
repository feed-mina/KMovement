'use client';
import KpopNav from './KpopNav';

import {FormEvent, useEffect, useRef, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import Pagination from '@/components/fields/Pagination';
import type {ScreenControllerProps} from '@/components/screens/types';
import {KpopArtistCard} from './KpopCards';

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
    const title = useRef<HTMLHeadingElement>(null);
    const shouldFocus = useRef(false);
    const key = JSON.stringify([detail, refId, query, page]);
    const [result, setResult] = useState<Result>({key, status: 'loading'});
    const current = result.key === key ? result : {key, status: 'loading' as const};

    useEffect(() => {setDraft(query);}, [query]);
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
        const trimmed = draft.trim();
        if (trimmed === query && page === 1) {shouldFocus.current = true; setRetry(value => value + 1);}
        else navigate(trimmed, 1);
    };
    const openArtist = (meta: Record<string, any>) => {
        const suffix = new URLSearchParams();
        if (query) suffix.set('q', query);
        if (page > 1) suffix.set('page', String(page));
        router.push(meta.actionUrl + (suffix.toString() ? `?${suffix}` : ''));
    };

    return <section className="page-wrap kpop-screen artist-catalog" aria-label="아티스트 공개 카탈로그">
        <KpopNav/><p className="kpop-eyebrow">K-POP · 아티스트</p>
        <h1>{detail ? '아티스트 상세' : '아티스트 찾기'}</h1>
        <p>로그인 없이 공개된 아티스트 소개와 공식 채널을 볼 수 있어요.</p>
        {detail ? <a href={listUrl(query, page)}>아티스트 목록으로</a> : <form onSubmit={search} role="search" className="artist-catalog-search">
            <label htmlFor="artist-query">아티스트 이름</label>
            <div className="artist-catalog-inputs">
                <input id="artist-query" type="search" maxLength={120} value={draft} onChange={e => setDraft(e.target.value)} placeholder="한국어 또는 영어 이름" />
                <button type="submit">검색</button>
                <button type="button" onClick={() => {setDraft(''); if (!query && page === 1) setRetry(x => x + 1); else navigate('', 1);}}>초기화</button>
            </div>
        </form>}
        <h2 tabIndex={-1} ref={title} className="artist-catalog-results" aria-live="polite">
            {current.status === 'loading' ? '아티스트를 불러오는 중…' : current.status === 'error' ? '불러오기 오류' : detail ? '상세 정보' : `${query ? `“${query}” 검색 · ` : ''}${current.page?.totalCount ?? 0}명의 아티스트`}
        </h2>
        <div aria-busy={current.status === 'loading'}>
            {current.status === 'error' && <div role="alert" className="artist-catalog-state">
                <p>아티스트를 불러오지 못했어요. 검색 조건은 유지됩니다.</p>
                <button onClick={() => {shouldFocus.current = true; setRetry(x => x + 1);}}>다시 시도</button>
            </div>}
            {current.status === 'missing' && <p role="status">아티스트를 찾을 수 없어요. 주소를 확인하거나 목록으로 돌아가 주세요.</p>}
            {current.status === 'ready' && detail && current.artist && <KpopArtistCard data={current.artist} meta={{componentId: 'kpop_artist_detail'}} readOnly personalSave />}
            {current.status === 'ready' && !detail && current.page && <>
                {current.page.items.length === 0 ? <p role="status">{page > 1 ? '이 페이지에 아티스트가 없어요. 첫 페이지로 돌아가 주세요.' : query ? '조건에 맞는 아티스트가 없어요. 이름을 바꾸거나 초기화해 주세요.' : '아직 공개된 아티스트가 없어요.'}</p>
                    : <div className="kpop-grid artist-catalog-grid">{current.page.items.map(artist => <KpopArtistCard key={artist.id} data={artist} readOnly personalSave onAction={openArtist} />)}</div>}
                {page > Math.max(1, Math.ceil(current.page.totalCount / PAGE_SIZE)) ? <button onClick={() => navigate(query, 1)}>첫 페이지로</button>
                    : <nav aria-label="아티스트 페이지"><Pagination totalCount={current.page.totalCount} pageSize={PAGE_SIZE} currentPage={page} onPageChange={next => navigate(query, next)} /></nav>}
                <p>{page}페이지 · 한 페이지에 최대 {PAGE_SIZE}명</p>
            </>}
        </div>
    </section>;
}
