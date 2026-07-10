import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationPanelV2 from '@/components/fields/ai/ConversationPanelV2';
import { ChatMessage } from '@/lib/types/ai';
import api from '@/services/axios';

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(() => Promise.resolve({ data: { data: '안녕하세요! 일본어 연습을 도와드릴게요.' } })),
    },
}));

const mockedApi = api as unknown as { post: jest.Mock };

// jsdom에서 scrollIntoView가 구현되어 있지 않아서 mock 처리
window.HTMLElement.prototype.scrollIntoView = jest.fn();

beforeEach(() => {
    mockedApi.post.mockClear();
    mockedApi.post.mockResolvedValue({ data: { data: '안녕하세요! 일본어 연습을 도와드릴게요.' } });
});

describe('ConversationPanelV2', () => {

    describe('메시지 렌더링', () => {
        it('system 메시지는 렌더링하지 않아야 함', () => {
            const messages: ChatMessage[] = [
                { role: 'system', content: 'system instruction' },
                { role: 'assistant', content: 'Hello!' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.queryByText('system instruction')).not.toBeInTheDocument();
            expect(screen.getByText('Hello!')).toBeInTheDocument();
        });

        it('user 메시지에 턴 번호와 단어 수를 표시해야 함', () => {
            const messages: ChatMessage[] = [
                { role: 'user', content: 'Hello world test' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.getByText(/1턴/)).toBeInTheDocument();
            expect(screen.getByText(/3 단어/)).toBeInTheDocument();
        });

        it('isStreaming이 true일 때 로딩 인디케이터를 표시해야 함', () => {
            render(<ConversationPanelV2 messages={[]} isStreaming={true} />);
            expect(screen.getByText('AI가 생각 중입니다...')).toBeInTheDocument();
        });

        it('isStreaming이 false일 때 로딩 인디케이터를 표시하지 않아야 함', () => {
            render(<ConversationPanelV2 messages={[]} isStreaming={false} />);
            expect(screen.queryByText('AI가 생각 중입니다...')).not.toBeInTheDocument();
        });
    });

    describe('한글 번역 보기 (지연 번역)', () => {
        it('translation이 이미 있으면 클릭 시 API 호출 없이 즉시 표시해야 함', async () => {
            const messages: ChatMessage[] = [
                { role: 'assistant', content: 'Hello!', translation: '안녕하세요!' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            fireEvent.click(screen.getByText('한글 번역 보기'));

            expect(screen.getByText('안녕하세요!')).toBeInTheDocument();
            expect(mockedApi.post).not.toHaveBeenCalled();
        });

        it('translation이 없는 환영 메시지는 클릭 시 translate API로 지연 번역해 표시해야 함', async () => {
            const messages: ChatMessage[] = [
                { role: 'assistant', content: 'こんにちは！日本語の練習をお手伝いします。' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} language="ja" />);

            fireEvent.click(screen.getByText('한글 번역 보기'));

            await waitFor(() => {
                expect(screen.getByText('안녕하세요! 일본어 연습을 도와드릴게요.')).toBeInTheDocument();
            });
            expect(mockedApi.post).toHaveBeenCalledWith('/api/ai/v2/chat/translate', {
                text: 'こんにちは！日本語の練習をお手伝いします。',
                target: 'ko',
            });
        });

        it('번역 API 실패 시 안내 문구를 표시해야 함', async () => {
            mockedApi.post.mockRejectedValueOnce(new Error('network'));
            const messages: ChatMessage[] = [
                { role: 'assistant', content: 'Hello!' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            fireEvent.click(screen.getByText('한글 번역 보기'));

            await waitFor(() => {
                expect(screen.getByText('번역을 불러오지 못했습니다.')).toBeInTheDocument();
            });
        });

        it('번역 숨기기 클릭 시 번역 영역을 감춰야 함', async () => {
            const messages: ChatMessage[] = [
                { role: 'assistant', content: 'Hello!', translation: '안녕하세요!' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            fireEvent.click(screen.getByText('한글 번역 보기'));
            expect(screen.getByText('안녕하세요!')).toBeInTheDocument();

            fireEvent.click(screen.getByText('번역 숨기기'));
            expect(screen.queryByText('안녕하세요!')).not.toBeInTheDocument();
        });
    });

    describe('표현 평가 배지 (pronunciationScore)', () => {
        it('pronunciationScore가 있으면 평가 배지를 렌더링해야 함', () => {
            const messages: ChatMessage[] = [
                {
                    role: 'user',
                    content: "It's a beautiful day",
                    pronunciationScore: 85,
                    pronunciationSpoken: "It's a beautiful day",
                    pronunciationIdeal: 'What a beautiful day it is!',
                    pronunciationFeedback: 'Great expression!',
                },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.getByText('85점')).toBeInTheDocument();
            expect(screen.getByText(/내 표현:/)).toBeInTheDocument();
            expect(screen.getByText(/추천 표현:/)).toBeInTheDocument();
            expect(screen.getByText('Great expression!')).toBeInTheDocument();
        });

        it('pronunciationScore가 없으면 배지를 렌더링하지 않아야 함', () => {
            const messages: ChatMessage[] = [
                { role: 'user', content: 'Hello' },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.queryByText(/점/)).not.toBeInTheDocument();
        });

        it('pronunciationIdeal이 없으면 "추천 표현" 항목을 렌더링하지 않아야 함', () => {
            const messages: ChatMessage[] = [
                {
                    role: 'user',
                    content: 'Hello',
                    pronunciationScore: 60,
                    pronunciationSpoken: 'Hello',
                    pronunciationFeedback: 'Good try!',
                },
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.getByText('60점')).toBeInTheDocument();
            expect(screen.queryByText(/추천 표현:/)).not.toBeInTheDocument();
        });

        it('assistant 메시지에는 평가 배지를 렌더링하지 않아야 함', () => {
            const messages: ChatMessage[] = [
                {
                    role: 'assistant',
                    content: 'Hello there!',
                    pronunciationScore: 90, // assistant에 잘못 설정된 경우도 표시 안 함
                } as ChatMessage,
            ];
            render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(screen.queryByText('90점')).not.toBeInTheDocument();
        });
    });

    describe('점수 레벨 CSS 클래스', () => {
        it.each([
            [90, 'excellent'],
            [85, 'excellent'],
            [75, 'good'],
            [65, 'good'],
            [55, 'fair'],
            [45, 'fair'],
            [30, 'poor'],
            [0,  'poor'],
        ])('score %i → score-%s CSS 클래스 적용', (score, expectedLevel) => {
            const messages: ChatMessage[] = [
                {
                    role: 'user',
                    content: 'test',
                    pronunciationScore: score,
                    pronunciationSpoken: 'test',
                },
            ];
            const { container } = render(<ConversationPanelV2 messages={messages} isStreaming={false} />);

            expect(container.querySelector(`.score-${expectedLevel}`)).toBeInTheDocument();
        });
    });
});
