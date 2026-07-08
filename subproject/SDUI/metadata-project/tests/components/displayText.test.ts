import { normalizeDisplayText } from '@/components/utils/displayText';

describe('normalizeDisplayText', () => {
    it('removes the no-materials phrase from search analysis copy', () => {
        expect(
            normalizeDisplayText('입력 완료 — 자료/회의록이 없어도 기대 산출물 기준으로 검색형 AI 분석을 시작합니다')
        ).toBe('입력 완료 — 기대 산출물 기준으로 검색형 AI 분석을 시작합니다');
    });

    it('uses provider-neutral wording for social login analysis copy', () => {
        expect(
            normalizeDisplayText('Google/Kakao 로그인에서는 기대 산출물과 의사결정 기준만 입력해 검색형 분석을 진행합니다.')
        ).toBe('소셜 로그인에서는 기대 산출물과 의사결정 기준만 입력해 검색형 분석을 진행합니다.');
    });
});
