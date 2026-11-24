// 순서 연출 도구(GSAP)는 쓰는 화면에서만, 화면이 뜬 뒤에 불러온다 (모션 가이드 08).
// 한 번 불러온 뒤에는 getGsap() 으로 바로 꺼내 쓸 수 있어, 결과가 나타나는 순간 깜빡임 없이 연출을 시작한다.
type Gsap = typeof import('gsap')['gsap'];
type ScrollTriggerType = typeof import('gsap/ScrollTrigger')['ScrollTrigger'];

let cached: Gsap | null = null;
let pending: Promise<Gsap> | null = null;
let scrollPending: Promise<{gsap: Gsap; ScrollTrigger: ScrollTriggerType}> | null = null;

export const prefersReducedMotion = () =>
    typeof window === 'undefined' || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true);

export function loadGsap(): Promise<Gsap> {
    pending ??= import('gsap').then((module) => (cached = module.gsap));
    return pending;
}

/** 이미 불러왔으면 바로, 아니면 null. null 이면 연출 없이 정적 상태로 둔다. */
export const getGsap = (): Gsap | null => cached;

export function loadGsapWithScroll() {
    scrollPending ??= Promise.all([loadGsap(), import('gsap/ScrollTrigger')]).then(([gsap, module]) => {
        gsap.registerPlugin(module.ScrollTrigger);
        return {gsap, ScrollTrigger: module.ScrollTrigger};
    });
    return scrollPending;
}

/**
 * 선 그리기용 길이. 화면에 맞춰 늘어나는 SVG(굵기는 고정)에서는 점선 길이를 화면 픽셀로 따져야 해서,
 * 길을 잘게 나눠 화면 기준 길이를 잰다.
 */
export function screenPathLength(path: SVGPathElement): number {
    const svg = path.ownerSVGElement;
    if (!svg || typeof path.getTotalLength !== 'function') return 0;
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const scaleX = view.width ? box.width / view.width : 1;
    const scaleY = view.height ? box.height / view.height : 1;
    const total = path.getTotalLength();
    let length = 0;
    let previous = path.getPointAtLength(0);
    for (let step = 1; step <= 48; step++) {
        const point = path.getPointAtLength((total * step) / 48);
        length += Math.hypot((point.x - previous.x) * scaleX, (point.y - previous.y) * scaleY);
        previous = point;
    }
    return length;
}

/** 선이 0에서 끝까지 그려지도록 하는 시작·끝 값. 끝난 뒤 화면 폭이 바뀌어도 선이 끊기지 않게 큰 점선 주기를 쓴다. */
export const DRAW_DASH = 6000;
export const drawFrom = () => ({strokeDasharray: `${DRAW_DASH} ${DRAW_DASH}`, strokeDashoffset: DRAW_DASH});
export const drawTo = (path: SVGPathElement) => ({strokeDashoffset: DRAW_DASH - Math.ceil(screenPathLength(path)) - 2});
