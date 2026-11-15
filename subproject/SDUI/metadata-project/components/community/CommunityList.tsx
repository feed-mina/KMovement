'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { communityService, PostListResponse } from '@/services/communityService';
import { PAGE_SIZE, formatDate, normalizePage, EmptyState, LoadingState } from './communityShared';

export function CommunityList() {
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const [posts, setPosts] = useState<PostListResponse[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadPosts = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await communityService.getPostList(page, PAGE_SIZE);
            const normalized = normalizePage(result);
            setPosts(normalized.posts);
            setTotalPages(normalized.totalPages);
            setTotalElements(normalized.totalElements);
        } catch {
            setError('커뮤니티 글을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const goWrite = () => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }
        router.push('/view/COMMUNITY_WRITE');
    };

    return (
        <div className="community-page community-list-page">
            <div className="community-shell">
                <div className="community-toolbar">
                    <div>
                        <h1 className="community-title">커뮤니티</h1>
                        <p className="community-count">전체 {totalElements}개</p>
                    </div>
                    <button className="community-primary-btn" type="button" onClick={goWrite}>
                        글쓰기
                    </button>
                </div>

                {loading && <LoadingState />}
                {error && <div className="community-error">{error}</div>}
                {!loading && !error && posts.length === 0 && (
                    <EmptyState message="아직 등록된 커뮤니티 글이 없습니다." />
                )}

                {!loading && !error && posts.length > 0 && (
                    <div className="community-list">
                        {posts.map((post) => (
                            <button
                                key={post.postId}
                                type="button"
                                className="community-card"
                                onClick={() => router.push(`/view/COMMUNITY_DETAIL/${post.postId}`)}
                            >
                                {post.thumbnailUrl && (
                                    <span className="community-thumb">
                                        <img src={post.thumbnailUrl} alt={`${post.title} 이미지`} />
                                    </span>
                                )}
                                <span className="community-card-body">
                                    <span className="community-card-head">
                                        <span className="community-card-title">{post.title}</span>
                                        <span className="community-card-date">{formatDate(post.createdAt)}</span>
                                    </span>
                                    <span className="community-preview">{post.contentPreview || '내용 없음'}</span>
                                    <span className="community-meta-row">
                                        <span>{post.authorNickname || '익명'}</span>
                                        <span>좋아요 {post.likeCount ?? 0}</span>
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="community-pagination" aria-label="커뮤니티 페이지 이동">
                        <button
                            type="button"
                            disabled={page <= 0}
                            onClick={() => setPage((value) => Math.max(0, value - 1))}
                        >
                            이전
                        </button>
                        <span>{page + 1} / {totalPages}</span>
                        <button
                            type="button"
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                        >
                            다음
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
