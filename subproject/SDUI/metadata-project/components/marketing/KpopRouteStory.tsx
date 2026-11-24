'use client';

import { useEffect, useRef } from 'react';
import { useKrideReducedMotion } from '@/components/motion/KrideMotion';
import styles from './scrollStory.module.css';

type Highlight = { name: string; description: string; tip: string };

/**
 * 순서 연출 도구(GSAP) 시범 1 — 스크롤에 맞춰 권역별 동선 넘기기.
 * 오른쪽 동선판을 화면에 고정해 두고, 스크롤로 권역 카드가 화면 가운데에 오면 그 권역 점이 켜지며 선이 이어진다.
 *
 * 지킬 원칙(가이드 08):
 * - GSAP은 이 부품이 화면에 올라온 뒤에만 동적으로 불러온다(다른 화면 첫 로딩에 싣지 않음).
 * - 움직임 줄이기가 켜져 있으면 불러오지도 않고, 모든 권역이 켜진 정적 상태로 둔다.
 * - 스크립트가 없어도(검색 로봇·느린 기기) 같은 내용이 모두 보인다.
 */
export function KpopRouteStory({ highlights }: { highlights: Highlight[] }) {
    const root = useRef<HTMLDivElement>(null);
    const reduced = useKrideReducedMotion();

    useEffect(() => {
        if (reduced || !root.current) return;
        let cancelled = false;
        let revert: (() => void) | undefined;
        (async () => {
            const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
            if (cancelled || !root.current) return;
            gsap.registerPlugin(ScrollTrigger);
            const ctx = gsap.context(() => {
                const mm = gsap.matchMedia();
                mm.add('(min-width: 721px) and (prefers-reduced-motion: no-preference)', () => {
                    const cards = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-route-card]'));
                    const stops = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-route-stop]'));
                    const line = root.current!.querySelector<HTMLElement>('[data-route-line]');
                    gsap.set(stops, { opacity: 0.35, scale: 0.85 });
                    gsap.set(cards, { opacity: 0.4, y: 24 });
                    if (line) gsap.set(line, { scaleY: 0, transformOrigin: 'top center' });
                    // 선은 권역 카드 묶음을 지나가는 동안 위에서 아래로 길어진다.
                    if (line) {
                        gsap.to(line, {
                            scaleY: 1, ease: 'none',
                            scrollTrigger: { trigger: root.current, start: 'top 60%', end: 'bottom 60%', scrub: 0.4 },
                        });
                    }
                    cards.forEach((card, index) => {
                        // 카드가 화면 가운데에 닿으면 그 권역이 켜지고, 위로 되돌아가면 다시 흐려진다.
                        ScrollTrigger.create({
                            trigger: card, start: 'top 65%', end: 'bottom 35%',
                            onToggle: (self) => stops[index]?.setAttribute('data-active', String(self.isActive)),
                            onEnter: () => {
                                gsap.to(card, { opacity: 1, y: 0, duration: 0.3, overwrite: 'auto' });
                                gsap.to(stops[index], { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', overwrite: 'auto' });
                            },
                            onLeaveBack: () => {
                                gsap.to(card, { opacity: 0.4, y: 24, duration: 0.2, overwrite: 'auto' });
                                gsap.to(stops[index], { opacity: 0.35, scale: 0.85, duration: 0.2, overwrite: 'auto' });
                            },
                        });
                    });
                });
            }, root);
            revert = () => ctx.revert();
        })();
        return () => {
            cancelled = true;
            revert?.();
        };
    }, [reduced, highlights.length]);

    return (
        <div ref={root} className={styles.routeStory}>
            <ol className={styles.routeCards}>
                {highlights.map((highlight, index) => (
                    <li key={highlight.name} data-route-card className={styles.routeCard}>
                        <span className={styles.routeIndex} aria-hidden="true">{index + 1}</span>
                        <h3>{highlight.name}</h3>
                        <p>{highlight.description}</p>
                        <small>{highlight.tip}</small>
                    </li>
                ))}
            </ol>
            <aside className={styles.routeRail} aria-hidden="true">
                <span className={styles.routeRailTitle}>동선 순서</span>
                <div className={styles.routeTrack}>
                    <span className={styles.routeLine} data-route-line />
                    {highlights.map((highlight, index) => (
                        <span key={highlight.name} className={styles.routeStop} data-route-stop>
                            <b>{index + 1}</b>
                            {highlight.name}
                        </span>
                    ))}
                </div>
            </aside>
        </div>
    );
}

/** 순서 연출 도구(GSAP) 시범 2 — 체크리스트가 화면에 들어오면 항목이 하나씩 체크된다. */
export function KpopChecklistStory({ items }: { items: string[] }) {
    const root = useRef<HTMLUListElement>(null);
    const reduced = useKrideReducedMotion();

    useEffect(() => {
        if (reduced || !root.current) return;
        let cancelled = false;
        let revert: (() => void) | undefined;
        (async () => {
            const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
            if (cancelled || !root.current) return;
            gsap.registerPlugin(ScrollTrigger);
            const ctx = gsap.context(() => {
                const mm = gsap.matchMedia();
                mm.add('(prefers-reduced-motion: no-preference)', () => {
                    const marks = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-check-mark]'));
                    gsap.set(marks, { scale: 0, opacity: 0 });
                    gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top 75%', once: true } })
                        .to(marks, { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.4)', stagger: 0.18 });
                });
            }, root);
            revert = () => ctx.revert();
        })();
        return () => {
            cancelled = true;
            revert?.();
        };
    }, [reduced, items.length]);

    return (
        <ul ref={root} className={styles.checklist}>
            {items.map((item) => (
                <li key={item}>
                    <span className={styles.checkMark} data-check-mark aria-hidden="true">✓</span>
                    {item}
                </li>
            ))}
        </ul>
    );
}
