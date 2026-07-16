'use client';

import { useAnalyticsConsent } from '@/components/analytics/AnalyticsProvider';

export default function ConsentBanner() {
    const { consent, setConsent, settingsOpen, setSettingsOpen } = useAnalyticsConsent();
    if (consent !== 'unset' && !settingsOpen) return null;

    return (
        <section
            role="region"
            aria-label="통계 쿠키 설정"
            style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 10000, maxWidth: 720, margin: '0 auto', padding: 18, borderRadius: 16, background: '#fff', color: '#222', border: '1px solid #ddd', boxShadow: '0 12px 36px rgba(0,0,0,.2)' }}
        >
            <strong style={{ display: 'block', marginBottom: 7 }}>서비스 개선을 위한 통계 수집</strong>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#555' }}>
                동의하면 Google Analytics와 Microsoft Clarity로 익명 이용 흐름을 확인합니다. 로그인 정보, 이메일, 전화번호, 주소, 채팅 내용은 보내지 않습니다. 필수 기능은 동의하지 않아도 사용할 수 있습니다.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                {settingsOpen && <button type="button" onClick={() => setSettingsOpen(false)} style={secondaryButton}>닫기</button>}
                <button type="button" onClick={() => setConsent('denied')} style={secondaryButton}>거부</button>
                <button type="button" onClick={() => setConsent('granted')} style={primaryButton}>통계 수집 동의</button>
            </div>
        </section>
    );
}

const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: '#E50914', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const secondaryButton: React.CSSProperties = { border: '1px solid #ccc', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#333', cursor: 'pointer' };
