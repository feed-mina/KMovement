'use client';

import { useEffect, useRef } from 'react';
import Rai from './atoms/Rai';
import { ITINERARY_LOADING_STAGES } from '@/lib/kride/itineraryLoadingStages';
import { loadGsap, prefersReducedMotion } from '@/lib/motion/gsapLoader';

const PATH = 'M30 62 C 90 62, 100 22, 160 22 S 230 62, 290 62';
// 세 지점이 길 위에서 차지하는 위치(0~1): 취향 분석 → 동선 구성 → 코스 정리
const STOPS = [0, 0.5, 1];
const STOP_POINTS = [{ x: 30, y: 62 }, { x: 160, y: 22 }, { x: 290, y: 62 }];

/**
 * 순서 연출(GSAP) — 코스 대기 화면.
 * 마스코트 라이가 지도 위 선을 따라 세 지점을 지나간다. 글자만 바뀌던 단계 표시를 하나의 순서표(타임라인)로 묶어,
 * 단계가 넘어갈 때마다 다음 지점까지 이어서 달린다. 움직임 줄이기면 현재 지점에 서 있는 그림만 보여준다.
 */
export default function LoadingRouteTrack({ stageIndex }: { stageIndex: number }) {
    const root = useRef<HTMLDivElement>(null);
    const timeline = useRef<{ tweenTo: (label: string) => unknown; kill: () => void } | null>(null);
    const latestStage = useRef(stageIndex);

    useEffect(() => {
        if (prefersReducedMotion() || !root.current) return;
        let cancelled = false;
        void loadGsap().then((gsap) => {
            if (cancelled || !root.current) return;
            const element = root.current;
            const path = element.querySelector<SVGPathElement>('[data-track-path]');
            const done = element.querySelector<SVGPathElement>('[data-track-done]');
            const rider = element.querySelector<HTMLElement>('[data-track-rider]');
            const dots = Array.from(element.querySelectorAll<SVGCircleElement>('[data-track-dot]'));
            if (!path || !done || !rider || typeof path.getTotalLength !== 'function') return;
            const length = path.getTotalLength();
            const state = { t: 0 };
            const place = () => {
                const point = path.getPointAtLength(length * state.t);
                rider.style.left = `${(point.x / 320) * 100}%`;
                rider.style.top = `${(point.y / 84) * 100}%`;
                done.style.strokeDashoffset = String(1 - state.t);
            };
            const tl = gsap.timeline({ paused: true });
            tl.addLabel('stage0', 0);
            STOPS.slice(1).forEach((stop, index) => {
                tl.to(state, { t: stop, duration: 1.4, ease: 'power2.inOut', onUpdate: place })
                    .to(dots[index + 1], { scale: 1.35, transformOrigin: '50% 50%', duration: 0.2, yoyo: true, repeat: 1 }, '>-0.15')
                    .addLabel(`stage${index + 1}`);
            });
            place();
            timeline.current = tl;
            tl.tweenTo(`stage${latestStage.current}`);
        });
        return () => { cancelled = true; timeline.current?.kill(); timeline.current = null; };
    }, []);

    useEffect(() => { latestStage.current = stageIndex; timeline.current?.tweenTo(`stage${stageIndex}`); }, [stageIndex]);

    const still = STOP_POINTS[stageIndex] ?? STOP_POINTS[0];
    return (
        <div ref={root} className="kride-itinerary-loading__track" aria-hidden="true">
            <svg viewBox="0 0 320 84" focusable="false">
                <path data-track-path d={PATH} fill="none" stroke="var(--border-hair, #e5e7eb)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
                <path data-track-done d={PATH} pathLength={1} fill="none" stroke="var(--semantic-accent, #e50914)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray="1" strokeDashoffset={1 - STOPS[stageIndex]} />
                {STOP_POINTS.map((point, index) => (
                    <circle key={ITINERARY_LOADING_STAGES[index].id} data-track-dot cx={point.x} cy={point.y} r="7"
                        fill={index <= stageIndex ? 'var(--semantic-accent, #e50914)' : '#fff'} stroke="var(--semantic-accent, #e50914)" strokeWidth="3" />
                ))}
            </svg>
            <span data-track-rider className="kride-itinerary-loading__rider" style={{ left: `${(still.x / 320) * 100}%`, top: `${(still.y / 84) * 100}%` }}>
                <Rai state="thinking" size={34} />
            </span>
        </div>
    );
}
