'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { communityService, PostImageDto, PostResponse } from '@/services/communityService';
import { imageKey } from './communityShared';
import { SketchPad } from './SketchPad';
import { MAX_IMAGES, ImagePicker, ExistingImageEditor } from './ImagePicker';

export function CommunityForm({
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

    const totalImages = retainedImages.length + newImages.length;

    const addImages = (files: File[]) => {
        setNewImages((prev) => {
            const remaining = MAX_IMAGES - retainedImages.length - prev.length;
            if (remaining <= 0) {
                alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
                return prev;
            }
            const toAdd = files.slice(0, remaining);
            if (toAdd.length < files.length) {
                alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다. ${toAdd.length}장만 추가됩니다.`);
            }
            return [...prev, ...toAdd];
        });
    };

    const addSketchImage = (file: File, _dataUrl: string) => {
        setNewImages((prev) => [...prev, file]);
        setSketchNotice('스케치가 첨부 이미지에 추가되었습니다.');
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
        const imageTotal = retainedImages.length + newImages.length;
        if (imageTotal < 1) {
            alert('이미지를 최소 1장 이상 첨부해주세요.');
            return;
        }
        if (imageTotal > MAX_IMAGES) {
            alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
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
                        currentTotal={totalImages}
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
