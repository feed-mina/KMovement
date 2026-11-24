import {render} from '@testing-library/react';
import AmbientVideo from '@/components/motion/AmbientVideo';
import {areaClip, HOME_HERO_CLIP} from '@/lib/motion/ambientClips';

function mockReducedMotion(reduce: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: reduce && query.includes('reduce'), media: query, onchange: null,
            addListener: () => undefined, removeListener: () => undefined,
            addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false,
        }),
    });
}

describe('AmbientVideo', () => {
    it('renders nothing when reduced motion is on', () => {
        mockReducedMotion(true);
        const {container} = render(<AmbientVideo {...HOME_HERO_CLIP} />);
        expect(container.querySelector('video')).toBeNull();
        expect(container.firstChild).toBeNull();
    });

    it('renders a muted inline video when motion is allowed', () => {
        mockReducedMotion(false);
        const {container} = render(<AmbientVideo {...HOME_HERO_CLIP} />);
        const video = container.querySelector('video');
        expect(video).not.toBeNull();
        expect(video?.muted).toBe(true);
        expect(video?.getAttribute('src')).toBe('/media/motion/home-hero.mp4');
    });

    it('has clips only for the four featured areas', () => {
        expect(areaClip('seoul')?.src).toBe('/media/motion/area-seoul.mp4');
        expect(areaClip('daegu')).toBeNull();
    });
});
