'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    CommentModerationItem,
    ContentModerationStatus,
    communityModerationService,
    PostModerationItem,
    ReportModerationItem,
    ReportReviewStatus,
} from '@/services/communityModerationService';

type QueueType = 'posts' | 'comments' | 'reports';
type Decision = {
    queue: QueueType;
    id: number;
    status: 'APPROVED' | 'REJECTED' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
};

const CONTENT_STATUSES: ContentModerationStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const REPORT_STATUSES: ReportReviewStatus[] = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'];
const STATUS_LABELS: Record<string, string> = {
    PENDING: '검수 대기',
    APPROVED: '승인·공개',
    REJECTED: '반려',
    OPEN: '접수',
    REVIEWING: '확인 중',
    RESOLVED: '조치 완료',
    DISMISSED: '기각',
};

function formatDate(value?: string | null) {
    if (!value) return '미지정';
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

function QueueMeta({ item }: { item: { dueAt: string | null; slaBreached: boolean; lastActorSqno: number | null } }) {
    return (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className={`rounded-full px-3 py-1 font-bold ${item.slaBreached ? 'bg-red-100 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
                {item.slaBreached ? '처리 기한 지남' : '처리 기한 내'}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1">처리 기한 {formatDate(item.dueAt)}</span>
            <span className="rounded-full bg-gray-100 px-3 py-1">
                최근 담당자 {item.lastActorSqno ? `#${item.lastActorSqno}` : '미배정'}
            </span>
        </div>
    );
}

export default function CommunityModerationPage() {
    const { user, isLoading } = useAuth();
    const isAdmin = user?.role === 'ROLE_ADMIN';
    const [queue, setQueue] = useState<QueueType>('posts');
    const [contentStatus, setContentStatus] = useState<ContentModerationStatus>('PENDING');
    const [reportStatus, setReportStatus] = useState<ReportReviewStatus>('OPEN');
    const [posts, setPosts] = useState<PostModerationItem[]>([]);
    const [comments, setComments] = useState<CommentModerationItem[]>([]);
    const [reports, setReports] = useState<ReportModerationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [decision, setDecision] = useState<Decision | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        setError('');
        try {
            if (queue === 'posts') {
                const page = await communityModerationService.getPosts(contentStatus);
                setPosts(page.content ?? []);
            } else if (queue === 'comments') {
                const page = await communityModerationService.getComments(contentStatus);
                setComments(page.content ?? []);
            } else {
                const page = await communityModerationService.getReports(reportStatus);
                setReports(page.content ?? []);
            }
        } catch {
            setError('운영 검수 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    }, [contentStatus, isAdmin, queue, reportStatus]);

    useEffect(() => {
        void load();
    }, [load]);

    const openDecision = (next: Decision) => {
        setDecision(next);
        setNote('');
    };

    const submitDecision = async () => {
        if (!decision || !note.trim()) return;
        setSaving(true);
        setError('');
        try {
            if (decision.queue === 'posts' && (decision.status === 'APPROVED' || decision.status === 'REJECTED')) {
                await communityModerationService.moderatePost(decision.id, decision.status, note.trim());
            } else if (decision.queue === 'comments' && (decision.status === 'APPROVED' || decision.status === 'REJECTED')) {
                await communityModerationService.moderateComment(decision.id, decision.status, note.trim());
            } else if (
                decision.queue === 'reports' &&
                (decision.status === 'REVIEWING' || decision.status === 'RESOLVED' || decision.status === 'DISMISSED')
            ) {
                await communityModerationService.updateReportStatus(decision.id, decision.status, note.trim());
            }
            setDecision(null);
            setNote('');
            await load();
        } catch {
            setError('검수 결과를 저장하지 못했습니다. 상태 전이 순서와 입력 내용을 확인해 주세요.');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return <main className="min-h-screen bg-[#f6f7f9] p-8"><p role="status">계정 권한을 확인하는 중…</p></main>;
    }

    if (!isAdmin) {
        return (
            <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#15171a] md:px-10">
                <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-bold">커뮤니티 운영 화면 접근 권한이 없습니다.</h1>
                    <p className="mt-3 text-sm text-gray-600">관리자 계정으로 로그인해 주세요.</p>
                </section>
            </main>
        );
    }

    const currentItems = queue === 'posts' ? posts : queue === 'comments' ? comments : reports;
    const statuses = queue === 'reports' ? REPORT_STATUSES : CONTENT_STATUSES;
    const selectedStatus = queue === 'reports' ? reportStatus : contentStatus;

    return (
        <main className="min-h-screen bg-[#f6f7f9] px-5 py-8 text-[#15171a] md:px-10">
            <div className="mx-auto max-w-6xl">
                <p className="text-sm font-bold tracking-[.16em] text-red-600">KRIDE COMMUNITY OPS</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">커뮤니티 신고·검수</h1>
                        <p className="mt-2 text-sm text-gray-500">게시글과 댓글 공개 여부를 검수하고 신고 처리 상태를 기록합니다.</p>
                    </div>
                    <button className="rounded-xl border bg-white px-4 py-2 text-sm font-bold" type="button" onClick={() => void load()} disabled={loading}>
                        새로고침
                    </button>
                </div>

                <nav className="mt-7 flex flex-wrap gap-2" aria-label="커뮤니티 운영 목록">
                    {([
                        ['posts', '게시글'],
                        ['comments', '댓글'],
                        ['reports', '신고'],
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-current={queue === value ? 'page' : undefined}
                            className={`rounded-full px-5 py-2 text-sm font-bold ${queue === value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
                            onClick={() => setQueue(value)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="처리 상태 필터">
                    {statuses.map((status) => (
                        <button
                            key={status}
                            type="button"
                            aria-pressed={selectedStatus === status}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${selectedStatus === status ? 'border-red-600 bg-red-50 text-red-800' : 'bg-white'}`}
                            onClick={() => {
                                if (queue === 'reports') setReportStatus(status as ReportReviewStatus);
                                else setContentStatus(status as ContentModerationStatus);
                            }}
                        >
                            {STATUS_LABELS[status]}
                        </button>
                    ))}
                </div>

                {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
                {loading && <p className="mt-7 rounded-2xl bg-white p-10 text-center text-gray-500" role="status">목록을 불러오는 중…</p>}

                {!loading && (
                    <section className="mt-7 grid gap-4">
                        {queue === 'posts' && posts.map((item) => (
                            <article key={item.postId} className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex flex-wrap justify-between gap-5">
                                    <div className="min-w-0 flex-1">
                                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{STATUS_LABELS[item.moderationStatus]}</span>
                                        <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
                                        <p className="mt-1 text-sm text-gray-500">작성자 {item.authorNickname || `#${item.authorSqno}`} · {formatDate(item.createdAt)}</p>
                                        <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                                        <QueueMeta item={item} />
                                    </div>
                                    {item.moderationStatus === 'PENDING' && (
                                        <div className="flex items-end gap-2">
                                            <button className="rounded-xl border px-5 py-3 text-sm font-bold" type="button" onClick={() => openDecision({ queue, id: item.postId, status: 'REJECTED' })}>반려</button>
                                            <button className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white" type="button" onClick={() => openDecision({ queue, id: item.postId, status: 'APPROVED' })}>승인·공개</button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}

                        {queue === 'comments' && comments.map((item) => (
                            <article key={item.commentId} className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex flex-wrap justify-between gap-5">
                                    <div className="min-w-0 flex-1">
                                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{STATUS_LABELS[item.moderationStatus]}</span>
                                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                                        <p className="mt-3 text-xs text-gray-500">글 #{item.postId} · 작성자 {item.authorNickname || `#${item.authorSqno}`} · {formatDate(item.createdAt)}</p>
                                        <QueueMeta item={item} />
                                    </div>
                                    {item.moderationStatus === 'PENDING' && (
                                        <div className="flex items-end gap-2">
                                            <button className="rounded-xl border px-5 py-3 text-sm font-bold" type="button" onClick={() => openDecision({ queue, id: item.commentId, status: 'REJECTED' })}>반려</button>
                                            <button className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white" type="button" onClick={() => openDecision({ queue, id: item.commentId, status: 'APPROVED' })}>승인·공개</button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}

                        {queue === 'reports' && reports.map((item) => (
                            <article key={item.reportId} className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex flex-wrap justify-between gap-5">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800">{item.reasonCode}</span>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{STATUS_LABELS[item.status]}</span>
                                        </div>
                                        <h2 className="mt-3 text-lg font-bold">게시글 #{item.postId} 신고</h2>
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.detailText || '상세 내용 없음'}</p>
                                        <p className="mt-3 text-xs text-gray-500">신고자 {item.reporterNickname || `#${item.reporterSqno}`} · {formatDate(item.createdAt)}</p>
                                        {item.resolutionNote && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">처리 기록: {item.resolutionNote}</p>}
                                        <QueueMeta item={item} />
                                    </div>
                                    {(item.status === 'OPEN' || item.status === 'REVIEWING') && (
                                        <div className="flex flex-wrap items-end gap-2">
                                            {item.status === 'OPEN' && <button className="rounded-xl border px-5 py-3 text-sm font-bold" type="button" onClick={() => openDecision({ queue, id: item.reportId, status: 'REVIEWING' })}>확인 시작</button>}
                                            {item.status === 'REVIEWING' && (
                                                <>
                                                    <button className="rounded-xl border px-5 py-3 text-sm font-bold" type="button" onClick={() => openDecision({ queue, id: item.reportId, status: 'DISMISSED' })}>기각</button>
                                                    <button className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white" type="button" onClick={() => openDecision({ queue, id: item.reportId, status: 'RESOLVED' })}>조치 완료</button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}

                        {currentItems.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-gray-500">이 상태의 항목이 없습니다.</div>}
                    </section>
                )}
            </div>

            {decision && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="community-decision-title">
                    <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <h2 id="community-decision-title" className="text-xl font-bold">{STATUS_LABELS[decision.status]} 처리 기록</h2>
                        <p className="mt-2 text-sm text-gray-600">판단 근거와 후속 조치를 남기면 감사 로그에 관리자와 함께 기록됩니다.</p>
                        <label className="mt-5 block text-sm font-bold" htmlFor="community-decision-note">처리 메모</label>
                        <textarea
                            id="community-decision-note"
                            className="mt-2 min-h-32 w-full rounded-xl border p-3"
                            maxLength={500}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="검수 판단 근거를 입력해 주세요."
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button className="rounded-xl border px-5 py-3 text-sm font-bold" type="button" disabled={saving} onClick={() => setDecision(null)}>취소</button>
                            <button className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40" type="button" disabled={saving || !note.trim()} onClick={() => void submitDecision()}>
                                {saving ? '저장 중…' : '기록하고 상태 변경'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
