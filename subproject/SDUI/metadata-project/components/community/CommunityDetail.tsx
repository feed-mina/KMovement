'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import CommunityDiscussion from '@/components/community/CommunityDiscussion';
import { backoffDelay } from '@/lib/net/backoff';
import { AnimationStatusResponse, BatchImageInput, communityService, PostImageDto, PostResponse } from '@/services/communityService';
import { ANIM_POLL_BASE_MS, ANIM_POLL_MAX_MS, ANIM_POLL_MAX_FAILURES, formatDate, imageKey, animationRouteLabel, formatFailedImageIndexes, LoadingState } from './communityShared';

export function CommunityDetail({ postId }: { postId: number }) {
    const router = useRouter();
    const { isLoggedIn, user } = useAuth();
    const [post, setPost] = useState<PostResponse | null>(null);
    const [liked, setLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [animStatus, setAnimStatus] = useState<AnimationStatusResponse | null>(null);
    const [animSubmitting, setAnimSubmitting] = useState(false);
    const [animRouteModal, setAnimRouteModal] = useState(false);
    const [trajectoryPreset, setTrajectoryPreset] = useState('object_pan_right');
    const [batchModal, setBatchModal] = useState(false);
    const [batchTtsTexts, setBatchTtsTexts] = useState<string[]>([]);
    const [batchImageTypes, setBatchImageTypes] = useState<('photo' | 'sketch' | 'auto')[]>([]);
    const [batchBgmDescription, setBatchBgmDescription] = useState('');
    const [batchBgmDuration, setBatchBgmDuration] = useState(15);
    const [batchSubmitting, setBatchSubmitting] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [animPollStopped, setAnimPollStopped] = useState(false);
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
        if (!isLoggedIn || !postId || post?.moderationStatus !== 'APPROVED') return;
        communityService.getLikeStatus(postId)
            .then((status) => setLiked(status.liked))
            .catch(() => undefined);
    }, [isLoggedIn, post?.moderationStatus, postId]);

    // 영상 생성 상태 조회: 성공하면 3초 간격, 실패하면 3초→6초→12초…(최대 30초)로 늦추고
    // 5번 연속 실패하면 멈춘 뒤 안내 문구를 보여 준다. (예전에는 오류를 무시하고 3초마다 무한 반복)
    const startAnimPolling = useCallback(() => {
        if (pollingRef.current) return;
        let failures = 0;
        setAnimPollStopped(false);
        const tick = async () => {
            try {
                const status = await communityService.getAnimationStatus(postId);
                failures = 0;
                setAnimStatus(status);
                if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                    pollingRef.current = null;
                    return;
                }
                pollingRef.current = setTimeout(tick, ANIM_POLL_BASE_MS);
            } catch {
                failures += 1;
                if (failures >= ANIM_POLL_MAX_FAILURES) {
                    pollingRef.current = null;
                    setAnimPollStopped(true);
                    return;
                }
                pollingRef.current = setTimeout(tick, backoffDelay(failures, { baseMs: ANIM_POLL_BASE_MS, maxMs: ANIM_POLL_MAX_MS }));
            }
        };
        pollingRef.current = setTimeout(tick, ANIM_POLL_BASE_MS);
    }, [postId]);

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

    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, []);

    const isDoodleImage = (image: PostImageDto): boolean =>
        image.originalName?.startsWith('kride-doodle-sketch-') ||
        image.storedName?.startsWith('kride-doodle-sketch-');

    const getFirstPhotoImageId = (): number | null => {
        const firstImage = post?.images?.find((image) => !isDoodleImage(image));
        if (!firstImage?.postImageId) {
            alert('영상을 생성하려면 게시글에 이미지가 필요합니다.');
            return null;
        }
        return firstImage.postImageId;
    };

    const submitAnimation = async (route: string) => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.push('/view/LOGIN_PAGE');
            return;
        }

        const doodleImage = post?.images
            ?.slice()
            .reverse()
            .find(isDoodleImage);
        const postImageId = route === 'animated_drawings_worker'
            ? doodleImage?.postImageId ?? getFirstPhotoImageId()
            : getFirstPhotoImageId();
        if (!postImageId) return;

        setAnimRouteModal(false);
        setAnimSubmitting(true);
        try {
            const result = await communityService.submitAnimation(
                postId,
                postImageId,
                route,
                route === 'tora_cogvideox_i2v' ? trajectoryPreset : '',
            );
            setAnimStatus(result);
            startAnimPolling();
        } catch {
            alert('영상 생성 요청에 실패했습니다.');
        } finally {
            setAnimSubmitting(false);
        }
    };

    const openBatchModal = () => {
        if (!post?.images?.length || post.images.length < 2) {
            alert('배치 영상 생성에는 이미지가 2장 이상 필요합니다.');
            return;
        }
        setBatchTtsTexts(post.images.map(() => ''));
        setBatchImageTypes(post.images.map(() => 'auto'));
        setBatchBgmDescription('');
        setBatchBgmDuration(15);
        setBatchModal(true);
    };

    const submitBatchAnimation = async () => {
        if (!post?.images?.length) return;
        setBatchSubmitting(true);
        try {
            const batchImages: BatchImageInput[] = [];
            for (let i = 0; i < post.images.length; i++) {
                const img = post.images[i];
                batchImages.push({
                    postImageId: img.postImageId,
                    ttsText: batchTtsTexts[i] || post.title || '',
                    imageType: batchImageTypes[i] || 'auto',
                });
            }

            const result = await communityService.submitBatchAnimation(
                postId,
                batchImages,
                'bright_travel',
                'auto',
                batchBgmDescription,
                batchBgmDuration,
            );
            setAnimStatus({
                jobId: result.jobId,
                status: result.status,
                resultUrl: '',
                errorMessage: '',
                route: 'batch_video',
                totalImages: result.totalImages,
                processedImages: 0,
                actualModel: '',
                actualModelExecuted: null,
                fallbackUsed: false,
                fallbackType: '',
                fallbackReason: '',
                failedImageIndexes: '',
            });
            setBatchModal(false);
            startAnimPolling();
        } catch {
            alert('배치 영상 생성 요청에 실패했습니다.');
        } finally {
            setBatchSubmitting(false);
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

    const animRouteText = animationRouteLabel(animStatus?.route);
    const failedImageText = formatFailedImageIndexes(animStatus?.failedImageIndexes);
    const fallbackNotice = animStatus?.fallbackUsed
        ? animStatus.fallbackReason || animStatus.fallbackType || '실제 모델 대신 폴백 경로가 사용되었습니다.'
        : '';
    const hasBatchProgress =
        typeof animStatus?.totalImages === 'number' && animStatus.totalImages > 1;
    const moderationStatus = post.moderationStatus ?? 'APPROVED';

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

                {moderationStatus === 'PENDING' && (
                    <div className="community-moderation-notice" role="status">
                        <strong>운영 검수 대기 중입니다.</strong>
                        <span>검수가 끝나면 다른 여행자에게 공개되고 댓글·좋아요를 받을 수 있습니다.</span>
                    </div>
                )}
                {moderationStatus === 'REJECTED' && (
                    <div className="community-moderation-notice is-rejected" role="status">
                        <strong>이 글은 공개되지 않았습니다.</strong>
                        <span>내용을 수정해 다시 등록하거나 운영 기준에 맞는지 확인해 주세요.</span>
                    </div>
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
                            </div>
                        ))}
                    </div>
                )}

                <div className="community-animation-section">
                    {animStatus?.status === 'COMPLETED' && animStatus.resultUrl && (
                        <div className="community-animation-result">
                            <h3>영상 결과</h3>
                            <video controls preload="metadata" src={animStatus.resultUrl} />
                            <div className="community-animation-meta">
                                {animRouteText && <span>{animRouteText}</span>}
                                {hasBatchProgress && (
                                    <span>
                                        {animStatus.processedImages ?? 0}/{animStatus.totalImages}장 처리
                                    </span>
                                )}
                                {animStatus.actualModel && <span>실행 모델 {animStatus.actualModel}</span>}
                                {fallbackNotice && (
                                    <span className="community-animation-meta-warning">
                                        폴백 실행: {fallbackNotice}
                                    </span>
                                )}
                                {failedImageText && <span>실패 이미지 {failedImageText}</span>}
                            </div>
                        </div>
                    )}
                    {animStatus?.status === 'QUEUED' || animStatus?.status === 'RUNNING' ? (
                        <p className="community-animation-progress">
                            영상 생성 중... ({animStatus.status})
                            {hasBatchProgress && ` ${animStatus.processedImages ?? 0}/${animStatus.totalImages}장`}
                        </p>
                    ) : null}
                    {animPollStopped && (animStatus?.status === 'QUEUED' || animStatus?.status === 'RUNNING') && (
                        <p className="community-animation-progress" role="status">
                            진행 상태를 확인하지 못했어요. 잠시 후 새로고침해 주세요.
                        </p>
                    )}
                    {animStatus?.status === 'FAILED' && (
                        <div className="community-animation-error">
                            <p>영상 생성 실패: {animStatus.errorMessage || '알 수 없는 오류'}</p>
                            {isOwner && (
                                <button
                                    className="community-secondary-btn"
                                    type="button"
                                    style={{ marginTop: 6, fontSize: 12 }}
                                    onClick={async () => {
                                        try {
                                            await communityService.resetAnimationStatus(postId);
                                            setAnimStatus(null);
                                        } catch {
                                            alert('초기화 실패');
                                        }
                                    }}
                                >
                                    에러 기록 초기화
                                </button>
                            )}
                        </div>
                    )}
                    {isOwner && (!animStatus || animStatus.status === 'FAILED' || animStatus.status === 'NONE') && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="community-primary-btn"
                                type="button"
                                disabled={animSubmitting}
                                onClick={() => setAnimRouteModal(true)}
                            >
                                {animSubmitting ? '요청 중...' : '첫 이미지 영상 만들기'}
                            </button>
                            {post?.images && post.images.length >= 2 && (
                                <button
                                    className="community-primary-btn"
                                    type="button"
                                    disabled={batchSubmitting}
                                    onClick={openBatchModal}
                                >
                                    {batchSubmitting ? '요청 중...' : '전체 이미지로 영상 만들기'}
                                </button>
                            )}
                        </div>
                    )}

                    {animRouteModal && (
                        <div className="community-sketch-backdrop" role="dialog" aria-modal="true" aria-label="영상 유형 선택">
                            <div className="community-sketch-panel" style={{ maxWidth: 520 }}>
                                <div className="community-sketch-header">
                                    <div>
                                        <h2>첫 번째 이미지 영상 만들기</h2>
                                        <p>게시글의 첫 번째 이미지만 사용합니다.</p>
                                    </div>
                                    <button className="community-secondary-btn" type="button" onClick={() => setAnimRouteModal(false)}>
                                        닫기
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        onClick={() => submitAnimation('animated_drawings_worker')}
                                    >
                                        스케치/캐릭터 애니메이션
                                        <br /><small>첫 이미지가 낙서나 캐릭터 그림일 때</small>
                                    </button>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={!post?.images?.length}
                                        onClick={() => submitAnimation('cogvideox_real')}
                                    >
                                        사진 AI 영상
                                        <br /><small>첫 사진 → CogVideoX 시네마틱 영상</small>
                                    </button>
                                    <label className="community-traj-select">
                                        경로(궤적):
                                        <select
                                            value={trajectoryPreset}
                                            onChange={(e) => setTrajectoryPreset(e.target.value)}
                                        >
                                            <option value="object_pan_right">오른쪽으로 이동</option>
                                            <option value="object_pan_left">왼쪽으로 이동</option>
                                            <option value="arc_up">위로 아치</option>
                                            <option value="arc_down">아래로 아치</option>
                                            <option value="pause_then_move">멈췄다 이동</option>
                                        </select>
                                    </label>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={
                                            !post?.images?.some((image) => !isDoodleImage(image))
                                        }
                                        onClick={() => submitAnimation('tora_cogvideox_i2v')}
                                    >
                                        <span>사진 Tora 경로 제어</span>
                                        <br /><small>사진 전용 I2V입니다. 낙서/스케치는 미디어 애니메이션으로 실행됩니다.</small>
                                    </button>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={!post?.images?.length}
                                        onClick={() => submitAnimation('3d_photo_inpainting_real')}
                                    >
                                        사진 3D 모션
                                        <br /><small>첫 사진 → 3D 깊이/카메라 이동 효과</small>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {batchModal && post?.images && (
                        <div className="community-sketch-backdrop" role="dialog" aria-modal="true" aria-label="배치 영상 설정">
                            <div className="community-sketch-panel" style={{ maxWidth: 560 }}>
                                <div className="community-sketch-header">
                                    <h2>전체 이미지로 영상 만들기</h2>
                                    <button className="community-secondary-btn" type="button" onClick={() => setBatchModal(false)}>
                                        닫기
                                    </button>
                                </div>
                                <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <p style={{ color: '#64748b', fontSize: 14 }}>
                                        모든 첨부 이미지를 장면으로 만들고 이어붙입니다. 나레이션을 비워두면 게시글 제목이 사용됩니다.
                                    </p>
                                    {post.images.map((img, idx) => (
                                        <div key={imageKey(img)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                            <img
                                                src={img.storageUrl}
                                                alt={img.originalName || `이미지 ${idx + 1}`}
                                                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }}
                                            />
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <input
                                                    className="community-input"
                                                    placeholder={`이미지 ${idx + 1} 나레이션 (선택)`}
                                                    value={batchTtsTexts[idx] || ''}
                                                    onChange={(e) => {
                                                        const next = [...batchTtsTexts];
                                                        next[idx] = e.target.value;
                                                        setBatchTtsTexts(next);
                                                    }}
                                                />
                                                <select
                                                    className="community-input"
                                                    value={batchImageTypes[idx] || 'auto'}
                                                    onChange={(e) => {
                                                        const next = [...batchImageTypes];
                                                        next[idx] = e.target.value as 'photo' | 'sketch' | 'auto';
                                                        setBatchImageTypes(next);
                                                    }}
                                                >
                                                    <option value="auto">자동 감지</option>
                                                    <option value="photo">사진</option>
                                                    <option value="sketch">낙서/스케치</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ color: '#64748b', fontSize: 14 }}>
                                            BGM 설명 (MusicGen AI 생성, 비워두면 기본 BGM)
                                        </label>
                                        <input
                                            className="community-input"
                                            placeholder="예: calm Korean ambient music for travel"
                                            value={batchBgmDescription}
                                            onChange={(e) => setBatchBgmDescription(e.target.value)}
                                        />
                                        {batchBgmDescription && (
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <label style={{ color: '#64748b', fontSize: 13, whiteSpace: 'nowrap' }}>
                                                    BGM 길이 (초)
                                                </label>
                                                <input
                                                    className="community-input"
                                                    type="number"
                                                    min={5}
                                                    max={30}
                                                    value={batchBgmDuration}
                                                    onChange={(e) => setBatchBgmDuration(Math.min(30, Math.max(5, Number(e.target.value) || 15)))}
                                                    style={{ width: 80 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="community-primary-btn"
                                        type="button"
                                        disabled={batchSubmitting}
                                        onClick={submitBatchAnimation}
                                    >
                                        {batchSubmitting ? '요청 중...' : `${post.images.length}장으로 영상 생성하기`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="community-content">{post.content}</div>

                {moderationStatus === 'APPROVED' && (
                    <>
                        <div className="community-detail-actions">
                            <button className={liked ? 'community-primary-btn' : 'community-secondary-btn'} type="button" onClick={toggleLike}>
                                {liked ? '좋아요 취소' : '좋아요'}
                            </button>
                            {!isOwner && (
                                <button className="community-secondary-btn" type="button" onClick={followAuthor}>
                                    작성자 팔로우
                                </button>
                            )}
                        </div>

                        <CommunityDiscussion
                            postId={postId}
                            isLoggedIn={isLoggedIn}
                            currentUserSqno={user?.userSqno}
                            onRequireLogin={() => {
                                alert('로그인이 필요한 기능입니다.');
                                router.push('/view/LOGIN_PAGE');
                            }}
                        />
                    </>
                )}
            </article>
        </div>
    );
}
