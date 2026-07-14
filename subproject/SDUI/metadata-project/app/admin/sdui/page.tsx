'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';

type ApiEnvelope<T> = {
    status: string;
    data: T;
    message?: string | null;
};

type SduiScreenSummary = {
    screenId: string;
    componentCount: number;
    firstLabelText?: string | null;
    lastCreatedAt?: string | null;
    componentTypes: string[];
    dataSqlKeys: string[];
};

type SduiScreenComponent = {
    uiId: number;
    componentId?: string | null;
    labelText?: string | null;
    componentType?: string | null;
    sortOrder?: number | null;
    actionType?: string | null;
    actionUrl?: string | null;
    dataSqlKey?: string | null;
    dataApiUrl?: string | null;
    groupId?: string | null;
    parentGroupId?: string | null;
    isVisible?: string | null;
    allowedRoles?: string | null;
    componentProps?: string | null;
};

type SduiScreenDetail = {
    screenId: string;
    components: SduiScreenComponent[];
};

type SduiThemeSummary = {
    themeId: string;
    tokenCount: number;
    lastUpdatedAt?: string | null;
    categories: string[];
};

type SduiQueryMaster = {
    sqlKey: string;
    returnType?: string | null;
    requiredRole?: string | null;
    description?: string | null;
    queryText?: string | null;
    updatedAt?: string | null;
};

type TabId = 'screens' | 'themes' | 'queries';

const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'screens', label: '화면 관리' },
    { id: 'themes', label: '디자인 설정' },
    { id: 'queries', label: '데이터 연결' },
];

const componentTypeLabels: Record<string, string> = {
    TEXT: '안내 문구',
    INPUT: '입력 칸',
    PASSWORD: '비밀번호 입력',
    BUTTON: '버튼',
    GROUP: '영역 묶음',
    DATA_SOURCE: '데이터 불러오기',
    STAT_CARD: '현황 카드',
    CHART: '차트',
    ADMIN_USER_TABLE: '회원 목록',
};

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data;
    }
    return payload as T;
}

function formatDate(value?: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function matchesSearch(values: Array<string | null | undefined>, query: string) {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return values.some((value) => (value || '').toLowerCase().includes(needle));
}

function joinList(values?: string[]) {
    return values && values.length > 0 ? values.join(', ') : '-';
}

function screenName(screen: SduiScreenSummary | string, fallback?: string | null) {
    const id = typeof screen === 'string' ? screen : screen.screenId;
    const label = typeof screen === 'string' ? fallback : screen.firstLabelText;
    if (id === 'ADMIN_DASHBOARD') return '운영 현황 대시보드';
    if (id === 'MAIN_PAGE') return '메인 화면';
    if (id === 'LOGIN_PAGE') return '로그인 화면';
    return label?.trim() || id.replace(/_/g, ' ').replace(/\bPAGE\b/gi, '화면');
}

function componentTypeName(value?: string | null) {
    if (!value) return '설정 없음';
    return componentTypeLabels[value] || value.replace(/_/g, ' ');
}

export default function SduiAdminPage() {
    const { user, isLoggedIn, isLoading } = useAuth();
    const isAdmin = user?.role === 'ROLE_ADMIN';

    const [activeTab, setActiveTab] = useState<TabId>('screens');
    const [search, setSearch] = useState('');
    const [screens, setScreens] = useState<SduiScreenSummary[]>([]);
    const [themes, setThemes] = useState<SduiThemeSummary[]>([]);
    const [queries, setQueries] = useState<SduiQueryMaster[]>([]);
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [screenDetail, setScreenDetail] = useState<SduiScreenDetail | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState('');

    const loadInventory = useCallback(async () => {
        if (!isLoggedIn || !isAdmin) return;

        setIsFetching(true);
        setError(null);
        try {
            const [screenRes, themeRes, queryRes] = await Promise.all([
                api.get<ApiEnvelope<SduiScreenSummary[]> | SduiScreenSummary[]>('/api/admin/sdui/screens'),
                api.get<ApiEnvelope<SduiThemeSummary[]> | SduiThemeSummary[]>('/api/admin/sdui/themes'),
                api.get<ApiEnvelope<SduiQueryMaster[]> | SduiQueryMaster[]>('/api/admin/sdui/query-master'),
            ]);

            const nextScreens = unwrap<SduiScreenSummary[]>(screenRes.data) || [];
            setScreens(nextScreens);
            setThemes(unwrap<SduiThemeSummary[]>(themeRes.data) || []);
            setQueries(unwrap<SduiQueryMaster[]>(queryRes.data) || []);
            setSelectedScreenId((current) => current || nextScreens[0]?.screenId || null);
        } catch {
            setError('화면 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsFetching(false);
        }
    }, [isAdmin, isLoggedIn]);

    useEffect(() => {
        void loadInventory();
    }, [loadInventory]);

    useEffect(() => {
        if (!isLoggedIn || !isAdmin || !selectedScreenId) {
            setScreenDetail(null);
            return;
        }

        let ignore = false;
        setDetailLoading(true);
        setCopyStatus('');
        api.get<ApiEnvelope<SduiScreenDetail> | SduiScreenDetail>(`/api/admin/sdui/screens/${encodeURIComponent(selectedScreenId)}`)
            .then((res) => {
                if (!ignore) setScreenDetail(unwrap<SduiScreenDetail>(res.data));
            })
            .catch(() => {
                if (!ignore) setScreenDetail(null);
            })
            .finally(() => {
                if (!ignore) setDetailLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, [isAdmin, isLoggedIn, selectedScreenId]);

    const filteredScreens = useMemo(
        () => screens.filter((screen) => matchesSearch([
            screen.screenId,
            screen.firstLabelText,
            ...screen.componentTypes,
            ...screen.dataSqlKeys,
        ], search)),
        [screens, search],
    );

    const filteredThemes = useMemo(
        () => themes.filter((theme) => matchesSearch([
            theme.themeId,
            ...theme.categories,
        ], search)),
        [themes, search],
    );

    const filteredQueries = useMemo(
        () => queries.filter((query) => matchesSearch([
            query.sqlKey,
            query.returnType,
            query.requiredRole,
            query.description,
            query.queryText,
        ], search)),
        [queries, search],
    );

    const totalComponents = useMemo(
        () => screens.reduce((sum, screen) => sum + screen.componentCount, 0),
        [screens],
    );

    const selectedPreviewHref = selectedScreenId
        ? `/view/${encodeURIComponent(selectedScreenId)}`
        : '#';

    const copyScreenMetadata = useCallback(async () => {
        if (!screenDetail) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(screenDetail, null, 2));
            setCopyStatus('기술 설정을 복사했습니다.');
        } catch {
            setCopyStatus('복사하지 못했습니다. 다시 시도해 주세요.');
        }
    }, [screenDetail]);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] px-6 py-10">
                <div className="h-2 w-48 rounded bg-gray-200" />
                <div className="mt-6 h-36 rounded-lg border border-gray-200 bg-white" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="min-h-[60vh] px-6 py-10">
                <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-semibold text-gray-950">로그인이 필요합니다</h1>
                    <div className="mt-5">
                        <Link className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white" href="/view/LOGIN_PAGE">
                            로그인하기
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-[60vh] px-6 py-10">
                <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-semibold text-gray-950">관리자 권한이 필요합니다</h1>
                    <p className="mt-3 text-sm text-gray-600">현재 계정에는 이 메뉴를 볼 권한이 없습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 md:px-8 md:py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <div className="rounded-2xl bg-gradient-to-r from-sky-700 to-blue-700 px-5 py-6 text-white shadow-lg md:flex md:items-end md:justify-between md:px-8">
                    <div>
                        <p className="text-xs font-bold tracking-[0.18em] text-sky-100">KMOVEMENT 운영 관리</p>
                        <h1 className="mt-2 text-3xl font-bold leading-tight">홈페이지 운영 센터</h1>
                        <p className="mt-2 max-w-2xl text-sm text-sky-50">화면 구성, 디자인, 데이터 연결 상태를 한 곳에서 확인합니다.</p>
                    </div>
                    <button
                        type="button"
                        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-sky-800 shadow-sm hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60 md:mt-0"
                        onClick={() => void loadInventory()}
                        disabled={isFetching}
                    >
                        {isFetching ? '새로 불러오는 중…' : '↻ 최신 정보 불러오기'}
                    </button>
                </div>

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Metric label="관리 중인 화면" value={screens.length} help="고객에게 보여지는 화면 수" />
                    <Metric label="화면 구성 항목" value={totalComponents} help="버튼, 입력 칸, 안내 문구 등" />
                    <Metric label="연결된 데이터" value={queries.length} help="화면에 표시할 데이터 설정 수" />
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`h-10 rounded-lg px-4 text-sm font-bold ${activeTab === tab.id ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <input
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-sky-200 focus:ring-2 md:max-w-sm"
                        placeholder="화면 이름이나 기능을 검색하세요"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                {activeTab === 'screens' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
                        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                                    <thead className="bg-slate-100 text-xs text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">화면 이름</th>
                                            <th className="px-4 py-3 font-semibold">구성 항목</th>
                                            <th className="px-4 py-3 font-semibold">주요 기능</th>
                                            <th className="px-4 py-3 font-semibold">연결 데이터</th>
                                            <th className="px-4 py-3 font-semibold">최근 변경</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredScreens.map((screen) => (
                                            <tr
                                                key={screen.screenId}
                                                className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${screen.screenId === selectedScreenId ? 'bg-gray-100' : ''}`}
                                                onClick={() => setSelectedScreenId(screen.screenId)}
                                            >
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-semibold text-slate-950">{screenName(screen)}</div>
                                                    <div className="mt-1 max-w-xs truncate text-xs text-slate-500">관리 코드: {screen.screenId}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top font-medium">{screen.componentCount}</td>
                                                <td className="px-4 py-3 align-top text-slate-600">{screen.componentTypes.map(componentTypeName).join(', ') || '-'}</td>
                                                <td className="px-4 py-3 align-top text-gray-600">{joinList(screen.dataSqlKeys)}</td>
                                                <td className="px-4 py-3 align-top text-gray-600">{formatDate(screen.lastCreatedAt)}</td>
                                            </tr>
                                        ))}
                                        {filteredScreens.length === 0 && <EmptyRow colSpan={5} />}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-500">선택한 화면</div>
                                    <div className="mt-1 break-words text-xl font-bold">{selectedScreenId ? screenName(selectedScreenId, screens.find((screen) => screen.screenId === selectedScreenId)?.firstLabelText) : '선택한 화면 없음'}</div>
                                    {selectedScreenId && <div className="mt-1 text-xs text-slate-500">관리 코드: {selectedScreenId}</div>}
                                    {copyStatus && <div className="mt-1 text-xs font-semibold text-gray-500">{copyStatus}</div>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold ${selectedScreenId ? 'border-gray-300 bg-white text-gray-900 hover:bg-gray-100' : 'pointer-events-none border-gray-200 bg-gray-100 text-gray-400'}`}
                                        href={selectedPreviewHref}
                                        target="_blank"
                                    >
                                        화면 미리보기
                                    </Link>
                                    <button
                                        type="button"
                                        className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={() => void copyScreenMetadata()}
                                        disabled={!screenDetail}
                                    >
                                        기술 설정 복사
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[680px] overflow-auto">
                                {detailLoading ? (
                                    <div className="p-4 text-sm text-slate-500">화면 정보를 불러오는 중입니다…</div>
                                ) : screenDetail?.components?.length ? (
                                    <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                                        <thead className="sticky top-0 bg-gray-100 text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold">순서</th>
                                                <th className="px-3 py-2 font-semibold">화면 항목</th>
                                                <th className="px-3 py-2 font-semibold">종류</th>
                                                <th className="px-3 py-2 font-semibold">사용자 동작</th>
                                                <th className="px-3 py-2 font-semibold">연결 데이터</th>
                                                <th className="px-3 py-2 font-semibold">표시</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {screenDetail.components.map((component) => (
                                                <tr key={component.uiId} className="border-t border-gray-100">
                                                    <td className="px-3 py-2 align-top text-gray-500">{component.sortOrder ?? '-'}</td>
                                                    <td className="px-3 py-2 align-top">
                                                        <div className="font-semibold text-gray-950">{component.componentId || component.uiId}</div>
                                                        <div className="mt-1 max-w-[240px] break-words text-gray-500">{component.labelText || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-gray-600">{componentTypeName(component.componentType)}</td>
                                                    <td className="px-3 py-2 align-top text-gray-600">
                                                        <div>{component.actionType || '-'}</div>
                                                        <div className="mt-1 max-w-[220px] break-words text-gray-500">{component.actionUrl || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-gray-600">
                                                        <div>{component.dataSqlKey || '-'}</div>
                                                        <div className="mt-1 max-w-[220px] break-words text-gray-500">{component.dataApiUrl || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-gray-600">{component.isVisible || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-4 text-sm text-slate-500">표시할 화면 항목이 없습니다.</div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'themes' && (
                    <DataTable
                        headers={['디자인 이름', '설정 수', '적용 영역', '최근 변경']}
                        empty={filteredThemes.length === 0}
                    >
                        {filteredThemes.map((theme) => (
                            <tr key={theme.themeId} className="border-t border-gray-100">
                                <td className="px-4 py-3 font-semibold">{theme.themeId}</td>
                                <td className="px-4 py-3">{theme.tokenCount}</td>
                                <td className="px-4 py-3 text-gray-600">{joinList(theme.categories)}</td>
                                <td className="px-4 py-3 text-gray-600">{formatDate(theme.lastUpdatedAt)}</td>
                            </tr>
                        ))}
                    </DataTable>
                )}

                {activeTab === 'queries' && (
                    <DataTable
                        headers={['데이터 이름', '결과 형태', '사용 권한', '설명', '최근 변경']}
                        empty={filteredQueries.length === 0}
                    >
                        {filteredQueries.map((query) => (
                            <tr key={query.sqlKey} className="border-t border-gray-100 align-top">
                                <td className="px-4 py-3 font-semibold">{query.sqlKey}</td>
                                <td className="px-4 py-3 text-gray-600">{query.returnType || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">{query.requiredRole || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">
                                    <div>{query.description || '-'}</div>
                                    {query.queryText && <div className="mt-2 text-xs text-slate-400">기술용 조회문이 등록되어 있습니다.</div>}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{formatDate(query.updatedAt)}</td>
                            </tr>
                        ))}
                    </DataTable>
                )}
            </div>
        </div>
    );
}

function Metric({ label, value, help }: { label: string; value: number; help: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-700">{label}</div>
            <div className="mt-2 text-3xl font-bold text-sky-800">{value.toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-500">{help}</div>
        </div>
    );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-500">
                찾는 항목이 없습니다. 검색어를 바꾸거나 최신 정보를 다시 불러와 주세요.
            </td>
        </tr>
    );
}

function DataTable({
    headers,
    empty,
    children,
}: {
    headers: string[];
    empty: boolean;
    children: React.ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs text-slate-600">
                        <tr>
                            {headers.map((header) => (
                                <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {children}
                        {empty && <EmptyRow colSpan={headers.length} />}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
