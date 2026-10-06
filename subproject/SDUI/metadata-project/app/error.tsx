'use client';

import { useEffect } from 'react';
import KrideStatePanel from '@/components/fields/kride/atoms/KrideStatePanel';

/**
 * 루트 오류 경계 (벤치마킹 G1).
 * 화면이 예외로 깨졌을 때 빈 화면 대신 원인 한 줄 + 다시 시도 + 홈 링크를 보여준다.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('[RootError]', error);
    }, [error]);

    return (
        <main style={{ padding: '32px 16px' }}>
            <KrideStatePanel
                kind="error"
                title="화면을 그리지 못했어요"
                description="일시적인 문제일 수 있어요. 다시 시도해도 반복되면 홈에서 다시 들어와 주세요."
                primaryAction={{ label: '다시 시도', onClick: reset }}
                secondaryLinks={[{ label: '홈으로', href: '/view/MAIN_PAGE' }]}
            />
        </main>
    );
}
