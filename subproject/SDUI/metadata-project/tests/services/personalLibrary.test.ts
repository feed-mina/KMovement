import {personalPage, readVideoLocation, safePersonalReturn, safeVideoReturn, videoLibraryHref} from '@/lib/kride/personalLibrary';
import {safeLoginReturn, loginReturnLabel} from '@/lib/kride/loginReturn';
import {videoCreatedAt, normalizeVideoJob} from '@/lib/hooks/usePrivateVideoHistory';
const id = '1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
test('video login return keeps only supported navigation hints and a bounded saved return', () => {
    const input = `/travel/video?view=history&page=2&job=${id}&owner=99&token=secret&returnTo=${encodeURIComponent('/view/KPOP_SAVED_ITEMS?kind=events&page=3&returnTo=https://outside.test')}`;
    expect(safeLoginReturn(input)).toBe(videoLibraryHref({view:'history',page:2,job:id,returnTo:'/view/KPOP_SAVED_ITEMS?kind=events&page=3'}));
    expect(loginReturnLabel(input)).toBe('내 영상');
});
test.each(['https://outside.test/travel/video','//outside.test/travel/video','/travel/video/extra','/travel/%76ideo','/travel/video\\evil','/travel/video\n'])('rejects video destination %s', value => {
    expect(safeVideoReturn(value)).toBeNull(); expect(safeLoginReturn(value)).toBe('/view/MY_PAGE');
});
test.each(['https://outside.test','//outside.test','/view/LOGIN_PAGE','/travel/video?returnTo=/view/MY_PAGE','/view/KPOP_SAVED_ITEMS/extra'])('rejects personal return %s', value => expect(safePersonalReturn(value)).toBe('/view/MY_PAGE'));
test('normalizes invalid mode, page, job and removes account hints', () => {
    expect(readVideoLocation(new URLSearchParams('view=bad&page=10000&job=bad&owner=4'))).toEqual({view:'history',page:1,job:null,returnTo:'/view/MY_PAGE'});
    expect(readVideoLocation(new URLSearchParams('job='+id))).toMatchObject({view:'history',job:id});
    expect(safePersonalReturn('/view/KPOP_SAVED_ITEMS?kind=bad&page=-2&owner=4')).toBe('/view/KPOP_SAVED_ITEMS?kind=artists&page=1');
    expect(personalPage('9999')).toBe(9999); expect(personalPage('0')).toBe(1);
});
test('interprets SQLite timestamps as UTC and presents Korean time', () => {
    expect(videoCreatedAt('2026-10-26 01:00:00')?.dateTime).toBe('2026-10-26T01:00:00.000Z');
    expect(videoCreatedAt('2026-10-26 01:00:00')?.label).toContain('10:00');
    expect(videoCreatedAt('not-a-date')).toBeNull();
});
test('never follows an external playback URL', () => {
    const job=normalizeVideoJob({jobId:id,photoId:id,status:'COMPLETED',methodLabel:'사진',videoUrl:'https://outside.test/video.mp4'},id);
    expect(job.videoUrl).toBe(`/api/travel-video/jobs/${id}/video`);
    expect(()=>normalizeVideoJob({...job,jobId:'other'},id)).toThrow();
});
