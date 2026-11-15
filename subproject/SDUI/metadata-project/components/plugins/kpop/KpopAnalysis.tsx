'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { KpopProductSearch, ProductCard, normalizeCandidate } from './KpopProducts';
import { backoffDelay } from '@/lib/net/backoff';

type LeafProps = {
    meta?: Record<string, any>;
    onAction?: (meta: Record<string, any>, data?: Record<string, any>) => void;
};

type AnalysisJob = {
    jobId: string | number;
    status: string;
    progressPct: number;
    result?: Record<string, any>;
    errorMessage?: string;
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']);
const POLL_BASE_MS = 3000;
const POLL_MAX_MS = 30000;
const MAX_POLL_FAILURES = 5;
/** SSE를 열었는데 이 시간 안에 첫 상태가 오지 않으면(중간 프록시가 막는 경우 등) 조회로 바꾼다. */
const SSE_FIRST_EVENT_MS = 5000;

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || String(response.status));
    return (payload?.data ?? payload) as T;
}

function normalizeJob(value: Record<string, any>): AnalysisJob {
    const rawStatus = String(value.status || 'QUEUED').toUpperCase();
    const status = rawStatus === 'SUCCESS' ? 'SUCCEEDED'
        : rawStatus === 'FAILURE' ? 'FAILED'
            : ['STARTED', 'PROGRESS'].includes(rawStatus) ? 'RUNNING' : rawStatus;
    let result = value.result ?? value.resultJson ?? value.result_json;
    if (typeof result === 'string') {
        try { result = JSON.parse(result); } catch { result = { evidence: result }; }
    }
    return {
        jobId: value.jobId ?? value.id ?? '',
        status,
        progressPct: Number(value.progressPct ?? value.progress_pct ?? 0),
        result,
        errorMessage: value.errorMessage ?? value.error_message,
    };
}

function friendlyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        return '로그인 후 이용해 주세요.';
    }
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function KpopUploadConsent({ meta, onAction }: LeafProps) {
    const inputId = useId();
    const [file, setFile] = useState<File | null>(null);
    const [consented, setConsented] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const chooseFile = (next?: File) => {
        setMessage('');
        if (!next) return;
        if (!ACCEPTED_TYPES.includes(next.type)) {
            setFile(null);
            setMessage('JPG, PNG, WebP 이미지만 선택할 수 있습니다.');
            return;
        }
        if (next.size > MAX_BYTES) {
            setFile(null);
            setMessage('이미지는 10MB 이하로 선택해 주세요.');
            return;
        }
        setFile(next);
    };

    const submit = async () => {
        if (!file || !consented || busy) return;
        setBusy(true);
        try {
            setMessage('업로드 주소를 준비하고 있어요.');
            const presign = await requestJson<Record<string, any>>('/api/v1/kpop/analysis-assets/presign', {
                method: 'POST',
                body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
            });
            const sourceKey = String(presign.sourceKey ?? presign.objectKey ?? presign.key ?? '');
            const uploadUrl = String(presign.uploadUrl ?? presign.presignedUrl ?? presign.url ?? '');
            if (!sourceKey || !uploadUrl) throw new Error('업로드 주소가 없습니다.');

            setMessage('사진을 업로드하고 있어요.');
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: presign.headers ?? presign.requiredHeaders ?? {},
                body: file,
            });
            if (!uploadResponse.ok) throw new Error(String(uploadResponse.status));

            setMessage('AI 분석 작업을 시작하고 있어요.');
            const rawJob = await requestJson<Record<string, any>>('/api/v1/kpop/analysis-jobs', {
                method: 'POST',
                body: JSON.stringify({
                    sourceKey,
                    contentType: file.type,
                    idempotencyKey: `kpop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    consented: true,
                    consentScope: 'user-owned-image-analysis',
                }),
            });
            const job = normalizeJob(rawJob);
            if (!job.jobId) throw new Error('분석 작업 번호가 없습니다.');
            onAction?.({
                ...meta,
                actionType: 'ROUTE',
                actionUrl: `/view/KPOP_AI_RESULT?jobId=${encodeURIComponent(String(job.jobId))}`,
            }, rawJob);
        } catch (error) {
            setMessage(friendlyError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="kpop-analysis-panel" aria-labelledby="kpop-upload-title">
            <div>
                <span className="kpop-eyebrow">AI PRODUCT FINDER</span>
                <h2 id="kpop-upload-title">내 사진으로 상품 후보를 찾아보세요</h2>
                <p>AI가 비슷한 상품 후보와 확인 근거를 정리합니다. 동일 상품이나 정품을 확정하지 않습니다.</p>
            </div>
            <label className="kpop-file-picker" htmlFor={inputId}>
                <span>{file ? '다른 사진 선택' : '사진 선택'}</span>
                <input
                    id={inputId}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                />
            </label>
            <small>JPG, PNG, WebP · 최대 10MB</small>
            {file && (
                <div className="kpop-upload-preview">
                    <img src={previewUrl} alt="선택한 분석 사진 미리보기" />
                    <strong>{file.name}</strong>
                </div>
            )}
            <label className="kpop-consent-row">
                <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
                <span>이 사진을 사용할 권한이 있으며 상품 후보 분석을 위한 업로드에 동의합니다.</span>
            </label>
            <button type="button" className="kpop-primary-btn" disabled={!file || !consented || busy} aria-busy={busy} onClick={submit}>
                {busy ? '분석 준비 중...' : '후보 분석 시작'}
            </button>
            {message && <p className="kpop-analysis-message" role="status">{message}</p>}
        </section>
    );
}

export function KpopAiResultCard({ initialJobId }: { initialJobId?: string } = {}) {
    const [jobId] = useState(() => (
        initialJobId
            || (typeof window === 'undefined'
                ? ''
                : new URLSearchParams(window.location.search).get('jobId') || '')
    ));
    const [job, setJob] = useState<AnalysisJob | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!jobId) return;
        const jobUrl = `/api/v1/kpop/analysis-jobs/${encodeURIComponent(jobId)}`;
        let active = true;
        let finished = false;
        let failures = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let firstEventTimer: ReturnType<typeof setTimeout> | undefined;
        let source: EventSource | undefined;

        // 상태 하나를 화면에 반영하고, 끝난 상태인지 돌려준다.
        const apply = (raw: Record<string, any>) => {
            const next = normalizeJob(raw);
            setJob(next);
            setMessage('');
            finished = TERMINAL_STATUSES.has(next.status);
            return finished;
        };
        const closeStream = () => {
            if (firstEventTimer) clearTimeout(firstEventTimer);
            source?.close();
            source = undefined;
        };
        // 2순위: 상태 조회. 성공하면 3초 간격, 실패하면 3초→6초→12초…(최대 30초)로 늦추고 5번 연속 실패하면 멈춘다.
        const poll = async () => {
            try {
                const raw = await requestJson<Record<string, any>>(jobUrl);
                if (!active) return;
                failures = 0;
                if (!apply(raw)) timer = setTimeout(poll, POLL_BASE_MS);
            } catch (error) {
                if (!active) return;
                failures += 1;
                const authError = friendlyError(error) === '로그인 후 이용해 주세요.';
                if (authError || failures >= MAX_POLL_FAILURES) {
                    setMessage(friendlyError(error));
                    return;
                }
                timer = setTimeout(poll, backoffDelay(failures, { baseMs: POLL_BASE_MS, maxMs: POLL_MAX_MS }));
            }
        };
        const fallBackToPolling = () => {
            closeStream();
            if (active && !finished) void poll();
        };

        // 1순위: 서버가 보내 주는 SSE(/stream). 연결이 안 되거나 끊기면 조회로 바꾼다.
        if (typeof EventSource === 'undefined') {
            void poll();
        } else {
            source = new EventSource(`${jobUrl}/stream`, { withCredentials: true });
            firstEventTimer = setTimeout(fallBackToPolling, SSE_FIRST_EVENT_MS);
            source.addEventListener('status', (event) => {
                if (!active) return;
                if (firstEventTimer) clearTimeout(firstEventTimer);
                try {
                    if (apply(JSON.parse((event as MessageEvent).data))) closeStream();
                } catch {
                    fallBackToPolling();
                }
            });
            source.addEventListener('done', () => { finished = true; closeStream(); });
            source.onerror = () => { if (active && !finished) fallBackToPolling(); };
        }
        return () => { active = false; closeStream(); if (timer) clearTimeout(timer); };
    }, [jobId]);

    const candidates = useMemo(
        () => (Array.isArray(job?.result?.candidates) ? job.result.candidates : []).map(normalizeCandidate),
        [job?.result?.candidates]
    );
    const suggestedQuery = candidates[0]?.name || candidates[0]?.brand || '';

    if (!jobId) {
        return (
            <>
                <section className="kpop-analysis-panel"><p>분석 작업 번호가 없습니다. 사진을 다시 선택해 주세요.</p></section>
                <KpopProductSearch
                    autoSearchOnMount={false}
                    eyebrow="TEXT SEARCH"
                    title="직접 상품 후보 검색"
                    description="상품명 또는 브랜드로 직접 후보를 다시 찾아볼 수 있습니다."
                    ariaLabel="직접 검색 상품 후보"
                />
            </>
        );
    }

    return (
        <>
            <section className="kpop-analysis-panel" aria-busy={Boolean(job && !TERMINAL_STATUSES.has(job.status))}>
                <span className="kpop-eyebrow">작업 #{jobId}</span>
                <h2>{job?.status === 'SUCCEEDED' ? '사진 기반 상품 후보 분석이 완료됐어요' : '사진 기반 상품 후보를 분석하고 있어요'}</h2>
                {job && !TERMINAL_STATUSES.has(job.status) && (
                    <div className="kpop-progress" role="progressbar" aria-valuenow={job.progressPct} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${Math.max(0, Math.min(100, job.progressPct))}%` }} />
                    </div>
                )}
                {job?.status === 'FAILED' && <p role="alert">{job.errorMessage || '분석을 완료하지 못했습니다.'}</p>}
                {candidates.length > 0 && (
                    <div className="kpop-product-list" role="list" aria-label="AI 분석 상품 후보">
                        {candidates.map((candidate, index) => (
                            <ProductCard key={String(candidate.id || index)} candidate={candidate} />
                        ))}
                    </div>
                )}
                {job?.status === 'SUCCEEDED' && candidates.length === 0 && <p>제시할 만한 후보가 없습니다. 근거 부족도 정상적인 결과입니다.</p>}
                {message && <p className="kpop-analysis-message" role="status">{message}</p>}
            </section>
            <KpopProductSearch
                initialQuery={suggestedQuery}
                autoSearchOnMount={false}
                eyebrow="TEXT SEARCH"
                title="직접 상품 후보 검색"
                description="AI 결과와 별개로 상품명 또는 브랜드로 후보를 다시 찾아볼 수 있습니다."
                ariaLabel="직접 검색 상품 후보"
            />
        </>
    );
}