'use client';

import {Suspense, useContext, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {AuthContext} from '@/context/AuthContext';
import PersonalLibraryNav from '@/components/personal/PersonalLibraryNav';
import {clearPhotoVideoContext, PHOTO_VIDEO_CONTEXT_KEY, readVideoLocation, videoLibraryHref, UUID_V4, type VideoLocation} from '@/lib/kride/personalLibrary';
import {normalizeVideoJob, privateVideoRequest, usePrivateVideoHistory, usePrivateVideoJob, videoCreatedAt, type PrivateRead, type VideoJob} from '@/lib/hooks/usePrivateVideoHistory';

const labels: Record<VideoJob['status'], string> = {QUEUED: '생성 대기 중', RUNNING: '영상 생성 중', COMPLETED: '영상 생성 완료', FAILED: '영상 생성 실패'};
const failures: Record<string, string> = {RENDER_TIMEOUT: '영상 생성 시간이 초과됐습니다.', RENDER_FAILED: '사진 처리 또는 영상 생성에 실패했습니다.', WORKER_INTERRUPTED: '처리 서버가 중단됐습니다.'};
const noSessionChange = () => {};
const loginHref = (location: VideoLocation) => '/view/LOGIN_PAGE?returnTo=' + encodeURIComponent(videoLibraryHref(location));

function ReadNotice({state, location, retry}: {state: Exclude<PrivateRead<unknown>, {kind: 'ready'}>; location: VideoLocation; retry: () => void}) {
    if (state.kind === 'loading') return <p role="status">불러오는 중입니다.</p>;
    if (state.kind === 'unauthenticated') return <p role="status">로그인을 다시 확인해주세요. <Link href={loginHref(location)}>로그인하고 돌아오기</Link></p>;
    if (state.kind === 'unavailable') return <div role="status"><p>내 영상 기능을 준비 중입니다. 잠시 후 다시 확인해주세요.</p><button type="button" onClick={retry}>다시 확인</button></div>;
    return <div role="alert"><p>{state.kind === 'not-found' ? '작업을 찾을 수 없습니다.' : state.message}</p><button type="button" onClick={retry}>다시 불러오기</button></div>;
}
function CreatedTime({value}: {value?: string}) {
    const time = videoCreatedAt(value);
    return time ? <time dateTime={time.dateTime}>{time.label}</time> : null;
}

type Course = {owner: string; courseContext: string; places: {id: string; name: string}[]};
function VideoCreator({identity, onCreated, onExpired}: {identity: string; onCreated: (job: VideoJob) => void; onExpired: () => void}) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [photoId, setPhotoId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<'upload' | 'generate' | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [poiId, setPoiId] = useState('');
    const requestId = useRef('');
    const operation = useRef<AbortController | null>(null);
    useEffect(() => () => operation.current?.abort(), []);
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(PHOTO_VIDEO_CONTEXT_KEY);
            if (!stored) return;
            const data = stored.length <= 24000 ? JSON.parse(stored) : null;
            if (!data || data.owner !== identity || typeof data.courseContext !== 'string' || data.courseContext.length > 8000 ||
                !Array.isArray(data.places) || data.places.length > 24 ||
                !data.places.every((p: {id?: unknown; name?: unknown}) => p && typeof p.id === 'string' && typeof p.name === 'string')) {
                clearPhotoVideoContext(); return;
            }
            setCourse(data);
        } catch { clearPhotoVideoContext(); setError('코스 연결 정보를 읽지 못했습니다. 코스 화면에서 다시 연결해주세요.'); }
    }, [identity]);
    useEffect(() => {
        if (!file) {setPreview(''); return;}
        const url = URL.createObjectURL(file); setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    async function submit(kind: 'upload' | 'generate') {
        if (operation.current || (kind === 'upload' ? !file : !photoId || !!course && !poiId)) return;
        const controller = new AbortController(); operation.current = controller;
        setBusy(kind); setError('');
        try {
            if (kind === 'upload') {
                const data = await privateVideoRequest('photos', controller.signal, {method: 'POST', body: file!, headers: {'Content-Type': file!.type}});
                if (!UUID_V4.test(data.photoId)) throw new Error('사진 응답을 확인하지 못했습니다. 다시 확인해주세요.');
                if (!controller.signal.aborted) setPhotoId(data.photoId);
            } else {
                requestId.current ||= crypto.randomUUID();
                const data = await privateVideoRequest('jobs', controller.signal, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
                    photoId, requestId: requestId.current, ...(course ? {courseContext: course.courseContext, poiId} : {}),
                })});
                if (!controller.signal.aborted) onCreated(normalizeVideoJob(data));
            }
        } catch (e) {
            if (!controller.signal.aborted) {
                if ((e as {status?: number}).status === 401) onExpired();
                setError(e instanceof Error ? e.message : '요청하지 못했습니다. 잠시 후 다시 확인해주세요.');
            }
        } finally {if (!controller.signal.aborted) {operation.current = null; setBusy(null);}}
    }
    return <section aria-labelledby="create-video-title">
        <h2 id="create-video-title">새 영상 만들기</h2>
        <p>사진 한 장으로 시작합니다. 로그인한 본인만 사진을 조회할 수 있습니다.</p>
        {course && <section aria-label="여행 코스 연결"><h3>이 사진과 연결할 코스 장소</h3>
            <label>장소 선택 <select value={poiId} disabled={!!busy} onChange={e => {setPoiId(e.target.value); requestId.current = '';}}>
                <option value="">직접 장소를 선택해주세요</option>{course.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
            <p>사진의 실제 촬영 위치를 자동 판정하지 않습니다. 선택한 코스와 장소 번호를 기록합니다.</p>
            <button type="button" disabled={!!busy} onClick={() => {setCourse(null); setPoiId(''); requestId.current = ''; clearPhotoVideoContext();}}>코스 연결 없이 만들기</button>
        </section>}
        <label>여행 사진 선택 (JPEG·PNG·WebP, 최대 10MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={e => {
                const next = e.target.files?.[0]; setPhotoId(''); setFile(null); setError(''); requestId.current = '';
                if (!next) return;
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 10 * 1024 * 1024 || !next.size) {
                    setError('10MB 이하의 JPEG·PNG·WebP 사진을 선택해주세요.'); return;
                }
                setFile(next);
            }}/>
        </label>
        {(preview || photoId) && <img src={preview || `/api/travel-video/photos/${photoId}`} alt="선택한 여행 사진" className="private-video-preview"/>}
        <p><button type="button" disabled={!file || !!busy || !!photoId} onClick={() => void submit('upload')}>{busy === 'upload' ? '사진을 올리는 중' : '사진 올리기'}</button></p>
        {photoId && <><p role="status">사진을 저장했습니다.</p><p>처리 방식: CPU에서 사진을 천천히 확대·이동합니다. 실제 사진 처리이며, 생성형 AI 실행이나 모의 처리가 아닙니다.</p>
            <button type="button" disabled={!!busy || !!course && !poiId} onClick={() => void submit('generate')}>{busy === 'generate' ? '생성을 요청하는 중' : '영상 만들기'}</button></>}
        {error && <p role="alert">{error}</p>}
    </section>;
}

function VideoWorkspace({identity, location, onExpired}: {identity: string; location: VideoLocation; onExpired: () => void}) {
    const router = useRouter();
    const [refresh, setRefresh] = useState(0);
    const [retryError, setRetryError] = useState('');
    const [retrying, setRetrying] = useState(false);
    const [playbackError, setPlaybackError] = useState(false);
    const retryOperation = useRef<AbortController | null>(null);
    const retryId = useRef('');
    const heading = useRef<HTMLHeadingElement>(null);
    const detail = usePrivateVideoJob(identity, location.job, refresh);
    const job = detail.kind === 'ready' ? detail.data : null;
    const history = usePrivateVideoHistory(identity, location.page, location.view === 'history', `${refresh}:${job?.status ?? ''}`);
    useEffect(() => {
        retryOperation.current?.abort(); retryOperation.current = null; retryId.current = '';
        setRetrying(false); setRetryError(''); setPlaybackError(false);
        return () => {retryOperation.current?.abort();};
    }, [location.job]);
    useEffect(() => {heading.current?.focus();}, [location.view, location.page, location.job]);
    useEffect(() => {
        if (detail.kind === 'unauthenticated' || (location.view === 'history' && history.kind === 'unauthenticated')) onExpired();
    }, [detail.kind, history.kind, location.view, onExpired]);
    const navigate = (next: Partial<VideoLocation>) => router.push(videoLibraryHref({...location, ...next}), {scroll: false});
    const reload = () => {setPlaybackError(false); setRefresh(v => v + 1);};
    async function retry() {
        if (!job || job.status !== 'FAILED' || retryOperation.current) return;
        const controller = new AbortController(); retryOperation.current = controller;
        retryId.current ||= crypto.randomUUID(); setRetrying(true); setRetryError('');
        try {
            const data = await privateVideoRequest(`jobs/${job.jobId}/retry`, controller.signal, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: retryId.current})});
            if (!controller.signal.aborted) navigate({job: normalizeVideoJob(data).jobId});
        } catch (e) {
            if (!controller.signal.aborted) {
                if ((e as {status?: number}).status === 401) onExpired();
                setRetryError(e instanceof Error ? e.message : '재시도를 요청하지 못했습니다.');
            }
        } finally {if (!controller.signal.aborted) {retryOperation.current = null; setRetrying(false);}}
    }
    return <>
        <nav className="private-video-modes" aria-label="영상 보기 방식">
            <Link href={videoLibraryHref({...location, view: 'create', job: null})} aria-current={location.view === 'create' ? 'page' : undefined}>새 영상 만들기</Link>
            <Link href={videoLibraryHref({...location, view: 'history'})} aria-current={location.view === 'history' ? 'page' : undefined}>이전 작업</Link>
        </nav>
        <h2 ref={heading} tabIndex={-1} className="private-video-section-title">{location.view === 'history' ? `이전 작업 · ${location.page}페이지` : '사진으로 여행을 기록하세요'}</h2>
        {location.view === 'create' ? <VideoCreator identity={identity} onCreated={created => navigate({view: 'history', page: 1, job: created.jobId})} onExpired={onExpired}/> : <>
            <section aria-label="이전 영상 작업" aria-busy={history.kind === 'loading'}>
                {history.kind !== 'ready' ? <ReadNotice state={history} location={location} retry={reload}/> : history.data.length === 0
                    ? <p role="status">{location.page === 1 ? '아직 작업 기록이 없습니다.' : '이 페이지에는 작업 기록이 없습니다.'}</p>
                    : <ul className="private-video-history">{history.data.map(item => <li key={item.jobId}>
                        <Link href={videoLibraryHref({...location, job: item.jobId})} aria-current={location.job === item.jobId ? 'true' : undefined}>
                            <strong>{labels[item.status]} · {item.jobId.slice(0, 8)}</strong><CreatedTime value={item.createdAt}/><span>{item.methodLabel}</span>
                            {item.trip && <span>연결 장소: {item.trip.placeName}</span>}
                        </Link>
                    </li>)}</ul>}
                <div className="private-video-pagination" aria-label="영상 이력 페이지">
                    <button type="button" disabled={location.page === 1 || retrying} onClick={() => navigate({page: location.page - 1, job: null})}>이전 기록</button>
                    <span>{location.page}페이지</span>
                    <button type="button" disabled={retrying || history.kind !== 'ready' || history.data.length < 20 || location.page >= 9999} onClick={() => navigate({page: location.page + 1, job: null})}>다음 기록</button>
                </div>
            </section>
            {location.job && <section aria-label="영상 작업 상태" aria-busy={detail.kind === 'loading'}>
                <h3>선택한 영상</h3>
                {detail.kind !== 'ready' ? <ReadNotice state={detail} location={location} retry={reload}/> : job && <>
                    <p role="status">{labels[job.status]}</p><CreatedTime value={job.createdAt}/><p>{job.methodLabel}</p>
                    {job.trip && <p>연결 장소: {job.trip.placeName} · 코스 번호 {job.trip.itineraryId.slice(0, 8)}<br/>{job.trip.notice}</p>}
                    {job.errorCode && <p role="alert">{failures[job.errorCode] || '작업에 실패했습니다.'}</p>}
                    {job.status === 'FAILED' && <button type="button" disabled={retrying} onClick={() => void retry()}>{retrying ? '재시도를 요청하는 중' : '실패한 영상 다시 만들기'}</button>}
                    {job.renderMilliseconds != null && <p>영상 처리 시간: {(job.renderMilliseconds / 1000).toFixed(1)}초</p>}
                    {job.cost && <p>{job.cost.note}</p>}
                    {job.status === 'COMPLETED' && job.videoUrl && <>
                        <video key={`${job.jobId}:${refresh}`} controls playsInline preload="metadata" src={job.videoUrl} className="private-video-player" onError={() => setPlaybackError(true)}/>
                        <p><a href={job.videoUrl} download="travel.mp4">영상 다운로드</a></p>
                    </>}
                    <button type="button" onClick={reload}>상태 다시 확인</button>
                    {playbackError && <p role="alert">영상을 재생하지 못했습니다. 상태를 다시 확인하거나 다운로드해주세요.</p>}
                </>}
                {retryError && <p role="alert">{retryError}</p>}
                <Link href={videoLibraryHref({...location, job: null})}>선택 닫기</Link>
            </section>}
        </>}
    </>;
}
function PrivateVideoScreen() {
    const auth = useContext(AuthContext);
    const search = useSearchParams();
    const location = readVideoLocation(search);
    const canonical = videoLibraryHref(location);
    const router = useRouter();
    const enabled = process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED === 'true';
    const identity = auth?.isLoggedIn && !auth.isLoading ? String(auth.user?.userSqno ?? auth.user?.userId ?? '') : '';
    useEffect(() => {if (`/travel/video${search.toString() ? '?' + search.toString() : ''}` !== canonical) router.replace(canonical, {scroll: false});}, [canonical, router, search]);
    return <>
        <PersonalLibraryNav active="videos" savedHref={location.returnTo} videoEnabled={enabled}/>
        <p><Link href={location.returnTo}>이전 화면으로 돌아가기</Link> · <Link href="/view/ROUTE_PLANNER">여행 코스로 돌아가기</Link></p>
        {!enabled ? <p role="status">내 영상 기능을 준비 중입니다. 내 목록은 계속 이용할 수 있습니다.</p>
            : !auth || auth.isLoading ? <p role="status">로그인을 확인하는 중입니다.</p>
            : !identity ? <p role="status">내 영상은 로그인 후 볼 수 있습니다. <Link href={loginHref(location)}>로그인하고 돌아오기</Link></p>
            : <VideoWorkspace key={identity} identity={identity} location={location} onExpired={auth.markSessionExpired ?? noSessionChange}/>}
    </>;
}
export default function TravelVideoPage() {
    return <main className="private-video-page" aria-labelledby="private-video-title"><h1 id="private-video-title">내 영상</h1><Suspense fallback={<p role="status">화면을 준비하는 중입니다.</p>}><PrivateVideoScreen/></Suspense></main>;
}
