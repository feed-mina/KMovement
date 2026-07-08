'use client';

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types/ai';
import Rai from '@/components/fields/kride/atoms/Rai';

interface ConversationPanelProps {
    messages: ChatMessage[];
    isStreaming: boolean;
}

export default function ConversationPanel({ messages, isStreaming }: ConversationPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [playingIndex, setPlayingIndex] = React.useState<number | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;
        }
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handlePlay = (text: string, index: number) => {
        if (!synthRef.current) return;

        if (playingIndex === index) {
            synthRef.current.cancel();
            setPlayingIndex(null);
            return;
        }

        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 언어 감지: 한글이 포함되어 있으면 ko-KR, 아니면 en-US (간단하게)
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
        utterance.lang = hasKorean ? 'ko-KR' : 'en-US';
        
        utterance.onend = () => setPlayingIndex(null);
        utterance.onerror = () => setPlayingIndex(null);

        setPlayingIndex(index);
        synthRef.current.speak(utterance);
    };

    return (
        <div className="conversation-panel">
            {messages.map((msg, i) => (
                <div key={i} className={`message-bubble message-${msg.role}`}>
                    <span className="message-avatar">
                        {msg.role === 'assistant'
                            ? <Rai state={isStreaming && i === messages.length - 1 ? 'thinking' : 'success'} size={28} />
                            : '나'}
                    </span>
                    <div className="message-container">
                        <div className="message-content">
                            {msg.content}
                            {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && (
                                <span className="streaming-cursor">▌</span>
                            )}
                        </div>
                        {msg.role === 'assistant' && msg.content && !isStreaming && (
                            <div className="message-actions">
                                <button 
                                    className={`play-btn ${playingIndex === i ? 'playing' : ''}`}
                                    onClick={() => handlePlay(msg.content, i)}
                                >
                                    {playingIndex === i ? '⏹ 정지' : '▶ 듣기'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
