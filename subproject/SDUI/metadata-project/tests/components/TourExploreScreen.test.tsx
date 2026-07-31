import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TourExploreScreen from '@/components/plugins/travel/TourExploreScreen';
import { fetchHolyContents, fetchHolyPois, fetchTourAreas, fetchTourDistricts, fetchTourPois } from '@/services/tourApi';
import { HOLY_SITES } from '@/lib/data/holySites';

jest.mock('@/services/tourApi', () => ({
    __esModule: true,
    fetchTourPois: jest.fn(),
    fetchHolyPois: jest.fn(),
    fetchHolyContents: jest.fn(),
    fetchTourAreas: jest.fn(),
    fetchTourDistricts: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { socialType: 'K' }, isLoggedIn: true }) }));

// 진입 URL의 ?area= 를 테스트마다 갈아끼운다.
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParams,
}));

const mockedFetch = fetchTourPois as jest.Mock;
const mockedHolyFetch = fetchHolyPois as jest.Mock;
const mockedContentFetch = fetchHolyContents as jest.Mock;
const mockedAreaFetch = fetchTourAreas as jest.Mock;
const mockedDistrictFetch = fetchTourDistricts as jest.Mock;

const sample = [
    { contentId: '1', title: '가나돈까스의집', addr: '서울 강남구', firstImage: 'http://img/a.jpg', mapX: 127, mapY: 37.5, recommendReason: '근처 공연장과 함께 들르기 좋아요.' },
    { contentId: '2', title: '가담', addr: '서울 강남구', firstImage: '', mapX: 127.03, mapY: 37.52 },
];

describe('TourExploreScreen — [탐색] TourAPI 카드', () => {
    beforeEach(() => {
        mockSearchParams = new URLSearchParams();
        mockedFetch.mockReset();
        mockedFetch.mockResolvedValue(sample);
        mockedHolyFetch.mockReset();
        mockedHolyFetch.mockResolvedValue(HOLY_SITES);
        mockedContentFetch.mockReset();
        mockedContentFetch.mockResolvedValue([
            { contentSqno: 77, name: '김비서가 왜 그럴까', category: 'drama', poiCount: 12 },
        ]);
        mockedAreaFetch.mockReset();
        mockedAreaFetch.mockResolvedValue([
            { code: '1', name: '서울' },
            { code: '31', name: '경기도' },
            { code: '32', name: '강원특별자치도' },
        ]);
        mockedDistrictFetch.mockReset();
        mockedDistrictFetch.mockImplementation((areaCode: string) => Promise.resolve(
            areaCode === '31'
                ? [{ code: '13', name: '수원시' }, { code: '17', name: '안양시' }]
                : [{ code: '1', name: '강남구' }, { code: '23', name: '종로구' }],
        ));
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

    it('카드와 상세 모달에서 같은 대표 이미지와 대체 텍스트를 사용한다', async () => {
        renderScreen();
        const cardImage = await screen.findByAltText('가나돈까스의집') as HTMLImageElement;
        fireEvent.click(screen.getByRole('button', { name: '가나돈까스의집 상세 보기' }));

        const images = await screen.findAllByAltText('가나돈까스의집') as HTMLImageElement[];
        expect(images).toHaveLength(2);
        expect(images[0].src).toBe(cardImage.src);
        expect(images[1].src).toBe(cardImage.src);
    });

    it('동일한 추천 이유를 카드와 상세 모달에서 함께 사용하고 없는 카드는 영역을 생략한다', async () => {
        renderScreen();

        expect(await screen.findByText('근처 공연장과 함께 들르기 좋아요.')).toBeInTheDocument();
        expect(screen.getAllByTestId('tour-poi-recommend-reason')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', {name: '가나돈까스의집 상세 보기'}));
        expect(await screen.findByText('왜 추천하나요?')).toBeInTheDocument();
        expect(screen.getAllByText('근처 공연장과 함께 들르기 좋아요.')).toHaveLength(2);
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

    it('시·도 변경 시 하위 목록을 바꾸고 이전 시·군·구 선택을 초기화한다', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: '종로구' }));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1', sigunguCode: '23' })));

        fireEvent.click(screen.getByRole('button', { name: '경기도' }));

        expect(await screen.findByRole('button', { name: '경기도 전체' })).toHaveAttribute('aria-pressed', 'true');
        expect(await screen.findByRole('button', { name: '수원시' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '종로구' })).not.toBeInTheDocument();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '31', sigunguCode: '' })));
    });

    it('지역 필터 이동 버튼으로 칩 레일을 부드럽게 스크롤하고 끝 지점을 표시한다', async () => {
        renderScreen();
        const rail = screen.getByRole('group', { name: '시·도 선택' });
        const scrollBy = jest.fn();
        Object.defineProperties(rail, {
            clientWidth: { configurable: true, value: 300 },
            scrollWidth: { configurable: true, value: 900 },
            scrollLeft: { configurable: true, value: 0, writable: true },
            scrollBy: { configurable: true, value: scrollBy },
        });

        fireEvent.scroll(rail);
        const nextButton = screen.getByRole('button', { name: '시·도 선택 다음 항목' });
        await waitFor(() => expect(nextButton).toBeEnabled());
        fireEvent.click(nextButton);
        expect(scrollBy).toHaveBeenCalledWith({ left: 220, behavior: 'smooth' });

        Object.defineProperty(rail, 'scrollLeft', { configurable: true, value: 600 });
        fireEvent.scroll(rail);
        await waitFor(() => expect(nextButton).toBeDisabled());
        expect(screen.getByRole('button', { name: '시·도 선택 이전 항목' })).toBeEnabled();
    });

    it('시·도 전체와 시·군·구 선택을 같은 지역 코드 계약으로 조회한다', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: '경기도' }));
        fireEvent.click(await screen.findByRole('button', { name: '수원시' }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '31', sigunguCode: '13' })));
        fireEvent.click(screen.getByRole('button', { name: '성지' }));
        // 전국 시드(V90)는 시·군·구 코드가 없어 주소 매칭용 이름도 함께 보낸다.
        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalledWith(
            { areaCode: '31', sigunguCode: '13', sigunguName: '수원시' }));
    });

    it('?area= 로 들어오면 해당 시·도로 열린다', async () => {
        // 맛집 랜딩(/travel/food/busan)의 "부산 탐색하기" 진입 경로.
        mockSearchParams = new URLSearchParams('area=6');
        renderScreen();

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '6' })));
        // 시·군·구 목록도 같은 지역으로 따라간다.
        await waitFor(() => expect(mockedDistrictFetch).toHaveBeenCalledWith('6'));
        expect(mockedFetch).not.toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1' }));
    });

    it('?area= 가 없거나 모르는 코드면 기본 지역으로 연다', async () => {
        mockSearchParams = new URLSearchParams('area=9999');
        const { unmount } = renderScreen();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1' })));
        unmount();

        mockedFetch.mockClear();
        mockSearchParams = new URLSearchParams();
        renderScreen();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '1' })));
    });

    it('?area= 로 열어도 이후 칩 선택이 URL에 묶이지 않는다', async () => {
        mockSearchParams = new URLSearchParams('area=6');
        renderScreen();
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '6' })));

        fireEvent.click(await screen.findByRole('button', { name: '경기도' }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({ areaCode: '31' })));
    });

    it('성지 맛집 칩은 kind=FOOD로 조회하고 작품 필터를 함께 쓸 수 있다', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: '성지 맛집' }));

        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'FOOD' })));
        // 성지 계열이므로 작품 검색 입력이 함께 제공된다.
        expect(screen.getByLabelText('작품·아티스트로 성지 찾기')).toBeInTheDocument();
        // 제보 배너는 일반 성지 칩 전용이다.
        expect(screen.queryByText('새로운 팬 성지를 알고 있나요?')).not.toBeInTheDocument();
    });

    it('작품 검색에서 선택하면 contentSqno로 성지를 거르고 칩 해제 시 전체로 돌아간다', async () => {
        renderScreen();
        fireEvent.click(await screen.findByRole('button', { name: '성지' }));
        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalled());

        fireEvent.change(screen.getByLabelText('작품·아티스트로 성지 찾기'), { target: { value: '김비서' } });
        await waitFor(() => expect(mockedContentFetch).toHaveBeenCalledWith({ q: '김비서', limit: 8 }));

        fireEvent.click(await screen.findByRole('button', { name: /김비서가 왜 그럴까/ }));
        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalledWith(
            expect.objectContaining({ contentSqno: 77 })));
        expect(screen.getByText(/김비서가 왜 그럴까 · 드라마/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '김비서가 왜 그럴까 필터 해제' }));
        await waitFor(() => expect(mockedHolyFetch).toHaveBeenCalledWith(
            expect.objectContaining({ contentSqno: undefined })));
    });

    it('지역 카탈로그가 실패하면 전국 시/도 기본값과 전체 선택을 안전하게 제공한다', async () => {
        mockedAreaFetch.mockRejectedValueOnce(new Error('network'));
        mockedDistrictFetch.mockRejectedValueOnce(new Error('network'));

        renderScreen();

        expect(await screen.findByRole('button', { name: '서울' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '서울 전체' })).toHaveAttribute('aria-pressed', 'true');
        // 폴백이 서울로 쪼그라들지 않고 전국 시/도를 제공해야 한다.
        expect(screen.getByRole('button', { name: '부산' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '제주' })).toBeInTheDocument();
        expect(await screen.findByRole('status')).toHaveTextContent(/지역 전체로 탐색/);
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

        const dialog = await screen.findByRole('dialog', { name: '키보드 성지' });
        expect(dialog).toBeInTheDocument();
        const closeButton = screen.getByRole('button', { name: '닫기' });
        await waitFor(() => expect(closeButton).toHaveFocus());

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(within(dialog).getByRole('button', { name: '키보드 성지 저장' })).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await waitFor(() => expect(trigger).toHaveFocus());
    });
});
