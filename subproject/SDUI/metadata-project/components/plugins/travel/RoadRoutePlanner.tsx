'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { RoadPoint } from './RoadRouteMap';
import { type DirectionPlace, validDirectionPlace, searchDirectionPlaces, kakaoDirectionsUrl, googleDirectionsUrl } from '@/lib/kride/directions';

const RoadRouteMap = dynamic(() => import('./RoadRouteMap'), { ssr: false });
type Result = {
    path?: RoadPoint[]; course?: RoadPoint[]; total_distance_km: number;
    facilities_on_route?: { name: string; type: string; distance_km: number }[];
    facilities_on_course?: { name: string; type: string; distance_km: number }[];
    pois_on_route?: { title: string; lat: number; lon: number }[];
    pois_on_course?: { title: string; lat: number; lon: number }[];
    courseType?: string;
};
type Props = { region?: string; destinations?: DirectionPlace[]; initialDestination?: DirectionPlace };

function PlaceSearch({ label, selected, query, region, onQuery, onSelect }: {
    label: string; selected: DirectionPlace | null; query: string; region?: string;
    onQuery: (query: string) => void; onSelect: (place: DirectionPlace) => void;
}) {
    const id = useId();
    const requestRef = useRef(0);
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<DirectionPlace[]>([]);
    const [message, setMessage] = useState('');
    const [searchKey, setSearchKey] = useState('');
    const activeSearchKey = JSON.stringify([query, selected?.id ?? '']);
    const activeSearch = searchKey === activeSearchKey;
    useEffect(() => () => { requestRef.current++; }, []);
    async function search(event: FormEvent) {
        event.preventDefault();
        const text = query.trim();
        if (!text) return;
        const request = ++requestRef.current;
        setSearchKey(activeSearchKey); setBusy(true); setResults([]); setMessage('');
        try {
            const rows = await searchDirectionPlaces(text, region);
            if (request !== requestRef.current) return;
            setResults(rows);
            setMessage(rows.length ? '주소를 확인하고 장소를 선택해 주세요.' : '일치하는 장소가 없어요. 지역명이나 도로명 주소를 더해 검색해 주세요.');
        } catch {
            if (request === requestRef.current) setMessage('장소 검색에 연결하지 못했어요. 다시 검색하거나, 아래 Google 지도에서 입력한 주소로 계속할 수 있어요.');
        } finally {
            if (request === requestRef.current) setBusy(false);
        }
    }
    function edit(value: string) {
        requestRef.current++; setBusy(false); setResults([]); setMessage(''); onQuery(value);
    }
    return <div className="directions-place">
        <form onSubmit={search} aria-label={label + ' 검색'}>
            <label htmlFor={id}>{label}</label>
            <div className="directions-search-row">
                <input id={id} type="search" maxLength={160} value={query} onChange={e => edit(e.target.value)}
                    placeholder="장소명이나 도로명 주소" autoComplete="off" enterKeyHint="search" />
                <button type="submit" disabled={(busy && activeSearch) || !query.trim()}>{busy && activeSearch ? '검색 중…' : '검색'}</button>
            </div>
        </form>
        {selected && <p className="directions-selected" role="status"><strong>{selected.name}</strong>{selected.address && <span>{selected.address}</span>}</p>}
        {activeSearch && message && <p role="status">{message}</p>}
        {activeSearch && results.length > 0 && <ul className="directions-results" aria-label={label + ' 검색 결과'}>
            {results.map(place => <li key={place.id}>
                <button type="button" onClick={() => {
                    requestRef.current++; setResults([]); setMessage(''); setBusy(false); onSelect(place);
                }}><strong>{place.name}</strong><span>{place.address}</span></button>
            </li>)}
        </ul>}
    </div>;
}

export default function RoadRoutePlanner({ region = '서울', destinations = [], initialDestination }: Props) {
    const [start, setStart] = useState<DirectionPlace | null>(null);
    const [end, setEnd] = useState<DirectionPlace | null>(initialDestination ?? null);
    const [startQuery, setStartQuery] = useState('');
    const [endQuery, setEndQuery] = useState(initialDestination?.name ?? '');
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const locationRequest = useRef(0);
    const previewRequest = useRef(0);
    const previewController = useRef<AbortController | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<Result | null>(null);
    const [distance, setDistance] = useState('3');
    useEffect(() => () => { locationRequest.current++; previewRequest.current++; previewController.current?.abort(); }, []);

    function clearPreview() {
        previewRequest.current++; previewController.current?.abort();
        setResult(null); setError(''); setBusy(false);
    }
    function chooseStart(place: DirectionPlace | null, query: string) {
        locationRequest.current++; setLocating(false); setLocationError('');
        setStart(place); setStartQuery(query); clearPreview();
    }
    function chooseEnd(place: DirectionPlace | null, query: string) {
        setEnd(place); setEndQuery(query); clearPreview();
    }
    function useCurrentLocation() {
        const request = ++locationRequest.current;
        setLocationError(''); setStart(null); setStartQuery(''); clearPreview();
        if (!navigator.geolocation) {
            setLocationError('이 브라우저에서는 현재 위치를 받을 수 없어요. 아래에서 출발 주소를 검색해 주세요.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(position => {
            if (request !== locationRequest.current) return;
            setLocating(false);
            const place: DirectionPlace = { id: 'current-location', name: '현재 위치', lat: position.coords.latitude, lon: position.coords.longitude };
            if (!validDirectionPlace(place) || !Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 1000) {
                setLocationError('위치 오차가 커서 출발지를 정하지 못했어요. 아래에서 정확한 주소를 검색해 주세요.');
                return;
            }
            setStart(place); setStartQuery('현재 위치');
        }, reason => {
            if (request !== locationRequest.current) return;
            setLocating(false);
            setLocationError(reason.code === 1
                ? '위치 사용을 허용하지 않았어요. 아래에서 출발 주소를 검색하면 계속할 수 있어요.'
                : '현재 위치를 확인하지 못했어요. 다시 시도하거나 출발 주소를 검색해 주세요.');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    }

    async function preview(kind: 'route' | 'course') {
        if (!start || (kind === 'route' && !end) || busy) return;
        const km = Number(distance);
        if (kind === 'course' && (!Number.isFinite(km) || km < 0.2 || km > 50)) {
            setError('산책 거리를 0.2~50km 사이로 골라 주세요.'); return;
        }
        const request = ++previewRequest.current;
        const controller = new AbortController();
        previewController.current?.abort(); previewController.current = controller;
        const timer = setTimeout(() => controller.abort(), 30000);
        setBusy(true); setResult(null); setError('');
        const body = { start_lat: start.lat, start_lon: start.lon,
            ...(kind === 'route' && end ? { end_lat: end.lat, end_lon: end.lon } : { distance_km: km }) };
        try {
            const response = await fetch('/api/kride/route/' + kind, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
            });
            const data = await response.json().catch(() => null);
            if (request !== previewRequest.current) return;
            if (!data) throw new Error('산책 경로 응답을 확인하지 못했어요. 다시 시도하거나 카카오맵을 이용해 주세요.');
            if (!response.ok) throw new Error(response.status === 422
                ? '이 위치는 앱 안의 산책 미리보기 범위 밖이에요. 출발지와 목적지를 유지해 카카오맵에서 길을 찾을 수 있어요.'
                : '산책 경로를 불러오지 못했어요. 잠시 후 다시 시도하거나 카카오맵을 이용해 주세요.');
            if (!(data.path ?? data.course)?.length) throw new Error('이 조건의 산책 경로가 없어요. 다른 거리나 장소를 골라 주세요.');
            setResult(data);
        } catch (reason) {
            if (request === previewRequest.current) setError(reason instanceof Error && reason.name === 'AbortError'
                ? '경로 확인이 오래 걸리고 있어요. 다시 시도하거나 카카오맵에서 계속해 주세요.'
                : reason instanceof Error ? reason.message : '산책 경로를 확인하지 못했어요.');
        } finally {
            clearTimeout(timer);
            if (request === previewRequest.current) setBusy(false);
        }
    }

    const kakaoUrl = start && end ? kakaoDirectionsUrl(start, end) : null;
    const origin = start ?? startQuery.trim();
    const destination = end ?? endQuery.trim();
    const googleUrl = origin && destination ? googleDirectionsUrl(origin, destination) : null;
    return <section className="directions" aria-label={region + ' 길찾기'}>
        <header className="directions-heading"><p className="directions-eyebrow">{region} 여행 · 길찾기</p>
            <h2>어디에서 출발할까요?</h2>
            <p>현재 위치를 사용하거나 장소·주소를 검색해 주세요.</p>
        </header>
        <div className="directions-step">
            <h3>1. 출발지</h3>
            <button type="button" className="directions-location" disabled={locating} onClick={useCurrentLocation}>
                {locating ? '현재 위치 확인 중…' : '현재 위치 사용'}
            </button>
            <p className="directions-note">위치 사용을 허용하면 출발지에 자동으로 입력해요. 주소로도 정할 수 있어요.</p>
            {locationError && <p role="alert">{locationError}</p>}
            <PlaceSearch label="출발 장소·주소" selected={start} query={startQuery}
                onQuery={query => chooseStart(null, query)} onSelect={place => chooseStart(place, place.name)} />
        </div>
        <div className="directions-step">
            <h3>2. 목적지</h3>
            {destinations.length > 0 && <div className="directions-stops" role="group" aria-label="코스에서 목적지 선택">
                {destinations.map(place => <button key={place.id} type="button" aria-pressed={end?.id === place.id}
                    onClick={() => chooseEnd(place, place.name)}>{place.name}</button>)}
            </div>}
            <PlaceSearch label="도착 장소·주소" selected={end} query={endQuery} region={region}
                onQuery={query => chooseEnd(null, query)} onSelect={place => chooseEnd(place, place.name)} />
        </div>
        <div className="directions-handoff">
            {kakaoUrl
                ? <a className="directions-primary" href={kakaoUrl} target="_blank" rel="noopener noreferrer">카카오맵에서 길찾기</a>
                : <button className="directions-primary" type="button" disabled>출발지와 목적지를 선택해 주세요</button>}
            <p>새 창에서 길찾기가 열려요. 선택한 두 위치를 지도에 전달하며, 이동수단은 지도에서 고를 수 있어요.</p>
            {googleUrl && <a href={googleUrl} target="_blank" rel="noopener noreferrer">Google 지도에서 {kakaoUrl ? '길찾기' : '입력한 주소로 계속하기'}</a>}
        </div>
        {region === '서울' && <details className="directions-preview">
            <summary>앱에서 산책 경로 미리보기</summary>
            <p>서울 일부 지역의 도보 경로를 미리 볼 수 있어요. 실제 이동 안내는 지도에서 확인해 주세요.</p>
            <button type="button" disabled={!start || !end || busy} onClick={() => void preview('route')}>두 장소 사이 산책 경로 보기</button>
            <label>출발지로 돌아오는 산책 거리
                <select value={distance} onChange={e => { setDistance(e.target.value); clearPreview(); }}>
                    <option value="1">1km</option><option value="3">3km</option><option value="5">5km</option>
                </select>
            </label>
            <button type="button" disabled={!start || busy} onClick={() => void preview('course')}>왕복 산책 코스 보기</button>
            {busy && <p role="status">산책 경로를 확인하고 있어요…</p>}
            {error && <p role="alert">{error}</p>}
            {result && <div>
                <p role="status">{result.total_distance_km}km · {result.courseType ? '출발지로 돌아오는 산책 코스' : '두 장소 사이 산책 경로'}</p>
                <RoadRouteMap points={result.path ?? result.course ?? []} pois={result.pois_on_route ?? result.pois_on_course ?? []} />
            </div>}
        </details>}
    </section>;
}
