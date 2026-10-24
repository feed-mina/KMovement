import {act, fireEvent, render, screen} from '@testing-library/react';
import {KrideMotionProvider, MotionButton, PastelBackdrop} from '@/components/motion/KrideMotion';

let reduced = false;
let preferenceListeners: Set<() => void>;
let onIntersection: IntersectionObserverCallback;
const disconnect = jest.fn();

beforeEach(() => {
    reduced = false;
    preferenceListeners = new Set();
    Object.defineProperty(window, 'matchMedia', {configurable: true, value: jest.fn(() => ({
        get matches() {return reduced;},
        addEventListener: (_event: string, handler: () => void) => preferenceListeners.add(handler),
        removeEventListener: (_event: string, handler: () => void) => preferenceListeners.delete(handler),
        addListener: jest.fn(), removeListener: jest.fn(),
    }))});
    global.IntersectionObserver = jest.fn((callback) => {
        onIntersection = callback;
        return {observe: jest.fn(), disconnect, unobserve: jest.fn(), takeRecords: jest.fn(), root: null, rootMargin: '', thresholds: []};
    }) as unknown as typeof IntersectionObserver;
});

it('배경을 멈추고 다시 재생하며 화면 밖에서는 움직임을 중단한다', () => {
    const {container, unmount} = render(<KrideMotionProvider><PastelBackdrop /></KrideMotionProvider>);
    const backdrop = container.querySelector('.kride-pastel');
    act(() => onIntersection([{isIntersecting: true} as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(backdrop).toHaveAttribute('data-moving', 'true');
    fireEvent.click(screen.getByRole('button', {name: '배경 움직임 멈춤'}));
    expect(backdrop).toHaveAttribute('data-moving', 'false');
    fireEvent.click(screen.getByRole('button', {name: '배경 움직임 재생'}));
    expect(backdrop).toHaveAttribute('data-moving', 'true');
    act(() => onIntersection([{isIntersecting: false} as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(backdrop).toHaveAttribute('data-moving', 'false');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(preferenceListeners.size).toBe(0);
});

it('실행 중 동작 줄이기 설정을 켜면 즉시 배경을 멈추고 버튼 조작은 유지한다', () => {
    const onClick = jest.fn();
    const {container} = render(<KrideMotionProvider><PastelBackdrop /><MotionButton onClick={onClick}>필터</MotionButton></KrideMotionProvider>);
    act(() => onIntersection([{isIntersecting: true} as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(container.querySelector('.kride-pastel')).toHaveAttribute('data-moving', 'true');
    act(() => {reduced = true; preferenceListeners.forEach((notify) => notify());});
    expect(container.querySelector('.kride-pastel')).toHaveAttribute('data-moving', 'false');
    expect(screen.queryByRole('button', {name: '배경 움직임 멈춤'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '필터'}));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.kride-motion-ripple')).not.toBeInTheDocument();
});
