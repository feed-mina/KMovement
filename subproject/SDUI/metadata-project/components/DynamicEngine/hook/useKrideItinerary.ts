import { useState, useEffect, useRef } from "react";
import { trackEvent } from '@/lib/analytics/dataLayer';
import { countItineraryPlaces } from '@/lib/analytics/itinerary';

const DURATION_TO_KOREAN: Record<string, string> = {
    day: "당일치기",
    onenight: "1박2일",
    twonight: "2박3일",
};

interface KrideItineraryResult {
    data: { itinerary: any[]; markers: any[]; mapData: Record<string, any>; [key: string]: any } | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * KRIDE_FOCUS 화면일 때만 FastAPI에 일정 추천을 요청하는 훅.
 * formData에 온보딩 데이터(duration 등)가 준비된 뒤 1회만 호출한다.
 */
export function useKrideItinerary(
    screenId: string,
    formData: Record<string, any>
): KrideItineraryResult {
    const [data, setData] = useState<KrideItineraryResult["data"]>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const calledRef = useRef(false);

    const isFocus = screenId === "KRIDE_FOCUS";

    // formData에 온보딩 필수 데이터가 있는지 확인
    const hasFormData = isFocus && !!(
        formData?.duration ||
        (Array.isArray(formData?.selectedArtists) && formData.selectedArtists.length > 0) ||
        (Array.isArray(formData?.selectedRegions) && formData.selectedRegions.length > 0)
    );

    useEffect(() => {
        if (!isFocus || !hasFormData || calledRef.current) return;
        calledRef.current = true;

        const fetchItinerary = async () => {
            setIsLoading(true);
            setError(null);
            trackEvent('itinerary_start', { entry_point: 'focus_auto_generation' });
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const rawDuration = formData?.duration ?? "day";
                const body = {
                    duration: DURATION_TO_KOREAN[rawDuration] ?? rawDuration,
                    artists: Array.isArray(formData?.selectedArtists)
                        ? formData.selectedArtists.map((a: any) => a.name)
                        : [],
                    regions: Array.isArray(formData?.selectedRegions)
                        ? formData.selectedRegions.map((r: any) => r.name)
                        : [],
                    purposes: Array.isArray(formData?.purposes)
                        ? formData.purposes
                        : [],
                    budget: formData?.budget ?? { min: 30000, max: 2000000 },
                };

                trackEvent('preferences_complete', {
                    region: body.regions[0] || 'unspecified',
                    purpose: body.purposes[0] || 'unspecified',
                    duration: String(body.duration),
                });

                const controller = new AbortController();
                timer = setTimeout(() => controller.abort(), 120_000); // 2분 타임아웃

                const res = await fetch("/kride-api/recommend/itinerary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
                if (!res.ok) {
                    throw new Error(`FastAPI 응답 오류: ${res.status}`);
                }

                const json = await res.json();
                const placeCount = countItineraryPlaces(json);
                if (placeCount === 0) throw new Error('empty_result');
                const itinerary = json.itinerary ?? [];
                const markers = json.mapData?.markers ?? [];
                setData({
                    itinerary,
                    mapData: { ...json.mapData, markers, itinerary },
                    markers, // MapView가 data.markers로 직접 접근할 수 있도록
                    markerResolutionStatus: json.markerResolutionStatus ?? json.mapData?.markerResolutionStatus,
                    unresolvedPlaces: json.unresolvedPlaces ?? json.mapData?.unresolvedPlaces,
                } as any);
                trackEvent('itinerary_generated', {
                    place_count: placeCount,
                    duration: String(body.duration),
                    source: 'focus_onboarding',
                });
            } catch (err: any) {
                console.error("[useKrideItinerary]", err);
                setError(err.message ?? "일정 요청 실패");
                const message = String(err?.message || 'unknown');
                trackEvent('itinerary_error', {
                    error_type: message === 'empty_result' ? 'empty_result' : message.toLowerCase().includes('abort') ? 'timeout' : message.includes('응답 오류') ? 'http_error' : 'request_error',
                    source: 'focus_onboarding',
                });
            } finally {
                if (timer) clearTimeout(timer);
                setIsLoading(false);
            }
        };

        fetchItinerary();
    }, [isFocus, hasFormData]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isFocus) {
        return { data: null, isLoading: false, error: null };
    }

    return { data, isLoading, error };
}
