'use client';

import { motion } from 'framer-motion';
import { useKrideReducedMotion } from '@/components/motion/KrideMotion';

type Status = 'QUEUED' | 'RUNNING' | 'COMPLETED';

const STEPS: { key: Status; label: string }[] = [
    { key: 'QUEUED', label: '접수' },
    { key: 'RUNNING', label: '만드는 중' },
    { key: 'COMPLETED', label: '완료' },
];

/**
 * 3초마다 받아오는 영상 상태를 접수 → 만드는 중 → 완료 세 칸으로 보여준다.
 * 진행 중인 칸은 막대가 오가며 기다리는 중임을 알리고, 여러 장 묶기는 처리한 장 수만큼 채운다.
 */
export default function AnimationProgressSteps({ status, processed, total }: { status: Status; processed?: number; total?: number }) {
    const reduced = useKrideReducedMotion();
    const current = STEPS.findIndex((step) => step.key === status);
    const batchRatio = typeof total === 'number' && total > 1 ? Math.min(1, (processed ?? 0) / total) : null;

    return (
        <ol className="community-animation-steps" aria-label="영상 만들기 진행 단계">
            {STEPS.map((step, index) => {
                const state = index < current ? 'done' : index === current ? 'active' : 'todo';
                const activeFill = step.key === 'RUNNING' && batchRatio !== null ? Math.max(0.08, batchRatio) : null;
                return (
                    <li key={step.key} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
                        <span>{step.label}</span>
                        <span className="community-animation-steps__track" aria-hidden="true">
                            {state === 'done' || (state === 'active' && status === 'COMPLETED') ? (
                                <motion.span className="community-animation-steps__fill" initial={false} animate={{ scaleX: 1 }} transition={{ duration: 0.3 }} />
                            ) : state === 'active' ? (
                                activeFill !== null || reduced ? (
                                    <motion.span className="community-animation-steps__fill" initial={false}
                                        animate={{ scaleX: activeFill ?? 0.5 }} transition={{ duration: 0.3 }} />
                                ) : (
                                    <motion.span className="community-animation-steps__fill" initial={{ scaleX: 0.15 }}
                                        animate={{ scaleX: [0.15, 0.85] }}
                                        transition={{ duration: 1.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
                                )
                            ) : (
                                <span className="community-animation-steps__fill" style={{ transform: 'scaleX(0)' }} />
                            )}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
