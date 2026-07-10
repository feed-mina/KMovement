// TimeSelect.tsx 내부 수정 제안
import React, {useState, useEffect, memo, useMemo, useCallback} from "react";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import '../../app/styles/TimeSelect.css'
import 'swiper/css';
import 'swiper/css/navigation';
import {useRenderCount} from "@/components/DynamicEngine/hook/useRenderCount";

interface TimeItem {
    hour: number;
    available: boolean;
}

interface TimeSelectProps {
    value: number[];
    onChange: (selected: number[]) => void;
}
const TimeSelect: React.FC<any> = ({ id, meta, data, onChange }) => {
    useRenderCount("TimeSelect (Child)"); // @@@@ 렌더링 횟수 추적 추가
    // 1. 바인딩 키(refDataId) 및 읽기 여부 로직
    const updateKey = useMemo(() => meta.ref_data_id || meta.refDataId || id, [meta, id]);
    const isReadOnly = useMemo(() => {
        const val = meta.isReadonly ?? meta.is_readonly;
        return val === true || val === "true";
    }, [meta]);

    // const [selectedTimes, setSelectedTimes] = React.useState<number[]>([]);

    const {
        startHour = 0,
        endHour = 24,
        slidesPerView = 5,
        legendActive = "sleep", // 기본값
        legendDefault = "wake"   // 기본값
    } = meta?.component_props || {};


    const timeList = useMemo(() => {
        return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    }, [startHour, endHour]);

    // 3. 데이터 파싱 로직
    const selectedTimes: number[] = useMemo(() => {
        let rawData = data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            rawData = data[updateKey] || data.selected_times || [];
        }
        return Array.isArray(rawData) ? rawData.map(Number) : [];
    }, [data, updateKey]);

    // 4. 이벤트 핸들러 메모이제이션
    const toggleTime = useCallback((hour: number) => {
        if (isReadOnly) return;

        const nextSelected = selectedTimes.includes(hour)
            ? selectedTimes.filter((t) => t !== hour)
            : [...selectedTimes, hour].sort((a, b) => a - b);

        onChange(updateKey, nextSelected);
    }, [isReadOnly, selectedTimes, updateKey, onChange]);

    return (
        <div className="time-select-wrapper">
            <h3 className="time-select-title">{meta.label_text || meta.labelText || '기상·취침 시간'}</h3>

            <div className="swiper-container-wrapper">
                <Swiper
                    modules={[Navigation]}
                    navigation={{ nextEl: '.next', prevEl: '.prev' }}
                    slidesPerView={slidesPerView}
                    slidesPerGroup={3}
                    spaceBetween={10}
                >
                    {timeList.map((hour) => {
                        const isActive = selectedTimes.includes(hour);
                        return (
                            <SwiperSlide key={hour}>
                                <button
                                    type="button"
                                    onClick={() => toggleTime(hour)}
                                    className={`time-button ${isActive ? 'active' : 'default'} ${isReadOnly ? 'readonly' : ''}`}
                                >
                                    {hour}
                                </button>
                            </SwiperSlide>
                        );
                    })}
                </Swiper>

                <div className="swiper-nav-btn prev">〈</div>
                <div className="swiper-nav-btn next">〉</div>
            </div>

            {/*  동적 범례(Legend) 렌더링 영역 */}
            <div className="time-select-legend">
                {/* 비활성 상태(Default) 라벨 */}
                <span className="legend-item">
                    <div className="color-box default-bg" /> {legendDefault}
                </span>
                {/* 활성 상태(Active) 라벨 */}
                <span className="legend-item">
                    <div className="color-box active-bg" /> {legendActive}
                </span>
            </div>
        </div>
    );
};

export default memo(TimeSelect);