import { useState, useEffect, useRef, useCallback } from "react";
import { trackEvent } from '@/lib/analytics/dataLayer';
import { countItineraryPlaces } from '@/lib/analytics/itinerary';

import { buildItineraryRequest, validateItineraryRequest, itineraryHttpError, classifyItineraryError, itineraryErrorMessage } from '@/lib/kride/itineraryRequest';
import type { ItineraryErrorKind } from '@/lib/kride/itineraryRequest';
export type { ItineraryErrorKind } from '@/lib/kride/itineraryRequest';

/** 중복 과금을 피하기 위해 자동 재시도 없이 한 번만 요청한다. 재시도는 사용자가 버튼으로만 한다. */
const REQUEST_TIMEOUT_MS = 120_000;
/** 연속 실패가 이 횟수에 닿으면 안내 문구를 바꾸고 재시도 버튼을 잠시 잠근다 (벤치마킹 G2). */
export const RETRY_COOLDOWN_AFTER = 3;
export const RETRY_COOLDOWN_MS = 30_000;

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
        if (!res.ok) {
            const problem = await res.json().catch(()=>({}));
            throw itineraryHttpError(res.status, problem);
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export const classifyError = classifyItineraryError;
export const toUserMessage = itineraryErrorMessage;

interface KrideItineraryResult {
    data: { itinerary: any[]; markers: any[]; mapData: Record<string, any>; [key: string]: any } | null;
    isLoading: boolean;
    error: string | null;
    errorKind: ItineraryErrorKind | null;
    requiresLogin: boolean;
    candidatesUnavailable: boolean;
    /** 연속 실패 횟수. 성공하면 0 으로 돌아간다. */
    failCount: number;
    /** 입력값(formData)을 그대로 두고 같은 요청을 다시 보낸다. 새로고침 없음. */
    retry: () => void;
}

const IDLE: KrideItineraryResult = {
    data: null, isLoading: false, error: null, errorKind: null,
    requiresLogin: false, candidatesUnavailable: false, failCount: 0, retry: () => {},
};

/**
 * KRIDE_FOCUS 화면일 때만 FastAPI에 일정 추천을 요청하는 훅.
 * formData에 온보딩 데이터(duration 등)가 준비된 뒤 1회만 호출하고, 이후는 retry() 로만 다시 요청한다.
 */
export function useKrideItinerary(
    screenId: string,
    formData: Record<string, any>,
    enabled = true
): KrideItineraryResult {
    const [data, setData] = useState<KrideItineraryResult["data"]>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<ItineraryErrorKind | null>(null);
    const [requiresLogin, setRequiresLogin] = useState(false);
    const [candidatesUnavailable, setCandidatesUnavailable] = useState(false);
    const [failCount, setFailCount] = useState(0);
    const calledRef = useRef(false);
    const inFlightRef = useRef(false);
    const formRef = useRef(formData);
    formRef.current = formData;

    const isFocus = screenId === "KRIDE_FOCUS" && enabled;

    // formData에 온보딩 필수 데이터가 있는지 확인
    const hasFormData = isFocus && !!(
        formData?.duration ||
        (Array.isArray(formData?.selectedArtists) && formData.selectedArtists.length > 0) ||
        (Array.isArray(formData?.selectedRegions) && formData.selectedRegions.length > 0)
    );

    const fetchItinerary = useCallback(async (entryPoint: 'focus_auto_generation' | 'focus_retry') => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        const form = formRef.current ?? {};
        setIsLoading(true);
        setError(null);
        setErrorKind(null);
        setRequiresLogin(false);
        setData(null);
        setCandidatesUnavailable(false);
        trackEvent('itinerary_start', { entry_point: entryPoint });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const body = buildItineraryRequest(form);
            validateItineraryRequest(body);

            if (entryPoint === 'focus_auto_generation') {
                trackEvent('preferences_complete', {
                    region: body.regions[0] || 'unspecified',
                    purpose: body.purposes[0] || 'unspecified',
                    duration: String(body.duration),
                });
            }

            const json = await requestItinerary(body, (t) => { timer = t; });
            if (json.status === 'empty_candidates') throw new Error('empty_candidates');
            const placeCount = countItineraryPlaces(json);
            if (placeCount === 0) throw new Error('empty_result');
            const itinerary = json.itinerary ?? [];
            const markers = json.mapData?.markers ?? [];
            setData({
                courseContext: json.courseContext,
                itineraryId: json.itineraryId,
                catalogRevision: json.catalogRevision,
                responseLocale: json.responseLocale,
                source_pois: json.source_pois,
                scopeNotice: json.scopeNotice,
                itinerary,
                mapData: { ...json.mapData, markers, itinerary },
                markers, // MapView가 data.markers로 직접 접근할 수 있도록
                markerResolutionStatus: json.markerResolutionStatus ?? json.mapData?.markerResolutionStatus,
                unresolvedPlaces: json.unresolvedPlaces ?? json.mapData?.unresolvedPlaces,
            } as any);
            setFailCount(0);
            trackEvent('itinerary_generated', {
                place_count: placeCount,
                duration: String(body.duration),
                source: entryPoint === 'focus_retry' ? 'focus_retry' : 'focus_onboarding',
            });
        } catch (err: any) {
            if (err?.message !== "empty_candidates") console.error("[useKrideItinerary]", err);
            const kind = classifyError(err);
            setCandidatesUnavailable(kind === 'candidates');
            setRequiresLogin(kind === 'login');
            setErrorKind(kind);
            setError(toUserMessage(err));
            setFailCount((n) => n + 1);
            trackEvent('itinerary_error', {
                error_type: kind,
                source: entryPoint === 'focus_retry' ? 'focus_retry' : 'focus_onboarding',
            });
        } finally {
            if (timer) clearTimeout(timer);
            inFlightRef.current = false;
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isFocus || !hasFormData || calledRef.current) return;
        calledRef.current = true;
        fetchItinerary('focus_auto_generation');
    }, [isFocus, hasFormData, fetchItinerary]);

    const retry = useCallback(() => {
        if (!isFocus) return;
        fetchItinerary('focus_retry');
    }, [isFocus, fetchItinerary]);

    if (!isFocus) return IDLE;

    return { data, isLoading, error, errorKind, requiresLogin, candidatesUnavailable, failCount, retry };
}
