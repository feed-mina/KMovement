import { render, screen } from '@testing-library/react';
import KrideChatComponent from '@/components/fields/kride/chat/KrideChatComponent';

let mockHookState: any;

jest.mock('@/lib/hooks/useKrideChatStream', () => ({
  useKrideChatStream: () => mockHookState ?? ({
    messages: [],
    isLoading: false,
    error: null,
    send: jest.fn(),
    abort: jest.fn(),
    reset: jest.fn(),
  }),
}));

describe('KrideChatComponent', () => {
  beforeEach(() => {
    mockHookState = {
      messages: [],
      isLoading: false,
      error: null,
      send: jest.fn(),
      abort: jest.fn(),
      reset: jest.fn(),
    };
  });

  it('uses the compact modal layout and keeps the composer outside the scroll area', () => {
    const { container } = render(
      <KrideChatComponent
        meta={{ labelText: 'K-RIDE travel assistant' }}
        data={{ suggestions: ['Build a Seoul itinerary'] }}
        onCloseModal={jest.fn()}
      />
    );

    expect(container.querySelector('.kride-chat-header')).toHaveAttribute('data-variant', 'sheet');
    expect(container.querySelector('.kride-chat-empty')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('switches Rai to the sad state when chat returns an error', () => {
    mockHookState = {
      messages: [
        {
          id: 'assistant-error',
          role: 'assistant',
          text: 'No route found',
          error: 'No route found',
        },
      ],
      isLoading: false,
      error: 'No route found',
      send: jest.fn(),
      abort: jest.fn(),
      reset: jest.fn(),
    };

    const { container } = render(
      <KrideChatComponent
        meta={{ labelText: 'K-RIDE travel assistant' }}
        data={{ suggestions: ['Build a Seoul itinerary'] }}
      />
    );

    expect(container.querySelector('.kride-chat-header')).toHaveAttribute('data-status', 'error');
    expect(screen.getByText('코스를 못 찾았어요. 조건을 바꿔볼까요?')).toBeInTheDocument();
  });
});
