import { formatKoreanPhoneNumber, isValidKoreanMobileNumber } from '@/lib/formatters/phone';

describe('Korean phone formatter', () => {
    it('숫자를 입력하는 동안 3-4-4 형식으로 자동 변환한다', () => {
        expect(formatKoreanPhoneNumber('010')).toBe('010');
        expect(formatKoreanPhoneNumber('0101234')).toBe('010-1234');
        expect(formatKoreanPhoneNumber('01012345678')).toBe('010-1234-5678');
        expect(formatKoreanPhoneNumber('010-1234-56789')).toBe('010-1234-5678');
    });

    it('완성된 국내 휴대폰 번호만 유효하게 판단한다', () => {
        expect(isValidKoreanMobileNumber('01012345678')).toBe(true);
        expect(isValidKoreanMobileNumber('0201234567')).toBe(false);
        expect(isValidKoreanMobileNumber('0101234')).toBe(false);
    });
});
