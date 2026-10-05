'use client';

import { FormEvent, useRef, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';
import HolyMapPicker from '@/components/fields/kride/maps/HolyMapPicker';
import { loadKakaoMaps } from '@/components/fields/kride/maps/loadKakaoMaps';
import '../../styles/HOLY_SUBMIT.css';

const ARTIST_OPTIONS = [
  'BTS','BLACKPINK','SEVENTEEN','IVE','aespa','NewJeans','TWICE','Stray Kids','EXO','NCT','ATEEZ','LE SSERAFIM','아이유(IU)','태연(Taeyeon)','임영웅','지코(ZICO)','악뮤(AKMU)','DAY6','(여자)아이들','RIIZE','BOYNEXTDOOR','TOMORROW X TOGETHER','ENHYPEN','Red Velvet','ITZY','에스파(aespa)','G-DRAGON','박효신','이무진','볼빨간사춘기','백예린','성시경','장원영','차은우','유재석','침착맨','쯔양','곽튜브','빠니보틀','감스트','이영지','혜안','원지의하루','피식대학','숏박스','문복희','입짧은햇님','워크맨','딩고뮤직',
];

export default function HolySubmitPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [provider, setProvider] = useState<'kakao' | 'google'>('kakao');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const addressVersion = useRef(0);
  const [done, setDone] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  const openAddressSearch = () => {
    const launch = () => new window.daum!.Postcode({ oncomplete: async (data: any) => {
      const selected = data.roadAddress || data.jibunAddress || data.address;
      const version = ++addressVersion.current;
      setBaseAddress(selected);
      setLat(''); setLng('');
      try {
        const kakao = await loadKakaoMaps(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || '');
        if (version !== addressVersion.current) return;
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(selected, (result: any[], status: string) => {
          if (version !== addressVersion.current) return;
          if (status === kakao.maps.services.Status.OK && result[0]) { setLat(Number(result[0].y).toFixed(6)); setLng(Number(result[0].x).toFixed(6)); }
          else setError('선택한 주소의 좌표를 확인하지 못했습니다. 지도를 선택하거나 좌표를 직접 입력해 주세요.');
        });
      } catch { setError('주소는 선택됐지만 좌표를 확인하지 못했습니다. 지도를 선택하거나 좌표를 직접 입력해 주세요.'); }
    }}).open();
    if (window.daum?.Postcode) return launch();
    const script = document.createElement('script'); script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'; script.onload = launch; script.onerror = () => setError('주소 검색을 열지 못했습니다. 주소와 좌표를 직접 입력해 주세요.'); document.head.appendChild(script);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !isLoggedIn) return;
    if (!baseAddress.trim() || !lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) { setError('주소와 좌표를 확인해 주세요.'); return; }
    setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    try { await api.post('/api/v1/tour/holy/submissions', { title: form.get('title'), addr: `${baseAddress} ${detailAddress}`.trim(), artist: form.get('artist'), mapX: Number(lng), mapY: Number(lat), recommendReason: form.get('recommendReason'), sourceUrl: form.get('sourceUrl') }); setDone(true); }
    catch (cause) { const status = (cause as {response?:{status:number}}).response?.status; setError(status === 409 ? '같은 출처 URL의 대기 또는 승인된 제보가 있습니다. 기존 제보를 다시 제출할 수 없습니다.' : status === 401 || status === 403 ? '로그인이 만료되었습니다. 다시 로그인한 뒤 제출해 주세요.' : '제보를 저장하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.'); } finally { setBusy(false); }
  };

  if (isLoading) return <main className="holy-submit-page"><p>불러오는 중…</p></main>;
  if (done) return <main className="holy-submit-page"><section className="holy-submit-card holy-submit-card--success"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>제보가 검수 대기열에 등록됐습니다.</h1><p>운영일 기준 3영업일 안에 검토하며, 승인되면 성지 탐색 화면에 공개됩니다.</p></section></main>;
  return <main className="holy-submit-page"><form onSubmit={submit} className="holy-submit-card">
    <header className="holy-submit-card__header"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>팬 성지 제보</h1><p>공개된 사실 정보와 출처만 등록해 주세요. 사진·기사 본문·팬 창작물은 받지 않으며, 운영자가 출처를 확인한 뒤 공개합니다.</p></header>
    {!isLoggedIn && <p className="holy-notice">제출하려면 <a href="/view/LOGIN_PAGE">로그인</a>이 필요합니다. 입력과 지도 미리보기는 가능합니다.</p>}{error && <p className="holy-error" role="alert">{error}</p>}
    <div className="holy-submit-layout"><section className="holy-submit-fields">
      <div className="holy-field-grid"><Field label="장소명" name="title" required /><label className="holy-field"><span>아티스트/채널 (국내 상위 후보)</span><select name="artist" required defaultValue=""><option value="" disabled>아티스트를 선택하세요</option>{ARTIST_OPTIONS.map((artist) => <option key={artist} value={artist}>{artist}</option>)}</select></label></div>
      <div className="holy-address-card"><div className="holy-section-heading"><div><span className="holy-kicker">ADDRESS SEARCH</span><h2>주소로 위치 선택</h2></div><button type="button" className="holy-address-button" onClick={openAddressSearch}>주소 검색</button></div><div className="holy-address-row"><input value={baseAddress} required maxLength={500} onChange={e => { addressVersion.current++; setBaseAddress(e.target.value); setLat(''); setLng(''); }} placeholder="주소 검색 버튼을 눌러주세요" aria-label="검색된 기본 주소" /><input value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} placeholder="상세주소 입력" aria-label="상세주소" /></div><p className="holy-map-picker__hint">카카오 주소 검색 결과가 지도에 확대되어 마커로 표시됩니다.</p></div>
      <div className="holy-coordinate-card"><div className="holy-section-heading"><div><span className="holy-kicker">LOCATION PICKER</span><h2>선택된 주소 위치</h2></div><div className="holy-provider-toggle" role="tablist" aria-label="지도 제공자"><button type="button" className={provider === 'kakao' ? 'active' : ''} onClick={() => setProvider('kakao')}>카카오맵</button><button type="button" className={provider === 'google' ? 'active' : ''} onClick={() => setProvider('google')}>Google Maps</button></div></div><HolyMapPicker provider={provider} lat={lat} lng={lng} onChange={(nextLat, nextLng) => { addressVersion.current++; setLat(nextLat); setLng(nextLng); }} /><p className="holy-selected-address">선택 주소: {baseAddress ? `${baseAddress} ${detailAddress}` : '주소를 검색하면 이곳에 표시됩니다.'}</p><div className="holy-field-grid"><label className="holy-field"><span>위도 (33~39)</span><input aria-label="위도" type="number" step="any" min="33" max="39" required value={lat} onChange={e => { addressVersion.current++; setLat(e.target.value); }} /></label><label className="holy-field"><span>경도 (124~132)</span><input aria-label="경도" type="number" step="any" min="124" max="132" required value={lng} onChange={e => { addressVersion.current++; setLng(e.target.value); }} /></label></div><p>지도 사용이 어려우면 확인한 주소와 좌표를 직접 입력할 수 있습니다.</p></div>
      <label className="holy-field holy-field--full"><span>추천 이유·확인 가능한 사실</span><textarea name="recommendReason" required maxLength={500} placeholder="공개 출처로 확인할 수 있는 사실을 적어주세요." /></label>
      <div className="holy-field-grid"><Field label="출처 URL" name="sourceUrl" type="url" required /></div>
    </section><aside className="holy-submit-aside"><div><span className="holy-kicker">SUBMIT CHECKLIST</span><h2>검수 가능한 정보만</h2><ul><li>주소 검색 후 상세주소를 입력하세요.</li><li>선택 주소와 지도 마커를 확인하세요.</li><li>출처 URL은 필수입니다.</li><li>승인 전에는 공개되지 않습니다.</li><li>검토 목표는 접수 후 3영업일입니다.</li><li>제출자 정보는 감사용으로만 보관되며 공개되지 않습니다.</li></ul></div><button disabled={!isLoggedIn || busy} className="holy-submit-button">{busy ? '등록 중…' : '검수 요청하기'}</button></aside></div>
  </form></main>;
}

function Field({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <label className="holy-field"><span>{label}</span><input name={name} type={type} required={required} /></label>; }
