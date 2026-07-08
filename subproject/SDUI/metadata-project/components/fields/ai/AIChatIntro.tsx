'use client';

import React from 'react';
import MicIcon from '@/components/assets/icons/ai/MicIcon';
import Rai from '@/components/fields/kride/atoms/Rai';

interface AIChatIntroProps {
    title: string;
    subtitle?: string;
    onStart: () => void;
}

export default function AIChatIntro({ title, subtitle = 'Elevate your English with AI', onStart }: AIChatIntroProps) {
    return (
        <div className="ai-intro-container">
            <div className="ai-intro-icon-box">
                <Rai state="greeting" size={108} />
            </div>
            
            <div className="ai-intro-header">
                <h1 className="ai-intro-title">{title}</h1>
                <p className="ai-intro-subtitle">{subtitle}</p>
            </div>

            <div className="ai-permission-card">
                <div className="ai-permission-header">
                    <MicIcon width="24px" height="24px" color="#6366F1" />
                    <span className="ai-mic-label">마이크 사용 권한</span>
                </div>
                <p className="ai-permission-desc">
                    AI와 대화를 나누기 위해서는<br/>
                    마이크 사용 권한이 필요해요.
                </p>
                <div className="ai-permission-divider" />
                <p className="ai-permission-footer">마이크를 눌러 녹음을 진행해주세요.</p>
                <button className="ai-start-btn" onClick={onStart}>
                    대화 시작하기
                </button>
            </div>
        </div>
    );
}
