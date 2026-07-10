import { fetchTourPois, fetchRestaurants } from '@/services/tourApi';
import api from '@/services/axios';

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: { get: jest.fn() },
}));

const mockedApi = api as unknown as { get: jest.Mock };

describe('tourApi 서비스', () => {
    beforeEach(() => mockedApi.get.mockReset());

    it('fetchTourPois는 ApiResponse.data를 언랩해야 함', async () => {
        mockedApi.get.mockResolvedValue({ data: { data: [{ title: 'A' }] } });
        const result = await fetchTourPois({ areaCode: '1', contentTypeId: '39' });
        expect(mockedApi.get).toHaveBeenCalledWith('/api/v1/tour/poi', {
            params: { areaCode: '1', contentTypeId: '39' },
        });
        expect(result).toEqual([{ title: 'A' }]);
    });

    it('data가 없으면 빈 배열을 반환해야 함', async () => {
        mockedApi.get.mockResolvedValue({ data: {} });
        expect(await fetchTourPois()).toEqual([]);
    });

    it('fetchRestaurants는 맛집 엔드포인트를 호출해야 함', async () => {
        mockedApi.get.mockResolvedValue({ data: { data: [] } });
        await fetchRestaurants('1', 10);
        expect(mockedApi.get).toHaveBeenCalledWith('/api/v1/tour/restaurants', {
            params: { areaCode: '1', numOfRows: 10 },
        });
    });
});
