import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SpotThumbnail from '@/components/marketing/SpotThumbnail';

describe('SpotThumbnail', () => {
    it('http 이미지를 https로 올리고 lazy loading한다', () => {
        render(<SpotThumbnail src="http://tong.visitkorea.or.kr/place.jpg" title="자갈치시장" />);

        const image = screen.getByAltText('자갈치시장') as HTMLImageElement;
        expect(image.src).toBe('https://tong.visitkorea.or.kr/place.jpg');
        expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('URL이 없거나 http(s)가 아니면 자리표시자를 보여준다', () => {
        const { rerender } = render(<SpotThumbnail title="망원시장" />);
        expect(screen.getByRole('img', { name: '망원시장 이미지 없음' })).toBeInTheDocument();

        rerender(<SpotThumbnail src="javascript:alert(1)" title="망원시장" />);
        expect(screen.getByRole('img', { name: '망원시장 이미지 없음' })).toBeInTheDocument();
        expect(screen.queryByAltText('망원시장')).not.toBeInTheDocument();
    });

    it('로딩에 실패하면 깨진 이미지 대신 자리표시자로 바꾼다', () => {
        render(<SpotThumbnail src="https://tong.visitkorea.or.kr/missing.jpg" title="동문재래시장" />);

        fireEvent.error(screen.getByAltText('동문재래시장'));

        expect(screen.queryByAltText('동문재래시장')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: '동문재래시장 이미지 없음' })).toBeInTheDocument();
    });

    it('권리 표기가 있으면 카드 안에서 새 창 링크로 밝힌다', () => {
        render(
            <SpotThumbnail
                src="https://images.example.com/place.jpg"
                title="감천문화마을"
                sourceUrl="https://commons.wikimedia.org/wiki/File:Gamcheon.jpg"
                credit="Bgag · CC0 1.0"
            />,
        );

        const credit = screen.getByRole('link', { name: 'Bgag · CC0 1.0' });
        expect(credit).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Gamcheon.jpg');
        expect(credit).toHaveAttribute('target', '_blank');
        expect(credit).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('이미지를 못 띄우면 권리 표기도 함께 감춘다', () => {
        render(
            <SpotThumbnail
                src="https://images.example.com/missing.jpg"
                title="청사포"
                sourceUrl="https://commons.wikimedia.org/wiki/File:Cheongsapo.jpg"
                credit="Bgag · CC0 1.0"
            />,
        );

        fireEvent.error(screen.getByAltText('청사포'));

        expect(screen.queryByRole('link', { name: 'Bgag · CC0 1.0' })).toBeNull();
    });
});
