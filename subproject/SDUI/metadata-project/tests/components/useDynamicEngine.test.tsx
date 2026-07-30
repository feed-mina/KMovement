import { renderHook } from '@testing-library/react';
import { useDynamicEngine } from '@/components/DynamicEngine/useDynamicEngine';

// useBaseActions가 조회 결과(pageData)를 formData로 통째로 복사하기 때문에,
// formData[refId]는 사용자의 입력값일 수도 있고 조회된 컬렉션일 수도 있다.
// getComponentData는 두 경우를 모두 올바르게 구분해야 한다.
const leaf = (refDataId?: string) => ({ componentId: 'leaf', componentType: 'TEXT', refDataId }) as any;
const repeater = (refDataId: string) => ({
    componentId: 'group',
    componentType: 'GROUP',
    refDataId,
    children: [leaf(refDataId)],
}) as any;

function bind(pageData: any, formData: any) {
    const { result } = renderHook(() => useDynamicEngine([], pageData, formData));
    return result.current.getComponentData;
}

describe('useDynamicEngine getComponentData', () => {
    it('keeps form input values ahead of loaded data on edit screens', () => {
        const get = bind({ title: '저장된 제목' }, { title: '사용자가 고친 제목' });
        expect(get(leaf('title'), null)).toBe('사용자가 고친 제목');
    });

    it('keeps falsy and object form values intact', () => {
        const get = bind({ is_private: true, emotion: { code: 'JOY' } }, { is_private: false, emotion: {} });
        expect(get(leaf('is_private'), null)).toBe(false);
        expect(get(leaf('emotion'), null)).toEqual({});
    });

    it('prefers the repeater row over a collection copied into formData', () => {
        // KPOP_ARTIST_DETAIL: 루트 리피터와 카드가 같은 refDataId를 쓰는 구조
        const row = { id: 9, nameKo: 'aespa' };
        const get = bind({ artist: [row] }, { artist: [row] });
        expect(get(leaf('artist'), row)).toBe(row);
    });

    it('hands the whole collection to list-style leaves such as charts and galleries', () => {
        // MY_PAGE / ADMIN_DASHBOARD: CHART·GALLERY_GRID·HISTORY_LIST는 배열 전체를 받아야 한다.
        const rows = [{ label: '서울', value: 3 }, { label: '부산', value: 1 }];
        const get = bind({ mypage_route_history_source: rows }, { mypage_route_history_source: rows });
        expect(get(leaf('mypage_route_history_source'), null)).toBe(rows);
    });

    it('hands the whole collection to repeater groups', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        const get = bind({ artists: rows }, { artists: rows });
        expect(get(repeater('artists'), null)).toBe(rows);
    });

    it('falls back to pageData when formData has no entry for the binding', () => {
        const get = bind({ artist: [{ id: 9, nameKo: 'aespa' }] }, {});
        expect(get(leaf('artist'), null)).toEqual({ id: 9, nameKo: 'aespa' });
    });

    it('returns the unbound page data for components without a binding', () => {
        const pageData = { title: '제목' };
        const get = bind(pageData, {});
        expect(get(leaf(undefined), null)).toBe(pageData);
    });
});
