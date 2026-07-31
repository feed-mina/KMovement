import { toUserMessage } from '@/components/DynamicEngine/hook/useKrideItinerary';

/**
 * FOCUS 첫 진입에서 "signal is aborted without reason" 이 그대로 노출됐다.
 * 브라우저 예외 문구는 무슨 일이 일어났는지 알려주지 못한다.
 */
describe('toUserMessage', () => {
    it('중단된 요청을 사람이 읽을 수 있는 문구로 바꾼다', () => {
        const abortError = new Error('signal is aborted without reason');
        abortError.name = 'AbortError';

        expect(toUserMessage(abortError)).toBe('추천 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.');
        // 문구가 브라우저마다 달라도 name 이나 문구 중 하나로 잡힌다.
        expect(toUserMessage(new Error('The operation was aborted.')))
            .toBe('추천 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.');
    });

    it('네트워크 실패도 같은 안내로 묶는다', () => {
        expect(toUserMessage(new TypeError('Failed to fetch')))
            .toBe('추천 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.');
    });

    it('결과가 비었을 때는 조건을 바꾸라고 안내한다', () => {
        expect(toUserMessage(new Error('empty_result')))
            .toBe('조건에 맞는 코스를 찾지 못했어요. 지역이나 기간을 바꿔 보세요.');
    });

    it('서버 오류와 그 외를 구분한다', () => {
        expect(toUserMessage(new Error('FastAPI 응답 오류: 502')))
            .toBe('추천 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
        expect(toUserMessage(new Error('something else')))
            .toBe('코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
        expect(toUserMessage(undefined))
            .toBe('코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    });
});
