'use client';

import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useKrideReducedMotion} from '@/components/motion/KrideMotion';

type Props = {
    src: string;
    className?: string;
    /** 'loop'은 화면에 보일 때 계속 재생, 'hover'는 마우스를 올리거나 포커스할 때만 재생 */
    mode?: 'loop' | 'hover';
    label?: string;
};

const noSubscribe = () => () => undefined;

function saveDataOn(): boolean {
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
    return Boolean(connection?.saveData);
}

/**
 * 미리 만든 AI 영상(소리 없음, 5초)을 배경·미리보기로 보여준다.
 * 움직임 줄이기·데이터 절약 모드면 아무것도 그리지 않고(기존 파스텔 배경 유지), 화면 밖이거나 탭이 숨으면 멈춘다.
 */
export default function AmbientVideo({src, className = '', mode = 'loop', label}: Props) {
    const reduced = useKrideReducedMotion();
    const video = useRef<HTMLVideoElement>(null);
    const saveData = useSyncExternalStore(noSubscribe, saveDataOn, () => false);
    const allowed = reduced === false && !saveData;
    const [inView, setInView] = useState(false);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        const element = video.current;
        if (!element || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {threshold: 0.2});
        observer.observe(element);
        return () => observer.disconnect();
    }, [allowed]);

    useEffect(() => {
        const element = video.current;
        if (!element) return;
        const shouldPlay = allowed && inView && (mode === 'loop' || hovered);
        const sync = () => {
            if (shouldPlay && !document.hidden) void element.play().catch(() => undefined);
            else element.pause();
        };
        sync();
        document.addEventListener('visibilitychange', sync);
        return () => document.removeEventListener('visibilitychange', sync);
    }, [allowed, inView, hovered, mode]);

    const hoverProps = mode === 'hover' ? {
        onPointerEnter: () => setHovered(true), onPointerLeave: () => setHovered(false),
        onFocus: () => setHovered(true), onBlur: () => setHovered(false),
    } : {};

    if (!allowed) return null;
    return (
        <div className={`kride-ambient ${className}`} data-mode={mode} {...hoverProps}
             aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
            <video ref={video} className="kride-ambient__video" src={src}
                   muted loop playsInline preload="none" disablePictureInPicture />
        </div>
    );
}
