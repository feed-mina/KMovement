import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ChartLeaf, StatCardLeaf } from '../adminLeaves';

// Shaped like the V71 ADMIN_DASHBOARD seed rows.
const STAT_META = {
  component_id: 'admin_total_users_card',
  component_type: 'STAT_CARD',
  label_text: 'Total users',
  ref_data_id: 'admin_overview_source',
  component_props: { valueKey: 'total_users', helperText: 'Active accounts', compact: true },
};

describe('StatCardLeaf', () => {
  it('reads valueKey out of the SINGLE-type overview record', () => {
    render(<StatCardLeaf id="c1" meta={STAT_META} data={{ total_users: 1234, today_signups: 3 }} />);

    expect(screen.getByText('Total users')).toBeTruthy();
    // formatMetric(compact) mirrors the web: integer input → 0 fraction digits,
    // so ko-KR renders 1234 as 1천.
    expect(screen.getByText('1천')).toBeTruthy();
    expect(screen.getByText('Active accounts')).toBeTruthy();
  });

  it('falls back to zero when the source has not loaded', () => {
    render(<StatCardLeaf id="c1" meta={STAT_META} data={undefined} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('ChartLeaf', () => {
  it('renders trend rows with labels and values', () => {
    const meta = {
      component_type: 'CHART',
      label_text: 'Signup trend',
      component_props: { type: 'line', labelKey: 'label', valueKey: 'value', caption: 'Last 14 days', limit: 14 },
    };
    render(
      <ChartLeaf
        id="chart"
        meta={meta}
        data={[
          { label: '07-22', value: 2 },
          { label: '07-23', value: 5 },
        ]}
      />,
    );

    expect(screen.getByText('Signup trend')).toBeTruthy();
    expect(screen.getByText('Last 14 days')).toBeTruthy();
    expect(screen.getByText('07-22')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('walks dataPath and shows donut percentages', () => {
    const meta = {
      component_type: 'CHART',
      label_text: 'AI/media usage',
      component_props: { type: 'donut', labelKey: 'label', valueKey: 'value' },
    };
    render(
      <ChartLeaf
        id="donut"
        meta={meta}
        data={[
          { label: 'done', value: 3 },
          { label: 'failed', value: 1 },
        ]}
      />,
    );

    expect(screen.getByText(/75%/)).toBeTruthy();
  });

  it('shows an empty notice instead of a blank card', () => {
    render(<ChartLeaf id="empty" meta={{ component_type: 'CHART', label_text: 'Empty' }} data={[]} />);
    expect(screen.getByText('표시할 데이터가 없습니다.')).toBeTruthy();
  });
});
