import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import TourPoiCard, { shortAddress } from '@/components/plugins/travel/TourPoiCard';

const basePoi = {
    contentId: 'holy-1',
    contentTypeId: 'HOLY',
    title: '서울숲',
    addr: '서울특별시 성동구',
};

describe('TourPoiCard', () => {
    it('추천 이유를 trim한 뒤 두 줄 말줄임 스타일로 표시한다', () => {
        const longReason = '  한강뷰 인증샷 명당으로 아주 긴 추천 이유가 이어지며 모바일 카드에서도 두 줄까지만 보여야 합니다.  ';
        render(
            <TourPoiCard
                poi={{...basePoi, recommendReason: longReason}}
                isSaved={false}
                onOpen={jest.fn()}
                onToggleSave={jest.fn()}
            />,
        );

        const reason = screen.getByTestId('tour-poi-recommend-reason');
        expect(reason).toHaveTextContent(longReason.trim());
        const prefixedStyle = reason.style as CSSStyleDeclaration & {
            WebkitLineClamp: string;
            WebkitBoxOrient: string;
        };
        expect(prefixedStyle.WebkitLineClamp).toBe('2');
        expect(prefixedStyle.WebkitBoxOrient).toBe('vertical');
        expect(reason).toHaveStyle({overflow: 'hidden', overflowWrap: 'anywhere'});
    });

    it('추천 이유가 없거나 공백뿐이면 빈 영역을 만들지 않는다', () => {
        const {rerender} = render(
            <TourPoiCard poi={basePoi} isSaved={false} onOpen={jest.fn()} onToggleSave={jest.fn()}/>,
        );
        expect(screen.queryByTestId('tour-poi-recommend-reason')).not.toBeInTheDocument();

        rerender(
            <TourPoiCard poi={{...basePoi, recommendReason: '   '}} isSaved={false} onOpen={jest.fn()} onToggleSave={jest.fn()}/>,
        );
        expect(screen.queryByTestId('tour-poi-recommend-reason')).not.toBeInTheDocument();
    });

    it('상세 열기와 저장 버튼 동작을 서로 독립적으로 유지한다', () => {
        const onOpen = jest.fn();
        const onToggleSave = jest.fn();
        render(
            <TourPoiCard poi={basePoi} isSaved={false} onOpen={onOpen} onToggleSave={onToggleSave}/>,
        );

        fireEvent.click(screen.getByRole('button', {name: '서울숲 상세 보기'}));
        expect(onOpen).toHaveBeenCalledWith(basePoi, expect.any(HTMLElement));

        fireEvent.click(screen.getByRole('button', {name: '서울숲 저장'}));
        expect(onToggleSave).toHaveBeenCalledWith('holy-1');
        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});

// 벤치마킹 H4: 카드에 카테고리 태그 · 짧은 주소 · 호버/포커스 시 지도 핀 강조
describe('TourPoiCard — H4', () => {
    it('shortAddress keeps only the city and district', () => {
        expect(shortAddress('서울 종로구 창경궁로 88')).toBe('서울 종로구');
        expect(shortAddress('  부산광역시   해운대구 우동 ')).toBe('부산광역시 해운대구');
        expect(shortAddress(undefined)).toBe('');
    });
});
