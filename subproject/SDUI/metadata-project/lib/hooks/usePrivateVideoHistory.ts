'use client';
import {useEffect, useState} from 'react';
import {UUID_V4} from '@/lib/kride/personalLibrary';

export type VideoJob = {
    jobId: string; photoId: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    createdAt?: string; startedAt?: string; finishedAt?: string; errorCode?: string;
    videoUrl: string | null; methodLabel: string; renderMilliseconds?: number;
    cost?: {note: string}; trip?: {itineraryId: string; poiId: string; placeName: string; notice: string} | null;
};
export type PrivateRead<T> =
    | {kind: 'loading'} | {kind: 'ready'; data: T}
    | {kind: 'unauthenticated' | 'unavailable' | 'not-found' | 'error'; message: string};
class ReadError extends Error { constructor(public status: number, message: string) { super(message); } }
function failure(error: unknown): Exclude<PrivateRead<never>, {kind: 'loading'} | {kind: 'ready'}> {
    const status = error instanceof ReadError ? error.status : 0;
    return {kind: status === 401 ? 'unauthenticated' : status === 503 ? 'unavailable' : status === 404 ? 'not-found' : 'error',
        message: error instanceof Error ? error.message : '불러오지 못했습니다. 다시 시도해주세요.'};
}
export function normalizeVideoJob(value: unknown, expectedId?: string): VideoJob {
    const job = value as VideoJob;
    if (!job || !UUID_V4.test(job.jobId) || !UUID_V4.test(job.photoId) ||
        (expectedId && job.jobId.toLowerCase() !== expectedId.toLowerCase()) ||
        !['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].includes(job.status) || typeof job.methodLabel !== 'string') {
        throw new Error('영상 작업 응답을 확인하지 못했습니다. 다시 불러와주세요.');
    }
    // Playback always uses the protected same-origin route, never a supplied external URL.
    return {...job, videoUrl: job.status === 'COMPLETED' ? `/api/travel-video/jobs/${job.jobId}/video` : null};
}
export async function privateVideoRequest(path: string, signal: AbortSignal, init?: RequestInit): Promise<any> {
    let response: Response;
    try { response = await fetch(`/api/travel-video/${path}`, {...init, credentials: 'include', cache: 'no-store', signal}); }
    catch { throw new ReadError(0, '서버에 연결하지 못했습니다. 잠시 후 다시 확인해주세요.'); }
    let data;
    try { data = await response.json(); }
    catch { throw new ReadError(response.status >= 400 ? response.status : 502, '서버 응답을 확인하지 못했습니다. 다시 불러와주세요.'); }
    if (!response.ok) throw new ReadError(response.status, typeof data?.detail === 'string' ? data.detail : '불러오지 못했습니다. 다시 시도해주세요.');
    return data;
}
export function usePrivateVideoHistory(identity: string, page: number, enabled: boolean, refresh: string | number = 0): PrivateRead<VideoJob[]> {
    const key = `${identity}:${page}:${enabled}:${refresh}`;
    const [result, setResult] = useState<{key: string; state: PrivateRead<VideoJob[]>}>({key: '', state: {kind: 'loading'}});
    useEffect(() => {
        if (!enabled || !identity) return;
        const controller = new AbortController();
        setResult({key, state: {kind: 'loading'}});
        privateVideoRequest(`jobs?page=${page}`, controller.signal).then(data => {
            if (!Array.isArray(data?.items) || data.page !== page) throw new Error('이력 응답을 확인하지 못했습니다. 다시 불러와주세요.');
            const items = data.items.map((item: unknown) => normalizeVideoJob(item));
            if (!controller.signal.aborted) setResult({key, state: {kind: 'ready', data: items}});
        }).catch(error => {if (!controller.signal.aborted) setResult({key, state: failure(error)});});
        return () => controller.abort();
    }, [key, identity, page, enabled]);
    return result.key === key && enabled && identity ? result.state : {kind: 'loading'};
}
export function usePrivateVideoJob(identity: string, jobId: string | null, refresh: number): PrivateRead<VideoJob> {
    const key = `${identity}:${jobId}:${refresh}`;
    const [result, setResult] = useState<{key: string; state: PrivateRead<VideoJob>}>({key: '', state: {kind: 'loading'}});
    useEffect(() => {
        if (!identity || !jobId) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const deadline = Date.now() + 10 * 60_000;
        setResult({key, state: {kind: 'loading'}});
        async function poll() {
            try {
                const job = normalizeVideoJob(await privateVideoRequest(`jobs/${jobId}`, controller.signal), jobId!);
                if (controller.signal.aborted) return;
                setResult({key, state: {kind: 'ready', data: job}});
                if (!['QUEUED', 'RUNNING'].includes(job.status)) return;
                if (Date.now() >= deadline) throw new Error('상태 확인을 잠시 멈췄습니다. 상태 다시 확인을 눌러주세요.');
                timer = setTimeout(poll, 3000);
            } catch (error) {if (!controller.signal.aborted) setResult({key, state: failure(error)});}
        }
        void poll();
        return () => {controller.abort(); clearTimeout(timer);};
    }, [key, identity, jobId]);
    return result.key === key ? result.state : {kind: 'loading'};
}
export function videoCreatedAt(value?: string): {dateTime: string; label: string} | null {
    if (!value) return null;
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(iso)) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : {dateTime: date.toISOString(), label: new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short'}).format(date)};
}
