'use client';

import {useMemo, useState} from 'react';
import {safeHttpUrl} from '@/lib/media/safeImageUrl';
import {placeholderThumbnail} from '@/lib/media/placeholderThumbnail';

interface PoiImageProps {
    src?: string;
    title: string;
    variant: 'card' | 'modal';
    sourceUrl?: string;
    credit?: string;
}

export default function PoiImage({src, title, variant, sourceUrl, credit}: PoiImageProps) {
    const imageUrl = useMemo(() => safeHttpUrl(src, true), [src]);
    const attributionUrl = useMemo(() => safeHttpUrl(sourceUrl), [sourceUrl]);
    // 실패한 URL 자체를 기억한다. src가 바뀌면 자동으로 다시 시도되므로 초기화 effect가 필요 없다.
    const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

    const height = variant === 'card' ? 100 : 140;
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
                        loading={variant === 'card' ? 'lazy' : 'eager'}
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
