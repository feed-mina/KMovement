'use client';

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types/ai';
import UserIcon from '@/components/assets/icons/ai/UserIcon';
import SpeakerIcon from '@/components/assets/icons/ai/SpeakerIcon';
import Rai from '@/components/fields/kride/atoms/Rai';

interface ConversationPanelProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    language?: string;
}

function getScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 85) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 45) return 'fair';
    return 'poor';
}

export default function ConversationPanelV2({ messages, isStreaming, language }: ConversationPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingIndex, setPlayingIndex] = React.useState<number | null>(null);
    const [playingJaIndex, setPlayingJaIndex] = React.useState<number | null>(null);
    const jaAudioRef = useRef<HTMLAudioElement | null>(null);
    const [playingEnIndex, setPlayingEnIndex] = React.useState<number | null>(null);
    const enAudioRef = useRef<HTMLAudioElement | null>(null);
    const [playingIdealIndex, setPlayingIdealIndex] = React.useState<number | null>(null);
    const idealAudioRef = useRef<HTMLAudioElement | null>(null);
    const [showTranslations, setShowTranslations] = React.useState<Record<number, boolean>>({});

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handlePlay = (text: string, index: number, isUserAudio = false, audioUrl?: string) => {
        if (playingIndex === index) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingIndex(null);
            return;
        }

        if (audioRef.current) audioRef.current.pause();

        let audio: HTMLAudioElement;
        if (isUserAudio && audioUrl) {
            audio = new Audio(audioUrl);
        } else {
            const voice = 'alloy';
            const ttsUrl = `/api/ai/v2/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
            audio = new Audio(ttsUrl);
        }

        audioRef.current = audio;
        audio.onplay = () => setPlayingIndex(index);
        audio.onended = () => { setPlayingIndex(null); audioRef.current = null; };
        audio.onerror = () => { console.error('Audio playback failed'); setPlayingIndex(null); };
        audio.play().catch(console.error);
    };

    const handlePlayJA = (text: string, index: number) => {
        if (playingJaIndex === index) {
            if (jaAudioRef.current) { jaAudioRef.current.pause(); jaAudioRef.current = null; }
            setPlayingJaIndex(null);
            return;
        }
        if (jaAudioRef.current) jaAudioRef.current.pause();
        const audio = new Audio(`/api/ai/v2/tts?text=${encodeURIComponent(text)}&voice=alloy`);
        jaAudioRef.current = audio;
        audio.onplay = () => setPlayingJaIndex(index);
        audio.onended = () => { setPlayingJaIndex(null); jaAudioRef.current = null; };
        audio.onerror = () => { setPlayingJaIndex(null); };
        audio.play().catch(console.error);
    };

    const handlePlayEN = (text: string, index: number) => {
        if (playingEnIndex === index) {
            if (enAudioRef.current) { enAudioRef.current.pause(); enAudioRef.current = null; }
            setPlayingEnIndex(null);
            return;
        }
        if (enAudioRef.current) enAudioRef.current.pause();
        const audio = new Audio(`/api/ai/v2/tts?text=${encodeURIComponent(text)}&voice=alloy`);
        enAudioRef.current = audio;
        audio.onplay = () => setPlayingEnIndex(index);
        audio.onended = () => { setPlayingEnIndex(null); enAudioRef.current = null; };
        audio.onerror = () => { setPlayingEnIndex(null); };
        audio.play().catch(console.error);
    };

    const handlePlayIdeal = (text: string, index: number) => {
        if (playingIdealIndex === index) {
            if (idealAudioRef.current) { idealAudioRef.current.pause(); idealAudioRef.current = null; }
            setPlayingIdealIndex(null);
            return;
        }
        if (idealAudioRef.current) idealAudioRef.current.pause();
        const audio = new Audio(`/api/ai/v2/tts?text=${encodeURIComponent(text)}&voice=alloy`);
        idealAudioRef.current = audio;
        audio.onplay = () => setPlayingIdealIndex(index);
        audio.onended = () => { setPlayingIdealIndex(null); idealAudioRef.current = null; };
        audio.onerror = () => { setPlayingIdealIndex(null); };
        audio.play().catch(console.error);
    };

    const toggleTranslation = (index: number) => {
        setShowTranslations(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const visibleMessages = messages.filter(msg => msg.role !== 'system');

    return (
        <div className="ai-conversation-thread">
            {visibleMessages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const userTurn = isUser
                    ? visibleMessages.slice(0, i + 1).filter(m => m.role === 'user').length
                    : null;
                const wordCount = isUser
                    ? msg.content.trim().split(/\s+/).filter(w => w.length > 0).length
                    : null;

                return (
                    <div key={i} className={`ai-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>

                        <div className={`ai-message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                            <div className="ai-message-inner">
                                <div className="ai-message-avatar">
                                    {isUser
                                        ? <UserIcon width="28px" height="28px" color="#6366F1" />
                                        : <Rai state={isStreaming && i === visibleMessages.length - 1 ? 'thinking' : 'success'} size={32} />}
                                </div>

                                <div className="ai-message-body">
                                    {language === 'ja' && isUser && msg.originalText ? (
                                        <>
                                            <div className="ai-bilingual-cell">
                                                <span className="ai-lang-badge">KR</span>
                                                <span className="ai-bilingual-text">{msg.originalText}</span>
                                            </div>
                                            <div className="ai-bilingual-divider-line" />
                                            <div className="ai-bilingual-cell">
                                                <span className="ai-lang-badge">JA</span>
                                                <span className="ai-bilingual-text">{msg.content}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="ai-text-content">{msg.content}</div>
                                    )}

                                    {isUser && msg.originalText && language !== 'ja' && (
                                        <div className="ai-original-text">
                                            <span className="ai-original-text-label">KR</span> {msg.originalText}
                                        </div>
                                    )}

                                    {!isUser && msg.translation && showTranslations[i] && (
                                        <div className="ai-translation-box">
                                            {msg.translation}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 하단 액션바 */}
                            <div className="ai-bubble-actions">
                                {isUser && userTurn !== null && (
                                    <span className="ai-turn-info">{userTurn}턴 · {wordCount} 단어</span>
                                )}
                                {!isUser && (
                                    <>
                                        <button
                                            className={`ai-action-btn-pill ${playingIndex === i ? 'is-playing' : ''}`}
                                            onClick={() => handlePlay(msg.content, i)}
                                        >
                                            <SpeakerIcon width="14px" height="14px" />
                                            {playingIndex === i ? 'Stop' : 'Listen AI'}
                                        </button>
                                        <button className="ai-action-btn-text" onClick={() => toggleTranslation(i)}>
                                            {showTranslations[i] ? '번역 숨기기' : '한글 번역 보기'}
                                        </button>
                                    </>
                                )}
                                {isUser && msg.audioUrl && (
                                    <button
                                        className={`ai-action-btn-text ${playingIndex === i ? 'is-playing' : ''}`}
                                        onClick={() => handlePlay('', i, true, msg.audioUrl)}
                                    >
                                        <SpeakerIcon width="13px" height="13px" />
                                        {playingIndex === i ? 'Stop' : 'Play My Voice'}
                                    </button>
                                )}
                                {isUser && language === 'ja' && msg.originalText && msg.content && (
                                    <button
                                        className={`ai-action-btn-text ${playingJaIndex === i ? 'is-playing' : ''}`}
                                        onClick={() => handlePlayJA(msg.content, i)}
                                    >
                                        <SpeakerIcon width="13px" height="13px" />
                                        {playingJaIndex === i ? 'Stop' : 'Play JA Voice'}
                                    </button>
                                )}
                                {isUser && language === 'en' && msg.originalText && msg.content && (
                                    <button
                                        className={`ai-action-btn-text ${playingEnIndex === i ? 'is-playing' : ''}`}
                                        onClick={() => handlePlayEN(msg.content, i)}
                                    >
                                        <SpeakerIcon width="13px" height="13px" />
                                        {playingEnIndex === i ? 'Stop' : 'Play EN Voice'}
                                    </button>
                                )}
                            </div>

                            {/* 표현 평가 배지 */}
                            {isUser && msg.pronunciationScore !== undefined && (
                                <div className={`pronunciation-badge score-${getScoreLevel(msg.pronunciationScore)}`}>
                                    <span className="pronunciation-score">{msg.pronunciationScore}점</span>
                                    <div className="pronunciation-comparison">
                                        <span className="pronunciation-spoken">내 표현: {msg.pronunciationSpoken}</span>
                                        {msg.pronunciationIdeal && (
                                            <span className="pronunciation-expected">
                                                추천 표현: {msg.pronunciationIdeal}
                                                <button
                                                    className={`ai-action-btn-text pronunciation-listen-btn ${playingIdealIndex === i ? 'is-playing' : ''}`}
                                                    onClick={() => handlePlayIdeal(msg.pronunciationIdeal!, i)}
                                                >
                                                    <SpeakerIcon width="12px" height="12px" />
                                                    {playingIdealIndex === i ? 'Stop' : '듣기'}
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                    <span className="pronunciation-feedback">{msg.pronunciationFeedback}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {isStreaming && (
                <div className="ai-streaming-indicator">
                    <div className="ai-dot-pulse" />
                    <span>AI가 생각 중입니다...</span>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
}
