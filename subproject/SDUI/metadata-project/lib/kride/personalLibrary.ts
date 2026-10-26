// Navigation hints only: never include an owner, token, photo URL or course token.
export const PHOTO_VIDEO_CONTEXT_KEY = 'kride_photo_video_course';
export const SAVED_PATH = '/view/KPOP_SAVED_ITEMS';
export const VIDEO_PATH = '/travel/video';
export const VIDEO_PAGE_LIMIT = 9999;
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type VideoLocation = {view: 'create' | 'history'; page: number; job: string | null; returnTo: string};

function internalUrl(value: unknown): URL | null {
    if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || /[\\\u0000-\u0020]/.test(value)) return null;
    try { const url = new URL(value, 'https://kride.invalid'); return url.origin === 'https://kride.invalid' ? url : null; }
    catch { return null; }
}
export function personalPage(value: unknown): number {
    return typeof value === 'string' && /^[1-9][0-9]{0,3}$/.test(value) ? Number(value) : 1;
}
export function savedLibraryHref(kind: unknown = 'artists', page: unknown = '1'): string {
    const selected = kind === 'events' || kind === 'products' ? kind : 'artists';
    return `${SAVED_PATH}?kind=${selected}&page=${personalPage(String(page))}`;
}
export function safePersonalReturn(value: unknown): string {
    const url = internalUrl(value);
    if (url?.pathname === '/view/MY_PAGE') return '/view/MY_PAGE';
    if (url?.pathname === SAVED_PATH) return savedLibraryHref(url.searchParams.get('kind'), url.searchParams.get('page'));
    return '/view/MY_PAGE';
}
export function readVideoLocation(search: Pick<URLSearchParams, 'get'>): VideoLocation {
    const rawJob = search.get('job');
    const job = rawJob && UUID_V4.test(rawJob) ? rawJob.toLowerCase() : null;
    const rawView = search.get('view');
    const view = job || rawView === 'history' || (rawView !== null && rawView !== 'create') ? 'history' : 'create';
    return {view, page: personalPage(search.get('page')), job: view === 'history' ? job : null, returnTo: safePersonalReturn(search.get('returnTo'))};
}
export function videoLibraryHref(value: Partial<VideoLocation> = {}): string {
    const params = new URLSearchParams();
    const view = value.view === 'history' ? 'history' : 'create';
    params.set('view', view);
    if (view === 'history') {
        params.set('page', String(personalPage(String(value.page ?? 1))));
        if (value.job && UUID_V4.test(value.job)) params.set('job', value.job.toLowerCase());
    }
    const back = safePersonalReturn(value.returnTo);
    if (back !== '/view/MY_PAGE') params.set('returnTo', back);
    return `${VIDEO_PATH}?${params}`;
}
export function safeVideoReturn(value: unknown): string | null {
    const url = internalUrl(value);
    return url?.pathname === VIDEO_PATH ? videoLibraryHref(readVideoLocation(url.searchParams)) : null;
}
export function clearPhotoVideoContext(): void {
    try { sessionStorage.removeItem(PHOTO_VIDEO_CONTEXT_KEY); } catch { /* Optional same-tab hint. */ }
}
