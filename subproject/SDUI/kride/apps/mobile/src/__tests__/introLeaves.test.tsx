import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useOnboardingStore } from '@kride/core';
import { DurationButtonLeaf, KrideNextButtonLeaf, TypewriterTextLeaf } from '../composites';
import { RemoteImageLeaf } from '../leaves';

// Shaped like the V53 seed rows for the KRIDE_INTRO screens.
const NEXT_META = {
  component_id: 'intro2_next',
  component_type: 'KRIDE_NEXT_BTN',
  label_text: '다음',
  action_type: 'LINK',
  action_url: '/view/INTRO3',
};

describe('TypewriterTextLeaf', () => {
  it('renders the seeded title text statically', () => {
    render(
      <TypewriterTextLeaf
        id="intro1_title"
        meta={{ component_type: 'TYPEWRITER_TEXT', label_text: '어떤 여행을 떠나실 건가요?' }}
      />,
    );
    expect(screen.getByText('어떤 여행을 떠나실 건가요?')).toBeTruthy();
  });
});

describe('KrideNextButtonLeaf', () => {
  it('dispatches the LINK action so the engine can navigate', () => {
    const onAction = jest.fn();
    render(<KrideNextButtonLeaf id="intro2_next" meta={NEXT_META} formData={{}} onAction={onAction} />);

    fireEvent.press(screen.getByText('다음'));

    expect(onAction).toHaveBeenCalledWith(NEXT_META, {});
  });

  it('stays hidden until componentProps gating is satisfied', () => {
    const meta = { ...NEXT_META, component_props: { checkKey: 'artists', minCount: 1 } };
    const { rerender } = render(
      <KrideNextButtonLeaf id="intro2_next" meta={meta} formData={{ artists: [] }} onAction={jest.fn()} />,
    );
    expect(screen.queryByText('다음')).toBeNull();

    rerender(
      <KrideNextButtonLeaf
        id="intro2_next"
        meta={meta}
        formData={{ artists: [{ id: 1 }] }}
        onAction={jest.fn()}
      />,
    );
    expect(screen.getByText('다음')).toBeTruthy();
  });
});

describe('DurationButtonLeaf', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ duration: null });
  });

  it('stores the picked duration before the LINK action navigates away', () => {
    const onAction = jest.fn();
    render(
      <DurationButtonLeaf
        id="intro1_btn_1n"
        meta={{ component_type: 'DURATION_BUTTON', label_text: '1박 2일', action_type: 'LINK', action_url: '/view/INTRO2' }}
        onAction={onAction}
      />,
    );

    fireEvent.press(screen.getByText('1박 2일'));

    expect(useOnboardingStore.getState().duration).toBe('onenight');
    expect(onAction).toHaveBeenCalled();
  });
});

describe('RemoteImageLeaf', () => {
  it('skips web-app relative asset paths that do not exist on device', () => {
    const { toJSON } = render(
      <RemoteImageLeaf id="intro1_hero" meta={{ component_type: 'IMAGE', label_text: '/images/kride_hero.png' }} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders absolute URLs', () => {
    const { toJSON } = render(
      <RemoteImageLeaf id="img" meta={{ component_type: 'IMAGE', label_text: 'https://cdn.test/hero.png' }} />,
    );
    expect(toJSON()).not.toBeNull();
  });
});
