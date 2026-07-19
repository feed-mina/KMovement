'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';

type Item = {
  poiSqno: number;
  title: string;
  addr?: string;
  artist?: string;
  recommendReason?: string;
  source: string;
  sourceUrl: string;
  reviewStatus: string;
};

type Envelope<T> = { data: T };
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function unwrap<T>(payload: Envelope<T> | T): T {
  return payload && typeof payload === 'object' && 'data' in payload
    ? (payload as Envelope<T>).data
    : (payload as T);
}

export default function HolyReviewPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [busy, setBusy] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState(false);
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) return;

    setLoadState('loading');
    setItems([]);
    setReviewError(false);

    try {
      const response = await api.get<Envelope<Item[]> | Item[]>('/api/admin/tour/holy/pending');
      const nextItems = unwrap(response.data);
      if (!Array.isArray(nextItems)) throw new Error('Pending review response is invalid');
      setItems(nextItems);
      setLoadState('ready');
    } catch {
      setItems([]);
      setLoadState('error');
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: number, action: 'APPROVE' | 'REJECT') => {
    setBusy(id);
    setReviewError(false);
    try {
      await api.post(`/api/admin/tour/holy/${id}/review`, { action });
      setItems((current) => current.filter((item) => item.poiSqno !== id));
    } catch {
      setReviewError(true);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] p-8">
        <p role="status">계정 권한을 확인하는 중…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#15171a] md:px-10">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">관리자 검수 화면 접근 권한이 없습니다.</h1>
          <p className="mt-3 text-sm text-gray-600">관리자 계정으로 로그인해 주세요.</p>
        </section>
      </main>
    );
  }

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <main className="min-h-screen bg-[#f6f7f9] p-8">
        <p role="status">성지 제보를 불러오는 중…</p>
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#15171a] md:px-10">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="text-2xl font-bold">검수 대기 제보를 불러오지 못했습니다.</h1>
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
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold tracking-[.16em] text-red-600">KRIDE ADMIN</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">성지 제보 검수</h1>
            <p className="mt-2 text-sm text-gray-500">운영 관리자가 출처와 사실 정보를 확인해 접수 후 3영업일 안에 승인 또는 반려합니다.</p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">대기 {items.length}건</span>
        </div>

        {reviewError && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            검수 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        <section className="mt-7 grid gap-4">
          {items.map((item) => (
            <article key={item.poiSqno} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{item.source}</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{item.reviewStatus}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{item.addr} · {item.artist}</p>
                  <p className="mt-4 text-sm leading-6">{item.recommendReason}</p>
                  <a className="mt-3 block text-sm font-semibold text-blue-700 underline" href={item.sourceUrl} target="_blank" rel="noreferrer">출처 확인</a>
                </div>
                <div className="flex items-end gap-2">
                  <button disabled={busy !== null} onClick={() => void review(item.poiSqno, 'REJECT')} className="rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-40">반려</button>
                  <button disabled={busy !== null} onClick={() => void review(item.poiSqno, 'APPROVE')} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">승인·공개</button>
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-gray-500">검수 대기 제보가 없습니다.</div>
          )}
        </section>
      </div>
    </main>
  );
}
