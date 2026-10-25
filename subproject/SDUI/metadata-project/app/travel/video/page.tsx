'use client';

import { useEffect, useRef, useState } from 'react';

type VideoJob = { jobId: string; photoId: string; status: string; errorCode?: string; videoUrl?: string; methodLabel: string };
const labels: Record<string, string> = { QUEUED: '생성 대기 중', RUNNING: '영상 생성 중', COMPLETED: '영상 생성 완료', FAILED: '영상 생성 실패' };

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
      <button type="button" onClick={() => { setError(''); setPollKey(v => v + 1); }}>상태 다시 확인</button>
    </section>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
