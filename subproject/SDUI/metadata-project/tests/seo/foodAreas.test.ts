import { findFoodArea, foodAreaPath, foodAreas, foodAreaSlugs } from '@/lib/seo/travelContent';

// TourExploreScreen의 FALLBACK_AREAS와 같은 TourAPI 시·도 코드 체계여야 한다.
const TOUR_API_AREA_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '31', '32', '33', '34', '35', '36', '37', '38', '39'];

describe('전국 맛집 지역 데이터', () => {
    it('17개 시·도를 중복 없이 담는다', () => {
        expect(foodAreas).toHaveLength(17);
        expect(new Set(foodAreaSlugs).size).toBe(17);
    });

    it('TourAPI 시·도 코드와 1:1로 대응한다', () => {
        const codes = foodAreas.map((area) => area.areaCode);
        expect(new Set(codes).size).toBe(codes.length);
        expect([...codes].sort()).toEqual([...TOUR_API_AREA_CODES].sort());
    });

    it('모든 지역이 권역·맛집·성지 섹션을 채운다', () => {
        foodAreas.forEach((area) => {
            expect(area.highlights.length).toBeGreaterThanOrEqual(3);
            expect(area.signatureSpots.length).toBeGreaterThanOrEqual(3);
            expect(area.holySpots.length).toBeGreaterThanOrEqual(1);
            expect(area.districts.length).toBeGreaterThanOrEqual(5);
        });
    });

    it('맛집·성지의 시·군·구가 해당 지역 목록 안에 있다', () => {
        foodAreas.forEach((area) => {
            const districts = new Set(area.districts);
            [...area.signatureSpots, ...area.holySpots].forEach((spot) => {
                expect(districts.has(spot.district)).toBe(true);
            });
        });
    });

    it('인접 지역 링크가 실재하는 다른 지역을 가리킨다', () => {
        foodAreas.forEach((area) => {
            expect(area.neighbors.length).toBeGreaterThan(0);
            area.neighbors.forEach((slug) => {
                expect(slug).not.toBe(area.slug);
                expect(findFoodArea(slug)).toBeDefined();
            });
        });
    });

    it('slug는 URL에 그대로 쓸 수 있는 형태다', () => {
        foodAreaSlugs.forEach((slug) => {
            expect(slug).toMatch(/^[a-z]+$/);
            expect(foodAreaPath(slug)).toBe(`/travel/food/${slug}`);
        });
    });

    it('등록되지 않은 slug는 찾지 못한다', () => {
        expect(findFoodArea('seoul-food')).toBeUndefined();
        expect(findFoodArea('')).toBeUndefined();
    });
});
