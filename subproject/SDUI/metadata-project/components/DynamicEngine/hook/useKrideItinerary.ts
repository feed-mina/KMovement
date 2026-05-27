import { useState, useEffect, useRef } from "react";

const DURATION_TO_KOREAN: Record<string, string> = {
    day: "당일치기",
    onenight: "1박2일",
    twonight: "2박3일",
};

interface KrideItineraryResult {
    data: { itinerary: any[]; mapData: { markers: any[]; itinerary?: any[] } } | null;
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

                console.log("[useKrideItinerary] 요청:", body);

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 120_000); // 2분 타임아웃

                const res = await fetch("/api/kride/recommend/itinerary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
                clearTimeout(timer);

                if (!res.ok) {
                    throw new Error(`FastAPI 응답 오류: ${res.status}`);
                }

                const json = await res.json();
                console.log("[useKrideItinerary] 응답:", json);
                const itinerary = json.itinerary ?? [];
                const markers = json.mapData?.markers ?? [];
                setData({
                    itinerary,
                    mapData: { markers, itinerary },
                    markers, // MapView가 data.markers로 직접 접근할 수 있도록
                } as any);
            } catch (err: any) {
                console.error("[useKrideItinerary]", err);
                setError(err.message ?? "일정 요청 실패");
            } finally {
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
