import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import KrideStatePanel, { KrideStateChips } from '@/components/fields/kride/atoms/KrideStatePanel';
import KrideSelectionCounter from '@/components/fields/kride/KrideSelectionCounter';

// 벤치마킹 G1: 공용 상태 패널 — Primary 1개, 보조 링크 최대 2개, 오류는 alert
describe('KrideStatePanel', () => {
    it('renders an error as an alert with one primary action and at most two links', () => {
        const retry = jest.fn();
        render(
            <KrideStatePanel
                kind="error"
                title="불러오지 못했어요"
                description="네트워크를 확인해 주세요"
                primaryAction={{ label: '다시 시도', onClick: retry }}
                secondaryAction={{ label: '조건 바꾸기', href: '/view/INTRO1' }}
                secondaryLinks={[{ label: '홈으로', href: '/' }, { label: '둘러보기', href: '/view/kpop' }, { label: '세 번째', href: '/x' }]}
            />,
        );
        const panel = screen.getByRole('alert');
        expect(panel).toHaveTextContent('네트워크를 확인해 주세요');
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(retry).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: '조건 바꾸기' })).toHaveAttribute('href', '/view/INTRO1');
        expect(screen.queryByRole('link', { name: '세 번째' })).not.toBeInTheDocument();
    });

    it('renders an empty state as a status with a link action and chips', () => {
        render(
            <KrideStatePanel kind="empty-first" title="아직 없어요" primaryAction={{ label: '둘러보기', href: '/view/kpop' }}
                context={<KrideStateChips label="내가 고른 조건" items={[{ text: 'BLACKPINK', accent: true }, { text: '서울' }]} />} />,
        );
        expect(screen.getByRole('status')).toHaveTextContent('아직 없어요');
        expect(screen.getByRole('link', { name: '둘러보기' })).toHaveAttribute('href', '/view/kpop');
        expect(screen.getByText('BLACKPINK')).toHaveClass('kride-state-chip--accent');
    });

    it('marks a busy primary action', () => {
        render(<KrideStatePanel kind="error" title="x" description="y" primaryAction={{ label: '다시 시도', onClick: jest.fn(), busy: true }} />);
        expect(screen.getByRole('button', { name: '다시 시도…' })).toBeDisabled();
    });
});

// 벤치마킹 G3: "2 / 5 선택" 카운터
describe('KrideSelectionCounter', () => {
    it('shows the live count against the maximum', () => {
        const meta = { componentProps: { checkKey: 'selectedArtists', min: 1, max: 5, unit: '명' } };
        const { rerender } = render(<KrideSelectionCounter meta={meta} formData={{}} />);
        expect(screen.getByRole('status')).toHaveTextContent('0 / 5 선택');
        rerender(<KrideSelectionCounter meta={meta} formData={{ selectedArtists: [{ id: 1 }, { id: 2 }] }} />);
        expect(screen.getByRole('status')).toHaveTextContent('2 / 5 선택');
        expect(screen.getByText('1명 이상, 최대 5명')).toBeInTheDocument();
    });
});
