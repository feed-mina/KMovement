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
    { id: 'screens', label: 'Screens' },
    { id: 'themes', label: 'Themes' },
    { id: 'queries', label: 'Query Master' },
];

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
            setError('Failed to load SDUI inventory.');
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
            setCopyStatus('Copied');
        } catch {
            setCopyStatus('Copy failed');
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
                    <h1 className="text-2xl font-semibold text-gray-950">Admin login required</h1>
                    <div className="mt-5">
                        <Link className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white" href="/view/LOGIN_PAGE">
                            Go to login
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
                    <h1 className="text-2xl font-semibold text-gray-950">Admin access required</h1>
                    <p className="mt-3 text-sm text-gray-600">Current role: {user?.role || 'UNKNOWN'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950 md:px-8 md:py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Operations</p>
                        <h1 className="mt-2 text-3xl font-semibold leading-tight">SDUI Admin Console</h1>
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60"
                        onClick={() => void loadInventory()}
                        disabled={isFetching}
                    >
                        {isFetching ? 'Refreshing' : 'Refresh'}
                    </button>
                </div>

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Metric label="Screens" value={screens.length} />
                    <Metric label="Components" value={totalComponents} />
                    <Metric label="Queries" value={queries.length} />
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-md border border-gray-200 bg-gray-100 p-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`h-9 rounded px-3 text-sm font-semibold ${activeTab === tab.id ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-600 hover:text-gray-950'}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <input
                        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-950 md:max-w-sm"
                        placeholder="Search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                {activeTab === 'screens' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
                        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                                    <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Screen</th>
                                            <th className="px-4 py-3 font-semibold">Components</th>
                                            <th className="px-4 py-3 font-semibold">Types</th>
                                            <th className="px-4 py-3 font-semibold">Data SQL</th>
                                            <th className="px-4 py-3 font-semibold">Last created</th>
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
                                                    <div className="font-semibold text-gray-950">{screen.screenId}</div>
                                                    <div className="mt-1 max-w-xs truncate text-xs text-gray-500">{screen.firstLabelText || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top font-medium">{screen.componentCount}</td>
                                                <td className="px-4 py-3 align-top text-gray-600">{joinList(screen.componentTypes)}</td>
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
                                    <div className="text-sm font-semibold text-gray-500">Selected screen</div>
                                    <div className="mt-1 break-words text-xl font-semibold">{selectedScreenId || '-'}</div>
                                    {copyStatus && <div className="mt-1 text-xs font-semibold text-gray-500">{copyStatus}</div>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold ${selectedScreenId ? 'border-gray-300 bg-white text-gray-900 hover:bg-gray-100' : 'pointer-events-none border-gray-200 bg-gray-100 text-gray-400'}`}
                                        href={selectedPreviewHref}
                                        target="_blank"
                                    >
                                        Open preview
                                    </Link>
                                    <button
                                        type="button"
                                        className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={() => void copyScreenMetadata()}
                                        disabled={!screenDetail}
                                    >
                                        Copy JSON
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[680px] overflow-auto">
                                {detailLoading ? (
                                    <div className="p-4 text-sm text-gray-500">Loading</div>
                                ) : screenDetail?.components?.length ? (
                                    <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                                        <thead className="sticky top-0 bg-gray-100 text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold">Order</th>
                                                <th className="px-3 py-2 font-semibold">Component</th>
                                                <th className="px-3 py-2 font-semibold">Type</th>
                                                <th className="px-3 py-2 font-semibold">Action</th>
                                                <th className="px-3 py-2 font-semibold">Data</th>
                                                <th className="px-3 py-2 font-semibold">Visible</th>
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
                                                    <td className="px-3 py-2 align-top text-gray-600">{component.componentType || '-'}</td>
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
                                    <div className="p-4 text-sm text-gray-500">No screen detail</div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'themes' && (
                    <DataTable
                        headers={['Theme', 'Tokens', 'Categories', 'Updated']}
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
                        headers={['SQL key', 'Return', 'Role', 'Description', 'Updated']}
                        empty={filteredQueries.length === 0}
                    >
                        {filteredQueries.map((query) => (
                            <tr key={query.sqlKey} className="border-t border-gray-100 align-top">
                                <td className="px-4 py-3 font-semibold">{query.sqlKey}</td>
                                <td className="px-4 py-3 text-gray-600">{query.returnType || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">{query.requiredRole || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">
                                    <div>{query.description || '-'}</div>
                                    {query.queryText && (
                                        <pre className="mt-2 max-h-28 max-w-xl overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">
                                            {query.queryText}
                                        </pre>
                                    )}
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

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-gray-950">{value.toLocaleString()}</div>
        </div>
    );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-500">
                No results
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
                    <thead className="bg-gray-100 text-xs uppercase text-gray-500">
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
