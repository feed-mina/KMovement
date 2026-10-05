'use client';

import {useEffect, useRef, useState} from 'react';
import type {TourPoi} from '@/services/tourApi';
import {loadKakaoMaps} from '@/components/fields/kride/maps/loadKakaoMaps';

export const tourPoiKey = (poi: TourPoi) => poi.contentId ?? `${poi.title}:${poi.addr ?? ''}:${poi.mapX}:${poi.mapY}`;
export function hasTourCoordinates(poi: TourPoi): boolean {
    return Number.isFinite(poi.mapX) && Number.isFinite(poi.mapY)
        && Math.abs(poi.mapX!) <= 180 && Math.abs(poi.mapY!) <= 90
        && !(poi.mapX === 0 && poi.mapY === 0);
}

type Props = {pois: TourPoi[]; selectedId: string | null; onSelect: (id: string) => void};

/** Browse existing coordinates only: no geocoding or itinerary polyline. */
export default function TourExploreMap({pois, selectedId, onSelect}: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const selectedRef = useRef(selectedId);
    selectedRef.current = selectedId;
    const [ready, setReady] = useState(0);
    const geoPois = pois.filter(hasTourCoordinates);

    useEffect(() => {
        let alive = true;
        const listeners: Array<{marker: any; handler: () => void}> = [];
        let observer: ResizeObserver | undefined;
        setError(false);
        if (!pois.some(hasTourCoordinates)) return;
        loadKakaoMaps(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? '').then((kakao) => {
            if (!alive || !container.current) return;
            const places = pois.filter(hasTourCoordinates);
            const map = new kakao.maps.Map(container.current, {
                center: new kakao.maps.LatLng(places[0].mapY, places[0].mapX), level: 6,
            });
            mapRef.current = map;
            const bounds = new kakao.maps.LatLngBounds();
            places.forEach((poi) => {
                const position = new kakao.maps.LatLng(poi.mapY, poi.mapX);
                bounds.extend(position);
                const marker = new kakao.maps.Marker({map, position, title: poi.title});
                const handler = () => onSelect(tourPoiKey(poi));
                kakao.maps.event.addListener(marker, 'click', handler);
                listeners.push({marker, handler});
                markersRef.current.set(tourPoiKey(poi), marker);
            });
            map.setBounds(bounds);
            if (typeof ResizeObserver !== 'undefined') {
                observer = new ResizeObserver(() => {
                    map.relayout();
                    const selected = selectedRef.current && markersRef.current.get(selectedRef.current);
                    if (selected) map.panTo(selected.getPosition());
                    else map.setBounds(bounds);
                });
                observer.observe(container.current);
            }
            setReady((value) => value + 1);
        }).catch(() => { if (alive) setError(true); });
        return () => {
            alive = false;
            observer?.disconnect();
            listeners.forEach(({marker, handler}) => {
                window.kakao?.maps?.event.removeListener(marker, 'click', handler);
                marker.setMap(null);
            });
            markersRef.current.clear(); mapRef.current = null;
        };
    }, [pois, onSelect, attempt]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        markersRef.current.forEach((marker, id) => {
            marker.setZIndex(id === selectedId ? 10 : 1);
            marker.setOpacity(id === selectedId || !selectedId ? 1 : 0.55);
        });
        const marker = selectedId && markersRef.current.get(selectedId);
        if (marker) map.panTo(marker.getPosition());
    }, [selectedId, ready]);

    return <section className="tour-browse-map" aria-label="장소 지도">
        {geoPois.length > 0 && <label className="tour-map-picker">지도 장소 선택
            <select aria-label="지도 장소 선택" value={selectedId ?? ''} onChange={(event) => {if (event.target.value) onSelect(event.target.value);}}>
                <option value="">장소를 선택하세요</option>
                {geoPois.map((poi) => <option key={tourPoiKey(poi)} value={tourPoiKey(poi)}>{poi.title}</option>)}
            </select>
        </label>}
        <div ref={container} className="tour-browse-map__canvas" aria-label="카카오 장소 지도" />
        {geoPois.length === 0 && <p className="tour-map-state">현재 목록에 지도 좌표가 있는 장소가 없어요. 주소는 카드에서 확인해 주세요.</p>}
        {error && <div className="tour-map-state tour-recovery" role="status" data-error-source="map-sdk">
            <p>지도를 불러오지 못했어요. 장소 목록은 계속 볼 수 있어요.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>지도 다시 시도</button>
        </div>}
        {selectedId && <p className="tour-map-selection">선택: {pois.find((poi) => tourPoiKey(poi) === selectedId)?.title}</p>}
        <p className="tour-map-caption">좌표가 있는 {geoPois.length}곳 표시 · 지도 핀을 누르면 해당 카드로 이동해요.</p>
    </section>;
}
