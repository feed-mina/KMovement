'use client';

import {useEffect, useId, useState} from 'react';
import {ArrivalButton} from '@/components/fields/ArrivalButton';
import {useRecordTime} from '@/hooks/useRecordTime';
import {dateFormatter} from '@/utils/dateFormatter';

interface RecordTimeProps {
    data?: {
        user_id?: string;
        user_sqno?: string | number;
        [key: string]: unknown;
    };
    onChange?: (value: unknown) => void;
}

const COLLAPSE_STORAGE_KEY = 'kride:record-time-collapsed:v1';
const MOBILE_QUERY = '(max-width: 767px)';

const RecordTimeComponent = (_props: RecordTimeProps) => {
    const {formatGoalDate, formatTimePretty} = dateFormatter();
    const {
        goalTime,
        todaysMessage,
        goalList,
        remainTimeText,
        handleLinkToSetup,
        handleArrival,
    } = useRecordTime();
    const [isListOpen, setIsListOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const bodyId = useId();

    useEffect(() => {
        try {
            const savedPreference = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);

            if (savedPreference === 'collapsed' || savedPreference === 'expanded') {
                setIsCollapsed(savedPreference === 'collapsed');
                return;
            }
        } catch {
            // Storage can be unavailable in privacy-restricted browsers and WebViews.
        }

        setIsCollapsed(window.matchMedia(MOBILE_QUERY).matches);
    }, []);

    const handleToggle = () => {
        setIsCollapsed((previous) => {
            const next = !previous;

            try {
                window.localStorage.setItem(
                    COLLAPSE_STORAGE_KEY,
                    next ? 'collapsed' : 'expanded',
                );
            } catch {
                // The accordion still works for the current visit when storage is blocked.
            }

            return next;
        });
    };

    const summary = goalTime
        ? `목표 시간 ${formatGoalDate(goalTime)} ${formatTimePretty(goalTime)}`
        : '오늘의 약속 시간은 언제인가요?';

    return (
        <section
            className={`record-time-widget ${goalTime ? 'time-record-container' : 'no-goal-container'} ${isCollapsed ? 'is-collapsed' : ''}`}
            aria-label="약속 시간"
        >
            <div className="record-time-summary">
                <div className="record-time-summary-copy">
                    <span className="record-time-eyebrow">시간 설정</span>
                    <strong>{summary}</strong>
                </div>
                <button
                    type="button"
                    className="record-time-toggle"
                    aria-expanded={!isCollapsed}
                    aria-controls={bodyId}
                    onClick={handleToggle}
                >
                    <span className="record-time-toggle-label">
                        {isCollapsed ? '펼치기' : '접기'}
                    </span>
                    <span className="record-time-toggle-icon" aria-hidden="true">⌃</span>
                </button>
            </div>

            <div id={bodyId} className="record-time-body" hidden={isCollapsed}>
                {!goalTime ? (
                    <button type="button" className="setup-button" onClick={handleLinkToSetup}>
                        시간 설정하기
                    </button>
                ) : (
                    <>
                        <div className="clock-container">
                            <div className="clock-display-box">
                                <span className="target-time-label">
                                    목표 시간 {formatGoalDate(goalTime)}
                                </span>
                                <div className="formatted-time">
                                    {formatTimePretty(goalTime)}
                                </div>
                                <div className="remain-time">
                                    {remainTimeText}
                                </div>
                                {todaysMessage && (
                                    <div className="goal-memo-text">{todaysMessage}</div>
                                )}
                            </div>
                        </div>

                        <div className="more-list-section">
                            <div className="bottom-btn-group">
                                <ArrivalButton onClick={handleArrival}/>
                                <button type="button" onClick={handleLinkToSetup} className="add-time-btn">
                                    + 시간 추가
                                </button>
                                {goalList && goalList.length > 0 && (
                                    <button
                                        type="button"
                                        className="more-list-button"
                                        aria-expanded={isListOpen}
                                        onClick={() => setIsListOpen((previous) => !previous)}
                                    >
                                        더보기
                                    </button>
                                )}
                            </div>

                            {isListOpen && goalList && goalList.length > 0 && (
                                <div className="goal-list-popup">
                                    <ul className="goal-list-popup-ul">
                                        {goalList.map((time: string, index: number) => (
                                            <li className="goal-list-popup-li" key={`${time}-${index}`}>
                                                <span aria-hidden="true">⏰</span>
                                                <div className="goal-list-content">
                                                    <span className="goal-list-popup-date">
                                                        {formatGoalDate(time)}
                                                    </span>
                                                    <span className="goal-list-popup-time">
                                                        {formatTimePretty(time)}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default RecordTimeComponent;
