'use client';

import { useEffect, useRef, useState } from 'react';

type VideoJob = { jobId: string; photoId: string; status: string; errorCode?: string; videoUrl?: string; methodLabel: string; renderMilliseconds?: number; cost?: { note: string } };
const labels: Record<string, string> = { QUEUED: '생성 대기 중', RUNNING: '영상 생성 중', COMPLETED: '영상 생성 완료', FAILED: '영상 생성 실패' };
const failures: Record<string, string> = { RENDER_TIMEOUT: '영상 생성 시간이 초과됐습니다.', RENDER_FAILED: '사진 처리 또는 영상 생성에 실패했습니다.', WORKER_INTERRUPTED: '처리 서버가 중단됐습니다.' };

export default function TravelVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [photoId, setPhotoId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<VideoJob | null>(null);
  const requestId = useRef('');
  const submitting = useRef(false);
  const [pollKey, setPollKey] = useState(0);
  const [history, setHistory] = useState<VideoJob[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/travel-video/jobs?page=${historyPage}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '이전 작업을 불러오지 못했습니다.');
      setHistory(data.items);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '이전 작업을 불러오지 못했습니다.'); });
    return () => controller.abort();
  }, [job?.status, historyPage]);
  useEffect(() => {
    if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const deadline = Date.now() + 10 * 60_000;
    async function poll() {
      if (stopped) return;
      try {
        const response = await fetch(`/api/travel-video/jobs/${job!.jobId}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || '작업 상태를 확인하지 못했습니다.');
        if (stopped) return;
        setJob(data);
        if (!['QUEUED', 'RUNNING'].includes(data.status)) return;
      } catch (e) {
        if (stopped) return;
        setError(e instanceof Error ? e.message : '상태 조회에 실패했습니다.');
        return;
      }
      if (Date.now() >= deadline) { setError('상태 확인을 잠시 멈췄습니다. 상태 다시 확인을 눌러주세요.'); return; }
      timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [job?.jobId, job?.status, pollKey]);
  async function generate() {
    if (!photoId || submitting.current || (job && ['QUEUED', 'RUNNING'].includes(job.status))) return;
    submitting.current = true; setBusy(true); setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/travel-video/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId, requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '생성을 요청하지 못했습니다.');
      setJob(data);
    } catch (e) { setError(e instanceof Error ? e.message : '생성을 요청하지 못했습니다.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function retry() {
    if (!job || job.status !== 'FAILED' || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch(`/api/travel-video/jobs/${job.jobId}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '재시도를 요청하지 못했습니다.');
      setJob(data);
    } catch (e) { setError(e instanceof Error ? e.message : '재시도를 요청하지 못했습니다.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  useEffect(() => { requestId.current = ''; }, [job?.jobId]);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function upload() {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/travel-video/photos', { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '사진을 올리지 못했습니다.');
      setPhotoId(data.photoId);
    } catch (e) { setError(e instanceof Error ? e.message : '사진을 올리지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
    <h1>여행 사진으로 영상 만들기</h1>
    <p>사진 한 장으로 시작합니다. 로그인한 본인만 사진을 조회할 수 있습니다.</p>
    <label>여행 사진 선택 (JPEG·PNG·WebP, 최대 10MB)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !!job && ['QUEUED', 'RUNNING'].includes(job.status)} onChange={e => {
        const next = e.target.files?.[0]; setPhotoId(''); setError(''); setFile(null); setJob(null); requestId.current = '';
        if (!next) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 10 * 1024 * 1024 || !next.size) {
          setError('10MB 이하의 JPEG·PNG·WebP 사진을 선택해주세요.'); return;
        }
        setFile(next);
      }} />
    </label>
    {preview && <img src={preview} alt="선택한 여행 사진" style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }} />}
    <p><button type="button" disabled={!file || busy || !!photoId} onClick={upload}>{busy ? '사진을 올리는 중' : '사진 올리기'}</button></p>
    {photoId && <p role="status">사진을 저장했습니다.</p>}
    {photoId && <><p>기본 방식: 사진을 천천히 확대·이동하는 짧은 영상입니다. 생성형 AI 영상과 구분됩니다.</p>
      <button type="button" disabled={busy || !!job} onClick={generate}>영상 만들기</button></>}
    {job && <section aria-label="영상 작업 상태"><p role="status">{labels[job.status] || job.status}</p><p>{job.methodLabel}</p>
      {job.errorCode && <p role="alert">{failures[job.errorCode] || '작업에 실패했습니다.'}</p>}
      {job.status === 'FAILED' && <button type="button" disabled={busy} onClick={retry}>실패한 영상 다시 만들기</button>}
      {job.renderMilliseconds != null && <p>영상 처리 시간: {(job.renderMilliseconds / 1000).toFixed(1)}초</p>}
      {job.cost && <p>{job.cost.note}</p>}
      {job.status === 'COMPLETED' && job.videoUrl && <><video controls playsInline preload="metadata" src={job.videoUrl} style={{ width: '100%' }} onError={() => setError('영상을 재생하지 못했습니다. 다시 불러오거나 다운로드해주세요.')} />
        <p><a href={job.videoUrl} download="travel.mp4">영상 다운로드</a></p></>}
      {['QUEUED', 'RUNNING'].includes(job.status) && <button type="button" onClick={() => { setError(''); setPollKey(v => v + 1); }}>상태 다시 확인</button>}
    </section>}
    <section aria-label="이전 영상 작업"><h2>이전 작업</h2>{!history.length && <p>아직 작업 기록이 없습니다.</p>}
      <ul>{history.map(item => <li key={item.jobId}><button type="button" disabled={busy} onClick={() => {
        setJob(item); setPhotoId(item.photoId); setPollKey(v => v + 1); setError('');
      }}>{labels[item.status] || item.status} · {item.jobId.slice(0, 8)}</button></li>)}</ul>
      <button type="button" disabled={historyPage === 1} onClick={() => setHistoryPage(v => v - 1)}>이전 기록</button>
      <button type="button" disabled={history.length < 20} onClick={() => setHistoryPage(v => v + 1)}>다음 기록</button>
    </section>
    {error && <p role="alert">{error}</p>}
  </main>;
}
