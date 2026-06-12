"use client";

// 2026-06-12 THEME_SETTINGS 관리 화면 (GitHub issue #4 Phase 4)
// design_tokens 값을 컬러피커/텍스트로 수정 → 즉시 미리보기(:root 주입)
// → 저장 시 PUT /api/ui/theme/{themeId} (관리자 전용) → Redis evict → 전 화면 반영
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const THEME_ID = "KRIDE_DEFAULT";
const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const CATEGORY_LABELS: Record<string, string> = {
    color: "색상",
    spacing: "간격",
    radius: "라운드",
    shadow: "그림자",
    size: "크기",
};

interface ThemeToken {
    category: string;
    key: string;
    value: string;
}

async function fetchTheme(themeId: string): Promise<ThemeToken[]> {
    const res = await fetch(`/api/ui/theme/${themeId}`);
    if (!res.ok) throw new Error(`테마 조회 실패: ${res.status}`);
    const json = await res.json();
    if (json.status !== "success" || !json.data) {
        throw new Error(json.message ?? "테마 응답이 올바르지 않습니다");
    }
    return json.data.tokens;
}

function applyToRoot(key: string, value: string) {
    document.documentElement.style.setProperty(`--kride-${key}`, value);
}

export default function ThemeSettingsEditor({ id }: any) {
    const queryClient = useQueryClient();
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ThemeProvider와 동일한 queryKey → 캐시 공유
    const { data: tokens, isLoading, isError } = useQuery({
        queryKey: ["theme", THEME_ID],
        queryFn: () => fetchTheme(THEME_ID),
        staleTime: 1000 * 60 * 60,
        retry: 1,
    });

    if (isLoading) return <div className="theme-settings-status">테마 토큰을 불러오는 중...</div>;
    if (isError || !tokens) return <div className="theme-settings-status">테마 토큰을 불러오지 못했습니다.</div>;

    const currentValue = (token: ThemeToken) => edits[token.key] ?? token.value;
    const dirtyKeys = Object.keys(edits).filter(
        (key) => tokens.some((t) => t.key === key && t.value !== edits[key])
    );

    const handleChange = (key: string, value: string) => {
        setEdits((prev) => ({ ...prev, [key]: value }));
        applyToRoot(key, value); // 즉시 미리보기
        setMessage(null);
    };

    const handleReset = () => {
        // 편집 전 서버 값으로 미리보기 원복
        tokens.forEach((t) => applyToRoot(t.key, t.value));
        setEdits({});
        setMessage(null);
    };

    const handleSave = async () => {
        if (dirtyKeys.length === 0) return;
        setSaving(true);
        setMessage(null);
        try {
            const body = Object.fromEntries(dirtyKeys.map((key) => [key, edits[key]]));
            const res = await fetch(`/api/ui/theme/${THEME_ID}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.status === 401 || res.status === 403) {
                throw new Error("관리자 권한이 필요합니다. 관리자 계정으로 로그인해주세요.");
            }
            if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
            const json = await res.json();
            if (json.status !== "success") throw new Error(json.message ?? "저장에 실패했습니다");

            // 캐시 갱신 → ThemeProvider가 새 값 재주입, 다른 탭/기기는 다음 로드에 반영
            await queryClient.invalidateQueries({ queryKey: ["theme", THEME_ID] });
            setEdits({});
            setMessage({ type: "success", text: `토큰 ${dirtyKeys.length}건이 저장되었습니다. 전체 화면에 적용됩니다.` });
        } catch (e: any) {
            setMessage({ type: "error", text: e?.message ?? "저장 중 오류가 발생했습니다" });
        } finally {
            setSaving(false);
        }
    };

    const categories = Array.from(new Set(tokens.map((t) => t.category)));

    return (
        <div id={id} className="theme-settings-editor">
            {categories.map((category) => (
                <section key={category} className="theme-settings-section">
                    <h3 className="theme-settings-section-title">
                        {CATEGORY_LABELS[category] ?? category}
                    </h3>
                    <div className="theme-settings-grid">
                        {tokens
                            .filter((t) => t.category === category)
                            .map((token) => {
                                const value = currentValue(token);
                                const isHex = HEX_COLOR_RE.test(value.trim());
                                const isDirty = edits[token.key] !== undefined && edits[token.key] !== token.value;
                                return (
                                    <label key={token.key} className={`theme-token-row ${isDirty ? "is-dirty" : ""}`}>
                                        <span className="theme-token-key">--kride-{token.key}</span>
                                        <span className="theme-token-inputs">
                                            {isHex && (
                                                <input
                                                    type="color"
                                                    className="theme-token-color"
                                                    value={value.trim()}
                                                    onChange={(e) => handleChange(token.key, e.target.value)}
                                                />
                                            )}
                                            <input
                                                type="text"
                                                className="theme-token-text"
                                                value={value}
                                                onChange={(e) => handleChange(token.key, e.target.value)}
                                            />
                                        </span>
                                    </label>
                                );
                            })}
                    </div>
                </section>
            ))}

            <div className="theme-settings-actions">
                <button
                    type="button"
                    className="theme-settings-reset"
                    onClick={handleReset}
                    disabled={saving || Object.keys(edits).length === 0}
                >
                    되돌리기
                </button>
                <button
                    type="button"
                    className="theme-settings-save"
                    onClick={handleSave}
                    disabled={saving || dirtyKeys.length === 0}
                >
                    {saving ? "저장 중..." : `저장 (${dirtyKeys.length}건)`}
                </button>
            </div>

            {message && (
                <p className={`theme-settings-message ${message.type}`}>{message.text}</p>
            )}
        </div>
    );
}
