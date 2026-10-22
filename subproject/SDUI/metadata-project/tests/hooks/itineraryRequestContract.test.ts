import { act, renderHook, waitFor } from '@testing-library/react';
import { useKrideItinerary } from '@/components/DynamicEngine/hook/useKrideItinerary';
import { buildItineraryRequest, validateItineraryRequest, itineraryHttpError, classifyItineraryError, itineraryErrorMessage } from '@/lib/kride/itineraryRequest';
jest.mock('@/lib/analytics/dataLayer', () => ({ trackEvent: jest.fn() }));

const form = { duration: 'day', selectedRegions: [{ name: '서울' }], selectedArtists: [{ name: 'BTS' }], budget: [30000, 200000], responseLocale: 'ja', acknowledgeUnverifiedConditions: true };
const success = { status: 'ok', itinerary: [{ day: 1, morning: { places: [{ name: 'place' }] } }], mapData: { markers: [] } };

beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => success }); });

test('builder preserves names, slider budget, locale and explicit consent', () => {
    expect(buildItineraryRequest(form)).toEqual({ duration: '당일치기', artists: ['BTS'], regions: ['서울'], purposes: [], budget: { min: 30000, max: 200000 }, responseLocale: 'ja', acknowledgeUnverifiedConditions: true });
    expect(buildItineraryRequest({ regions: ['서울'] })).toMatchObject({ budget: { min: 30000, max: 2000000 }, acknowledgeUnverifiedConditions: false });
});

test.each([false, undefined, 'true', 1])('never treats %s as explicit consent', consent => {
    const body = buildItineraryRequest({ ...form, acknowledgeUnverifiedConditions: consent });
    expect(body.acknowledgeUnverifiedConditions).toBe(false);
    expect(() => validateItineraryRequest(body)).toThrow('consent');
});

test.each([{ regions: ['부산'], selectedRegions: undefined }, { duration: 'onenight' }, { selectedRegions: [] }])('unsupported conditions stop before fetch: %j', change => {
    expect(() => validateItineraryRequest(buildItineraryRequest({ ...form, ...change }))).toThrow('unsupported');
});

test('hook blocks without consent, then retry uses current explicit consent and chosen language', async () => {
    const { result, rerender } = renderHook(({ value }) => useKrideItinerary('KRIDE_FOCUS', value), { initialProps: { value: { ...form, acknowledgeUnverifiedConditions: false } } });
    await waitFor(() => expect(result.current.errorKind).toBe('consent'));
    expect(fetch).not.toHaveBeenCalled();
    rerender({ value: form });
    await act(async () => result.current.retry());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toEqual(buildItineraryRequest(form));
    expect(result.current.data).not.toBeNull();
});

test('disabled focus never generates, explicit confirmation generates once', async () => {
    const { rerender } = renderHook(({ enabled }) => useKrideItinerary('KRIDE_FOCUS', form, enabled), { initialProps: { enabled: false } });
    expect(fetch).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ enabled: true });
    expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([[401, 'login'], [403, 'forbidden'], [422, 'validation'], [429, 'limit'], [502, 'upstream'], [503, 'unavailable'], [504, 'timeout']])('HTTP %i keeps its error kind %s despite server text', (status, kind) => {
    const error = itineraryHttpError(status as number, { detail: 'server wording can change' });
    expect(classifyItineraryError(error)).toBe(kind);
    expect(itineraryErrorMessage(error)).not.toContain('server wording');
});

test.each([['consent_required', 'consent'], ['unsupported_conditions', 'unsupported']])('structured 422 %s becomes %s', (code, kind) => {
    expect(classifyItineraryError(itineraryHttpError(422, { detail: { code } }))).toBe(kind);
});

test('validation arrays, timeout and network failures remain distinct', () => {
    expect(classifyItineraryError(itineraryHttpError(422, { detail: [{ loc: ['body', 'duration'] }] }))).toBe('validation');
    expect(classifyItineraryError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
    expect(classifyItineraryError(new TypeError('Failed to fetch'))).toBe('network');
    expect(classifyItineraryError(new Error('empty_result'))).toBe('no-route');
    expect(classifyItineraryError(new Error('empty_candidates'))).toBe('candidates');
});
