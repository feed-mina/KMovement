'use client';

import React, { memo } from 'react';
import { cn } from "@/components/utils/cn";

const EmotionSelectField = memo(({ id, meta, data, onChange }: any) => {
    // 1. 데이터 매핑 키 및 값 추출
    const targetKey = meta?.ref_data_id || meta?.refDataId || id;
    const value = (typeof data === 'string' || typeof data === 'number')
        ? data
        : (data?.[targetKey] || "");

    // 2. 읽기 전용 여부 판단
    const isReadOnly = meta?.isReadonly === true || meta?.isReadonly === "true" ||
        meta?.is_readonly === true || meta?.is_readonly === "true";
    const labelText = meta?.labelText || meta?.label_text;

    const emotionItems = [
        { text: "기분이 좋아요", value: "1" },
        { text: "너무 웃겨요", value: "2" },
        { text: "어떡해야 할까요", value: "3" },
        { text: "불쾌하고 지루해요", value: "4" },
        { text: "어떻게 이럴 수가", value: "5" },
        { text: "화가 나요", value: "6" },
        { text: "여기서 벗어나고 싶어요", value: "7" },
        { text: "사랑이 넘쳐요", value: "8" },
        { text: "몸 상태가 좋지 않아요", value: "9" },
        { text: "우울해요", value: "10" }
    ];

    // 3. 현재 선택된 감정 텍스트 찾기 (읽기 전용 표시용)
    const selectedEmotion = emotionItems.find(item => String(item.value) === String(value));

    // 4. 클래스 병합
    const containerClass = cn(
        "emotion-select-container",
        meta?.css_class,
        meta?.cssClass,
        isReadOnly && "is-readonly"
    );

    return (
        <div className={containerClass}>
            {labelText && (isReadOnly ? (
                <span className="field-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {labelText}
                </span>
            ) : (
                <label className="field-label" htmlFor={id} style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {labelText}
                </label>
            ))}

            {isReadOnly ? (
                // 읽기 전용 상태: 선택된 감정 텍스트만 출력
                <div className="readonly-emotion-text">
                    {selectedEmotion ? selectedEmotion.text : "선택된 감정 없음"}
                </div>
            ) : (
                // 편집 가능 상태: Select 박스 노출
                <select
                    id={id}
                    value={value}
                    className="emotion-select-element"
                    onChange={(e) => onChange?.(targetKey, e.target.value)}
                >
                    <option value="">오늘 나의 기분은?</option>
                    {emotionItems.map(item => (
                        <option key={item.value} value={item.value}>
                            {item.text}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
});

EmotionSelectField.displayName = "EmotionSelectField";
export default EmotionSelectField;
