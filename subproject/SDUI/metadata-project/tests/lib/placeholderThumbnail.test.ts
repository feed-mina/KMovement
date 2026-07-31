import { placeholderThumbnail } from '@/lib/media/placeholderThumbnail';

describe('placeholderThumbnail', () => {
    it('같은 장소는 항상 같은 색과 글자를 받는다', () => {
        const first = placeholderThumbnail('자갈치시장');
        const second = placeholderThumbnail('자갈치시장');
        expect(first).toEqual(second);
    });

    it('첫 글자를 코드포인트 단위로 뽑는다', () => {
        expect(placeholderThumbnail('자갈치시장').initial).toBe('자');
        expect(placeholderThumbnail('  광장시장  ').initial).toBe('광');
        expect(placeholderThumbnail('KSPO돔').initial).toBe('K');
        // 서러게이트 페어를 반 글자로 자르지 않는다.
        expect(placeholderThumbnail('🎤 홍대').initial).toBe('🎤');
    });

    it('빈 이름에도 렌더 가능한 값을 준다', () => {
        const empty = placeholderThumbnail('   ');
        expect(empty.initial).toBe('·');
        expect(empty.background).toContain('linear-gradient');
        expect(empty.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('장소가 다르면 색이 갈린다', () => {
        const names = ['자갈치시장', '광장시장', '망원시장', '동문재래시장', '서문시장', '남부시장', '중앙시장', '교동시장'];
        const backgrounds = new Set(names.map((name) => placeholderThumbnail(name).background));
        // 8색 팔레트라 전부 다를 수는 없지만, 한 색으로 뭉치면 회색 벽과 다를 게 없다.
        expect(backgrounds.size).toBeGreaterThan(1);
    });

    it('항상 그라데이션 배경과 대비용 잉크 색을 함께 준다', () => {
        ['홍대 걷고싶은거리', '감천문화마을', '주문진 방파제', 'a', '1'].forEach((name) => {
            const tone = placeholderThumbnail(name);
            expect(tone.background).toMatch(/^linear-gradient\(135deg, #[0-9A-Fa-f]{6} 0%, #[0-9A-Fa-f]{6} 100%\)$/);
            expect(tone.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });
});
