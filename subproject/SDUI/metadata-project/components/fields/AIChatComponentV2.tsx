'use client';

import React, { useEffect, useState } from 'react';
import { AIChatComponentProps } from '@/lib/types/ai';
import { useAIChatLogic } from '@/lib/hooks/useAIChatLogic';
import ConversationPanelV2 from '@/components/fields/ai/ConversationPanelV2';
import AudioRecorder from '@/components/fields/ai/AudioRecorder';
import MembershipUpgradeModal from '@/components/fields/ai/MembershipUpgradeModal';
import AIChatIntro from '@/components/fields/ai/AIChatIntro';
import AIChatHeader from '@/components/fields/ai/AIChatHeader';
import AIChatGoalModal from '@/components/fields/ai/AIChatGoalModal';
import api from '@/services/axios';

/**
 * SDUI AIChat Component (Container)
 * ──
 * This component acts as a high-level container that orchestrates 
 * sub-fields (Intro, Header, Thread, Input) based on SDUI metadata.
 */
export default function AIChatComponentV2({ meta, data }: AIChatComponentProps) {
    // ── configuration via metadata ──
    const rawTitle = meta.labelText || meta.label_text || 'AI English Tutor';
    const title = rawTitle.replace(/\s*[Vv]2\s*$/, '').trim();
    const containerClass = meta.cssClass || meta.css_class || '';
    const isDisabled = meta.isReadonly === true || meta.is_readonly === true;
    const actionType = meta.actionType || meta.action_type || '';
    
    // Logic setup
    const targetLanguage = meta.target_language || data?.language ||
        (actionType.includes('EN') ? 'en' : actionType.includes('JA') ? 'ja' : 'ko');
    const systemPromptTemplate = meta.system_prompt_template || ''; // Placeholder for template logic
    
    const [isStarted, setIsStarted] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [upgradeModalMsg, setUpgradeModalMsg] = useState(data?.upgrade_message || 'Voice conversation requires a PREMIUM membership.');

    // Logic Hook
    const defaultPrompt = `You are a professional and engaging English tutor. help the user improve their English through natural conversation. Respond human-like, give feedback, and always end with an open-ended question. Respond in JSON format: { "en": "...", "ko": "..." }`;

    const {
        messages,
        isStreaming,
        recordingState,
        analyser,
        userMessageCount,
        handleStartRecording,
        stopRecording,
        cancelRecording,
        handleEndChat,
    } = useAIChatLogic({
        language: targetLanguage,
        systemPrompt: systemPromptTemplate || defaultPrompt,
        welcomeMessage: data?.welcome_message,
        onGoalAchieved: () => setShowGoalModal(true),
        onError: (msg) => {
            setUpgradeModalMsg(msg);
            setShowUpgradeModal(true);
        },
    });

    useEffect(() => {
        if (isDisabled) return;
        api.get('/api/v1/user-memberships/current').catch((err) => {
            console.error('[AIChatComponentV2] 멤버십 조회 실패:', err?.response?.status);
        });
    }, [isDisabled]);

    // ── SDUI Sub-Field Rendering Logic ──
    const introSubtitle = targetLanguage === 'ja'
        ? 'AI와 함께 일본어를 배워보세요'
        : 'Elevate your English with AI';

    const renderIntro = () => <AIChatIntro title={title} subtitle={introSubtitle} onStart={() => setIsStarted(true)} />;
    
    const renderMain = () => (
        <>
            <AIChatHeader title={title} userMessageCount={userMessageCount} />
            
            <div className="ai-chat-main-content">
                <ConversationPanelV2
                    messages={messages}
                    isStreaming={isStreaming}
                    language={targetLanguage}
                />
            </div>

            <div className="ai-chat-footer-area">
                <div className="ai-chat-input-wrapper">
                    <AudioRecorder
                        state={recordingState}
                        analyser={analyser}
                        micBtnLabel={data?.mic_btn_label || '🎤'}
                        submitBtnLabel={data?.submit_btn_label || 'Submit'}
                        onStart={handleStartRecording}
                        onStop={stopRecording}
                        onCancel={cancelRecording}
                        disabled={isDisabled || isStreaming}
                        language={targetLanguage}
                    />
                </div>
                
                {messages.length > 0 && (
                    <div className="ai-chat-actions-bar">
                        <button className="ai-session-end-btn" onClick={handleEndChat}>
                            채팅종료하기
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <div className={`ai-chat-standalone-container ${containerClass}`}>
            {!isStarted ? renderIntro() : renderMain()}

            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                message={upgradeModalMsg}
                onClose={() => setShowUpgradeModal(false)}
            />

            <AIChatGoalModal 
                show={showGoalModal} 
                onClose={() => setShowGoalModal(false)} 
            />
        </div>
    );
}
