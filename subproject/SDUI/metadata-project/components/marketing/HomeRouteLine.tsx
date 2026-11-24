'use client';

import { useEffect, useRef } from 'react';
import { drawFrom, drawTo, loadGsapWithScroll, prefersReducedMotion } from '@/lib/motion/gsapLoader';
import styles from './scrollStory.module.css';

/**
 * 순서 연출(GSAP) — 홈의 경로 선.
 * 스크롤하면 성지와 맛집을 잇는 선이 그려지고, 아래 세 가지 여행 유형 카드로 갈라져 내려간다.
 * 꾸밈용이라 화면 낭독기에는 숨기고, 좁은 화면·움직임 줄이기·스크립트 없음에서는 다 그려진 그림으로 둔다.
 */
export default function HomeRouteLine() {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (prefersReducedMotion() || !root.current) return;
        let cancelled = false;
        let revert: (() => void) | undefined;
        void loadGsapWithScroll().then(({ gsap }) => {
            if (cancelled || !root.current) return;
            const ctx = gsap.context(() => {
                gsap.matchMedia().add('(min-width: 721px) and (prefers-reduced-motion: no-preference)', () => {
                    const element = root.current!;
                    const trunk = Array.from(element.querySelectorAll<SVGPathElement>('[data-line=trunk]'));
                    const branches = Array.from(element.querySelectorAll<SVGPathElement>('[data-line=branch]'));
                    const ends = Array.from(element.querySelectorAll('[data-line=end]'));
                    const timeline = gsap.timeline({ scrollTrigger: { trigger: element, start: 'top 85%', end: 'bottom 65%', scrub: 0.5 } });
                    trunk.forEach((path) => timeline.fromTo(path, drawFrom(), { ...drawTo(path), ease: 'none', duration: 1 }, 0));
                    branches.forEach((path) => timeline.fromTo(path, drawFrom(), { ...drawTo(path), ease: 'none', duration: 1 }, 1));
                    timeline.fromTo(ends, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, stagger: 0.1 }, 2);
                });
            }, root);
            revert = () => ctx.revert();
        });
        return () => { cancelled = true; revert?.(); };
    }, []);

    return (
        <div ref={root} className={styles.homeRoute} aria-hidden="true">
            <svg viewBox="0 0 900 130" preserveAspectRatio="none" focusable="false">
                <g fill="none" stroke="#e50914" strokeWidth="2.5" strokeLinecap="round">
                    <path vectorEffect="non-scaling-stroke" data-line="trunk" d="M330 22 C 330 50, 450 40, 450 66" />
                    <path vectorEffect="non-scaling-stroke" data-line="trunk" d="M570 22 C 570 50, 450 40, 450 66" />
                    <path vectorEffect="non-scaling-stroke" data-line="branch" d="M450 66 C 450 96, 150 84, 150 120" />
                    <path vectorEffect="non-scaling-stroke" data-line="branch" d="M450 66 L 450 120" />
                    <path vectorEffect="non-scaling-stroke" data-line="branch" d="M450 66 C 450 96, 750 84, 750 120" />
                </g>
                <g fill="#e50914">
                    <circle cx="330" cy="22" r="6" /><circle cx="570" cy="22" r="6" />
                    <circle data-line="end" cx="150" cy="122" r="6" /><circle data-line="end" cx="450" cy="122" r="6" /><circle data-line="end" cx="750" cy="122" r="6" />
                </g>
            </svg>
            <span className={styles.homeRouteLabel} style={{ left: '36.67%' }}>성지</span>
            <span className={styles.homeRouteLabel} style={{ left: '63.33%' }}>맛집</span>
        </div>
    );
}
