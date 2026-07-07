// Rai.tsx — K-RIDE 마스코트 "라이(RAI)"
// 브랜드 레드 헬멧을 쓴 둥근 호랑이. 표정(state)으로 챗봇 상태를 전달한다.
//   greeting  → 인사 / 온보딩 (chat status: idle)
//   thinking  → 분석 중       (chat status: thinking)
//   success   → 결과 도착      (chat status: streaming / 완료)
//   sad       → 에러 · 결과 0건
// 캐릭터 색은 다크모드에서 반전되면 안 되므로 고정 hex를 사용한다.

import React from 'react';

export type RaiState = 'greeting' | 'thinking' | 'success' | 'sad';

interface RaiProps {
  state?: RaiState;
  size?: number;
  /** 헬멧 색 — 테마 교체 시 브랜드 색 토큰 값을 주입할 수 있다 */
  helmet?: string;
  className?: string;
  title?: string;
}

const BODY = '#FFD29B';
const EAR_INNER = '#F4A29A';
const HELMET_RIM = '#B00710';
const EYE = '#3A2A22';
const NOSE = '#C25A5A';
const MOUTH = '#8A4B3A';
const CHEEK = '#FF9AA2';
const STAR = '#F6B93B';
const TEAR = '#7EC8E3';

const LABELS: Record<RaiState, string> = {
  greeting: '라이가 인사해요',
  thinking: '라이가 생각 중이에요',
  success: '라이가 찾았어요',
  sad: '라이가 아쉬워해요',
};

function Face({ state }: { state: RaiState }) {
  switch (state) {
    case 'thinking':
      return (
        <>
          <circle cx="26" cy="52" r="4" fill={CHEEK} opacity="0.75" />
          <circle cx="54" cy="52" r="4" fill={CHEEK} opacity="0.75" />
          <circle cx="31" cy="46" r="4.2" fill={EYE} />
          <circle cx="49" cy="46" r="4.2" fill={EYE} />
          <circle cx="32.5" cy="43.8" r="1.4" fill="#FFFFFF" />
          <circle cx="50.5" cy="43.8" r="1.4" fill="#FFFFFF" />
          <path d="M37 50 h6 l-3 4 z" fill={NOSE} />
          <path d="M36 57 h8" stroke={MOUTH} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="60" cy="30" r="1.7" fill="#B7A99A" />
          <circle cx="65" cy="26" r="1.2" fill="#B7A99A" />
        </>
      );
    case 'success':
      return (
        <>
          <circle cx="25" cy="53" r="4.5" fill={CHEEK} opacity="0.8" />
          <circle cx="55" cy="53" r="4.5" fill={CHEEK} opacity="0.8" />
          <path d="M27 48 Q31 43 35 48" stroke={EYE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M45 48 Q49 43 53 48" stroke={EYE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M37 50 h6 l-3 4 z" fill={NOSE} />
          <path d="M33 55 Q40 63 47 55 Z" fill={NOSE} />
          <path d="M62 26 l1.6 3 l3 1.6 l-3 1.6 l-1.6 3 l-1.6 -3 l-3 -1.6 l3 -1.6 z" fill={STAR} />
        </>
      );
    case 'sad':
      return (
        <>
          <circle cx="26" cy="53" r="4" fill={CHEEK} opacity="0.6" />
          <circle cx="54" cy="53" r="4" fill={CHEEK} opacity="0.6" />
          <circle cx="31" cy="48" r="4" fill={EYE} />
          <circle cx="49" cy="48" r="4" fill={EYE} />
          <circle cx="32.2" cy="46.6" r="1.3" fill="#FFFFFF" />
          <circle cx="50.2" cy="46.6" r="1.3" fill="#FFFFFF" />
          <path d="M26 42 l7 2 M54 42 l-7 2" stroke={MOUTH} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M37 50 h6 l-3 4 z" fill={NOSE} />
          <path d="M35 59 Q40 55 45 59" stroke={MOUTH} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M60 32 q-3 4 0 6 q3 -2 0 -6 z" fill={TEAR} />
        </>
      );
    case 'greeting':
    default:
      return (
        <>
          <circle cx="26" cy="52" r="4" fill={CHEEK} opacity="0.75" />
          <circle cx="54" cy="52" r="4" fill={CHEEK} opacity="0.75" />
          <circle cx="31" cy="47" r="4.2" fill={EYE} />
          <circle cx="49" cy="47" r="4.2" fill={EYE} />
          <circle cx="32.5" cy="45.5" r="1.4" fill="#FFFFFF" />
          <circle cx="50.5" cy="45.5" r="1.4" fill="#FFFFFF" />
          <path d="M37 50 h6 l-3 4 z" fill={NOSE} />
          <path d="M35 57 Q40 62 45 57" stroke={MOUTH} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M62 30 l2 2 M64 28 l0 3" stroke={STAR} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
  }
}

export default function Rai({
  state = 'greeting',
  size = 40,
  helmet = '#E50914',
  className,
  title,
}: RaiProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title ?? LABELS[state]}
    >
      <circle cx="22" cy="20" r="8" fill={BODY} />
      <circle cx="58" cy="20" r="8" fill={BODY} />
      <circle cx="22" cy="20" r="4" fill={EAR_INNER} />
      <circle cx="58" cy="20" r="4" fill={EAR_INNER} />
      <circle cx="40" cy="44" r="27" fill={BODY} />
      <path d="M14 42 A27 23 0 0 1 66 42 Z" fill={helmet} />
      <rect x="13" y="38" width="54" height="6" rx="3" fill={HELMET_RIM} />
      <Face state={state} />
    </svg>
  );
}
