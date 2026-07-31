'use client';

import { useMemo, useState } from 'react';
import { safeHttpUrl } from '@/lib/media/safeImageUrl';
import { placeholderThumbnail } from '@/lib/media/placeholderThumbnail';
import styles from './marketing.module.css';

// 맛집 카드 썸네일.
// 탐색 화면의 PoiImage와 같은 URL 규칙을 쓰되, 이 페이지에는 상세 모달이 없으므로
// 권리 표기가 필요한 이미지는 카드 안에서 바로 출처를 밝힌다.
export default function SpotThumbnail({
    src,
    title,
    sourceUrl,
    credit,
}: {
    src?: string;
    title: string;
    sourceUrl?: string;
    credit?: string;
}) {
    const imageUrl = useMemo(() => safeHttpUrl(src, true), [src]);
    const attributionUrl = useMemo(() => safeHttpUrl(sourceUrl), [sourceUrl]);
    // 실패한 URL 자체를 기억한다. src가 바뀌면 자동으로 다시 시도되므로 초기화 effect가 필요 없다.
    const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

    const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
    // 사진이 없는 장소도 카드가 서로 구분되도록 이름 기반 썸네일을 만든다.
    const placeholder = useMemo(() => placeholderThumbnail(title), [title]);

    return (
        <figure className={styles.thumb}>
            <span
                className={styles.thumbFrame}
                style={showImage ? undefined : { background: placeholder.background }}
            >
                {showImage ? (
                    // 외부 호스트(TourAPI 등) 이미지라 next/image 대신 img를 쓴다 — PoiImage와 같은 방식.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageUrl}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailedUrl(imageUrl)}
                        className={styles.thumbImage}
                    />
                ) : (
                    <span
                        className={styles.thumbEmpty}
                        role="img"
                        aria-label={`${title} 이미지 없음`}
                        style={{ color: placeholder.ink }}
                    >
                        <span aria-hidden="true">{placeholder.initial}</span>
                    </span>
                )}
            </span>
            {showImage && credit && attributionUrl && (
                <figcaption className={styles.thumbCredit}>
                    이미지: <a href={attributionUrl} target="_blank" rel="noopener noreferrer">{credit}</a>
                </figcaption>
            )}
        </figure>
    );
}
