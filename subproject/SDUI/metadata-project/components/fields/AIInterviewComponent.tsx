'use client';

import React, { useState } from 'react';
import { AIChatComponentProps, AIInterviewConfig, ResumeInputType } from '@/lib/types/ai';
import { useInterviewLogic } from '@/lib/hooks/useInterviewLogic';
import ConversationPanelV2 from '@/components/fields/ai/ConversationPanelV2';
import AudioRecorder from '@/components/fields/ai/AudioRecorder';
import MembershipUpgradeModal from '@/components/fields/ai/MembershipUpgradeModal';
import AIInterviewIntro from '@/components/fields/ai/AIInterviewIntro';
import AIChatHeader from '@/components/fields/ai/AIChatHeader';

export default function AIInterviewComponent({ meta, data }: AIChatComponentProps) {
    const interviewData = data as (AIInterviewConfig | undefined);
    const title = meta.labelText || meta.label_text || 'Professional AI Interview';
    const containerClass = meta.cssClass || meta.css_class || '';
    const isDisabled = meta.isReadonly === true || meta.is_readonly === true;
    const language = meta.target_language || interviewData?.language || 'ko';

    const [isStarted, setIsStarted] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [resumeInputType, setResumeInputType] = useState<ResumeInputType>('text');
    const [resumeText, setResumeText] = useState('');
    const [resumeFileKey, setResumeFileKey] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradeModalMsg, setUpgradeModalMsg] = useState(
        interviewData?.upgrade_message || 'Interview assessment requires a PREMIUM membership.'
    );

    const {
        messages,
        isStreaming,
        recordingState,
        analyser,
        startInterview,
        handleStartRecording,
        stopRecording,
        cancelRecording,
        handleEndInterview,
    } = useInterviewLogic({
        language,
        resumeText,
        resumeFileKey,
        systemPromptTemplate: meta.system_prompt_template,
        onError: (msg) => {
            setUpgradeModalMsg(msg);
            setShowUpgradeModal(true);
            setIsStarting(false);
        },
    });

    const handleStart = async () => {
        setIsStarting(true);
        await startInterview();
        setIsStarted(true);
        setIsStarting(false);
    };

    const renderIntro = () => (
        <AIInterviewIntro
            title={title}
            resumeInputType={resumeInputType}
            onInputTypeChange={setResumeInputType}
            resumeText={resumeText}
            onResumeChange={setResumeText}
            resumeFileKey={resumeFileKey}
            onFileKeyChange={(key) => setResumeFileKey(key)}
            onStart={handleStart}
            isLoading={isStarting}
            placeholder={interviewData?.resume_placeholder}
            startBtnLabel={interviewData?.start_btn_label}
        />
    );

    const renderMain = () => (
        <>
            <AIChatHeader
                title={title}
                userMessageCount={messages.filter(m => m.role === 'user').length}
                isStreaming={isStreaming}
                statusLabel={isStreaming ? '라이가 답변을 정리하고 있어요' : '라이가 면접 흐름을 보고 있어요'}
            />

            <div className="ai-chat-main-content">
                <ConversationPanelV2
                    messages={messages}
                    isStreaming={isStreaming}
                />
            </div>

            <div className="ai-chat-footer-area">
                <div className="ai-chat-input-wrapper">
                    <AudioRecorder
                        state={recordingState}
                        analyser={analyser}
                        micBtnLabel={interviewData?.mic_btn_label || '🎤'}
                        submitBtnLabel={interviewData?.answer_btn_label || '답변 제출'}
                        onStart={handleStartRecording}
                        onStop={stopRecording}
                        onCancel={cancelRecording}
                        disabled={isDisabled || isStreaming}
                    />
                </div>

                <div className="ai-chat-actions-bar">
                    <button className="ai-session-end-btn" onClick={handleEndInterview}>
                        {interviewData?.end_btn_label || '면접 종료'}
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className={`ai-chat-standalone-container ai-interview-theme ${containerClass}`}>
            {!isStarted ? renderIntro() : renderMain()}

            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                message={upgradeModalMsg}
                onClose={() => setShowUpgradeModal(false)}
            />
        </div>
    );
}
