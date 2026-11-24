import React from 'react';
import {render, screen} from '@testing-library/react';
import {KpopChecklistStory, KpopRouteStory} from '@/components/marketing/KpopRouteStory';

const highlights = [
    {name: '성수', description: '팝업 거리', tip: '평일 오전'},
    {name: '홍대', description: '버스킹', tip: '저녁'},
];

// jsdom 에는 matchMedia 가 없어 움직임 줄이기로 판단된다: GSAP 을 불러오지 않고 모든 내용이 그대로 보여야 한다.
test('route story keeps every area readable without the sequencing script', () => {
    render(<KpopRouteStory highlights={highlights} />);
    expect(screen.getByRole('heading', {name: '성수'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: '홍대'})).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('평일 오전')).toBeInTheDocument();
});

test('checklist shows all items with their check marks', () => {
    render(<KpopChecklistStory items={['일정 확인', '막차 확인']} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['✓일정 확인', '✓막차 확인']);
});
