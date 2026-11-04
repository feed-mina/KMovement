'use client';

import {useContext, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {AuthContext} from '@/context/AuthContext';
import {cropProductImage, FULL_CROP, IMAGE_TYPES, MAX_IMAGE_BYTES, type Crop} from '@/lib/kpop/productImage';
import {normalizeCandidate, ProductCard} from './KpopProducts';

type Job = {jobId: number | string; status: string; result?: {availability?: string; candidates?: unknown[]}; sourceDeleted?: boolean};
class RequestError extends Error {constructor(public status: number) {super(String(status));}}
async function json<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, {method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
        ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}), signal});
    if (!response.ok) throw new RequestError(response.status);
    return (await response.json()).data as T;
}
const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']);
const categoryNames = {top: '상의·재킷', bag: '가방', shoes: '신발', accessory: '액세서리'};

export default function ProductImageFinder({mode}: {mode: 'upload' | 'url'}) {
    const auth = useContext(AuthContext);
    const identity = auth?.isLoggedIn ? String(auth.user?.userSqno || auth.user?.userId || '') : '';
    // Never retain another account's private image, job or pending response.
    return <ImageFinder key={identity || 'guest'} mode={mode} loggedIn={Boolean(identity)} authLoading={Boolean(auth?.isLoading)}/>;
}

function ImageFinder({mode, loggedIn, authLoading}: {mode: 'upload' | 'url'; loggedIn: boolean; authLoading: boolean}) {
    const [file, setFile] = useState<Blob | null>(null), [preview, setPreview] = useState('');
    const [url, setUrl] = useState(''), [choices, setChoices] = useState<string[]>([]);
    const [crop, setCrop] = useState<Crop>(FULL_CROP), [category, setCategory] = useState('top');
    const [artistQuery, setArtistQuery] = useState(''), [artists, setArtists] = useState<{id: number; nameKo: string}[]>([]);
    const [artistId, setArtistId] = useState(''), [artistMessage, setArtistMessage] = useState('');
    const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
    const [error, setError] = useState(''), [message, setMessage] = useState('');
    const [job, setJob] = useState<Job | null>(null), [pollRetry, setPollRetry] = useState(0), [deleting, setDeleting] = useState(false);
    const generation = useRef(0), remoteOperation = useRef<AbortController | null>(null), operation = useRef<AbortController | null>(null);
    const drag = useRef<{x: number; y: number} | null>(null);
    const submission = useRef<{sourceKey: string; idempotencyKey: string} | null>(null);
    const artistOperation = useRef<AbortController | null>(null);
    useEffect(() => {
        if (!file) {setPreview(''); return;}
        const local = URL.createObjectURL(file); setPreview(local);
        return () => URL.revokeObjectURL(local);
    }, [file]);
    useEffect(() => () => {generation.current++; operation.current?.abort(); remoteOperation.current?.abort(); artistOperation.current?.abort();}, []);
    const invalidate = () => {
        generation.current++; operation.current?.abort(); remoteOperation.current?.abort();
        submission.current = null; setJob(null); setError(''); setMessage(''); setBusy(false);
    };
    const selectFile = (next?: Blob) => {
        if (!next) return;
        invalidate();
        if (!IMAGE_TYPES.includes(next.type) || !next.size || next.size > MAX_IMAGE_BYTES) {
            setFile(null); setError('JPG, PNG, WebP 사진을 10MB 이하로 선택해 주세요.'); return;
        }
        setFile(next); setCrop(FULL_CROP); setConsent(false);
    };
    const loadUrl = async (address = url) => {
        if (!loggedIn || busy) return;
        invalidate(); const current = generation.current;
        setFile(null); setChoices([]); setBusy(true);
        const controller = new AbortController(); remoteOperation.current = controller;
        const timer = setTimeout(() => controller.abort(), 65000);
        try {
            const parsed = new URL(address);
            if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
            const response = await fetch('/api/kpop/product-images', {method: 'POST', credentials: 'include', cache: 'no-store',
                headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: address}), signal: controller.signal});
            if (!response.ok) throw new RequestError(response.status);
            if (current !== generation.current) return;
            if (response.headers.get('Content-Type')?.includes('application/json')) {
                const data = await response.json();
                if (current !== generation.current) return;
                if (!Array.isArray(data.images) || !data.images.length) throw new Error();
                setChoices(data.images); setMessage('게시물에서 찾은 사진 중 한 장을 골라 주세요.');
            } else {
                const image = await response.blob();
                if (current !== generation.current) return;
                selectFile(image);
            }
        } catch (e) {
            if (current === generation.current) setError(e instanceof RequestError && e.status === 401
                ? '로그인을 다시 확인한 뒤 사진 주소를 불러와 주세요.'
                : '이 주소의 사진을 가져올 수 없어요. 로그인 제한이 없는 주소인지 확인하거나 사진을 직접 올려 주세요.');
        } finally {clearTimeout(timer); if (current === generation.current || remoteOperation.current === controller) setBusy(false);}
    };
    const findArtists = async () => {
        artistOperation.current?.abort(); const controller = new AbortController(); artistOperation.current = controller;
        setArtistMessage('아티스트를 찾는 중이에요.');
        try {
            const data = await json<{items: {id: number; nameKo: string}[]}>(`/api/v1/kpop/artists?q=${encodeURIComponent(artistQuery.trim())}&page=1&pageSize=8`, undefined, controller.signal);
            if (controller.signal.aborted) return;
            setArtists(data.items || []); setArtistMessage(data.items?.length ? '목록에서 직접 선택해 주세요.' : '이름을 찾지 못했어요. 상품만 찾을 수도 있어요.');
        } catch {if (!controller.signal.aborted) setArtistMessage('아티스트 목록을 불러오지 못했어요. 다시 검색하거나 상품만 찾아 주세요.');}
    };
    const submit = async () => {
        if (!file || !consent || !loggedIn || busy) return;
        const current = generation.current; setBusy(true); setError(''); setJob(null);
        const controller = new AbortController(); operation.current = controller;
        const timer = setTimeout(() => controller.abort(), 60000);
        try {
            if (!submission.current) {
                setMessage('선택한 상품 부분을 준비하고 있어요.');
                const image = await cropProductImage(preview, crop);
                if (current !== generation.current) return;
                const presign = await json<{sourceKey: string; uploadUrl: string; headers: Record<string, string>}>(
                    '/api/v1/kpop/analysis-assets/presign', {contentType: 'image/jpeg', fileSize: image.size}, controller.signal);
                const upload = await fetch(presign.uploadUrl, {method: 'PUT', headers: presign.headers, body: image, credentials: 'omit', signal: controller.signal});
                if (!upload.ok) throw new Error();
                if (current !== generation.current) return;
                submission.current = {sourceKey: presign.sourceKey, idempotencyKey: crypto.randomUUID()};
            }
            setMessage('상품 후보 분석을 요청하고 있어요.');
            const result = await json<Job>('/api/v1/kpop/analysis-jobs', {...submission.current, contentType: 'image/jpeg', consented: true,
                consentScope: 'user-owned-image-analysis', itemCategory: category, ...(artistId ? {artistId: Number(artistId)} : {})}, controller.signal);
            if (current !== generation.current) return;
            if (!result.jobId) throw new Error();
            setJob(result); setMessage('');
        } catch (e) {
            if (current === generation.current) setError(e instanceof RequestError && e.status === 401 ? '로그인 후 다시 시도해 주세요.'
                : e instanceof RequestError && e.status === 429 ? '분석 요청이 많아요. 잠시 후 다시 시도해 주세요.'
                : e instanceof Error && !(e instanceof RequestError) && !['AbortError', 'TypeError'].includes(e.name) && e.message.startsWith('사진') ? e.message
                : '분석 요청을 완료하지 못했어요. 사진과 선택을 유지했으니 다시 시도해 주세요.');
        } finally {clearTimeout(timer); if (current === generation.current) setBusy(false);}
    };
    const jobId = job?.jobId;
    useEffect(() => {
        if (!jobId) return;
        const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
        const current = generation.current;
        const refresh = async () => {
            try {
                const next = await json<Job>(`/api/v1/kpop/analysis-jobs/${encodeURIComponent(jobId)}`, undefined, controller.signal);
                if (controller.signal.aborted || current !== generation.current) return;
                setJob(next); setError('');
                if (!terminal.has(next.status)) timer = setTimeout(refresh, 3000);
            } catch {if (!controller.signal.aborted && current === generation.current) setError('작업 상태를 확인하지 못했어요. 새 작업을 만들지 않고 다시 확인할 수 있어요.');}
        };
        void refresh(); return () => {controller.abort(); clearTimeout(timer);};
    }, [jobId, pollRetry]);
    const candidates = (job?.result?.candidates || []).map(normalizeCandidate);
    const running = Boolean(job && !terminal.has(job.status));
    const removeSource = async () => {
        if (!jobId || deleting) return; setDeleting(true);
        const current = generation.current;
        try {
            const response = await fetch(`/api/v1/kpop/analysis-jobs/${encodeURIComponent(jobId)}/source`, {method: 'DELETE', credentials: 'include'});
            if (!response.ok) throw new Error();
            if (current === generation.current) {setJob(j => j ? {...j, sourceDeleted: true} : j); setMessage('업로드한 상품 사진을 삭제했어요.');}
        } catch {if (current === generation.current) setError('업로드 사진을 삭제하지 못했어요. 다시 눌러 주세요.');}
        finally {setDeleting(false);}
    };
    const changeCrop = (next: Crop) => {invalidate(); setCrop(next);};
    const pointer = (event: React.PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {x: Math.max(0, Math.min(99, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(99, (event.clientY - rect.top) / rect.height * 100))};
    };
    return <div className="product-image-finder">
        {!loggedIn && <p className="product-image-notice">{authLoading ? '로그인을 확인하고 있어요.' : <>사진 분석과 주소 불러오기는 로그인 후 사용할 수 있어요. <Link href="/view/LOGIN_PAGE?returnTo=%2Fview%2FKPOP_PRODUCTS">로그인하고 돌아오기</Link></>}</p>}
        {mode === 'upload' ? <div><label htmlFor="product-photo">사진 올리기</label><input id="product-photo" type="file" accept={IMAGE_TYPES.join(',')} onChange={e => selectFile(e.target.files?.[0])}/><p>JPG, PNG, WebP · 최대 10MB. 선택한 부분만 업로드합니다.</p></div>
            : <form onSubmit={e => {e.preventDefault(); void loadUrl();}}><label htmlFor="product-image-url">이미지 또는 공개 게시물 주소</label><div className="product-image-url-row"><input id="product-image-url" type="url" maxLength={2048} value={url} placeholder="https://…" onChange={e => {invalidate(); setUrl(e.target.value); setFile(null); setChoices([]);}}/><button disabled={!loggedIn || busy || !url.trim()} type="submit">{busy ? '불러오는 중…' : '사진 불러오기'}</button></div><p>공개된 사진을 가져옵니다. 로그인이나 접근 제한이 있으면 직접 올려 주세요.</p></form>}
        {choices.length > 0 && <fieldset><legend>분석할 사진 한 장 선택</legend>{choices.map((address, i) => <button type="button" disabled={busy} key={address} onClick={() => void loadUrl(address)}>사진 {i + 1} 불러오기</button>)}</fieldset>}
        <details className="product-artist-picker"><summary>아티스트 직접 선택 · 모르면 건너뛰기</summary><p>얼굴로 이름을 추정하지 않습니다. 선택한 이름은 사용자가 알려 준 정보로 표시합니다.</p><label htmlFor="product-artist-query">아티스트 이름</label><div className="product-image-url-row"><input id="product-artist-query" value={artistQuery} maxLength={120} onChange={e => setArtistQuery(e.target.value)}/><button type="button" onClick={() => void findArtists()}>아티스트 찾기</button></div><label htmlFor="product-artist">선택 목록</label><select id="product-artist" value={artistId} onChange={e => {invalidate(); setArtistId(e.target.value);}}><option value="">모르겠어요 · 상품만 찾기</option>{artists.map(a => <option key={a.id} value={a.id}>{a.nameKo}</option>)}</select>{artistMessage && <p>{artistMessage}</p>}{artistId && <p>사용자가 직접 선택한 아티스트 정보입니다. 실제 착용 사실을 확인한 것은 아닙니다.</p>}</details>
        {preview && <div className="product-image-workspace"><div><div className="product-crop-image" onPointerDown={e => {if (busy) return; drag.current = pointer(e); e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e => {if (!drag.current) return; const end = pointer(e), start = drag.current; changeCrop({x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.max(1, Math.abs(end.x - start.x)), height: Math.max(1, Math.abs(end.y - start.y))});}} onPointerUp={() => {drag.current = null;}} onPointerCancel={() => {drag.current = null;}}>
            <img src={preview} alt="상품 부분을 선택할 사진" draggable={false} onLoad={e => {if (e.currentTarget.naturalWidth * e.currentTarget.naturalHeight > 25_000_000) {invalidate(); setFile(null); setError('사진을 2,500만 화소 이하로 줄여 주세요.');}}} onError={() => {invalidate(); setFile(null); setError('사진을 열지 못했어요. 다른 사진을 선택해 주세요.');}}/>
            <div className="product-crop-box" style={{left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`}}/>
        </div><p>물건 주위를 드래그하거나 오른쪽 조절 막대로 영역을 맞춰 주세요.</p></div><div><fieldset disabled={busy}><legend>어느 아이템을 찾을까요?</legend><div className="product-item-buttons">{Object.entries(categoryNames).map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => {invalidate(); setCategory(value);}}>{label}</button>)}</div>
            {(Object.keys(crop) as (keyof Crop)[]).map(key => <label key={key}>{({x: '왼쪽 위치', y: '위쪽 위치', width: '영역 너비', height: '영역 높이'})[key]} {Math.round(crop[key])}%<input type="range" min={key === 'x' || key === 'y' ? 0 : 1} max={key === 'x' ? 100 - crop.width : key === 'y' ? 100 - crop.height : key === 'width' ? 100 - crop.x : 100 - crop.y} value={crop[key]} onChange={e => changeCrop({...crop, [key]: Number(e.target.value)})}/></label>)}<button type="button" onClick={() => changeCrop(FULL_CROP)}>사진 전체 선택</button></fieldset>
            <label className="product-image-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/>이 사진을 사용할 권한이 있으며, 선택한 상품 부분의 업로드와 분석에 동의합니다.</label>
            <button type="button" className="product-image-submit" disabled={!consent || !loggedIn || busy || running} onClick={() => void submit()}>{busy ? '분석 요청 중…' : '선택한 아이템 후보 찾기'}</button>
        </div></div>}
        {message && <p role="status">{message}</p>}
        {error && <div role="alert"><p>{error}</p>{jobId && !terminal.has(job?.status || '') ? <button type="button" onClick={() => setPollRetry(n => n + 1)}>작업 상태 다시 확인</button> : file && consent && <button type="button" disabled={busy} onClick={() => void submit()}>다시 시도</button>}</div>}
        {job && <section className="product-image-results" aria-live="polite"><h2>{running ? '사진 속 상품을 확인하고 있어요' : job.status === 'SUCCEEDED' ? '사진 분석 결과' : '분석을 완료하지 못했어요'}</h2>
            {job.status === 'SUCCEEDED' && job.result?.availability === 'MODEL_NOT_CONFIGURED' ? <p>사진 비교 모델이 아직 연결되지 않았어요. 상품명·브랜드 검색을 이용해 주세요.</p>
                : job.status === 'SUCCEEDED' && !candidates.length ? <p>공개할 근거가 충분한 상품 후보가 없어요. 상품 영역을 다시 고르거나 상품명·브랜드로 찾아보세요.</p> : null}
            {['FAILED', 'CANCELLED', 'EXPIRED'].includes(job.status) && <><p>사진과 선택을 유지했어요. 잠시 후 새 분석을 요청할 수 있어요.</p><button type="button" disabled={busy} onClick={() => {submission.current = null; void submit();}}>새 분석 요청</button></>}
            <div className="kpop-product-list" role="list" aria-label="사진 분석 상품 후보">{candidates.map(c => <ProductCard key={c.id} candidate={c} readOnly personalSave/>)}</div>
            {!running && <button type="button" disabled={deleting || job.sourceDeleted} onClick={() => void removeSource()}>{job.sourceDeleted ? '업로드 사진 삭제됨' : '업로드한 상품 사진 삭제'}</button>}
        </section>}
    </div>;
}
