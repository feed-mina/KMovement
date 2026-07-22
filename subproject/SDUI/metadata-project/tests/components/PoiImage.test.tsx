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

    it('URL 부재와 유효하지 않은 URL은 동일 fallback으로 표시한다', () => {
        const {rerender} = render(<PoiImage title="북촌" variant="card"/>);
        expect(screen.getByRole('img', {name: '북촌 이미지 없음'})).toBeInTheDocument();

        rerender(<PoiImage src="javascript:alert(1)" title="북촌" variant="card"/>);
        expect(screen.getByRole('img', {name: '북촌 이미지 없음'})).toBeInTheDocument();
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
