/** Shared request contract for the quick planner and onboarding result screen. */
export type ItineraryErrorKind = 'no-route' | 'server' | 'timeout' | 'offline' | 'network' | 'login' | 'forbidden' | 'consent' | 'unsupported' | 'validation' | 'limit' | 'upstream' | 'unavailable' | 'candidates' | 'unknown';

export class ItineraryRequestError extends Error {
    constructor(public kind: ItineraryErrorKind, public status?: number, public detail?: string) {
        super(kind);
    }
}

const DURATIONS: Record<string, string> = { day: '당일치기', onenight: '1박2일', twonight: '2박3일' };
export interface ItineraryRequest {
    duration: string;
    artists: string[];
    regions: string[];
    purposes: string[];
    budget: Record<string, unknown>;
    responseLocale: 'ko' | 'en' | 'ja';
    acknowledgeUnverifiedConditions: boolean;
}

function names(value: unknown, limit: number): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > limit) throw new ItineraryRequestError('validation');
    return value.map(item => {
        const name = typeof item === 'string' ? item : item?.name;
        if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new ItineraryRequestError('validation');
        return name;
    });
}

export function buildItineraryRequest(form: Record<string, unknown>): ItineraryRequest {
    const rawDuration = form.duration ?? 'day';
    if (typeof rawDuration !== 'string') throw new ItineraryRequestError('validation');
    const locale = form.responseLocale ?? 'ko';
    if (locale !== 'ko' && locale !== 'en' && locale !== 'ja') throw new ItineraryRequestError('validation');
    let budget = form.budget ?? { min: 30000, max: 2000000 };
    if (Array.isArray(budget)) {
        if (budget.length !== 2) throw new ItineraryRequestError('validation');
        budget = { min: budget[0], max: budget[1] };
    }
    if (!budget || typeof budget !== 'object') throw new ItineraryRequestError('validation');
    return {
        duration: DURATIONS[rawDuration] ?? rawDuration,
        artists: names(form.selectedArtists ?? form.artists, 5),
        regions: names(form.selectedRegions ?? form.regions, 3),
        purposes: names(form.purposes, 5),
        budget: budget as Record<string, unknown>,
        responseLocale: locale,
        acknowledgeUnverifiedConditions: form.acknowledgeUnverifiedConditions === true,
    };
}

/** Match server policy without removing budget/artist preferences to bypass consent. */
export function validateItineraryRequest(body: ItineraryRequest): void {
    if (body.duration !== '당일치기' || body.regions.length !== 1 || body.regions[0] !== '서울') {
        throw new ItineraryRequestError('unsupported', 422);
    }
    if ((body.artists.length > 0 || Object.keys(body.budget).length > 0) && !body.acknowledgeUnverifiedConditions) {
        throw new ItineraryRequestError('consent', 422);
    }
}

export function itineraryHttpError(status: number, payload: unknown): ItineraryRequestError {
    const problem = payload as { detail?: unknown; error?: unknown } | null;
    const detail = typeof problem?.detail === 'string' ? problem.detail : typeof problem?.error === 'string' ? problem.error : undefined;
    const code = typeof problem?.detail === 'object' && problem.detail ? (problem.detail as { code?: string }).code : undefined;
    const kind = status === 401 ? 'login' : status === 403 ? 'forbidden'
        : status === 429 ? 'limit' : status === 502 ? 'upstream' : status === 503 ? 'unavailable'
        : status === 504 ? 'timeout' : status === 422 ? code === 'consent_required' ? 'consent' : code === 'unsupported_conditions' ? 'unsupported' : 'validation'
        : status === 400 || status === 413 ? 'validation' : 'server';
    return new ItineraryRequestError(kind, status, detail);
}

export function classifyItineraryError(error: unknown): ItineraryErrorKind {
    if (error instanceof ItineraryRequestError) return error.kind;
    const { name = '', message = '' } = (error ?? {}) as { name?: string; message?: string };
    if (message === 'login_required') return 'login';
    if (message === 'empty_candidates') return 'candidates';
    if (message === 'empty_result') return 'no-route';
    if (name === 'AbortError' || name === 'TimeoutError' || /abort/i.test(message)) return 'timeout';
    if (/failed to fetch|network|load failed/i.test(message)) return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'network';
    if (message.includes('응답 오류')) return 'server';
    return 'unknown';
}

export function itineraryErrorMessage(error: unknown): string {
    const messages: Record<ItineraryErrorKind, string> = {
        consent: '아티스트 연관과 예산 충족은 미확인입니다. 일반 장소 코스 안내에 직접 동의해 주세요.',
        unsupported: '현재 서울 당일치기만 지원합니다. 지역과 기간을 바꿔 주세요.',
        validation: '요청 조건을 확인해 주세요. 지역·기간·예산·안내 언어 입력이 올바르지 않습니다.',
        login: '로그인 후 AI 코스를 이용해 주세요.',
        forbidden: '현재 허용된 테스트 계정만 AI 코스를 이용할 수 있습니다.',
        limit: '추천 요청 또는 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
        upstream: '추천 서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        unavailable: '추천 서버 또는 자료를 준비 중입니다. 잠시 후 다시 시도해 주세요.',
        timeout: '추천 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.',
        offline: '인터넷 연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요.',
        network: '추천 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.',
        candidates: '출처가 확인된 추천 자료가 아직 없습니다.',
        'no-route': '조건에 맞는 코스를 찾지 못했어요. 여행 목적을 바꿔 다시 시도해 주세요.',
        server: '추천 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
        unknown: '코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    };
    return messages[classifyItineraryError(error)];
}
