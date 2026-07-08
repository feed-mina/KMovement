'use client';

import React from 'react';
import Rai, { type RaiState } from '@/components/fields/kride/atoms/Rai';

interface AIChatHeaderProps {
    title: string;
    userMessageCount: number;
    isStreaming?: boolean;
    statusLabel?: string;
    actions?: React.ReactNode;
}

export default function AIChatHeader({
    title,
    userMessageCount,
    isStreaming = false,
    statusLabel,
    actions,
}: AIChatHeaderProps) {
    const progress = Math.min((userMessageCount / 10) * 100, 100);
    const isGoalReached = userMessageCount >= 10;
    const raiState: RaiState = isStreaming ? 'thinking' : isGoalReached ? 'success' : 'greeting';
    const label = statusLabel ?? (
        isStreaming ? '라이가 답변을 준비하고 있어요' :
            isGoalReached ? '오늘 목표를 채웠어요' :
                '라이가 함께 듣고 있어요'
    );

    return (
        <div className="ai-chat-header">
            <div className="ai-header-content">
                <div className="ai-header-title-row">
                    <div className="ai-header-rai" aria-hidden="true">
                        <Rai state={raiState} size={38} />
                    </div>
                    <div className="ai-header-title-group">
                        <h2 className="ai-header-title">{title}</h2>
                        <span className="ai-status-tag">{label}</span>
                    </div>
                    {actions && <div className="ai-header-actions">{actions}</div>}
                </div>
                
                <div className="ai-gauge-wrapper">
                    <div className="ai-gauge-container">
                        <div 
                            className="ai-gauge-fill" 
                            style={{ 
                                width: `${progress}%`,
                                background: isGoalReached ? 'linear-gradient(90deg, #FFD700, #FFA000)' : undefined
                            }} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
