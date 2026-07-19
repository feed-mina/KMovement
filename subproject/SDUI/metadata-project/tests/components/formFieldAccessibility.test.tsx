import React from 'react';
import { render, screen } from '@testing-library/react';
import EmotionSelectField from '@/components/fields/EmotionSelectField';
import TextAreaField from '@/components/fields/TextAreaField';

describe('form field accessibility', () => {
    it('associates the content label with its textarea', () => {
        render(
            <TextAreaField
                id="content"
                meta={{ label_text: '내용', ref_data_id: 'content' }}
                data={{ content: '' }}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('textbox', { name: '내용' })).toBeInTheDocument();
    });

    it('associates the emotion label with its select', () => {
        render(
            <EmotionSelectField
                id="emotion"
                meta={{ label_text: '감정', ref_data_id: 'emotion' }}
                data={{ emotion: '' }}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('combobox', { name: '감정' })).toBeInTheDocument();
    });
});
