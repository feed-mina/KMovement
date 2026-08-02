'use client';

import {useMemo, useState} from 'react';
import {safeHttpUrl} from '@/lib/media/safeImageUrl';
import {placeholderThumbnail} from '@/lib/media/placeholderThumbnail';

interface PoiImageProps {
    src?: string;
    /**
     * 원본(src)의 썸네일. 카드는 150×100 으로 그리는데 TourAPI 원본은 수백 KB~수 MB 라
     * 첫 화면에서만 몇 MB 를 받게 된다. 카드에서는 이쪽을 먼저 쓰고, 없으면 원본으로 떨어진다.
     * 상세 모달은 크게 보여주므로 언제나 원본이다.
     */
    thumbnail?: string;
    title: string;
    variant: 'card' | 'modal';
    /** 첫 화면에 보이는 카드에만 켠다. lazy 를 끄고 우선순위를 올린다. */
    priority?: boolean;
    sourceUrl?: string;
    credit?: string;
}

export default function PoiImage({src, thumbnail, title, variant, priority = false, sourceUrl, credit}: PoiImageProps) {
    const preferred = variant === 'card' ? (thumbnail ?? src) : src;
    const imageUrl = useMemo(() => safeHttpUrl(preferred, true), [preferred]);
    const attributionUrl = useMemo(() => safeHttpUrl(sourceUrl), [sourceUrl]);
    // 실패한 URL 자체를 기억한다. src가 바뀌면 자동으로 다시 시도되므로 초기화 effect가 필요 없다.
    const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

    const height = variant === 'card' ? 100 : 140;
    // 카드 그리드는 minmax(150px, 1fr) 이다. width/height 를 주지 않으면 사진이 도착할
    // 때마다 자리가 잡히며 리플로우가 난다.
    const width = variant === 'card' ? 150 : 400;
    const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
    // 성지 대부분이 사진 없이 들어온다. 회색 상자 대신 장소별로 다른 썸네일을 만든다.
    const placeholder = useMemo(() => placeholderThumbnail(title), [title]);

    return (
        <figure style={{display: 'block', width: '100%', margin: 0}}>
            <span
                style={{
                    display: 'flex',
                    width: '100%',
                    height,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: showImage ? '#f5f5f5' : placeholder.background,
                }}
            >
                {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageUrl}
                        alt={title}
                        width={width}
                        height={height}
                        loading={variant === 'card' && !priority ? 'lazy' : 'eager'}
                        decoding="async"
                        fetchPriority={priority || variant === 'modal' ? 'high' : 'auto'}
                        onError={() => setFailedUrl(imageUrl)}
                        style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}
                    />
                ) : (
                    <span
                        role="img"
                        aria-label={`${title} 이미지 없음`}
                        style={{
                            display: 'flex',
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: placeholder.ink,
                            fontSize: variant === 'card' ? 34 : 46,
                            fontWeight: 700,
                            letterSpacing: '-.03em',
                            opacity: .75,
                        }}
                    >
                        <span aria-hidden="true">{placeholder.initial}</span>
                    </span>
                )}
            </span>
            {variant === 'modal' && credit && attributionUrl && (
                <figcaption style={{padding: '5px 10px', background: '#fafafa', color: '#777', fontSize: 10, lineHeight: 1.4}}>
                    이미지: <a href={attributionUrl} target="_blank" rel="noopener noreferrer" style={{color: '#555'}}>{credit}</a>
                </figcaption>
            )}
        </figure>
    );
}
