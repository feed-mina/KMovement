'use client';

import { useEffect, useState } from 'react';

export default function TravelVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [photoId, setPhotoId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const next = e.target.files?.[0]; setPhotoId(''); setError(''); setFile(null);
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
    {error && <p role="alert">{error}</p>}
  </main>;
}
