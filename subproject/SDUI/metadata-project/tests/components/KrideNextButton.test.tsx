import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import KrideNextButton from '@/components/fields/kride/KrideNextButton';
import { renderWithProviders } from '@/tests/test-utils';

describe('KrideNextButton', () => {
    // 벤치마킹 G3: 하한 미만이면 숨기지 않고 비활성 + 이유 문구 (Spotify/Pinterest/Netflix 3/4)
    it('stays visible but disabled with a reason until the configured selection count is met', () => {
        const onAction = jest.fn();
        const meta = { labelText: '다음', componentProps: { checkKey: 'selectedArtists', minCount: 2, unit: '명' } };
        const { rerender } = renderWithProviders(
            <KrideNextButton id="next" meta={meta} formData={{ selectedArtists: ['BTS'] }} onAction={onAction} />,
        );
        const gated = screen.getByRole('button', { name: '다음 · 1명 선택됨' });
        expect(gated).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('2명 이상 골라야');
        fireEvent.click(gated);
        expect(onAction).not.toHaveBeenCalled();

        rerender(<KrideNextButton id="next" meta={meta} formData={{ selectedArtists: ['BTS', 'IVE'] }} onAction={onAction} />);
        const ready = screen.getByRole('button', { name: '다음 · 2명 선택됨' });
        expect(ready).toBeEnabled();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        fireEvent.click(ready);
        expect(onAction).toHaveBeenCalledWith(meta, {});
    });

    it('shows a plain label and no gate when nothing is selected yet', () => {
        renderWithProviders(
            <KrideNextButton id="next" meta={{ labelText: '다음', componentProps: { checkKey: 'selectedArtists', minCount: 1 } }} formData={{}} onAction={jest.fn()} />,
        );
        expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('1명 이상 골라야');
    });

    it('forwards metadata when activated', () => {
        const onAction = jest.fn();
        const meta = { labelText: '다음', actionType: 'ROUTE', actionUrl: '/view/NEXT' };
        renderWithProviders(<KrideNextButton id="next" meta={meta} formData={{}} onAction={onAction} />);
        fireEvent.click(screen.getByRole('button', { name: '다음' }));
        expect(onAction).toHaveBeenCalledWith(meta, {});
    });
});
