'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { cn } from "@/components/utils/cn";

const ImageField = memo(({ meta, pageData, ...rest }: any) => {
    // 1. HTML 태그에 전달되면 안 되는 커스텀 속성들을 rest에서 분리합니다.
    const {
        onAction,
        pwType,
        showPassword,
        className: ignoredClassName, // rest에 포함된 className은 아래에서 mergedClassName으로 처리하므로 제외
        ...domSafeRest
    } = rest;

    // 2. 읽기 전용 여부 판단
    const isReadOnly = meta?.isReadonly === true || meta?.isReadonly === "true" ||
        meta?.is_readonly === true || meta?.is_readonly === "true";

    // 3. 이미지 경로 및 파일명 처리
    const label = meta?.label_text || meta?.labelText || "";
    // 슬래시는 경로 구분자이므로 각 세그먼트만 인코딩
    const encodedLabel = label
        ? label.split('/').map((seg: string) => encodeURIComponent(seg)).join('/')
        : "";
    const imagePath = encodedLabel ? `/img/${encodedLabel}` : "/img/default.png";

    // 이미지 크기 설정 (ui_metadata의 inline_style에서 width/height 추출 가능)
    const width = meta?.width || 800;
    const height = meta?.height || 600;

    // 4. 인라인 스타일 안전하게 파싱
    let customStyle = {};
    try {
        customStyle = typeof meta?.inlineStyle === 'string'
            ? JSON.parse(meta.inlineStyle)
            : (meta?.inlineStyle || {});
    } catch (e) {
        customStyle = {};
    }

    // 5. 클래스 병합
    const mergedClassName = cn(
        "ui-image-element",
        meta?.cssClass,
        meta?.css_class,
        rest.className,
        isReadOnly && "is-readonly"
    );

    return (
        <div style={{ ...customStyle, width: "100%", position: "relative" }} className="image-field-wrapper">
            <Image
                {...domSafeRest}
                src={imagePath}
                alt={meta?.altText || "ui-element"}
                width={width}
                height={height}
                className={mergedClassName}
                style={{ width: "100%", height: "auto", objectFit: "contain" }}
                priority={meta?.priority === true}
                unoptimized={true} // Vercel 이미지 최적화 비활성화 (public 파일 직접 사용)
            />
        </div>
    );
});

ImageField.displayName = "ImageField";
export default ImageField;