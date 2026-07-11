import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import KrideNextButton from '@/components/fields/kride/KrideNextButton';
import { renderWithProviders } from '@/tests/test-utils';

describe('KrideNextButton', () => {
    it('hides until the configured selection count is met', () => {
        const { rerender } = renderWithProviders(
            <KrideNextButton id="next" meta={{ labelText: '다음', componentProps: { checkKey: 'artists', minCount: 2 } }} formData={{ artists: ['BTS'] }} onAction={jest.fn()} />,
        );
        expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
        rerender(<KrideNextButton id="next" meta={{ labelText: '다음', componentProps: { checkKey: 'artists', minCount: 2 } }} formData={{ artists: ['BTS', 'IVE'] }} onAction={jest.fn()} />);
        expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument();
    });

    it('forwards metadata when activated', () => {
        const onAction = jest.fn();
        const meta = { labelText: '다음', actionType: 'ROUTE', actionUrl: '/view/NEXT' };
        renderWithProviders(<KrideNextButton id="next" meta={meta} formData={{}} onAction={onAction} />);
        fireEvent.click(screen.getByRole('button', { name: '다음' }));
        expect(onAction).toHaveBeenCalledWith(meta, {});
    });
});
