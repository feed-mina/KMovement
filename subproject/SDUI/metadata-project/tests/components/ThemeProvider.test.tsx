/**
 * ThemeProvider — DB design_tokens를 :root CSS 변수로 주입 (issue #4 Phase 3~4)
 */
import { render, waitFor, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

function renderWithQuery(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
}

describe("ThemeProvider", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        document.documentElement.removeAttribute("style");
    });

    it("테마 API 성공 시 --kride-* CSS 변수를 :root에 주입한다", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: "success",
                data: {
                    themeId: "KRIDE_DEFAULT",
                    tokens: [
                        { category: "color", key: "primary", value: "#E50914" },
                        { category: "color", key: "bg-cream", value: "#FDFBF7" },
                    ],
                },
                message: null,
            }),
        }) as jest.Mock;

        renderWithQuery(
            <ThemeProvider>
                <div>content</div>
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(
                document.documentElement.style.getPropertyValue("--kride-primary")
            ).toBe("#E50914");
        });
        expect(
            document.documentElement.style.getPropertyValue("--kride-bg-cream")
        ).toBe("#FDFBF7");
        expect(global.fetch).toHaveBeenCalledWith("/api/ui/theme/KRIDE_DEFAULT");
    });

    it("테마 API 실패 시에도 children은 정상 렌더링된다 (tokens.css 폴백)", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
        }) as jest.Mock;

        renderWithQuery(
            <ThemeProvider>
                <div>fallback content</div>
            </ThemeProvider>
        );

        expect(screen.getByText("fallback content")).toBeInTheDocument();
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
        // 인라인 변수가 주입되지 않아 tokens.css 정적 값이 그대로 적용됨
        expect(
            document.documentElement.style.getPropertyValue("--kride-primary")
        ).toBe("");
    });

    it("themeId prop으로 다른 테마를 조회할 수 있다", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: "success",
                data: { themeId: "DARK", tokens: [] },
                message: null,
            }),
        }) as jest.Mock;

        renderWithQuery(
            <ThemeProvider themeId="DARK">
                <div>dark</div>
            </ThemeProvider>
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/ui/theme/DARK");
        });
    });
});
