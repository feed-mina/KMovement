'use client';

import {useEffect, useLayoutEffect, useRef} from 'react';
import {getGsap, loadGsap, prefersReducedMotion} from '@/lib/motion/gsapLoader';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * 순서 연출(GSAP) — 코스 일정 세로선.
 * 새 코스가 나오면 시간대를 잇는 세로선이 위에서 아래로 그려지고, 선이 닿는 순간 각 장소 번호가 켜진다.
 * `signature` 가 바뀔 때(코스를 새로 받았을 때)만 다시 실행한다. 움직임 줄이기면 아무것도 하지 않는다.
 */
export function useRouteTimeline(signature: string) {
    const root = useRef<HTMLDivElement>(null);

    // 화면이 열릴 때 미리 불러 둔다: 코스 결과가 도착하는 순간에는 이미 준비되어 깜빡이지 않는다.
    useEffect(() => { if (!prefersReducedMotion()) void loadGsap(); }, []);

    useIsoLayoutEffect(() => {
        const gsap = getGsap();
        if (!gsap || !root.current || !signature || prefersReducedMotion()) return;
        const ctx = gsap.context(() => {
            root.current!.querySelectorAll<HTMLElement>('.route-day__list').forEach((list) => {
                const line = list.querySelector<HTMLElement>('.route-day__line');
                const dots = Array.from(list.querySelectorAll<HTMLElement>('.route-stop__index'));
                if (!line || dots.length < 2) return;
                const step = 0.16;
                const timeline = gsap.timeline();
                timeline.fromTo(line, {scaleY: 0}, {scaleY: 1, duration: step * (dots.length - 1), ease: 'none'}, 0);
                dots.forEach((dot, index) => {
                    timeline.fromTo(dot, {scale: 0.6, opacity: 0.35}, {scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2.2)'}, index * step);
                });
            });
        }, root);
        return () => ctx.revert();
    }, [signature]);

    return root;
}
