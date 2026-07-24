import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AddressSearchModal, { parseAddressSearchResponse } from '../components/AddressSearchModal';

describe('parseAddressSearchResponse', () => {
  it('keeps only rows with both zipCode and roadAddress', () => {
    expect(
      parseAddressSearchResponse({
        items: [
          { zipCode: '06236', roadAddress: '서울 강남구 테헤란로 152', buildingName: '강남파이낸스센터' },
          { zipCode: '', roadAddress: '어딘가' },
          { roadAddress: '우편번호 없음' },
          null,
        ],
      }),
    ).toEqual([
      {
        zipCode: '06236',
        roadAddress: '서울 강남구 테헤란로 152',
        jibunAddress: undefined,
        buildingName: '강남파이낸스센터',
      },
    ]);
  });

  it('returns an empty list for malformed bodies', () => {
    expect(parseAddressSearchResponse(null)).toEqual([]);
    expect(parseAddressSearchResponse({})).toEqual([]);
    expect(parseAddressSearchResponse({ items: 'nope' })).toEqual([]);
  });
});

describe('AddressSearchModal', () => {
  const props = {
    visible: true,
    apiBase: 'https://api.test',
    onComplete: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches the backend proxy and applies the tapped result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ zipCode: '06236', roadAddress: '서울 강남구 테헤란로 152', jibunAddress: '역삼동 737' }],
      }),
    }) as any;

    render(<AddressSearchModal {...props} />);

    fireEvent.changeText(screen.getByPlaceholderText('예: 테헤란로 152 또는 역삼동'), '테헤란로 152');
    fireEvent.press(screen.getByText('검색'));

    // Generous timeout: the full suite runs 13 workers in parallel on CI-ish
    // hardware and the default 1s async timeout flakes under that contention.
    const row = await screen.findByText('서울 강남구 테헤란로 152', {}, { timeout: 15000 });
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.test/api/v1/address/search?keyword=${encodeURIComponent('테헤란로 152')}`,
    );

    fireEvent.press(row);
    expect(props.onComplete).toHaveBeenCalledWith({
      zipCode: '06236',
      roadAddress: '서울 강남구 테헤란로 152',
    });
  });

  it('falls back to manual entry when the search API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as any;

    render(<AddressSearchModal {...props} />);

    fireEvent.changeText(screen.getByPlaceholderText('예: 테헤란로 152 또는 역삼동'), '테헤란로');
    fireEvent.press(screen.getByText('검색'));

    await screen.findByText('주소 검색에 실패했습니다. 아래 직접 입력을 이용해주세요.', {}, { timeout: 15000 });

    fireEvent.press(screen.getByText('주소를 찾을 수 없나요? 직접 입력'));
    fireEvent.changeText(screen.getByPlaceholderText('우편번호 (5자리)'), '06236');
    fireEvent.changeText(screen.getByPlaceholderText('도로명 주소'), '서울 강남구 테헤란로 152');
    fireEvent.press(screen.getByText('이 주소 사용'));

    expect(props.onComplete).toHaveBeenCalledWith({
      zipCode: '06236',
      roadAddress: '서울 강남구 테헤란로 152',
    });
  });

  it('requires at least two characters before searching', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    render(<AddressSearchModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('예: 테헤란로 152 또는 역삼동'), '강');
    fireEvent.press(screen.getByText('검색'));

    await waitFor(
      () => expect(screen.getByText('도로명, 건물명 또는 동 이름을 2자 이상 입력해주세요.')).toBeTruthy(),
      { timeout: 15000 },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
