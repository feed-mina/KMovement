import { useState, useEffect, useRef } from "react";
import { trackEvent } from '@/lib/analytics/dataLayer';
import { countItineraryPlaces } from '@/lib/analytics/itinerary';

const DURATION_TO_KOREAN: Record<string, string> = {
    day: "당일치기",
    onenight: "1박2일",
    twonight: "2박3일",
};

/** 중복 과금을 피하기 위해 자동 재시도 없이 한 번만 요청한다. */
const REQUEST_TIMEOUT_MS = 120_000;

function isTransientFailure(error: unknown): boolean {
    const name = (error as { name?: string })?.name ?? '';
    const message = String((error as { message?: string })?.message ?? '');
    // AbortError 는 브라우저마다 문구가 다르다("signal is aborted without reason" 등).
    return name === 'AbortError'
        || /abort/i.test(message)
        || /failed to fetch|network|load failed/i.test(message);
}

/** 한 번의 요청. 타임아웃 타이머를 호출 측에 넘겨 finally 에서 정리하게 한다. */
async function requestItinerary(body: unknown, keepTimer: (timer: ReturnType<typeof setTimeout>) => void) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    keepTimer(timer);
    try {
        const res = await fetch("/api/kride/recommend/itinerary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (res.status === 401) throw new Error('login_required');
        if (!res.ok) {
            throw new Error(`FastAPI 응답 오류: ${res.status}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 사용자에게 보일 문구. 원본 예외 문구("signal is aborted without reason")는
 * 무슨 일이 일어났는지 알려주지 못한다.
 */
export function toUserMessage(error: unknown): string {
    if (isTransientFailure(error)) return '추천 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.';
    const message = String((error as { message?: string })?.message ?? '');
    if (message === 'login_required') return '로그인 후 AI 코스를 이용해 주세요.';
    if (message === 'empty_candidates') return '출처가 확인된 추천 자료가 아직 없습니다.';
    if (message === 'empty_result') return '조건에 맞는 코스를 찾지 못했어요. 지역이나 기간을 바꿔 보세요.';
    if (message.includes('응답 오류')) return '추천 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.';
    return '코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
}

interface KrideItineraryResult {
    data: { itinerary: any[]; markers: any[]; mapData: Record<string, any>; [key: string]: any } | null;
    isLoading: boolean;
    error: string | null;
    requiresLogin: boolean;
    candidatesUnavailable: boolean;
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
    const [requiresLogin, setRequiresLogin] = useState(false);
    const [candidatesUnavailable, setCandidatesUnavailable] = useState(false);
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
            setCandidatesUnavailable(false);
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
                    budget: Array.isArray(formData?.budget) ? {min:formData.budget[0],max:formData.budget[1]} : formData?.budget ?? { min: 30000, max: 2000000 },
                };

                trackEvent('preferences_complete', {
                    region: body.regions[0] || 'unspecified',
                    purpose: body.purposes[0] || 'unspecified',
                    duration: String(body.duration),
                });

                const json = await requestItinerary(body, (t) => { timer = t; });
                if (json.status === 'empty_candidates') throw new Error('empty_candidates');
                const placeCount = countItineraryPlaces(json);
                if (placeCount === 0) throw new Error('empty_result');
                const itinerary = json.itinerary ?? [];
                const markers = json.mapData?.markers ?? [];
                setData({
                    source_pois:json.source_pois,
                    scopeNotice:json.scopeNotice,
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
                if (err?.message !== "empty_candidates") console.error("[useKrideItinerary]", err);
                setCandidatesUnavailable(err?.message === "empty_candidates");
                setRequiresLogin(err?.message === 'login_required');
                setError(toUserMessage(err));
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
        return { data: null, isLoading: false, error: null, requiresLogin: false, candidatesUnavailable: false };
    }

    return { data, isLoading, error, requiresLogin, candidatesUnavailable };
}
