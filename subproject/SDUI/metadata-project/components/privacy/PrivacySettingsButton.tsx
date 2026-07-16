'use client';

import { useAnalyticsConsent } from '@/components/analytics/AnalyticsProvider';

export default function PrivacySettingsButton() {
    const { consent, setSettingsOpen } = useAnalyticsConsent();
    if (consent === 'unset') return null;
    return (
        <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9998, border: '1px solid #ddd', borderRadius: 999, background: '#fff', color: '#555', padding: '7px 10px', fontSize: 11, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}
        >
            개인정보 설정
        </button>
    );
}
