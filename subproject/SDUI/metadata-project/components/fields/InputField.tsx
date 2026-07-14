'use client';

import React, { memo } from "react";
import "../../app/styles/field.css";
import { formatKoreanPhoneNumber } from "@/lib/formatters/phone";

interface InputFieldProps {
    id: string;
    meta: any;
    data: any;
    onChange: (id: string, value: any) => void;
    onAction?: (action: any) => void;
    showPassword?: boolean;
    [key: string]: any;
}

const InputField = memo(({
    id,
    meta,
    data,
    onChange,
    onAction,
    pwType,
    showPassword,
    className: externalClassName,
    ...rest
}: InputFieldProps) => {

    const targetKey = meta?.ref_data_id || meta?.refDataId || String(id || "");
    const value = (data && typeof data === 'object') ? (data[targetKey] ?? "") : (data ?? "");
    const isReadOnly = meta?.is_readonly || meta?.isReadonly || false;
    const isPhone = targetKey === "phone" || targetKey.toLowerCase().includes("phone");

    // 클래스 네임 조합
    const inputClasses = [
        "inputfield-core",
        externalClassName,
        meta?.css_class,
        isReadOnly ? "readonly-style" : ""
    ].filter(Boolean).join(" ");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        //    console.log('[InputField] handleInputChange:', { targetKey, value: e.target.value, isReadOnly, onChangeFn: typeof onChange });
        if (!isReadOnly) {
            onChange(targetKey, isPhone ? formatKoreanPhoneNumber(e.target.value) : e.target.value);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onAction && (meta?.action_type === "SUBMIT" || meta?.actionType === "SUBMIT")) {
            onAction({
                actionType: "SUBMIT",
                actionUrl: meta.actionUrl || meta.action_url,
                componentId: meta.componentId || meta.component_id
            });
        }
    };

    return (
        <div className="input-group-wrapper">
            {meta?.component_id && (
                <label className="input-label" htmlFor={targetKey}>
                    {meta.label_text}
                </label>
            )}
            <input
                {...rest}
                placeholder={meta?.placeholder || `${meta?.labelText}을(를) 입력하세요`}
                id={targetKey}
                type={targetKey.toLowerCase().includes('pw') ? (showPassword ? 'text' : 'password') : isPhone ? 'tel' : 'text'}
                inputMode={isPhone ? 'numeric' : undefined}
                autoComplete={isPhone ? 'tel' : undefined}
                maxLength={isPhone ? 13 : undefined}
                value={value}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                readOnly={isReadOnly}
                className={inputClasses}
            />
        </div>
    );
});

InputField.displayName = "InputField";
export default InputField;
