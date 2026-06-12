/**
 * ThemeSettingsEditor — THEME_SETTINGS 관리 화면 (issue #4 Phase 4)
 * 토큰 조회 → 수정(즉시 미리보기) → 저장(PUT) → 캐시 무효화
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ThemeSettingsEditor from "@/components/fields/theme/ThemeSettingsEditor";

const MOCK_TOKENS = {
    status: "success",
    data: {
        themeId: "KRIDE_DEFAULT",
        tokens: [
            { category: "color", key: "primary", value: "#E50914" },
            { category: "spacing", key: "space-4", value: "16px" },
        ],
    },
    message: null,
};

function renderEditor() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeSettingsEditor id="theme_editor" />
        </QueryClientProvider>
    );
}

describe("ThemeSettingsEditor", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        document.documentElement.removeAttribute("style");
    });

    it("토큰 목록을 카테고리별로 렌더링한다 (hex값은 컬러피커 포함)", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => MOCK_TOKENS,
        }) as jest.Mock;

        renderEditor();

        expect(await screen.findByText("--kride-primary")).toBeInTheDocument();
        expect(screen.getByText("--kride-space-4")).toBeInTheDocument();
        expect(screen.getByText("색상")).toBeInTheDocument();
        expect(screen.getByText("간격")).toBeInTheDocument();
        // hex 토큰은 텍스트 입력 + 컬러피커 둘 다, 비-hex는 텍스트만
        expect(screen.getByDisplayValue("16px")).toBeInTheDocument();
        const colorInputs = document.querySelectorAll('input[type="color"]');
        expect(colorInputs).toHaveLength(1);
    });

    it("값 수정 시 :root에 즉시 미리보기 반영 + 저장 버튼 활성화", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => MOCK_TOKENS,
        }) as jest.Mock;

        renderEditor();
        await screen.findByText("--kride-primary");

        const textInput = screen.getByDisplayValue("#E50914");
        fireEvent.change(textInput, { target: { value: "#FF5500" } });

        expect(
            document.documentElement.style.getPropertyValue("--kride-primary")
        ).toBe("#FF5500");
        expect(screen.getByText("저장 (1건)")).toBeEnabled();
    });

    it("저장 시 변경분만 PUT으로 전송하고 성공 메시지를 보여준다", async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => MOCK_TOKENS,
        });
        global.fetch = fetchMock as jest.Mock;

        renderEditor();
        await screen.findByText("--kride-primary");

        fireEvent.change(screen.getByDisplayValue("#E50914"), {
            target: { value: "#FF5500" },
        });
        fireEvent.click(screen.getByText("저장 (1건)"));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/ui/theme/KRIDE_DEFAULT",
                expect.objectContaining({
                    method: "PUT",
                    body: JSON.stringify({ primary: "#FF5500" }),
                })
            );
        });
        expect(await screen.findByText(/저장되었습니다/)).toBeInTheDocument();
    });

    it("권한 없음(403) 응답이면 관리자 안내 에러를 보여준다", async () => {
        const fetchMock = jest
            .fn()
            // 첫 호출: GET 토큰 목록 성공
            .mockResolvedValueOnce({ ok: true, json: async () => MOCK_TOKENS })
            // 둘째 호출: PUT 403
            .mockResolvedValueOnce({ ok: false, status: 403 });
        global.fetch = fetchMock as jest.Mock;

        renderEditor();
        await screen.findByText("--kride-primary");

        fireEvent.change(screen.getByDisplayValue("#E50914"), {
            target: { value: "#FF5500" },
        });
        fireEvent.click(screen.getByText("저장 (1건)"));

        expect(await screen.findByText(/관리자 권한이 필요합니다/)).toBeInTheDocument();
    });

    it("되돌리기 클릭 시 서버 값으로 미리보기를 원복한다", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => MOCK_TOKENS,
        }) as jest.Mock;

        renderEditor();
        await screen.findByText("--kride-primary");

        fireEvent.change(screen.getByDisplayValue("#E50914"), {
            target: { value: "#FF5500" },
        });
        fireEvent.click(screen.getByText("되돌리기"));

        expect(
            document.documentElement.style.getPropertyValue("--kride-primary")
        ).toBe("#E50914");
        expect(screen.getByDisplayValue("#E50914")).toBeInTheDocument();
    });
});
