'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AIChatConfig, ChatMessage } from '@/lib/types/ai';
import { useSSEStream } from '@/lib/hooks/useSSEStream';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';
import ConversationPanel from '@/components/fields/ai/ConversationPanel';
import AudioRecorder from '@/components/fields/ai/AudioRecorder';
import MembershipUpgradeModal from '@/components/fields/ai/MembershipUpgradeModal';
import AIChatHeader from '@/components/fields/ai/AIChatHeader';
import api from '@/services/axios';

// DynamicEngine이 전달하는 표준 props
interface AIChatComponentProps {
    meta: {
        labelText?: string;
        label_text?: string;
        cssClass?: string;
        css_class?: string;
        actionType?: string;
        action_type?: string;
        placeholder?: string;
        isReadonly?: boolean;
        is_readonly?: boolean;
    };
    data?: AIChatConfig; // pageData[ref_data_id] — query_master에서 조회한 설정값
    [key: string]: any;
}

export default function AIChatComponent({ meta, data }: AIChatComponentProps) {
    // ── 메타데이터에서 읽기 ──
    const title = meta.labelText || meta.label_text || 'AI 대화';
    const containerClass = meta.cssClass || meta.css_class || '';
    const isDisabled = meta.isReadonly === true || meta.is_readonly === true;
    const actionType = meta.actionType || meta.action_type || '';
    const language = (data?.language as 'en' | 'ko') ?? (actionType.includes('EN') ? 'en' : 'ko');

    // query_master 설정값
    const micBtnLabel = data?.mic_btn_label ?? '🎤 녹음 시작';
    const submitBtnLabel = data?.submit_btn_label ?? '답변완료';
    const endBtnLabel = data?.end_btn_label ?? '대화 종료';
    const welcomeMessage = data?.welcome_message ?? '';
    const upgradeMessage = data?.upgrade_message ?? '이 기능은 멤버십이 필요합니다.';

    // ── 상태 ──
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradeModalMsg, setUpgradeModalMsg] = useState(upgradeMessage);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [koreanMode, setKoreanMode] = useState(false); // 한국어 인식 모드
    const conversationStartedRef = useRef(false);

    // ── SSE 스트림 훅 ──
    const { stream, abort } = useSSEStream({
        onChunk: (chunk) => {
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
                }
                return [...prev, { role: 'assistant', content: chunk }];
            });
        },
        onDone: () => setIsStreaming(false),
        onError: (msg) => {
            setIsStreaming(false);
            setUpgradeModalMsg(msg || upgradeMessage);
            setShowUpgradeModal(true);
        },
    });

    // ── AI에게 메시지 전송 ──
    const sendToAI = useCallback(async (msgs: ChatMessage[]) => {
        setIsStreaming(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        await stream('/api/ai/chat/stream', { messages: msgs, language });
    }, [stream, language]);

    // ── 마운트 시: 멤버십 체크 + 환영 메시지 ──
    useEffect(() => {
        if (isDisabled) return;

        const init = async () => {
            try {
                const res = await api.get('/api/v1/user-memberships/current');
                const membership = res.data?.data;

                if (!membership) {
                    setUpgradeModalMsg(upgradeMessage);
                    setShowUpgradeModal(true);
                    return;
                }
            } catch (err: any) {
                // 멤버십 API 미구현(404) 또는 네트워크 에러 → 멤버십 체크 스킵, 대화 진행
                const status = err?.response?.status;
                if (status === 401) return; // 인증 에러는 axios 인터셉터 처리
                // 404 등 → 멤버십 기능 미구현 단계: 그냥 대화 시작
            }

            // 멤버십 확인됐거나 API 미구현 상태 → 환영 메시지 표시
            if (welcomeMessage && !conversationStartedRef.current) {
                conversationStartedRef.current = true;
                setMessages([{ role: 'assistant', content: welcomeMessage }]);
            }
        };

        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 오디오 녹음 훅 ──
    const { state: recordingState, startRecording, stopRecording, resetState } = useAudioRecorder({
        onAudioReady: async (blob) => {
            try {
                const formData = new FormData();
                formData.append('audio', blob, 'recording.webm');

                const res = await api.post('/api/ai/stt', formData, {
                    params: { language: koreanMode ? 'ko' : (language === 'ko' ? 'ko' : undefined) },
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const transcript: string = res.data?.data?.text || '';

                if (!transcript.trim()) {
                    resetState();
                    return;
                }

                const userMsg: ChatMessage = { role: 'user', content: transcript };
                const updatedMsgs = [...messages, userMsg];
                setMessages(updatedMsgs);
                resetState();
                await sendToAI(updatedMsgs);
            } catch {
                resetState();
            }
        },
        onAnalyser: setAnalyser,
    });

    // ── 대화 종료 ──
    const handleEnd = () => {
        abort();
        setMessages([]);
        conversationStartedRef.current = false;
    };

    return (
        <div className={`ai-chat-container ${containerClass}`}>
            <AIChatHeader
                title={title}
                userMessageCount={messages.filter(message => message.role === 'user').length}
                isStreaming={isStreaming}
                actions={messages.length > 0 ? (
                    <button className="ai-end-btn admin-back-btn" onClick={handleEnd}>
                        {endBtnLabel}
                    </button>
                ) : null}
            />

            <ConversationPanel messages={messages} isStreaming={isStreaming} />

            {/* 언어 토글 버튼 */}
            <div className="lang-toggle-bar">
                <button
                    className={`lang-toggle-btn ${koreanMode ? 'lang-toggle-btn--active' : ''}`}
                    onClick={() => setKoreanMode(prev => !prev)}
                    title="토글: 한국어 인식 ON/OFF"
                >
                    {koreanMode ? '🇰🇷 한국어 인식 중' : '🌐 영어 인식 중 (한국어로 전환)'}
                </button>
            </div>

            <AudioRecorder
                state={recordingState}
                analyser={analyser}
                micBtnLabel={micBtnLabel}
                submitBtnLabel={submitBtnLabel}
                onStart={startRecording}
                onStop={stopRecording}
                disabled={isDisabled || isStreaming}
            />

            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                message={upgradeModalMsg}
                onClose={() => setShowUpgradeModal(false)}
            />
        </div>
    );
}
