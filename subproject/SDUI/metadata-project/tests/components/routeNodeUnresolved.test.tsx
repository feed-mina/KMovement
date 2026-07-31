import React from 'react';
import { render, screen } from '@testing-library/react';
import RouteNode from '@/components/fields/kride/atoms/RouteNode';

/**
 * 위치를 못 찾은 장소를 지도 위 배너로 개수만 알리면 어느 장소가 문제인지 알 수 없다.
 * 일정 목록의 해당 장소 옆에 붙인다.
 */
describe('RouteNode — 위치를 못 찾은 장소', () => {
    it('좌표가 없으면 주소 옆에 표시하고 지도 링크를 감춘다', () => {
        render(
            <RouteNode
                id="n1"
                meta={{}}
                data={{ name: 'PLEDIS 엔터테인먼트', address: '서울특별시 강남구 도산대로 16길 20' }}
            />
        );

        expect(screen.getByText('위치가 정확하지 않아요')).toBeInTheDocument();
        expect(screen.getByText('서울특별시 강남구 도산대로 16길 20')).toBeInTheDocument();
        // 좌표가 없으면 지도로 보낼 수 없다.
        expect(screen.queryByTitle('카카오맵에서 보기')).toBeNull();
        expect(screen.queryByTitle('구글 지도에서 보기')).toBeNull();
    });

    it('좌표가 있으면 표시하지 않고 지도 링크를 준다', () => {
        render(
            <RouteNode
                id="n2"
                meta={{}}
                data={{ name: 'SM 엔터테인먼트', address: '서울특별시 강남구 청담동 423-1', lat: 37.52, lng: 127.05 }}
            />
        );

        expect(screen.queryByText('위치가 정확하지 않아요')).toBeNull();
        expect(screen.getByTitle('카카오맵에서 보기')).toBeInTheDocument();
        expect(screen.getByTitle('구글 지도에서 보기')).toBeInTheDocument();
    });

    it('주소가 없어도 좌표가 없으면 표시한다', () => {
        render(<RouteNode id="n3" meta={{}} data={{ name: '이름만 있는 장소' }} />);

        expect(screen.getByText('위치가 정확하지 않아요')).toBeInTheDocument();
    });
});
