'use client';

import { useEffect, useRef } from 'react';
import { drawFrom, drawTo, getGsap, loadGsap, prefersReducedMotion } from '@/lib/motion/gsapLoader';

/** 작업 서버(deploy/media_motion/tora_trajectory.py)의 다섯 가지 길과 같은 좌표. 사진 크기를 0~1로 본 값이다. */
export const TRAJECTORY_POINTS: Record<string, [number, number][]> = {
    object_pan_right: [[0.3, 0.5], [0.7, 0.5]],
    object_pan_left: [[0.7, 0.5], [0.3, 0.5]],
    arc_up: [[0.3, 0.6], [0.5, 0.3], [0.7, 0.6]],
    arc_down: [[0.3, 0.4], [0.5, 0.7], [0.7, 0.4]],
    pause_then_move: [[0.5, 0.5], [0.5, 0.5], [0.7, 0.5]],
};

function pathFor(points: [number, number][]) {
    const [a, b, c] = points.map(([x, y]) => [x * 100, y * 100]);
    if (!c) return `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
    if (a[0] === b[0] && a[1] === b[1]) return `M${a[0]} ${a[1]} L${c[0]} ${c[1]}`;
    // 세 점을 지나는 부드러운 곡선: 가운데 점을 지나도록 조절점을 잡는다.
    return `M${a[0]} ${a[1]} Q${2 * b[0] - (a[0] + c[0]) / 2} ${2 * b[1] - (a[1] + c[1]) / 2} ${c[0]} ${c[1]}`;
}

/**
 * 순서 연출(GSAP) — 움직일 길 미리보기.
 * 길을 고르면 사진 위에 화살표 선이 그 길대로 그려진다. 몇 분 기다리기 전에 결과를 짐작할 수 있다.
 * 움직임 줄이기면 다 그려진 선만 보여준다.
 */
export default function TrajectoryPreview({ imageUrl, preset }: { imageUrl: string; preset: string }) {
    const root = useRef<HTMLDivElement>(null);
    const points = TRAJECTORY_POINTS[preset] ?? TRAJECTORY_POINTS.object_pan_right;
    const pauses = preset === 'pause_then_move';
    const end = points[points.length - 1];
    const before = points[points.length - 2];
    const angle = Math.atan2(end[1] - before[1], end[0] - before[0]) * 180 / Math.PI;

    useEffect(() => {
        if (prefersReducedMotion() || !root.current) return;
        let cancelled = false;
        let kill: (() => void) | undefined;
        const run = (gsap: NonNullable<ReturnType<typeof getGsap>>) => {
            if (cancelled || !root.current) return;
            const line = root.current.querySelector<SVGPathElement>('[data-traj-line]');
            if (!line) return;
            const head = root.current.querySelector('[data-traj-head]');
            const start = root.current.querySelector('[data-traj-start]');
            const timeline = gsap.timeline();
            timeline.fromTo(start, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.2 })
                .fromTo(line, drawFrom(), { ...drawTo(line), duration: 0.7, ease: 'power1.inOut', delay: pauses ? 0.45 : 0 })
                .fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.15 }, '>-0.05');
            kill = () => { timeline.kill(); gsap.set(line, { clearProps: 'strokeDasharray,strokeDashoffset' }); };
        };
        const ready = getGsap();
        if (ready) run(ready); else void loadGsap().then(run);
        return () => { cancelled = true; kill?.(); };
    }, [preset, pauses]);

    return (
        <div ref={root} className="community-traj-preview">
            <img src={imageUrl} alt="" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path data-traj-line d={pathFor(points)} fill="none" stroke="#fff" strokeWidth="3"
                    strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.7))' }} />
                <circle data-traj-start cx={points[0][0] * 100} cy={points[0][1] * 100} r="2.2" fill="#e50914" stroke="#fff" strokeWidth="0.8" />
            </svg>
            <span data-traj-head className="community-traj-preview__head" aria-hidden="true"
                style={{ left: `${end[0] * 100}%`, top: `calc((100% - 34px) * ${end[1]})`, rotate: `${angle}deg` }}>➤</span>
            <p className="community-traj-preview__note">고른 길대로 사진 속 대상이 움직여요{pauses ? ' (잠깐 멈췄다가 출발)' : ''}. 미리보기이며 실제 결과와 다를 수 있어요.</p>
        </div>
    );
}
