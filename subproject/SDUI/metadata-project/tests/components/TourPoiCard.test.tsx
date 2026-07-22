import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import TourPoiCard from '@/components/plugins/travel/TourPoiCard';

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
        expect(reason.style.webkitLineClamp).toBe('2');
        expect(reason.style.webkitBoxOrient).toBe('vertical');
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
