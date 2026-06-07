import React from 'react';
import { fireEvent, screen } from '@testing-library/react';

import DynamicEngine from '@/components/DynamicEngine/DynamicEngine';
import { renderWithProviders } from '@/tests/test-utils';


describe('MAIN_PAGE AI chat cards', () => {
    const metadata = [
        {
            componentId: 'main_ai_chat_grid',
            component_id: 'main_ai_chat_grid',
            componentType: 'GROUP',
            cssClass: 'main-ai-chat-grid col-span-3',
            children: [
                {
                    componentId: 'main_bento_ai_english_grp',
                    component_id: 'main_bento_ai_english_grp',
                    componentType: 'GROUP',
                    actionType: 'LINK',
                    actionUrl: '/view/AI_ENGLISH_CHAT_PAGE',
                    children: [
                        {
                            componentId: 'main_bento_ai_english_title',
                            component_id: 'main_bento_ai_english_title',
                            componentType: 'TEXT',
                            labelText: 'AI 영어 채팅',
                        },
                    ],
                },
                {
                    componentId: 'main_bento_ai_japanese_grp',
                    component_id: 'main_bento_ai_japanese_grp',
                    componentType: 'GROUP',
                    actionType: 'LINK',
                    actionUrl: '/view/AI_JAPANESE_CHAT_PAGE',
                    children: [
                        {
                            componentId: 'main_bento_ai_japanese_title',
                            component_id: 'main_bento_ai_japanese_title',
                            componentType: 'TEXT',
                            labelText: 'AI 일본어 채팅',
                        },
                    ],
                },
            ],
        },
    ] as any;

    function renderCards(onAction: jest.Mock) {
        renderWithProviders(
            <DynamicEngine
                metadata={metadata}
                screenId="MAIN_PAGE"
                pageData={{}}
                formData={{}}
                onChange={jest.fn()}
                onAction={onAction}
            />,
        );
    }

    it('runs the English card action when clicked', () => {
        const onAction = jest.fn();
        renderCards(onAction);

        fireEvent.click(screen.getByRole('link', { name: 'AI 영어 채팅' }));

        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: '/view/AI_ENGLISH_CHAT_PAGE' }),
            null,
        );
    });

    it('supports keyboard navigation on the Japanese card', () => {
        const onAction = jest.fn();
        renderCards(onAction);

        fireEvent.keyDown(screen.getByRole('link', { name: 'AI 일본어 채팅' }), {
            key: 'Enter',
        });

        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: '/view/AI_JAPANESE_CHAT_PAGE' }),
            null,
        );
    });
});
