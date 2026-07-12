'use client';

import { FormEvent, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';
import HolyMapPicker from '@/components/fields/kride/maps/HolyMapPicker';
import '../../styles/HOLY_SUBMIT.css';

export default function HolySubmitPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [provider, setProvider] = useState<'kakao' | 'google'>('kakao');
  const [lat, setLat] = useState('37.566500');
  const [lng, setLng] = useState('126.978000');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/api/v1/tour/holy/submissions', {
        title: form.get('title'), addr: form.get('addr'), artist: form.get('artist'),
        mapX: Number(lng), mapY: Number(lat), recommendReason: form.get('recommendReason'),
        sourceUrl: form.get('sourceUrl'),
      });
      setDone(true);
    } catch { setError('제보를 저장하지 못했습니다. 입력값과 중복 출처를 확인해 주세요.'); }
    finally { setBusy(false); }
  };

  if (isLoading) return <main className="holy-submit-page"><p>불러오는 중…</p></main>;
  if (done) return <main className="holy-submit-page"><section className="holy-submit-card holy-submit-card--success"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>제보가 검수 대기열에 등록됐습니다.</h1><p>관리자 확인 후 성지 탐색 화면에 공개됩니다.</p></section></main>;

  return <main className="holy-submit-page">
    <form onSubmit={submit} className="holy-submit-card">
      <header className="holy-submit-card__header"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>팬 성지 제보</h1><p>공개된 사실 정보와 출처만 등록해 주세요. 사진·기사 본문·팬 창작물은 받지 않습니다.</p></header>
      {!isLoggedIn && <p className="holy-notice">제출하려면 로그인이 필요합니다. 입력과 지도 미리보기는 가능합니다.</p>}
      {error && <p className="holy-error">{error}</p>}
      <div className="holy-submit-layout">
        <section className="holy-submit-fields">
          <div className="holy-field-grid">
            <Field label="장소명" name="title" required />
            <Field label="아티스트" name="artist" required />
            <Field label="주소" name="addr" />
            <Field label="출처 URL" name="sourceUrl" type="url" required />
          </div>
          <div className="holy-coordinate-card">
            <div className="holy-section-heading"><div><span className="holy-kicker">LOCATION PICKER</span><h2>지도에서 위치 선택</h2></div><div className="holy-provider-toggle" role="tablist" aria-label="지도 제공자"><button type="button" className={provider === 'kakao' ? 'active' : ''} onClick={() => setProvider('kakao')}>카카오맵</button><button type="button" className={provider === 'google' ? 'active' : ''} onClick={() => setProvider('google')}>Google Maps</button></div></div>
            <HolyMapPicker provider={provider} lat={lat} lng={lng} onChange={(nextLat, nextLng) => { setLat(nextLat); setLng(nextLng); }} />
            <div className="holy-field-grid holy-field-grid--coords"><Field label="위도" name="mapY" type="number" step="any" value={lat} onChange={setLat} required /><Field label="경도" name="mapX" type="number" step="any" value={lng} onChange={setLng} required /></div>
          </div>
          <label className="holy-field holy-field--full"><span>추천 이유·확인 가능한 사실</span><textarea name="recommendReason" required maxLength={500} placeholder="공개 출처로 확인할 수 있는 사실을 적어주세요." /></label>
        </section>
        <aside className="holy-submit-aside"><div><span className="holy-kicker">SUBMIT CHECKLIST</span><h2>검수 가능한 정보만</h2><ul><li>출처 URL은 필수입니다.</li><li>좌표는 지도 클릭으로 정확히 선택하세요.</li><li>승인 전에는 공개되지 않습니다.</li></ul></div><button disabled={!isLoggedIn || busy} className="holy-submit-button">{busy ? '등록 중…' : '검수 요청하기'}</button></aside>
      </div>
    </form>
  </main>;
}

function Field({ label, name, type = 'text', required = false, step, value, onChange }: { label: string; name: string; type?: string; required?: boolean; step?: string; value?: string; onChange?: (value: string) => void }) {
  return <label className="holy-field"><span>{label}</span><input name={name} type={type} required={required} step={step} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} /></label>;
}
