import { render, screen } from '@testing-library/react';
import KrideChatComponent from '@/components/fields/kride/chat/KrideChatComponent';

jest.mock('@/lib/hooks/useKrideChatStream', () => ({
  useKrideChatStream: () => ({
    messages: [],
    isLoading: false,
    send: jest.fn(),
    abort: jest.fn(),
    reset: jest.fn(),
  }),
}));

describe('KrideChatComponent', () => {
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
});
