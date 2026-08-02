import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import PoiImage from '@/components/plugins/travel/PoiImage';

describe('PoiImage', () => {
    it('정상 URL을 HTTPS로 정규화하고 카드 이미지를 lazy loading한다', () => {
        render(<PoiImage src="http://images.example.com/place.jpg" title="서울숲" variant="card"/>);

        const image = screen.getByAltText('서울숲') as HTMLImageElement;
        expect(image.src).toBe('https://images.example.com/place.jpg');
        expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('카드는 썸네일을 쓰고 모달은 원본을 쓴다', () => {
        // 카드는 150×100 으로 그린다. TourAPI 원본은 수백 KB~수 MB 라
        // 첫 화면에서만 몇 MB 를 받게 된다.
        const props = {
            src: 'https://images.example.com/original.jpg',
            thumbnail: 'https://images.example.com/thumb.jpg',
            title: '서울숲',
        };

        const {rerender} = render(<PoiImage {...props} variant="card"/>);
        expect((screen.getByAltText('서울숲') as HTMLImageElement).src)
            .toBe('https://images.example.com/thumb.jpg');

        rerender(<PoiImage {...props} variant="modal"/>);
        expect((screen.getByAltText('서울숲') as HTMLImageElement).src)
            .toBe('https://images.example.com/original.jpg');
    });

    it('썸네일이 없는 장소는 원본으로 떨어진다', () => {
        // 성지(tour_poi)는 썸네일 컬럼이 없어 항상 이 경로로 온다.
        render(<PoiImage src="https://images.example.com/original.jpg" title="북촌" variant="card"/>);

        expect((screen.getByAltText('북촌') as HTMLImageElement).src)
            .toBe('https://images.example.com/original.jpg');
    });

    it('카드에 크기를 박아 사진이 도착할 때 자리가 밀리지 않게 한다', () => {
        render(<PoiImage src="https://images.example.com/place.jpg" title="서울숲" variant="card"/>);

        const image = screen.getByAltText('서울숲');
        expect(image).toHaveAttribute('width', '150');
        expect(image).toHaveAttribute('height', '100');
        expect(image).toHaveAttribute('decoding', 'async');
    });

    it('첫 화면 카드는 lazy 를 끄고 우선순위를 올린다', () => {
        render(<PoiImage src="https://images.example.com/place.jpg" title="서울숲" variant="card" priority/>);

        const image = screen.getByAltText('서울숲');
        expect(image).not.toHaveAttribute('loading', 'lazy');
        expect(image).toHaveAttribute('fetchpriority', 'high');
    });

    it('URL 부재와 유효하지 않은 URL은 동일 fallback으로 표시한다', () => {
        const {rerender} = render(<PoiImage title="북촌" variant="card"/>);
        expect(screen.getByRole('img', {name: '북촌 이미지 없음'})).toBeInTheDocument();

        rerender(<PoiImage src="javascript:alert(1)" title="북촌" variant="card"/>);
        expect(screen.getByRole('img', {name: '북촌 이미지 없음'})).toBeInTheDocument();
    });

    it('사진이 없으면 장소별로 다른 썸네일을 그린다', () => {
        // 성지 대부분이 사진 없이 들어오므로, 회색 상자 하나로 뭉치면 목록이 읽히지 않는다.
        const {rerender} = render(<PoiImage title="자갈치시장" variant="card"/>);
        const first = screen.getByRole('img', {name: '자갈치시장 이미지 없음'});
        expect(first).toHaveTextContent('자');

        rerender(<PoiImage title="광장시장" variant="card"/>);
        expect(screen.getByRole('img', {name: '광장시장 이미지 없음'})).toHaveTextContent('광');
    });

    it('이미지 로딩 실패 시 깨진 이미지 대신 fallback으로 한 번 전환한다', () => {
        render(<PoiImage src="https://images.example.com/missing.jpg" title="DDP" variant="card"/>);

        fireEvent.error(screen.getByAltText('DDP'));

        expect(screen.queryByAltText('DDP')).not.toBeInTheDocument();
        expect(screen.getByRole('img', {name: 'DDP 이미지 없음'})).toBeInTheDocument();
    });

    it('모달에서 권리 출처를 안전한 새 창 링크로 표시한다', () => {
        render(
            <PoiImage
                src="https://images.example.com/place.jpg"
                title="북촌"
                variant="modal"
                sourceUrl="https://commons.wikimedia.org/wiki/File:Bukchon.jpg"
                credit="Bgag · CC0 1.0"
            />,
        );

        const credit = screen.getByRole('link', {name: 'Bgag · CC0 1.0'});
        expect(credit).toHaveAttribute('target', '_blank');
        expect(credit).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
