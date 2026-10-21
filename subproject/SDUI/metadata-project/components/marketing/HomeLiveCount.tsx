'use client';

import { useEffect, useState } from 'react';

interface Props {
    /** `data.totalCount` 를 돌려주는 공개 API */
    url: string;
    /** 숫자 뒤에 붙는 단위 (팀 · 건) */
    unit: string;
    /** 숫자 앞 문구 (예: "다가오는 ") */
    prefix?: string;
    /** 불러오기 전·실패 시 보여줄 정적 문구. 숫자는 보조 정보라 0 을 꾸며 넣지 않는다. */
    fallback: string;
}

/** 랜딩 홈 타일의 실제 수량 (벤치마킹 H3: 탭·타일에 실제 수, 값이 없으면 숫자 자리 비움). */
export default function HomeLiveCount({ url, unit, prefix = '', fallback }: Props) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        const abort = new AbortController();
        let active = true;
        (async () => {
            try {
                const response = await fetch(url, { signal: abort.signal, credentials: 'omit', cache: 'no-store' });
                if (!response.ok) return;
                const body = await response.json();
                const total = body?.data?.totalCount;
                if (active && Number.isInteger(total) && total >= 0) setCount(total);
            } catch {
                // 숫자는 보조 정보: 실패하면 정적 문구를 유지한다.
            }
        })();
        return () => { active = false; abort.abort(); };
    }, [url]);

    return <>{count === null ? fallback : `${prefix}${count.toLocaleString('ko-KR')}${unit}`}</>;
}
