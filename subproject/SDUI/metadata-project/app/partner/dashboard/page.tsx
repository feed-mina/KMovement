'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/services/axios';
import { useAuth } from '@/context/AuthContext';

type Slot = { slotId:number; title:string; status:string; impressions:number; clicks:number; conversions:number; ctr:number; conversionRate:number };
type Dashboard = { generatedAt:string; impressions:number; clicks:number; conversions:number; ctr:number; conversionRate:number; slots:Slot[] };
type Envelope<T> = { data:T };
const demo: Dashboard = { generatedAt:new Date().toISOString(), impressions:12840, clicks:936, conversions:147, ctr:7.3, conversionRate:15.7, slots:[
  {slotId:1,title:'성수 K-POP 팝업 추천',status:'ACTIVE',impressions:7240,clicks:612,conversions:103,ctr:8.5,conversionRate:16.8},
  {slotId:2,title:'한강 야간 동선 제휴',status:'ACTIVE',impressions:5600,clicks:324,conversions:44,ctr:5.8,conversionRate:13.6},
]};

export default function PartnerDashboardPage(){
 const { user,isLoading }=useAuth(); const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState(false);
 const allowed=user?.role==='ROLE_PARTNER'||user?.role==='ROLE_ADMIN';
 const load=useCallback(async()=>{ if(!allowed)return; try{const r=await api.get<Envelope<Dashboard>|Dashboard>(user?.role==='ROLE_ADMIN'?'/api/admin/b2b/dashboard':'/api/partner/b2b/dashboard'); const p=r.data as Envelope<Dashboard>|Dashboard; setData('data' in p?p.data:p);setError(false);}catch{setData(demo);setError(true)}},[allowed,user?.role]);
 useEffect(()=>{void load()},[load]); const d=data??demo; const updated=useMemo(()=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d.generatedAt)),[d.generatedAt]);
 if(isLoading)return <main className="min-h-screen bg-[#f6f7f9] p-8">불러오는 중…</main>;
 return <main className="min-h-screen bg-[#f6f7f9] px-5 py-8 text-[#15171a] md:px-10">
  <div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold tracking-[.16em] text-red-600">KRIDE PARTNER</p><h1 className="mt-2 text-3xl font-bold">노출·전환 대시보드</h1><p className="mt-2 text-sm text-gray-500">마지막 집계 {updated}</p></div><span className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">수동 승인 파일럿</span></div>
  {error&&<p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">API 데이터가 없어 파일럿 예시 지표를 표시합니다.</p>}
  <section className="mt-7 grid gap-4 md:grid-cols-5">{[['노출',d.impressions],['클릭',d.clicks],['전환',d.conversions],['CTR',`${d.ctr}%`],['전환율',`${d.conversionRate}%`]].map(([k,v])=><article key={String(k)} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{k}</p><strong className="mt-2 block text-3xl">{typeof v==='number'?v.toLocaleString():v}</strong></article>)}</section>
  <section className="mt-7 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="text-lg font-bold">추천 슬롯 성과</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-gray-500"><tr>{['슬롯','상태','노출','클릭','전환','CTR','전환율'].map(h=><th key={h} className="px-6 py-3">{h}</th>)}</tr></thead><tbody>{d.slots.map(s=><tr key={s.slotId} className="border-t"><td className="px-6 py-4 font-semibold">{s.title}</td><td className="px-6 py-4"><span className="rounded-full bg-green-50 px-3 py-1 font-semibold text-green-700">{s.status}</span></td><td className="px-6 py-4">{s.impressions.toLocaleString()}</td><td className="px-6 py-4">{s.clicks.toLocaleString()}</td><td className="px-6 py-4">{s.conversions.toLocaleString()}</td><td className="px-6 py-4">{s.ctr}%</td><td className="px-6 py-4">{s.conversionRate}%</td></tr>)}</tbody></table></div></section>
  <p className="mt-5 text-sm text-gray-500">파일럿 단계에서는 관리자가 슬롯을 승인하며 계약·정산은 외부에서 처리합니다.</p></div>
 </main>;
}
