import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TourExploreScreen from '@/components/plugins/travel/TourExploreScreen';
import { fetchHolyPois, fetchTourPois } from '@/services/tourApi';

jest.mock('@/services/tourApi', () => ({
    __esModule: true,
    fetchTourPois: jest.fn(),
    fetchHolyPois: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { socialType: 'K' }, isLoggedIn: true }) }));

const mockedFetch = fetchTourPois as jest.Mock;
const mockedHolyFetch = fetchHolyPois as jest.Mock;

const sample = [
    { contentId: '1', title: '가나돈까스의집', addr: '서울 강남구', firstImage: 'http://img/a.jpg', mapX: 127, mapY: 37.5 },
    { contentId: '2', title: '가담', addr: '서울 강남구', firstImage: '', mapX: 127.03, mapY: 37.52 },
];

describe('TourExploreScreen — [탐색] TourAPI 카드', () => {
    beforeEach(() => {
        mockedFetch.mockReset();
        mockedFetch.mockResolvedValue(sample);
        // 기본: 성지 API는 빈 결과 → 시드(HOLY_SITES) 폴백 경로
        mockedHolyFetch.mockReset();
        mockedHolyFetch.mockResolvedValue([]);
    });

    const renderScreen = () => render(<TourExploreScreen screenId="TOUR_EXPLORE" refId={null} />);

    it('맛집 POI 카드를 렌더링해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가나돈까스의집')).toBeInTheDocument());
        expect(screen.getByText('가담')).toBeInTheDocument();
    });

    it('기본 카테고리는 맛집(39)으로 조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1', contentTypeId: '39' }));
    });

    it('카테고리 전환 시 해당 contentTypeId로 재조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가담')).toBeInTheDocument());
        fireEvent.click(screen.getByText('관광지'));
        await waitFor(() =>
            expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ contentTypeId: '12' })),
        );
    });

    it('http 이미지 URL을 https로 업그레이드해야 함', async () => {
        renderScreen();
        const img = await screen.findByAltText('가나돈까스의집') as HTMLImageElement;
        expect(img.src).toBe('https://img/a.jpg');
    });

    it('조회 실패 시 안내 문구를 표시해야 함', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('network'));
        renderScreen();
        await waitFor(() => expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument());
    });

    it('지역(구) 선택 시 sigunguCode로 재조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가담')).toBeInTheDocument());
        fireEvent.click(screen.getByText('종로구'));
        await waitFor(() =>
            expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ sigunguCode: '23' })),
        );
    });

    it('정렬(최신순) 선택 시 arrange=C로 재조회해야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가담')).toBeInTheDocument());
        fireEvent.click(screen.getByText('최신순'));
        await waitFor(() =>
            expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ arrange: 'C' })),
        );
    });

    it('카드 클릭 시 상세 모달(구글지도 링크)이 열려야 함', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가나돈까스의집')).toBeInTheDocument());
        fireEvent.click(screen.getByText('가나돈까스의집'));
        const link = await screen.findByText('구글지도에서 보기') as HTMLAnchorElement;
        expect(link).toBeInTheDocument();
        expect(link.getAttribute('href')).toContain('37.5,127');
    });

    it('성지 카테고리는 TourAPI 대신 성지 API를 호출한다 (#96-A)', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가나돈까스의집')).toBeInTheDocument());
        mockedFetch.mockClear();
        fireEvent.click(screen.getByText('성지'));
        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalled());
        expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('성지 탐색 중에만 공개 전 검수·사진 미지원 안내를 표시한다', async () => {
        renderScreen();
        await waitFor(() => expect(screen.getByText('가나돈까스의집')).toBeInTheDocument());
        expect(screen.queryByRole('link', { name: '새 성지 제보하기' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('성지'));
        await screen.findByText('서울숲');
        expect(screen.getByText('제보는 공개 전 운영진이 검수하며, 사진 업로드는 지원하지 않아요.')).toBeInTheDocument();

        fireEvent.click(screen.getByText('관광지'));
        await screen.findByText('가나돈까스의집');
        expect(screen.queryByRole('link', { name: '새 성지 제보하기' })).not.toBeInTheDocument();
    });

    it('성지 제보 CTA를 접근 가능한 제출 링크로 제공한다', async () => {
        renderScreen();
        await screen.findByText('가나돈까스의집');
        fireEvent.click(screen.getByText('성지'));
        await screen.findByText('서울숲');

        const link = screen.getByRole('link', { name: '새 성지 제보하기' });
        expect(link).toHaveAttribute('href', '/holy/submit');
        expect(link).toHaveAccessibleDescription('제보는 공개 전 운영진이 검수하며, 사진 업로드는 지원하지 않아요.');
    });

    it('성지 API 결과가 있으면 그대로 표시한다', async () => {
        mockedHolyFetch.mockResolvedValue([
            { contentId: 'holy-db-1', title: 'DB성지', addr: '서울', mapX: 127, mapY: 37.5, contentTypeId: 'HOLY', artist: 'BTS' },
        ]);
        renderScreen();
        fireEvent.click(await screen.findByText('성지'));
        await waitFor(() => expect(screen.getByText('DB성지')).toBeInTheDocument());
    });

    it('성지 API가 비었거나 실패하면 시드 큐레이션으로 폴백한다', async () => {
        mockedHolyFetch.mockRejectedValueOnce(new Error('network'));
        renderScreen();
        fireEvent.click(await screen.findByText('성지'));
        await waitFor(() => expect(screen.getByText('서울숲')).toBeInTheDocument());
    });

    it('성지 카드 모달에 팬덤 발자취·추천 이유를 표시', async () => {
        renderScreen();
        fireEvent.click(await screen.findByText('성지'));
        fireEvent.click(await screen.findByText('서울숲'));
        expect(await screen.findByText('왜 추천하나요?')).toBeInTheDocument();
        expect(screen.getByText('팬덤 발자취')).toBeInTheDocument();
    });

    it('성지 상세에 허용된 외부 출처 URL만 안전한 새 창 링크로 제공한다', async () => {
        mockedHolyFetch.mockResolvedValue([
            {
                contentId: 'holy-safe-source',
                title: '출처 있는 성지',
                contentTypeId: 'HOLY',
                sourceUrl: 'https://example.com/articles/holy-place?verified=true',
            },
            {
                contentId: 'holy-unsafe-source',
                title: '잘못된 출처 성지',
                contentTypeId: 'HOLY',
                sourceUrl: 'javascript:alert(document.domain)',
            },
        ]);
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: '성지' }));

        fireEvent.click(await screen.findByRole('button', { name: '출처 있는 성지 상세 보기' }));
        const sourceLink = await screen.findByRole('link', { name: '출처 확인' });
        expect(sourceLink).toHaveAttribute('href', 'https://example.com/articles/holy-place?verified=true');
        expect(sourceLink).toHaveAttribute('target', '_blank');
        expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');

        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: '잘못된 출처 성지 상세 보기' }));
        expect(await screen.findByRole('dialog', { name: '잘못된 출처 성지' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '출처 확인' })).not.toBeInTheDocument();
    });

    it('상세 모달을 키보드로 열고 이름·초점 고정·Escape 종료·초점 복귀를 지원한다', async () => {
        const user = userEvent.setup();
        mockedHolyFetch.mockResolvedValue([
            { contentId: 'holy-keyboard', title: '키보드 성지', contentTypeId: 'HOLY' },
        ]);
        renderScreen();
        await user.click(await screen.findByRole('button', { name: '성지' }));

        const trigger = await screen.findByRole('button', { name: '키보드 성지 상세 보기' });
        trigger.focus();
        await user.keyboard('{Enter}');

        expect(await screen.findByRole('dialog', { name: '키보드 성지' })).toBeInTheDocument();
        const closeButton = screen.getByRole('button', { name: '닫기' });
        await waitFor(() => expect(closeButton).toHaveFocus());

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('button', { name: '키보드 성지 저장' })).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await waitFor(() => expect(trigger).toHaveFocus());
    });
});
