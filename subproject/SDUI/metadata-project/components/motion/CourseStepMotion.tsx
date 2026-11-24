'use client';

import {useEffect, useRef, type ReactNode} from 'react';
import {motion, useAnimate} from 'framer-motion';
import {useKrideReducedMotion} from './KrideMotion';

export const COURSE_STEP_TOTAL = 5;

/** Fills 1/5 per step; the bar grows from the previous step instead of jumping. */
export function CourseProgressBar({step}: {step: number}) {
    return (
        <div className="course-progress__bar" role="progressbar" aria-label="코스 작성 진행"
            aria-valuemin={1} aria-valuemax={COURSE_STEP_TOTAL} aria-valuenow={step}>
            <motion.span className="course-progress__fill" initial={false}
                animate={{scaleX: step / COURSE_STEP_TOTAL}} transition={{duration: 0.3}} />
        </div>
    );
}

/**
 * The 5-step course screens slide in from the side they come from:
 * moving forward enters from the right, going back enters from the left.
 * The wrapper stays mounted, so the page state is not reset by the animation.
 */
export function CourseStepFrame({step, children}: {step: number; children: ReactNode}) {
    const reduced = useKrideReducedMotion();
    const [scope, animate] = useAnimate<HTMLDivElement>();
    const previous = useRef<number | null>(null);

    useEffect(() => {
        const from = previous.current;
        previous.current = step;
        if (from === null || from === step || reduced || !scope.current) return;
        const direction = step > from ? 1 : -1;
        const controls = animate(scope.current, {x: [direction * 32, 0], opacity: [0, 1]}, {duration: 0.24, ease: 'easeOut'});
        return () => controls.stop();
    }, [step, reduced, animate, scope]);

    return <div ref={scope} className="course-step-frame" data-step={step}>{children}</div>;
}
