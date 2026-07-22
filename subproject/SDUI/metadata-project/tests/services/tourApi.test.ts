import {
    fetchHolyPois,
    fetchRestaurants,
    fetchTourAreas,
    fetchTourDistricts,
    fetchTourPois,
} from '@/services/tourApi';
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

    it('시·도와 시·군·구 카탈로그를 같은 지역 엔드포인트에서 조회한다', async () => {
        mockedApi.get.mockResolvedValue({ data: { data: [{ code: '1', name: '서울' }] } });

        expect(await fetchTourAreas()).toEqual([{ code: '1', name: '서울' }]);
        expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/api/v1/tour/areas');

        await fetchTourDistricts('31');
        expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/api/v1/tour/areas', {
            params: { areaCode: '31' },
        });
    });

    it('성지 조회에도 선택한 시·도와 시·군·구 코드를 전달한다', async () => {
        mockedApi.get.mockResolvedValue({ data: { data: [] } });

        await fetchHolyPois({ areaCode: '1', sigunguCode: '23' });

        expect(mockedApi.get).toHaveBeenCalledWith('/api/v1/tour/holy', {
            params: { areaCode: '1', sigunguCode: '23' },
        });
    });
});
