import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MetadataProvider } from "@/components/providers/MetadataProvider";
import DynamicEngine from "@/components/DynamicEngine/DynamicEngine";
import { renderWithProviders, getRenderCount, resetRenderCounts } from "@/tests/test-utils";
import { logTestSuccess } from "@/tests/TestLogger";
import MAIN_PAGE from "@/tests/mocks/MAIN_PAGE.json";
import LOGIN_PAGE from "@/tests/mocks/LOGIN_PAGE.json";
import CONTENT_LIST from "@/tests/mocks/CONTENT_LIST.json";
import SET_TIME_PAGE from "@/tests/mocks/SET_TIME_PAGE.json";
import CONTENT_WRITE from "@/tests/mocks/CONTENT_WRITE.json";
import { Metadata } from "@/components/DynamicEngine";


// 1. 테스트할 모든 화면 데이터 정의 (서버 응답 규격인 menuTree 형태) [cite: 2026-02-20]
const allMockData: Record<string, any> = { MAIN_PAGE, LOGIN_PAGE, CONTENT_LIST, SET_TIME_PAGE, CONTENT_WRITE };

// @@@@  화면별 필요한 가짜 비즈니스 데이터 정의
const mockPageData: Record<string, any> = {
    CONTENT_LIST: { content_list_source: [] },
    MAIN_PAGE: {},
    LOGIN_PAGE: {},
    SET_TIME_PAGE: {},
    CONTENT_WRITE: {}
};

// 2. 동적 MSW 서버 설정
const server = setupServer(
    http.get('http://localhost/api/auth/me', () => HttpResponse.json({ isLoggedIn: false, role: 'GUEST' })),
    http.post('http://localhost/api/auth/refresh', () => HttpResponse.json({ accessToken: 'test-access-token' })),
    http.get('/api/ui/:screenId', ({params}) => {
        const {screenId} = params;
        const data = allMockData[screenId as string];
        if (!data) return new HttpResponse(null, {status: 404});
        // 서버 응답 규격에 맞춰 data.data(순수 배열) 전달
        return HttpResponse.json({ success: true, data: { screenId, children: data.data } });
    })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SDUI 모든 화면 유동적 최적화 검증', () => {
    beforeEach(() => {
        resetRenderCounts();
    });
    //   테스트 실행 전 시간을 충분히 확보 (10초)
    jest.setTimeout(10000);
    // @@@@ 핵심: 데이터셋의 키 값들을 순회하며 테스트 실행 [cite: 2026-02-20]
    test.each(Object.keys(allMockData))('%s 화면 렌더링 및 정렬 상태 확인', async (screenId) => {
        renderWithProviders(
            <MetadataProvider screenId={screenId}>
                <DynamicEngine
                    //  JSON 객체 전체가 아닌 내부의 data 배열만 전달
                    metadata={allMockData[screenId].data}
                    screenId={screenId}
                    // 2. 인터페이스 규격에 맞춰 필수 프롭 추가
                    pageData={allMockData[screenId] || {}}
                    formData={{}}
                    onChange={jest.fn()}
                    onAction={jest.fn()}
                />
            </MetadataProvider>
        );

        // 2. 비동기 렌더링 완료 대기
        await waitFor(() => {
            // 이제 jest-dom이 로드되어 toBeInTheDocument를 쓸 수 있음
            expect(screen.queryByText(/DATA_SOURCE/)).not.toBeInTheDocument();
        });


        // 3. 입력창이 있다면 글자를 입력해 본다
        const textboxes = screen.queryAllByRole('textbox');
        if (textboxes.length > 0) {
            fireEvent.change(textboxes[0], { target: { value: 'optimization_test' } });
        }

        // 4. 성능 지표 분석 (최적화 여부)
        const engineRenderCount = getRenderCount(`DynamicEngine (Screen: ${screenId})`);

        // React 19에서 초기 마운트 + Provider 반영 + device 상태 반영까지 최대 3회 허용한다.
        // 4회 이상은 상태 루프나 불필요한 부모 갱신 회귀로 간주한다.
        expect(engineRenderCount).toBeGreaterThan(0);
        expect(engineRenderCount).toBeLessThanOrEqual(3);

        // 5. 성공 로그 기록 (전체 요약 리포트에 포함됨) [cite: 2026-02-20]
        logTestSuccess(`${screenId} - 최적화 통과 (Render Count: ${engineRenderCount})`);
    }, 10000);
});
