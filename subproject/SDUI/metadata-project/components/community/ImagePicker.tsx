'use client';

import { ChangeEvent, useEffect, useMemo } from 'react';
import { PostImageDto } from '@/services/communityService';
import { imageKey } from './communityShared';

export const MAX_IMAGES = 10;

export function ImagePicker({
    files,
    onChange,
    onRemove,
    onOpenSketch,
    currentTotal,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    onRemove: (index: number) => void;
    onOpenSketch: () => void;
    currentTotal: number;
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
        let selectedFiles = imageFiles.filter((file) => file.size <= MAX_FILE_SIZE);
        const remaining = MAX_IMAGES - currentTotal;
        if (selectedFiles.length > remaining) {
            alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다. ${remaining}장만 추가됩니다.`);
            selectedFiles = selectedFiles.slice(0, remaining);
        }
        if (selectedFiles.length > 0) {
            onChange(selectedFiles);
        }
        event.target.value = '';
    };

    return (
        <div className="community-image-field">
            <div className="community-field-head">
                <label className="community-label" htmlFor="community-images">이미지 첨부 (최소 1장, 최대 {MAX_IMAGES}장)</label>
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

export function ExistingImageEditor({
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
