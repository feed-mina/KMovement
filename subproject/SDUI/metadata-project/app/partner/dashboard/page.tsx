'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';

type Slot = {
  slotId: number;
  title: string;
  status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
};

type Dashboard = {
  generatedAt: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  slots: Slot[];
};

type Envelope<T> = { data: T };
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function unwrap<T>(payload: Envelope<T> | T): T {
  return payload && typeof payload === 'object' && 'data' in payload
    ? (payload as Envelope<T>).data
    : (payload as T);
}

export default function PartnerDashboardPage() {
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const role = user?.role;
  const allowed = role === 'ROLE_PARTNER' || role === 'ROLE_ADMIN';

  const load = useCallback(async () => {
    if (role !== 'ROLE_PARTNER' && role !== 'ROLE_ADMIN') return;

    setLoadState('loading');
    setData(null);

    try {
      const response = await api.get<Envelope<Dashboard> | Dashboard>(
        role === 'ROLE_ADMIN' ? '/api/admin/b2b/dashboard' : '/api/partner/b2b/dashboard',
      );
      const nextData = unwrap(response.data);
      if (!nextData) throw new Error('Dashboard response is empty');
      setData(nextData);
      setLoadState('ready');
    } catch {
      setData(null);
      setLoadState('error');
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const updated = useMemo(() => {
    if (!data) return null;
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(data.generatedAt));
  }, [data]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] p-8">
        <p role="status">계정 권한을 확인하는 중…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#15171a] md:px-10">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">파트너 대시보드 접근 권한이 없습니다.</h1>
          <p className="mt-3 text-sm text-gray-600">파트너 또는 관리자 계정으로 로그인해 주세요.</p>
        </section>
      </main>
    );
  }

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <main className="min-h-screen bg-[#f6f7f9] p-8">
        <p role="status">파트너 지표를 불러오는 중…</p>
      </main>
    );
  }

  if (loadState === 'error' || !data || !updated) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#15171a] md:px-10">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="text-2xl font-bold">파트너 지표를 불러오지 못했습니다.</h1>
          <p className="mt-3 text-sm text-gray-600">잠시 후 다시 시도해 주세요.</p>
          <button className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white" onClick={() => void load()}>
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-8 text-[#15171a] md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[.16em] text-red-600">KRIDE PARTNER</p>
            <h1 className="mt-2 text-3xl font-bold">노출·전환 대시보드</h1>
            <p className="mt-2 text-sm text-gray-500">마지막 집계 {updated}</p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">수동 승인 파일럿</span>
        </div>

        <section className="mt-7 grid gap-4 md:grid-cols-5">
          {[
            ['노출', data.impressions],
            ['클릭', data.clicks],
            ['전환', data.conversions],
            ['CTR', `${data.ctr}%`],
            ['전환율', `${data.conversionRate}%`],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{label}</p>
              <strong className="mt-2 block text-3xl">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </strong>
            </article>
          ))}
        </section>

        <section className="mt-7 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-lg font-bold">추천 슬롯 성과</h2>
          </div>
          {data.slots.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">표시할 추천 슬롯 성과가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {['슬롯', '상태', '노출', '클릭', '전환', 'CTR', '전환율'].map((heading) => (
                      <th key={heading} className="px-6 py-3">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slots.map((slot) => (
                    <tr key={slot.slotId} className="border-t">
                      <td className="px-6 py-4 font-semibold">{slot.title}</td>
                      <td className="px-6 py-4"><span className="rounded-full bg-green-50 px-3 py-1 font-semibold text-green-700">{slot.status}</span></td>
                      <td className="px-6 py-4">{slot.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4">{slot.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4">{slot.conversions.toLocaleString()}</td>
                      <td className="px-6 py-4">{slot.ctr}%</td>
                      <td className="px-6 py-4">{slot.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-5 text-sm text-gray-500">파일럿 단계에서는 관리자가 슬롯을 승인하며 계약·정산은 외부에서 처리합니다.</p>
      </div>
    </main>
  );
}
