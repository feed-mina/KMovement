'use client';

import {
    ChangeEvent,
    FormEvent,
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    AnimationStatusResponse,
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

type SketchHandoff = {
    kind: 'community-sketch' | 'community-image';
    filename?: string;
    dataUrl?: string;
    sourceUrl?: string;
    originalName?: string;
    createdAt: string;
};

const PAGE_SIZE = 5;
const SKETCH_HANDOFF_KEY = 'kride:doodle-source';

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

function rememberDoodleSource(payload: SketchHandoff) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SKETCH_HANDOFF_KEY, JSON.stringify(payload));
}

function dataUrlToFile(dataUrl: string, filename: string) {
    const [header, encoded] = dataUrl.split(',');
    const mime = header.match(/data:(.*);base64/)?.[1] || 'image/png';
    const bytes = window.atob(encoded);
    const buffer = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
        buffer[index] = bytes.charCodeAt(index);
    }
    return new File([buffer], filename, { type: mime });
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

function SketchPad({
    onSave,
    onClose,
}: {
    onSave: (file: File, dataUrl: string) => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const historyRef = useRef<string[]>([]);
    const [brushColor, setBrushColor] = useState('#111827');
    const [brushSize, setBrushSize] = useState(10);
    const [isErasing, setIsErasing] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ w: 640, h: 480 });

    useEffect(() => {
        const updateSize = () => {
            const maxW = Math.min(window.innerWidth - 48, 640);
            const h = Math.round(maxW * 0.75); // 4:3 비율 유지
            setCanvasSize({ w: maxW, h });
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const prepareCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.lineCap = 'round';
        context.lineJoin = 'round';
    }, []);

    useEffect(() => {
        prepareCanvas();
    }, [prepareCanvas, canvasSize]);

    const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const pushHistory = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        historyRef.current = [...historyRef.current.slice(-12), canvas.toDataURL('image/png')];
    };

    const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        pushHistory();
        drawingRef.current = true;
        canvas.setPointerCapture(event.pointerId);
        const point = getPoint(event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    };

    const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!context) return;
        const point = getPoint(event);
        context.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
        context.strokeStyle = brushColor;
        context.lineWidth = brushSize;
        context.lineTo(point.x, point.y);
        context.stroke();
    };

    const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const clearCanvas = () => {
        pushHistory();
        prepareCanvas();
    };

    const undo = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const previous = historyRef.current.pop();
        if (!canvas || !context || !previous) return;
        const image = new Image();
        image.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = previous;
    };

    const saveSketch = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `kride-doodle-sketch-${Date.now()}.png`;
        onSave(dataUrlToFile(dataUrl, filename), dataUrl);
    };

    return (
        <div className="community-sketch-backdrop" role="dialog" aria-modal="true" aria-label="스케치 도구">
            <div className="community-sketch-panel">
                <div className="community-sketch-header">
                    <div>
                        <h2>스케치</h2>
                        <p>그린 이미지는 글의 첨부 이미지와 낙서 입력으로 저장됩니다.</p>
                    </div>
                    <button className="community-secondary-btn" type="button" onClick={onClose}>
                        닫기
                    </button>
                </div>

                <canvas
                    ref={canvasRef}
                    className="community-sketch-canvas"
                    width={canvasSize.w}
                    height={canvasSize.h}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    onPointerLeave={(event) => {
                        if (drawingRef.current) stopDrawing(event);
                    }}
                />

                <div className="community-sketch-tools">
                    <div className="community-sketch-swatches" aria-label="펜 색상">
                        {['#111827', '#2563eb', '#dc2626', '#16a34a'].map((color) => (
                            <button
                                key={color}
                                type="button"
                                aria-label={`${color} 색상`}
                                className={brushColor === color && !isErasing ? 'active' : ''}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setBrushColor(color);
                                    setIsErasing(false);
                                }}
                            />
                        ))}
                    </div>
                    <label className="community-sketch-size">
                        굵기
                        <input
                            type="range"
                            min={3}
                            max={28}
                            value={brushSize}
                            onChange={(event) => setBrushSize(Number(event.target.value))}
                        />
                    </label>
                    <button
                        className={isErasing ? 'community-primary-btn' : 'community-secondary-btn'}
                        type="button"
                        onClick={() => setIsErasing((value) => !value)}
                    >
                        지우개
                    </button>
                    <button className="community-secondary-btn" type="button" onClick={undo}>
                        되돌리기
                    </button>
                    <button className="community-danger-btn" type="button" onClick={clearCanvas}>
                        비우기
                    </button>
                    <button className="community-primary-btn" type="button" onClick={saveSketch}>
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}

function ImagePicker({
    files,
    onChange,
    onRemove,
    onOpenSketch,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    onRemove: (index: number) => void;
    onOpenSketch: () => void;
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

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const imageFiles = Array.from(event.target.files || [])
            .filter((file) => file.type.startsWith('image/'));
        const oversized = imageFiles.filter((file) => file.size > MAX_FILE_SIZE);
        if (oversized.length > 0) {
            alert(`${oversized.map((f) => f.name).join(', ')} 파일이 10MB를 초과합니다. 해당 파일은 제외됩니다.`);
        }
        const selectedFiles = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE);
        onChange(selectedFiles);
        event.target.value = '';
    };

    return (
        <div className="community-image-field">
            <div className="community-field-head">
                <label className="community-label" htmlFor="community-images">이미지 첨부</label>
                <button className="community-secondary-btn" type="button" onClick={onOpenSketch}>
                    스케치하기
                </button>
            </div>
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
                            <button type="button" onClick={() => onRemove(index)}>제거</button>
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
    const [sketchOpen, setSketchOpen] = useState(false);
    const [sketchNotice, setSketchNotice] = useState('');

    const isModify = mode === 'modify';

    const addImages = (files: File[]) => {
        setNewImages((prev) => [...prev, ...files]);
    };

    const addSketchImage = (file: File, dataUrl: string) => {
        setNewImages((prev) => [...prev, file]);
        rememberDoodleSource({
            kind: 'community-sketch',
            filename: file.name,
            dataUrl,
            createdAt: new Date().toISOString(),
        });
        setSketchNotice('스케치가 첨부 이미지에 추가되고 낙서 입력으로 저장되었습니다.');
        setSketchOpen(false);
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
                    <ImagePicker
                        files={newImages}
                        onChange={addImages}
                        onRemove={removeNewImage}
                        onOpenSketch={() => setSketchOpen(true)}
                    />
                    {sketchNotice && (
                        <p className="community-sketch-notice" role="status">
                            {sketchNotice}
                        </p>
                    )}

                    <div className="community-form-actions">
                        <button className="community-primary-btn" type="submit" disabled={submitting}>
                            {submitting ? '저장 중' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>

            {sketchOpen && (
                <SketchPad
                    onSave={addSketchImage}
                    onClose={() => setSketchOpen(false)}
                />
            )}
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
    const [doodleNotice, setDoodleNotice] = useState('');
    const [animStatus, setAnimStatus] = useState<AnimationStatusResponse | null>(null);
    const [animSubmitting, setAnimSubmitting] = useState(false);
    const [animRouteModal, setAnimRouteModal] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    useEffect(() => {
        communityService.getAnimationStatus(postId)
            .then((status) => {
                setAnimStatus(status);
                if (status.status === 'QUEUED' || status.status === 'RUNNING') {
                    startAnimPolling();
                }
            })
            .catch(() => undefined);
    }, [postId, startAnimPolling]);

    const startAnimPolling = useCallback(() => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(async () => {
            try {
                const status = await communityService.getAnimationStatus(postId);
                setAnimStatus(status);
                if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                }
            } catch {
                /* ignore polling errors */
            }
        }, 3000);
    }, [postId]);

    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, []);

    const getImageBase64 = async (route: string): Promise<string | null> => {
        if (route === 'animated_drawings_worker') {
            const handoff = typeof window !== 'undefined'
                ? window.localStorage.getItem(SKETCH_HANDOFF_KEY)
                : null;
            if (!handoff) {
                alert('먼저 스케치를 그려주세요. 글 작성 시 스케치하기를 이용하세요.');
                return null;
            }
            const parsed = JSON.parse(handoff) as SketchHandoff;
            return parsed.dataUrl?.split(',')[1] || null;
        }
        // CogVideoX / 3D Photo: 게시글 첨부 이미지 사용
        const firstImage = post?.images?.[0];
        if (!firstImage?.storageUrl) {
            alert('영상을 생성하려면 게시글에 이미지가 필요합니다.');
            return null;
        }
        try {
            const res = await fetch(firstImage.storageUrl);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1] || null);
                };
                reader.readAsDataURL(blob);
            });
        } catch {
            alert('이미지를 불러오지 못했습니다.');
            return null;
        }
    };

    const submitAnimation = async (route: string) => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }

        const imageBase64 = await getImageBase64(route);
        if (!imageBase64) return;

        setAnimRouteModal(false);
        setAnimSubmitting(true);
        try {
            const result = await communityService.submitAnimation(postId, imageBase64, route);
            setAnimStatus(result);
            startAnimPolling();
        } catch {
            alert('영상 생성 요청에 실패했습니다.');
        } finally {
            setAnimSubmitting(false);
        }
    };

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

    const sendImageToDoodle = (image: PostImageDto) => {
        rememberDoodleSource({
            kind: 'community-image',
            sourceUrl: image.storageUrl,
            originalName: image.originalName,
            createdAt: new Date().toISOString(),
        });
        setDoodleNotice('선택한 이미지가 낙서 입력으로 저장되었습니다.');
        alert('이 이미지를 낙서 입력으로 보낼 준비가 완료되었습니다.');
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

                {doodleNotice && (
                    <p className="community-sketch-notice" role="status">
                        {doodleNotice}
                    </p>
                )}

                {post.images?.length > 0 && (
                    <div className="community-detail-images">
                        {post.images.map((image) => (
                            <div className="community-detail-image-wrap" key={imageKey(image)}>
                                <a
                                    href={image.storageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="community-detail-image"
                                >
                                    <img src={image.storageUrl} alt={image.originalName || '커뮤니티 이미지'} />
                                </a>
                                <button
                                    className="community-image-doodle-btn"
                                    type="button"
                                    onClick={() => sendImageToDoodle(image)}
                                >
                                    낙서로 보내기
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="community-animation-section">
                    {animStatus?.status === 'COMPLETED' && animStatus.resultUrl && (
                        <div className="community-animation-result">
                            <h3>영상 결과</h3>
                            <video controls preload="metadata" src={animStatus.resultUrl} />
                        </div>
                    )}
                    {animStatus?.status === 'QUEUED' || animStatus?.status === 'RUNNING' ? (
                        <p className="community-animation-progress">
                            영상 생성 중... ({animStatus.status})
                        </p>
                    ) : null}
                    {animStatus?.status === 'FAILED' && (
                        <p className="community-animation-error">
                            영상 생성 실패: {animStatus.errorMessage || '알 수 없는 오류'}
                        </p>
                    )}
                    {isOwner && (!animStatus || animStatus.status === 'FAILED') && (
                        <button
                            className="community-primary-btn"
                            type="button"
                            disabled={animSubmitting}
                            onClick={() => setAnimRouteModal(true)}
                        >
                            {animSubmitting ? '요청 중...' : '영상 만들기'}
                        </button>
                    )}

                    {animRouteModal && (
                        <div className="community-sketch-backdrop" role="dialog" aria-modal="true" aria-label="영상 유형 선택">
                            <div className="community-sketch-panel" style={{ maxWidth: 420 }}>
                                <div className="community-sketch-header">
                                    <h2>어떤 영상을 만들까요?</h2>
                                    <button className="community-secondary-btn" type="button" onClick={() => setAnimRouteModal(false)}>
                                        닫기
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        onClick={() => submitAnimation('animated_drawings_worker')}
                                    >
                                        스케치 애니메이션
                                        <br /><small>스케치/그림 → 캐릭터 움직임</small>
                                    </button>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={!post?.images?.length}
                                        onClick={() => submitAnimation('cogvideox_real')}
                                    >
                                        AI 영상 생성
                                        <br /><small>첨부 사진 → AI 시네마틱 영상 (GPU)</small>
                                    </button>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={!post?.images?.length}
                                        onClick={() => submitAnimation('3d_photo_inpainting_real')}
                                    >
                                        3D 사진 영상
                                        <br /><small>첨부 사진 → 3D 깊이 카메라 효과</small>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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
