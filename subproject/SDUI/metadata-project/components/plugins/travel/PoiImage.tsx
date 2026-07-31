'use client';

import {useEffect, useMemo, useState} from 'react';
import {safeHttpUrl} from '@/lib/media/safeImageUrl';

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
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [imageUrl]);

    const height = variant === 'card' ? 100 : 140;
    const showImage = Boolean(imageUrl) && !failed;

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
                    background: '#f5f5f5',
                }}
            >
                {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageUrl}
                        alt={title}
                        loading={variant === 'card' ? 'lazy' : 'eager'}
                        onError={() => setFailed(true)}
                        style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}
                    />
                ) : (
                    <span
                        role="img"
                        aria-label={`${title} 이미지 없음`}
                        style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#aaa', fontSize: 11}}
                    >
                        <span aria-hidden="true" style={{fontSize: 20}}>♪</span>
                        이미지 없음
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
