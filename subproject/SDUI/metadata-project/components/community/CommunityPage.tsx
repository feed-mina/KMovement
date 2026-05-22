'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    communityService,
    PostImageDto,
    PostListResponse,
    PostResponse,
} from '@/services/communityService';

type CommunityPageProps = {
    screenId: string;
    refId: string | number | null;
};

type CommunityMode = 'list' | 'write' | 'detail' | 'modify';

const PAGE_SIZE = 5;

function getMode(screenId: string): CommunityMode {
    if (screenId.includes('WRITE')) return 'write';
    if (screenId.includes('DETAIL')) return 'detail';
    if (screenId.includes('MODIFY')) return 'modify';
    return 'list';
}

function formatDate(value?: string) {
    if (!value) return '';
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

function normalizePage(data: any): {
    posts: PostListResponse[];
    totalPages: number;
    totalElements: number;
} {
    const posts = Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
            ? data
            : [];
    const totalElements = data?.totalElements ?? data?.total_elements ?? posts.length;
    const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    return { posts, totalPages, totalElements };
}

function imageKey(image: PostImageDto) {
    return image.storedName || image.storageUrl || String(image.postImageId);
}

function EmptyState({ message }: { message: string }) {
    return <div className="community-empty">{message}</div>;
}

function LoadingState() {
    return <div className="community-loading">불러오는 중입니다.</div>;
}

function CommunityList() {
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
                        새 글 쓰기
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

function ImagePicker({
    files,
    onChange,
    onRemove,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    onRemove: (index: number) => void;
}) {
    const previews = useMemo(
        () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
        [files],
    );

    useEffect(() => {
        return () => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [previews]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || [])
            .filter((file) => file.type.startsWith('image/'));
        onChange(selectedFiles);
        event.target.value = '';
    };

    return (
        <div className="community-image-field">
            <label className="community-label" htmlFor="community-images">이미지 첨부</label>
            <input
                id="community-images"
                className="community-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
            />
            {files.length > 0 && (
                <div className="community-image-grid">
                    {previews.map((preview, index) => (
                        <div className="community-image-tile" key={`${preview.file.name}-${index}`}>
                            <img src={preview.url} alt={`${preview.file.name} 미리보기`} />
                            <button type="button" onClick={() => onRemove(index)}>삭제</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ExistingImageEditor({
    images,
    onRemove,
}: {
    images: PostImageDto[];
    onRemove: (key: string) => void;
}) {
    if (images.length === 0) return null;

    return (
        <div className="community-image-field">
            <div className="community-label">등록된 이미지</div>
            <div className="community-image-grid">
                {images.map((image) => (
                    <div className="community-image-tile" key={imageKey(image)}>
                        <img src={image.storageUrl} alt={image.originalName || '등록된 이미지'} />
                        <button type="button" onClick={() => onRemove(imageKey(image))}>제거</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CommunityForm({
    initialPost,
    mode,
}: {
    initialPost?: PostResponse;
    mode: 'write' | 'modify';
}) {
    const router = useRouter();
    const [title, setTitle] = useState(initialPost?.title || '');
    const [content, setContent] = useState(initialPost?.content || '');
    const [newImages, setNewImages] = useState<File[]>([]);
    const [retainedImages, setRetainedImages] = useState<PostImageDto[]>(initialPost?.images || []);
    const [submitting, setSubmitting] = useState(false);

    const isModify = mode === 'modify';

    const addImages = (files: File[]) => {
        setNewImages((prev) => [...prev, ...files]);
    };

    const removeNewImage = (index: number) => {
        setNewImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    };

    const removeRetainedImage = (key: string) => {
        setRetainedImages((prev) => prev.filter((image) => imageKey(image) !== key));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        if (!content.trim()) {
            alert('내용을 입력해주세요.');
            return;
        }

        setSubmitting(true);
        try {
            if (isModify && initialPost) {
                const updated = await communityService.updatePost(
                    initialPost.postId,
                    {
                        title: title.trim(),
                        content: content.trim(),
                        retainedImages: retainedImages
                            .map((image) => image.storedName)
                            .filter((name): name is string => Boolean(name)),
                    },
                    newImages,
                );
                router.push(`/view/COMMUNITY_DETAIL/${updated.postId}`);
                return;
            }

            const created = await communityService.createPost(
                { title: title.trim(), content: content.trim() },
                newImages,
            );
            router.push(`/view/COMMUNITY_DETAIL/${created.postId}`);
        } catch {
            alert(isModify ? '커뮤니티 글 수정에 실패했습니다.' : '커뮤니티 글 등록에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="community-page community-form-page">
            <div className="community-shell">
                <div className="community-toolbar">
                    <div>
                        <h1 className="community-title">{isModify ? '커뮤니티 글 수정' : '커뮤니티 글 쓰기'}</h1>
                        <p className="community-count">이미지는 글과 함께 저장됩니다.</p>
                    </div>
                    <button
                        className="community-secondary-btn"
                        type="button"
                        onClick={() => router.push(isModify && initialPost ? `/view/COMMUNITY_DETAIL/${initialPost.postId}` : '/view/COMMUNITY_LIST')}
                    >
                        돌아가기
                    </button>
                </div>

                <form className="community-form" onSubmit={handleSubmit}>
                    <label className="community-label" htmlFor="community-title">제목</label>
                    <input
                        id="community-title"
                        className="community-input"
                        value={title}
                        maxLength={200}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="제목을 입력하세요"
                    />

                    <label className="community-label" htmlFor="community-content">내용</label>
                    <textarea
                        id="community-content"
                        className="community-textarea"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="내용을 입력하세요"
                    />

                    {isModify && (
                        <ExistingImageEditor images={retainedImages} onRemove={removeRetainedImage} />
                    )}
                    <ImagePicker files={newImages} onChange={addImages} onRemove={removeNewImage} />

                    <div className="community-form-actions">
                        <button className="community-primary-btn" type="submit" disabled={submitting}>
                            {submitting ? '저장 중' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CommunityDetail({ postId }: { postId: number }) {
    const router = useRouter();
    const { isLoggedIn, user } = useAuth();
    const [post, setPost] = useState<PostResponse | null>(null);
    const [liked, setLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isOwner = Boolean(user?.userSqno && post?.authorSqno && user.userSqno === post.authorSqno);

    const loadPost = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await communityService.getPostDetail(postId);
            setPost(result);
        } catch {
            setError('커뮤니티 글을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        loadPost();
    }, [loadPost]);

    useEffect(() => {
        if (!isLoggedIn || !postId) return;
        communityService.getLikeStatus(postId)
            .then((status) => setLiked(status.liked))
            .catch(() => undefined);
    }, [isLoggedIn, postId]);

    const toggleLike = async () => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }
        try {
            const result = await communityService.toggleLike(postId);
            setLiked(result.liked);
            setPost((prev) => prev ? { ...prev, likeCount: result.likeCount } : prev);
        } catch {
            alert('좋아요 처리에 실패했습니다.');
        }
    };

    const reportPost = async () => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }
        const detailText = window.prompt('신고 사유를 입력해주세요.');
        if (!detailText) return;
        try {
            await communityService.reportPost(postId, 'ETC', detailText);
            alert('신고가 접수되었습니다.');
        } catch {
            alert('신고 처리에 실패했습니다.');
        }
    };

    const followAuthor = async () => {
        if (!isLoggedIn || !post?.authorSqno) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }
        try {
            const result = await communityService.toggleFollow(post.authorSqno);
            alert(result.following ? '팔로우했습니다.' : '팔로우를 취소했습니다.');
        } catch {
            alert('팔로우 처리에 실패했습니다.');
        }
    };

    const deletePost = async () => {
        if (!window.confirm('이 글을 삭제할까요?')) return;
        try {
            await communityService.deletePost(postId);
            router.push('/view/COMMUNITY_LIST');
        } catch {
            alert('삭제에 실패했습니다.');
        }
    };

    if (loading) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="community-page">
                <div className="community-shell">
                    <div className="community-error">{error || '글을 찾을 수 없습니다.'}</div>
                    <button className="community-secondary-btn" type="button" onClick={() => router.push('/view/COMMUNITY_LIST')}>
                        목록으로
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="community-page community-detail-page">
            <article className="community-shell community-detail">
                <div className="community-toolbar">
                    <button className="community-secondary-btn" type="button" onClick={() => router.push('/view/COMMUNITY_LIST')}>
                        목록
                    </button>
                    <div className="community-action-row">
                        {isOwner && (
                            <>
                                <button className="community-secondary-btn" type="button" onClick={() => router.push(`/view/COMMUNITY_MODIFY/${post.postId}`)}>
                                    수정
                                </button>
                                <button className="community-danger-btn" type="button" onClick={deletePost}>
                                    삭제
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <header className="community-detail-header">
                    <h1>{post.title}</h1>
                    <div className="community-meta-row">
                        <span>{post.authorNickname || '익명'}</span>
                        <span>{formatDate(post.createdAt)}</span>
                        <span>좋아요 {post.likeCount ?? 0}</span>
                    </div>
                </header>

                {post.images?.length > 0 && (
                    <div className="community-detail-images">
                        {post.images.map((image) => (
                            <a
                                href={image.storageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="community-detail-image"
                                key={imageKey(image)}
                            >
                                <img src={image.storageUrl} alt={image.originalName || '커뮤니티 이미지'} />
                            </a>
                        ))}
                    </div>
                )}

                <div className="community-content">{post.content}</div>

                <div className="community-detail-actions">
                    <button className={liked ? 'community-primary-btn' : 'community-secondary-btn'} type="button" onClick={toggleLike}>
                        {liked ? '좋아요 취소' : '좋아요'}
                    </button>
                    {!isOwner && (
                        <button className="community-secondary-btn" type="button" onClick={followAuthor}>
                            작성자 팔로우
                        </button>
                    )}
                    <button className="community-secondary-btn" type="button" onClick={reportPost}>
                        신고
                    </button>
                </div>
            </article>
        </div>
    );
}

function CommunityModify({ postId }: { postId: number }) {
    const router = useRouter();
    const { user } = useAuth();
    const [post, setPost] = useState<PostResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        communityService.getPostDetail(postId)
            .then((result) => {
                if (!mounted) return;
                if (user?.userSqno && result.authorSqno && user.userSqno !== result.authorSqno) {
                    alert('수정 권한이 없습니다.');
                    router.replace(`/view/COMMUNITY_DETAIL/${postId}`);
                    return;
                }
                setPost(result);
            })
            .catch(() => setError('수정할 글을 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
        return () => {
            mounted = false;
        };
    }, [postId, router, user?.userSqno]);

    if (loading) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="community-page">
                <div className="community-shell">
                    <div className="community-error">{error || '글을 찾을 수 없습니다.'}</div>
                    <button className="community-secondary-btn" type="button" onClick={() => router.push('/view/COMMUNITY_LIST')}>
                        목록으로
                    </button>
                </div>
            </div>
        );
    }

    return <CommunityForm mode="modify" initialPost={post} />;
}

export default function CommunityPage({ screenId, refId }: CommunityPageProps) {
    const router = useRouter();
    const { isLoggedIn, isLoading } = useAuth();
    const mode = getMode(screenId);
    const postId = refId === null ? Number.NaN : Number(refId);

    useEffect(() => {
        if (isLoading) return;
        if ((mode === 'write' || mode === 'modify') && !isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.replace('/view/LOGIN_PAGE');
        }
    }, [isLoading, isLoggedIn, mode, router]);

    if (isLoading) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if ((mode === 'write' || mode === 'modify') && !isLoggedIn) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if (mode === 'write') return <CommunityForm mode="write" />;
    if (mode === 'detail' && Number.isFinite(postId)) return <CommunityDetail postId={postId} />;
    if (mode === 'modify' && Number.isFinite(postId)) return <CommunityModify postId={postId} />;

    return <CommunityList />;
}
