import React, {useCallback, useEffect, useRef, useState} from 'react';
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from 'react-datepicker';
import {useCalendar} from '../../hooks/useCalendar';

interface DateTimePickerProps {
    id: string;
    onChange?: (id: string, value: string) => void;
    data?: any;
    meta?: any;
}

const ITEM_HEIGHT = 50;

const DateTimePicker = ({id, onChange, data}: DateTimePickerProps) => {
    const getInitialDate = (inputData: any) => {
        if (!inputData) return new Date();
        const d = new Date(inputData);
        return isNaN(d.getTime()) ? new Date() : d;
        // 유효하지 않는 날짜면 현재 시간 사용
    }
    // 1. 상태 관리
    const {
        date,
        isOpen,
        openCalendar,
        closeCalendar,
        handleDateChange,
        updateTime
    } = useCalendar(getInitialDate(data));

    // 2. Refs
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialized = useRef(false);

    // 2-1. 키보드 입력 모드 상태
    const [isInputMode, setIsInputMode] = useState(false);
    const [inputValues, setInputValues] = useState({hour: '00', minute: '00'});

    // Constants
    const hours = Array.from({length: 24}, (_, i) => i);
    const minutes = Array.from({length: 60}, (_, i) => i);

    // 3. UI 동기화 함수
    const syncScrollToData = useCallback((targetDate: Date) => {
        if (hourRef.current && minuteRef.current) {
            const h = targetDate.getHours();
            const m = targetDate.getMinutes();
            setTimeout(() => {
                if (hourRef.current) hourRef.current.scrollTo({top: h * ITEM_HEIGHT, behavior: 'smooth'});
                if (minuteRef.current) minuteRef.current.scrollTo({top: m * ITEM_HEIGHT, behavior: 'smooth'});
            }, 50);
        }
    }, []);

    // 4. 초기화 useEffect (가드 패턴 적용)
    useEffect(() => {
        // @@@@ 20260-02-08 주석 추가 : 이미 초기화되었거나 데이터가 이미 존재한다면 부모에게 다시 알릴 필요 없음
        if (isInitialized.current) return;
        syncScrollToData(date);

        // @@@@ 20260-02-08 주석 추가 : data가 없을때만 즉 신규 입력일때만 초기값을 부모에게 알림
        // 만약 부모가 넘겨준 data가 있다면 onChange를 호출하지 않음
        if (onChange && !data) {
            // @@@@ 20260-02-08 주석 추가 : data가 유효한지 체크하는 방어코드 추가
            if (!isNaN(date.getTime())) {
                onChange(id, date.toISOString());

            }
        }
        isInitialized.current = true;
    }, [date, onChange, id, data, syncScrollToData]);

    // 입력 모드 -> 휠 모드로 전환될 때 스크롤 위치를 잡아주는 역할
    useEffect(() => {
        if (!isInputMode) {
            // 휠이 화면에 그려진 직후 실행
            setTimeout(() => {
                syncScrollToData(date);
            }, 0);
        }
    }, [isInputMode, date, syncScrollToData]);
    // 5. 공통 변경 알림 함수
    const notifyChange = (newDate: Date) => {
        if (onChange && !isNaN(newDate.getTime())) {
            onChange(id, newDate.toISOString());
        }
        ;
    }

    // 6. 스크롤 핸들러
    const handleScroll = (type: 'hour' | 'minute') => {
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const ref = type === 'hour' ? hourRef.current : minuteRef.current;
            if (!ref) return;

            const scrollTop = ref.scrollTop;
            const value = Math.round(scrollTop / ITEM_HEIGHT);

            ref.scrollTo({top: value * ITEM_HEIGHT, behavior: 'smooth'});

            const newDate = new Date(date);
            if (type === 'hour') {
                newDate.setHours(value);
            } else {
                newDate.setMinutes(value);
            }

            updateTime(newDate);
            notifyChange(newDate);
        }, 150);
    };

    // 7. 클릭 시 입력 모드 전환
    const handleWheelClick = () => {
        setInputValues({
            hour: date.getHours().toString().padStart(2, '0'),
            minute: date.getMinutes().toString().padStart(2, '0')
        });
        setIsInputMode(true);
    };

    // 8. [수정됨] 입력 값 변경 핸들러 (type 인자 추가)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'hour' | 'minute') => {
        const val = e.target.value;
        if (!/^\d{0,2}$/.test(val)) return;

        setInputValues(prev => ({
            ...prev,
            [type]: val // computed property name 사용
        }));
    };

    // 9. [밖으로 탈출 성공] 입력 확정 핸들러
    const handleInputConfirm = () => {
        let h = parseInt(inputValues.hour || '0', 10);
        let m = parseInt(inputValues.minute || '0', 10);

        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;
        h = Math.min(23, Math.max(0, h));
        m = Math.min(59, Math.max(0, m));

        const newDate = new Date(date);
        newDate.setHours(h);
        newDate.setMinutes(m);

        updateTime(newDate);
        notifyChange(newDate);
        syncScrollToData(newDate);
        setIsInputMode(false);
    };


    // @@@@ 2026-02-02 추가 포커스 이동 처리 키보드 시간 : 분 입력
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // 다음 포커스 요소 (relatedTarget)이 time-input클래스를 가졌다면 닫지 않음
        if (e.relatedTarget && (e.relatedTarget as HTMLElement).classList.contains('time-input')) return;
        handleInputConfirm();
    };


    // 10. [밖으로 탈출 성공] 엔터키 핸들러
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleInputConfirm();
    };

    // 11. [밖으로 탈출 성공] 퀵 버튼 핸들러
    const addMinutes = (mins: number) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + mins);
        updateTime(newDate);
        syncScrollToData(newDate);
        notifyChange(newDate);
    };

    // 12. 캘린더 핸들러
    const handleCalendarSelect = (newDateFromCalendar: Date | null) => {
        if (!newDateFromCalendar) return;

        handleDateChange(newDateFromCalendar);

        const updateDate = new Date(newDateFromCalendar);
        updateDate.setHours(date.getHours());
        updateDate.setMinutes(date.getMinutes());
        notifyChange(updateDate);
    };

    return (
        <div className="time-picker-container">
            <div className="picker-display" onClick={!isInputMode ? handleWheelClick : undefined}>
                {isInputMode ? (
                    <div className="input-mode-wrapper">
                        <input
                            type="text"
                            value={inputValues.hour}
                            // [수정됨] 두 번째 인자로 'hour' 전달
                            onChange={(e) => handleInputChange(e, 'hour')}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="time-input"
                        />
                        <span className="colon">:</span>
                        <input
                            type="text"
                            value={inputValues.minute}
                            // [수정됨] 두 번째 인자로 'minute' 전달
                            onChange={(e) => handleInputChange(e, 'minute')}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className="time-input"
                        />
                    </div>
                ) : (
                    <>
                        <div className="wheel-wrapper" ref={hourRef} onScroll={() => handleScroll('hour')}>
                            <div className="wheel-spacer" aria-hidden="true" />
                            {hours.map((h) => (
                                <div key={`h-${h}`} className="wheel-item">
                                    {h.toString().padStart(2, '0')}
                                </div>
                            ))}
                            <div className="wheel-spacer" aria-hidden="true" />
                        </div>
                        <span className="colon">:</span>
                        <div className="wheel-wrapper" ref={minuteRef} onScroll={() => handleScroll('minute')}>
                            <div className="wheel-spacer" aria-hidden="true" />
                            {minutes.map((m) => (
                                <div key={`m-${m}`} className="wheel-item">
                                    {m.toString().padStart(2, '0')}
                                </div>
                            ))}
                            <div className="wheel-spacer" aria-hidden="true" />
                        </div>
                    </>
                )}
            </div>

            <div className="quick-buttons">
                <button type="button" onClick={() => addMinutes(10)}>+10분</button>
                <button type="button" onClick={() => addMinutes(30)}>+30분</button>
                <button type="button" onClick={() => addMinutes(60)}>+1시간</button>
            </div>

            <p className="picker-selected-label">
                설정 시간: {date.getHours()}시 {date.getMinutes()}분
            </p>

            <div className="date-input-box" onClick={openCalendar}>
                {/* 왼쪽: 아이콘과 라벨 */}
                <div className="date-label-group">
                    <span className="calendar-icon">📅</span>
                    <span className="date-label">날짜 설정</span>
                </div>
                {/* 오른쪽: 현재 선택된 날짜 */}
                <p className="date-value-text">
                    {date.toLocaleDateString()}
                </p>
            </div>

            {isOpen && (
                <div className="calendar-modal-overlay">
                    <div className="calendar-modal">
                        <DatePicker
                            selected={date}
                            onChange={handleCalendarSelect}
                            inline
                        />
                        <button onClick={closeCalendar}>닫기</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateTimePicker;