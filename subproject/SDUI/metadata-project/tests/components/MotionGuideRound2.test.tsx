import React from 'react';
import {render, screen} from '@testing-library/react';
import TrajectoryPreview, {TRAJECTORY_POINTS} from '@/components/community/TrajectoryPreview';
import LoadingRouteTrack from '@/components/fields/kride/LoadingRouteTrack';
import HomeRouteLine from '@/components/marketing/HomeRouteLine';
import AnimationProgressSteps from '@/components/community/AnimationProgressSteps';

// jsdom 은 움직임 줄이기로 판단된다: 순서 연출 도구 없이도 다 그려진 정적 그림이 나와야 한다.
test('trajectory preview draws the chosen path without the sequencing script', () => {
    const {container, rerender} = render(<TrajectoryPreview imageUrl="/a.jpg" preset="object_pan_left" />);
    expect(container.querySelector('[data-traj-line]')).toHaveAttribute('d', 'M70 50 L30 50');
    rerender(<TrajectoryPreview imageUrl="/a.jpg" preset="pause_then_move" />);
    expect(container.querySelector('[data-traj-line]')).toHaveAttribute('d', 'M50 50 L70 50');
    expect(screen.getByText(/잠깐 멈췄다가 출발/)).toBeInTheDocument();
});

test('trajectory presets match the worker names', () => {
    expect(Object.keys(TRAJECTORY_POINTS).sort()).toEqual(['arc_down', 'arc_up', 'object_pan_left', 'object_pan_right', 'pause_then_move']);
});

test('loading track is decorative and marks reached stops', () => {
    const {container} = render(<LoadingRouteTrack stageIndex={1} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    const filled = Array.from(container.querySelectorAll('[data-track-dot]')).map((dot) => dot.getAttribute('fill') !== '#fff');
    expect(filled).toEqual([true, true, false]);
});

test('home route line is hidden from assistive technology', () => {
    const {container} = render(<HomeRouteLine />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path')).toHaveLength(5);
});

test('progress steps accept custom labels for the private video page', () => {
    render(<AnimationProgressSteps status="RUNNING" labels={['대기', '생성 중', '완료']} />);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['대기', '생성 중', '완료']);
    expect(screen.getByText('생성 중').closest('li')).toHaveAttribute('aria-current', 'step');
});
