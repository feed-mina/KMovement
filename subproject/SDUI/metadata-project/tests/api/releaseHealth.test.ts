/** @jest-environment node */
import { GET } from '@/app/health/release/route';

const original = process.env.KMOVEMENT_RELEASE_SHA;
afterEach(() => {
    if (original === undefined) delete process.env.KMOVEMENT_RELEASE_SHA;
    else process.env.KMOVEMENT_RELEASE_SHA = original;
});

test('returns only the exact runtime release revision without caching', async () => {
    process.env.KMOVEMENT_RELEASE_SHA = 'a'.repeat(40);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', revision: 'a'.repeat(40) });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
});

test.each([undefined, '', 'latest', 'a'.repeat(39), 'z'.repeat(40)])('rejects unversioned runtime %s', async revision => {
    if (revision === undefined) delete process.env.KMOVEMENT_RELEASE_SHA;
    else process.env.KMOVEMENT_RELEASE_SHA = revision;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unversioned' });
});
