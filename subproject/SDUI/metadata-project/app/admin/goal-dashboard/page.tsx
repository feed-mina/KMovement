'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';

type ApiEnvelope<T> = {
  status: string;
  data: T;
  message?: string | null;
};

type MonthlyGoalSummary = {
  month: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  attainmentRate: number;
};

type DailyGoalTrend = {
  date: string;
  successCount: number;
  failureCount: number;
};

type UserGoalCard = {
  userSqno: number;
  userId?: string | null;
  displayName: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
  attainmentRate: number;
};

type GoalDashboard = {
  generatedAt: string;
  monthly: MonthlyGoalSummary[];
  trend: DailyGoalTrend[];
  users: UserGoalCard[];
};

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function compactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5);
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(date);
}

function maxTrendValue(trend: DailyGoalTrend[]) {
  return Math.max(1, ...trend.map((item) => item.successCount + item.failureCount));
}

export default function GoalDashboardPage() {
  const { user, isLoggedIn, isLoading } = useAuth();
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isLoggedIn || !isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const res = await api.get<ApiEnvelope<GoalDashboard> | GoalDashboard>('/api/admin/goal-dashboard');
      setDashboard(unwrap<GoalDashboard>(res.data));
    } catch {
      setError('Failed to load goal dashboard.');
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin, isLoggedIn]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const totals = useMemo(() => {
    const monthly = dashboard?.monthly ?? [];
    const total = monthly.reduce((sum, item) => sum + item.totalCount, 0);
    const success = monthly.reduce((sum, item) => sum + item.successCount, 0);
    const failure = monthly.reduce((sum, item) => sum + item.failureCount, 0);
    const rate = total > 0 ? (success / total) * 100 : 0;
    return { total, success, failure, rate };
  }, [dashboard]);

  const trendMax = useMemo(() => maxTrendValue(dashboard?.trend ?? []), [dashboard]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-56 rounded bg-gray-200" />
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-lg border border-gray-200 bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AccessPanel title="Admin login required" action={<LinkButton href="/view/LOGIN_PAGE">Go to login</LinkButton>} />;
  }

  if (!isAdmin) {
    return <AccessPanel title="Admin access required" detail={`Current role: ${user?.role || 'UNKNOWN'}`} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">Goal Dashboard</h1>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60"
            onClick={() => void loadDashboard()}
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Metric label="Monthly Goals" value={totals.total.toLocaleString()} />
          <Metric label="Success" value={totals.success.toLocaleString()} tone="success" />
          <Metric label="Failure" value={totals.failure.toLocaleString()} tone="danger" />
          <Metric label="Attainment" value={pct(totals.rate)} tone="info" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Monthly Attainment</h2>
              <span className="text-xs font-medium text-gray-500">{dashboard?.generatedAt ? compactDate(dashboard.generatedAt) : '-'}</span>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {(dashboard?.monthly ?? []).map((item) => (
                <div key={item.month} className="grid grid-cols-[84px_minmax(0,1fr)_72px] items-center gap-3 text-sm">
                  <div className="font-medium text-gray-700">{item.month}</div>
                  <div className="h-8 overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full rounded bg-emerald-500"
                      style={{ width: `${Math.max(2, Math.min(item.attainmentRate, 100))}%` }}
                    />
                  </div>
                  <div className="text-right font-semibold">{pct(item.attainmentRate)}</div>
                </div>
              ))}
              {!dashboard?.monthly?.length && <EmptyState>No monthly data</EmptyState>}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Success / Failure Trend</h2>
            <div className="mt-5 flex h-64 items-end gap-2">
              {(dashboard?.trend ?? []).map((item) => {
                const successHeight = (item.successCount / trendMax) * 100;
                const failureHeight = (item.failureCount / trendMax) * 100;
                return (
                  <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-48 w-full max-w-8 items-end justify-center gap-1">
                      <div className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(4, successHeight)}%` }} />
                      <div className="w-3 rounded-t bg-rose-500" style={{ height: `${Math.max(4, failureHeight)}%` }} />
                    </div>
                    <div className="truncate text-[11px] font-medium text-gray-500">{compactDate(item.date)}</div>
                  </div>
                );
              })}
              {!dashboard?.trend?.length && <EmptyState>No trend data</EmptyState>}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-lg font-semibold">User Goal Status</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(dashboard?.users ?? []).map((item) => (
              <article key={item.userSqno} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{item.displayName}</h3>
                    <p className="mt-1 truncate text-xs text-gray-500">{item.userId || `#${item.userSqno}`}</p>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{pct(item.attainmentRate)}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded bg-gray-100">
                  <div className="h-full rounded bg-sky-500" style={{ width: `${Math.max(2, Math.min(item.attainmentRate, 100))}%` }} />
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                  <MiniStat label="Total" value={item.totalCount} />
                  <MiniStat label="Success" value={item.successCount} />
                  <MiniStat label="Failure" value={item.failureCount} />
                  <MiniStat label="Pending" value={item.pendingCount} />
                </dl>
              </article>
            ))}
            {!dashboard?.users?.length && <EmptyState>No user data</EmptyState>}
          </div>
        </section>
      </div>
    </div>
  );
}

function AccessPanel({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-950">{title}</h1>
        {detail && <p className="mt-3 text-sm text-gray-600">{detail}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white" href={href}>
      {children}
    </Link>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'danger' | 'info' }) {
  const toneClass = {
    neutral: 'text-gray-950',
    success: 'text-emerald-700',
    danger: 'text-rose-700',
    info: 'text-sky-700',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-gray-950">{value.toLocaleString()}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-28 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 text-sm font-medium text-gray-500">
      {children}
    </div>
  );
}
