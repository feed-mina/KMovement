'use client';
import { motion } from 'framer-motion';
import { useKrideReducedMotion } from '@/components/motion/KrideMotion';

interface Props {
  id: string;
  meta: any;
  data: any;
  selected?: boolean;
}

export default function CheckIndicator({ selected }: Props) {
  const reduced = useKrideReducedMotion();
  if (!selected) return null;
  return (
    <div className="check-indicator absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 ring-4 ring-red-600 rounded-inherit" />
      <motion.div className="z-10 bg-red-600 rounded-full p-1"
        initial={reduced ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 22 }}>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
    </div>
  );
}
