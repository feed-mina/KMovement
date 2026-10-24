'use client';

import {useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode} from 'react';
import {motion, MotionConfig, useMotionValue, useSpring, type HTMLMotionProps} from 'framer-motion';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (notify: () => void) => {
    const query = window.matchMedia?.(reducedMotionQuery);
    query?.addEventListener('change', notify);
    return () => query?.removeEventListener('change', notify);
};
const readMotion = () => window.matchMedia?.(reducedMotionQuery).matches ?? true;
const serverMotion = () => true;

/** Respond immediately when the operating-system preference changes, including after hydration. */
export function useKrideReducedMotion() {
    return useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
}

export function KrideMotionProvider({children}: {children: ReactNode}) {
    const reduced = useKrideReducedMotion();
    return <MotionConfig reducedMotion={reduced ? "always" : "user"} transition={{duration: 0.2}}>{children}</MotionConfig>;
}

/** Keep pointer updates outside React rendering; touch and reduced motion stay flat. */
export function useCardTilt() {
    const reduced = useKrideReducedMotion();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(x, {stiffness: 240, damping: 28});
    const rotateY = useSpring(y, {stiffness: 240, damping: 28});
    const reset = () => {x.set(0); y.set(0);};
    useEffect(() => {if (reduced) {x.set(0); y.set(0);}}, [reduced, x, y]);
    return {
        style: {rotateX, rotateY, transformPerspective: 1000},
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            if (reduced !== false || event.pointerType !== 'mouse'
                || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
            const rect = event.currentTarget.getBoundingClientRect();
            x.set(-((event.clientY - rect.top) / rect.height - 0.5) * 6);
            y.set(((event.clientX - rect.left) / rect.width - 0.5) * 6);
        },
        onPointerLeave: reset,
        onPointerCancel: reset,
        onBlur: reset,
    };
}

export function MotionCard({children, className = '', ...props}: HTMLMotionProps<'div'>) {
    const tilt = useCardTilt();
    const reduced = useKrideReducedMotion();
    return <motion.div {...props} {...tilt} className={`kride-motion-card ${className}`}
        whileHover={reduced ? undefined : {y: -3}} whileTap={reduced ? undefined : {scale: 0.99}}>{children}</motion.div>;
}

/** A single ripple per press, with native button semantics and caller events intact. */
export function MotionButton({children, className = '', onPointerDown, ...props}: Omit<HTMLMotionProps<'button'>, 'children'> & {children?: ReactNode}) {
    const reduced = useKrideReducedMotion();
    const [ripple, setRipple] = useState<{id: number; x: number; y: number; size: number} | null>(null);
    return <motion.button {...props} className={`kride-motion-button ${className}`}
        whileHover={reduced ? undefined : {scale: 1.025}} whileTap={reduced ? undefined : {scale: 0.97}}
        onPointerDown={(event) => {
            onPointerDown?.(event);
            if (reduced !== false || props.disabled) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setRipple({id: performance.now(), x: event.clientX - rect.left, y: event.clientY - rect.top,
                size: Math.hypot(rect.width, rect.height) * 2});
        }}>
        {ripple && <motion.span key={ripple.id} aria-hidden="true" className="kride-motion-ripple"
            style={{left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size}}
            initial={{scale: 0, opacity: 0.18}} animate={{scale: 1, opacity: 0}}
            transition={{duration: 0.35}}
            onAnimationComplete={() => setRipple((current) => current?.id === ripple.id ? null : current)} />}
        <span className="kride-motion-button__label">{children}</span>
    </motion.button>;
}

/** Static during SSR and for reduced motion; the control pauses every background layer. */
export function PastelBackdrop() {
    const reduced = useKrideReducedMotion();
    const [paused, setPaused] = useState(false);
    const backdrop = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const update = () => setVisible(!document.hidden);
        update(); document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    useEffect(() => {
        if (!backdrop.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
        observer.observe(backdrop.current);
        return () => observer.disconnect();
    }, []);
    const moving = reduced === false && !paused && inView && visible;
    return <>
        <div ref={backdrop} aria-hidden="true" className="kride-pastel" data-moving={moving}>
            <span className="kride-pastel__pink" />
            <span className="kride-pastel__mint" />
            <span className="kride-pastel__blue" />
        </div>
        {reduced === false && <button type="button" className="kride-motion-pause" aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}>
            {paused ? '배경 움직임 재생' : '배경 움직임 멈춤'}
        </button>}
    </>;
}
