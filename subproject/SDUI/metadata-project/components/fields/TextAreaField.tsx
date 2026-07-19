'use client';

import React, { memo } from "react";
import { cn } from "@/components/utils/cn";

interface TextAreaFieldProps {
    id: string;
    meta: any;
    data?: any;
    onChange: (id: string, value: string) => void;
    [key: string]: any;
}

const TextAreaField = memo(({ id, meta, data, onChange, ...rest }: TextAreaFieldProps) => {
    // 1. DOM으로 전달되면 안 되는 속성들을 rest에서 분리
    const {
        onAction,
        pwType,
        showPassword,
        className: _ignoredClassName,
        ...domSafeRest
    } = rest;

    // 2. 데이터 매핑 키 결정
    const targetKey = meta?.ref_data_id || meta?.refDataId || meta?.componentId || id;

    // 3. 값 추출
    const value = (typeof data === 'string' || typeof data === 'number')
        ? data
        : (data?.[targetKey] || "");

    // 4. 읽기 전용 여부 판단
    const isReadOnly = meta?.isReadonly === true || meta?.isReadonly === "true" ||
        meta?.is_readonly === true || meta?.is_readonly === "true";
    const labelText = meta?.labelText || meta?.label_text;

    // 5. 클래스 병합
    const mergedClassName = cn(
        "common-textarea",
        meta?.css_class,
        meta?.cssClass,
        rest.className,
        isReadOnly && "is-readonly"
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isReadOnly && onChange) {
            onChange(targetKey, e.target.value);
        }
    };

    return (
        <div className={cn("textarea-field-wrap", isReadOnly && "readonly-wrap")}>
            {labelText && (isReadOnly ? (
                <span className="field-label">{labelText}</span>
            ) : (
                <label className="field-label" htmlFor={id}>{labelText}</label>
            ))}

            {isReadOnly ? (
                <div
                    className={cn(mergedClassName, "readonly-content")}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                    {value || <span className="placeholder-text">내용이 없습니다.</span>}
                </div>
            ) : (
                <textarea
                    {...domSafeRest}
                    id={id}
                    className={mergedClassName}
                    value={value}
                    placeholder={meta?.placeholder}
                    onChange={handleChange}
                />
            )}
        </div>
    );
});

TextAreaField.displayName = "TextAreaField";
export default TextAreaField;
