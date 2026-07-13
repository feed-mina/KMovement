'use client';

import { FormEvent, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';
import HolyMapPicker from '@/components/fields/kride/maps/HolyMapPicker';
import { loadKakaoMaps } from '@/components/fields/kride/maps/loadKakaoMaps';
import '../../styles/HOLY_SUBMIT.css';

const ARTIST_OPTIONS = [
  'BTS','BLACKPINK','SEVENTEEN','IVE','aespa','NewJeans','TWICE','Stray Kids','EXO','NCT','ATEEZ','LE SSERAFIM','아이유(IU)','태연(Taeyeon)','임영웅','지코(ZICO)','악뮤(AKMU)','DAY6','(여자)아이들','RIIZE','BOYNEXTDOOR','TOMORROW X TOGETHER','ENHYPEN','Red Velvet','ITZY','에스파(aespa)','G-DRAGON','박효신','이무진','볼빨간사춘기','백예린','성시경','장원영','차은우','유재석','침착맨','쯔양','곽튜브','빠니보틀','감스트','이영지','혜안','원지의하루','피식대학','숏박스','문복희','입짧은햇님','워크맨','딩고뮤직',
];

declare global { interface Window { daum?: any } }

export default function HolySubmitPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [provider, setProvider] = useState<'kakao' | 'google'>('kakao');
  const [lat, setLat] = useState('37.566500');
  const [lng, setLng] = useState('126.978000');
  const [baseAddress, setBaseAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [done, setDone] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  const openAddressSearch = () => {
    const launch = () => new window.daum!.Postcode({ oncomplete: async (data: any) => {
      const selected = data.roadAddress || data.jibunAddress || data.address;
      setBaseAddress(selected);
      try {
        const kakao = await loadKakaoMaps(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || '');
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(selected, (result: any[], status: string) => {
          if (status === kakao.maps.services.Status.OK && result[0]) { setLat(Number(result[0].y).toFixed(6)); setLng(Number(result[0].x).toFixed(6)); }
        });
      } catch { setError('주소는 선택됐지만 지도 좌표를 변환하지 못했습니다. Kakao 키 설정을 확인하세요.'); }
    }}).open();
    if (window.daum?.Postcode) return launch();
    const script = document.createElement('script'); script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'; script.onload = launch; document.head.appendChild(script);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    try { await api.post('/api/v1/tour/holy/submissions', { title: form.get('title'), addr: `${baseAddress} ${detailAddress}`.trim(), artist: form.get('artist'), mapX: Number(lng), mapY: Number(lat), recommendReason: form.get('recommendReason'), sourceUrl: form.get('sourceUrl') }); setDone(true); }
    catch { setError('제보를 저장하지 못했습니다. 입력값과 중복 출처를 확인해 주세요.'); } finally { setBusy(false); }
  };

  if (isLoading) return <main className="holy-submit-page"><p>불러오는 중…</p></main>;
  if (done) return <main className="holy-submit-page"><section className="holy-submit-card holy-submit-card--success"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>제보가 검수 대기열에 등록됐습니다.</h1><p>관리자 확인 후 성지 탐색 화면에 공개됩니다.</p></section></main>;
  return <main className="holy-submit-page"><form onSubmit={submit} className="holy-submit-card">
    <header className="holy-submit-card__header"><span className="holy-kicker">KRIDE HOLY PLACE</span><h1>팬 성지 제보</h1><p>공개된 사실 정보와 출처만 등록해 주세요. 사진·기사 본문·팬 창작물은 받지 않습니다.</p></header>
    {!isLoggedIn && <p className="holy-notice">제출하려면 로그인이 필요합니다. 입력과 지도 미리보기는 가능합니다.</p>}{error && <p className="holy-error">{error}</p>}
    <div className="holy-submit-layout"><section className="holy-submit-fields">
      <div className="holy-field-grid"><Field label="장소명" name="title" required /><label className="holy-field"><span>아티스트/채널 (국내 상위 후보)</span><select name="artist" required defaultValue=""><option value="" disabled>아티스트를 선택하세요</option>{ARTIST_OPTIONS.map((artist) => <option key={artist} value={artist}>{artist}</option>)}</select></label></div>
      <div className="holy-address-card"><div className="holy-section-heading"><div><span className="holy-kicker">ADDRESS SEARCH</span><h2>주소로 위치 선택</h2></div><button type="button" className="holy-address-button" onClick={openAddressSearch}>주소 검색</button></div><div className="holy-address-row"><input value={baseAddress} readOnly placeholder="주소 검색 버튼을 눌러주세요" aria-label="검색된 기본 주소" /><input value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} placeholder="상세주소 입력" aria-label="상세주소" /></div><p className="holy-map-picker__hint">카카오 주소 검색 결과가 지도에 확대되어 마커로 표시됩니다.</p></div>
      <div className="holy-coordinate-card"><div className="holy-section-heading"><div><span className="holy-kicker">LOCATION PICKER</span><h2>선택된 주소 위치</h2></div><div className="holy-provider-toggle" role="tablist" aria-label="지도 제공자"><button type="button" className={provider === 'kakao' ? 'active' : ''} onClick={() => setProvider('kakao')}>카카오맵</button><button type="button" className={provider === 'google' ? 'active' : ''} onClick={() => setProvider('google')}>Google Maps</button></div></div><HolyMapPicker provider={provider} lat={lat} lng={lng} onChange={(nextLat, nextLng) => { setLat(nextLat); setLng(nextLng); }} /><p className="holy-selected-address">선택 주소: {baseAddress ? `${baseAddress} ${detailAddress}` : '주소를 검색하면 이곳에 표시됩니다.'}</p><input type="hidden" name="mapY" value={lat} /><input type="hidden" name="mapX" value={lng} /></div>
      <label className="holy-field holy-field--full"><span>추천 이유·확인 가능한 사실</span><textarea name="recommendReason" required maxLength={500} placeholder="공개 출처로 확인할 수 있는 사실을 적어주세요." /></label>
      <div className="holy-field-grid"><Field label="출처 URL" name="sourceUrl" type="url" required /></div>
    </section><aside className="holy-submit-aside"><div><span className="holy-kicker">SUBMIT CHECKLIST</span><h2>검수 가능한 정보만</h2><ul><li>주소 검색 후 상세주소를 입력하세요.</li><li>선택 주소와 지도 마커를 확인하세요.</li><li>출처 URL은 필수입니다.</li><li>승인 전에는 공개되지 않습니다.</li></ul></div><button disabled={!isLoggedIn || busy} className="holy-submit-button">{busy ? '등록 중…' : '검수 요청하기'}</button></aside></div>
  </form></main>;
}

function Field({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <label className="holy-field"><span>{label}</span><input name={name} type={type} required={required} /></label>; }
