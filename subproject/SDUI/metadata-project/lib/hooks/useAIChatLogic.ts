import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, RecordingState } from '@/lib/types/ai';
import { useSSEStreamV2 } from '@/lib/hooks/useSSEStreamV2';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';
import api from '@/services/axios';
import { aiService } from '@/services/aiService';

interface UseAIChatLogicProps {
    language: string; // 'en', 'ko', 'ja' 등
    systemPrompt: string;
    welcomeMessage?: string;
    sttEndpoint?: string;
    chatEndpoint?: string;
    translateEndpoint?: string;
    onGoalAchieved?: () => void;
    onError?: (msg: string) => void;
}

export function useAIChatLogic({
    language,
    systemPrompt,
    welcomeMessage,
    sttEndpoint = '/api/ai/stt',
    chatEndpoint = '/api/ai/v2/chat/stream',
    translateEndpoint = '/api/ai/v2/chat/translate',
    onGoalAchieved,
    onError
}: UseAIChatLogicProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    // ref 사용: setCurrentRecordingMode 는 비동기이므로 onAudioReady 클로저가
    // 항상 이전 모드를 읽는 stale closure 버그를 방지하기 위해 ref로 관리
    const currentRecordingModeRef = useRef<string>(language);
    
    const conversationStartedRef = useRef(false);
    const hasTriggeredGoalRef = useRef(false);
    const userMessageCount = useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);

    // 목표 달성 체크
    useEffect(() => {
        if (userMessageCount === 10 && !hasTriggeredGoalRef.current) {
            onGoalAchieved?.();
            hasTriggeredGoalRef.current = true;
        }
    }, [userMessageCount, onGoalAchieved]);

    // SSE 스트리밍 설정
    const { stream, abort } = useSSEStreamV2({
        onChunk: (chunk) => {
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && !last.translation) { // 파싱 전인 경우만 스트리밍 합침
                    return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
                }
                return [...prev, { role: 'assistant', content: chunk }];
            });
        },
        onDone: () => handleDone(),
        onError: (err) => {
            setIsStreaming(false);
            onError?.(err || 'Streaming error occurred');
        },
    });

    // AI 응답 파싱 (JSON 추출)
    const handleDone = useCallback(() => {
        setIsStreaming(false);
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.content) {
                try {
                    const jsonBlocks = last.content.match(/\{[\s\S]*?\}/g);
                    if (jsonBlocks && jsonBlocks.length > 0) {
                        const lastJsonStr = jsonBlocks[jsonBlocks.length - 1];
                        const parsed = JSON.parse(lastJsonStr);
                        if (parsed.en || parsed.ko || parsed.ja) {
                            return [...prev.slice(0, -1), {
                                ...last,
                                // parsed.en: AI가 {"en": "...", "ko": "..."} 반환 (기본값)
                                // parsed.ja: AI가 key 이름을 "ja"로 바꿔서 반환하는 경우 fallback
                                content: parsed.en || parsed.ja || last.content,
                                translation: parsed.ko
                            }];
                        }
                    }
                } catch (e) {
                    console.warn('[useAIChatLogic] JSON 파싱 실패:', e);
                }
            }
            return prev;
        });
    }, []);

    const sendToAI = useCallback(async (msgs: ChatMessage[]) => {
        setIsStreaming(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        // 대화 히스토리에서 translation이 있는 assistant 메시지를 JSON으로 재구성
        // → AI가 히스토리에서 "나는 항상 JSON으로 답한다"는 패턴을 학습하여 일관성 유지
        const apiMessages = msgs.map(msg => {
            if (msg.role === 'assistant' && msg.translation) {
                return { role: 'assistant' as const, content: JSON.stringify({ en: msg.content, ko: msg.translation }) };
            }
            return { role: msg.role, content: msg.content };
        });

        const systemMsg: ChatMessage = {
            role: 'system',
            content: systemPrompt
        };
        const messagesWithSystem = [systemMsg, ...apiMessages];
        await stream(chatEndpoint, { messages: messagesWithSystem, language });
    }, [stream, language, systemPrompt, chatEndpoint]);

    // 오디오 녹음 및 STT 처리
    const { state: recordingState, startRecording, stopRecording, cancelRecording, resetState } = useAudioRecorder({
        onAudioReady: async (blob) => {
            try {
                const formData = new FormData();
                formData.append('audio', blob, 'recording.webm');

                // STT 언어 결정 (한국어로 말하기 모드 배려)
                const sttLanguage = currentRecordingModeRef.current === 'ko' ? 'ko' : language;
                
                const res = await api.post(sttEndpoint, formData, {
                    params: { language: sttLanguage },
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                
                let transcript: string = res.data?.data?.text || '';
                if (!transcript.trim()) {
                    resetState();
                    return;
                }

                const originalTranscript = transcript; // 발음 채점용 원본 (번역 전)

                // 한국어 포함 시 번역 수행 (영어/일본어 채팅 모드에서 한국어 입력 시)
                const containsKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(transcript);
                const isKoreanInput = currentRecordingModeRef.current === 'ko' || containsKorean;
                if (isKoreanInput && (language === 'en' || language === 'ja')) {
                    try {
                        const transRes = await api.post(translateEndpoint, {
                            text: transcript,
                            target: language  // 'en' 또는 'ja'로 동적 번역
                        });
                        if (transRes.data?.data) {
                            transcript = transRes.data.data;
                        }
                    } catch (e) {
                        console.error('[useAIChatLogic] 번역 실패:', e);
                    }
                }

                // 표현 평가 (General Mic 모드에서만 — 한국어 번역 모드는 스킵)
                const wasTranslated = isKoreanInput && (language === 'en' || language === 'ja');
                let pronunciationData: Partial<ChatMessage> = {};
                if (!wasTranslated) {
                    try {
                        const result = await aiService.checkPronunciation(originalTranscript, language);
                        pronunciationData = {
                            pronunciationScore: result.score,
                            pronunciationFeedback: result.feedback,
                            pronunciationSpoken: originalTranscript,
                            pronunciationIdeal: result.idealExpression,
                        };
                    } catch (e) {
                        console.error('[useAIChatLogic] 표현 평가 실패:', e);
                    }
                }

                const userMsg: ChatMessage = {
                    role: 'user',
                    content: transcript,
                    audioUrl: URL.createObjectURL(blob),
                    originalText: wasTranslated ? originalTranscript : undefined,
                    ...pronunciationData,
                };
                
                const updatedMsgs = [...messages, userMsg];
                setMessages(updatedMsgs);
                resetState();
                await sendToAI(updatedMsgs);
            } catch (err) {
                console.error('[useAIChatLogic] STT/번역 실패:', err);
                resetState();
            }
        },
        onAnalyser: setAnalyser,
    });

    const handleStartRecording = (mode: string) => {
        currentRecordingModeRef.current = mode;
        startRecording();
    };

    const handleEndChat = () => {
        abort();
        setMessages([]);
        conversationStartedRef.current = false;
        hasTriggeredGoalRef.current = false;
    };

    // 초기 환영 메시지
    useEffect(() => {
        if (welcomeMessage && !conversationStartedRef.current) {
            conversationStartedRef.current = true;
            setMessages([{ role: 'assistant', content: welcomeMessage }]);
        }
    }, [welcomeMessage]);

    return {
        messages,
        setMessages,
        isStreaming,
        recordingState,
        analyser,
        userMessageCount,
        handleStartRecording,
        stopRecording,
        cancelRecording,
        handleEndChat,
        sendToAI
    };
}
