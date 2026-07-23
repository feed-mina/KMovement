'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CommentResponse, communityService } from '@/services/communityService';

type Props = {
    postId: number;
    isLoggedIn: boolean;
    currentUserSqno?: number;
    onRequireLogin: () => void;
};

const REPORT_REASONS = [
    { value: 'SPAM', label: '광고·도배' },
    { value: 'HARASSMENT', label: '괴롭힘·모욕' },
    { value: 'HATE_SPEECH', label: '혐오 표현' },
    { value: 'MISINFORMATION', label: '허위·오해 정보' },
    { value: 'COPYRIGHT', label: '저작권 침해' },
    { value: 'PRIVACY', label: '개인정보 노출' },
    { value: 'OTHER', label: '기타' },
] as const;

function formatDate(value: string) {
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

export default function CommunityDiscussion({
    postId,
    isLoggedIn,
    currentUserSqno,
    onRequireLogin,
}: Props) {
    const [comments, setComments] = useState<CommentResponse[]>([]);
    const [commentText, setCommentText] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('SPAM');
    const [reportDetail, setReportDetail] = useState('');

    const loadComments = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setComments(await communityService.getComments(postId));
        } catch {
            setError('댓글을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        void loadComments();
    }, [loadComments]);

    const requireLogin = () => {
        if (isLoggedIn) return false;
        onRequireLogin();
        return true;
    };

    const submitComment = async (event: FormEvent) => {
        event.preventDefault();
        if (requireLogin()) return;
        const content = commentText.trim();
        if (!content) return;

        setBusy(true);
        setError('');
        setNotice('');
        try {
            const created = await communityService.createComment(postId, content);
            setComments((current) => [...current, created]);
            setCommentText('');
            setNotice(
                created.moderationStatus === 'APPROVED'
                    ? '댓글을 등록했습니다.'
                    : '댓글을 접수했습니다. 운영 검수 후 공개됩니다.',
            );
        } catch {
            setError('댓글을 등록하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const saveComment = async (commentId: number) => {
        const content = editingText.trim();
        if (!content) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const updated = await communityService.updateComment(postId, commentId, content);
            setComments((current) => current.map((item) => item.commentId === commentId ? updated : item));
            setEditingId(null);
            setEditingText('');
            setNotice('댓글을 수정했습니다. 수정 내용은 검수 후 공개될 수 있습니다.');
        } catch {
            setError('댓글을 수정하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const deleteComment = async (commentId: number) => {
        if (!window.confirm('이 댓글을 삭제할까요?')) return;
        setBusy(true);
        setError('');
        try {
            await communityService.deleteComment(postId, commentId);
            setComments((current) => current.filter((item) => item.commentId !== commentId));
            setNotice('댓글을 삭제했습니다.');
        } catch {
            setError('댓글을 삭제하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const submitReport = async (event: FormEvent) => {
        event.preventDefault();
        if (requireLogin()) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await communityService.reportPost(postId, reportReason, reportDetail.trim() || undefined);
            setReportOpen(false);
            setReportReason('SPAM');
            setReportDetail('');
            setNotice('신고가 접수되었습니다. 운영팀이 확인합니다.');
        } catch {
            setError('신고를 접수하지 못했습니다. 이미 신고한 글인지 확인해 주세요.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="community-discussion" aria-labelledby="community-comments-title">
            <div className="community-discussion-head">
                <div>
                    <h2 id="community-comments-title">댓글</h2>
                    <p>공개된 댓글 {comments.filter((item) => item.moderationStatus === 'APPROVED').length}개</p>
                </div>
                <button
                    className="community-secondary-btn"
                    type="button"
                    onClick={() => {
                        if (requireLogin()) return;
                        setReportOpen((value) => !value);
                    }}
                    aria-expanded={reportOpen}
                >
                    이 글 신고하기
                </button>
            </div>

            {reportOpen && (
                <form className="community-report-form" onSubmit={submitReport}>
                    <label htmlFor="community-report-reason">신고 사유</label>
                    <select
                        id="community-report-reason"
                        className="community-input"
                        value={reportReason}
                        onChange={(event) => setReportReason(event.target.value)}
                    >
                        {REPORT_REASONS.map((reason) => (
                            <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))}
                    </select>
                    <label htmlFor="community-report-detail">자세한 내용 (선택)</label>
                    <textarea
                        id="community-report-detail"
                        className="community-textarea"
                        maxLength={500}
                        value={reportDetail}
                        onChange={(event) => setReportDetail(event.target.value)}
                        placeholder="운영팀이 확인할 내용을 적어 주세요."
                    />
                    <div className="community-action-row">
                        <button className="community-secondary-btn" type="button" onClick={() => setReportOpen(false)}>
                            취소
                        </button>
                        <button className="community-danger-btn" type="submit" disabled={busy}>
                            {busy ? '접수 중…' : '신고 접수'}
                        </button>
                    </div>
                </form>
            )}

            {error && <p className="community-error" role="alert">{error}</p>}
            {notice && <p className="community-notice" role="status">{notice}</p>}

            <form className="community-comment-form" onSubmit={submitComment}>
                <label htmlFor="community-comment-content">댓글 작성</label>
                <textarea
                    id="community-comment-content"
                    className="community-textarea"
                    maxLength={1000}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onFocus={() => {
                        if (!isLoggedIn) onRequireLogin();
                    }}
                    placeholder={isLoggedIn ? '여행 팁과 경험을 나눠 주세요.' : '로그인 후 댓글을 작성할 수 있습니다.'}
                    disabled={!isLoggedIn || busy}
                />
                <button className="community-primary-btn" type="submit" disabled={!isLoggedIn || busy || !commentText.trim()}>
                    댓글 등록
                </button>
            </form>

            {loading && <p className="community-loading" role="status">댓글을 불러오는 중입니다.</p>}
            {!loading && comments.length === 0 && <p className="community-empty">첫 댓글을 남겨 보세요.</p>}
            {!loading && comments.length > 0 && (
                <div className="community-comment-list">
                    {comments.map((comment) => {
                        const isOwner = Boolean(currentUserSqno && comment.authorSqno === currentUserSqno);
                        return (
                            <article className="community-comment" key={comment.commentId}>
                                <div className="community-comment-meta">
                                    <strong>{comment.authorNickname || '익명'}</strong>
                                    <span>{formatDate(comment.createdAt)}</span>
                                    {comment.moderationStatus !== 'APPROVED' && (
                                        <span className="community-moderation-badge">검수 대기</span>
                                    )}
                                </div>
                                {editingId === comment.commentId ? (
                                    <div className="community-comment-edit">
                                        <textarea
                                            className="community-textarea"
                                            maxLength={1000}
                                            value={editingText}
                                            onChange={(event) => setEditingText(event.target.value)}
                                        />
                                        <div className="community-action-row">
                                            <button className="community-secondary-btn" type="button" onClick={() => setEditingId(null)}>
                                                취소
                                            </button>
                                            <button className="community-primary-btn" type="button" disabled={busy || !editingText.trim()} onClick={() => void saveComment(comment.commentId)}>
                                                저장
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p>{comment.content}</p>
                                )}
                                {isOwner && editingId !== comment.commentId && (
                                    <div className="community-comment-actions">
                                        <button type="button" onClick={() => {
                                            setEditingId(comment.commentId);
                                            setEditingText(comment.content);
                                        }}>수정</button>
                                        <button type="button" disabled={busy} onClick={() => void deleteComment(comment.commentId)}>삭제</button>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
