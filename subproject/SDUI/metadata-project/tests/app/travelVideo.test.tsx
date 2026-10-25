import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TravelVideoPage from '../../app/travel/video/page';

jest.mock('@/components/fields/kride/PhotoVideoCourseLink', () => ({ PHOTO_VIDEO_CONTEXT_KEY: 'kride_photo_video_course' }));
const fetchMock = jest.fn();
const photo = '1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
const job = { jobId: photo, photoId: photo, status: 'COMPLETED', methodLabel: '사진 확대·이동 영상 (생성형 AI 아님)', videoUrl: `/api/travel-video/jobs/${photo}/video` };
const json = (data: unknown, ok = true) => Promise.resolve({ ok, json: async () => data });
beforeEach(() => {
  sessionStorage.clear(); fetchMock.mockReset(); global.fetch = fetchMock;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => photo });
});
function selectPhoto() {
  const input = screen.getByLabelText(/여행 사진 선택/);
  fireEvent.change(input, { target: { files: [new File(['test'], 'travel.png', { type: 'image/png' })] } });
}
it('uploads one image and reaches a playable video with a download link', async () => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/travel-video/photos') return json({ photoId: photo });
    if (url === '/api/travel-video/jobs' && init?.method === 'POST') return json(job);
    return json({ items: [] });
  });
  render(<TravelVideoPage />); selectPhoto();
  fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }));
  await screen.findByText('사진을 저장했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '영상 만들기' }));
  expect(await screen.findByRole('link', { name: '영상 다운로드' })).toHaveAttribute('href', job.videoUrl);
  expect(document.querySelector('video')).toHaveAttribute('controls');
});
it('does not automatically remove a rejected course link or submit another job', async () => {
  sessionStorage.setItem('kride_photo_video_course', JSON.stringify({ courseContext: 'signed', places: [{ id: 'poi:17', name: '서울 장소' }] }));
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/travel-video/photos') return json({ photoId: photo });
    if (url === '/api/travel-video/jobs' && init?.method === 'POST') return json({ detail: '코스가 만료됐습니다.' }, false);
    return json({ items: [] });
  });
  render(<TravelVideoPage />); selectPhoto();
  fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }));
  await screen.findByText('사진을 저장했습니다.');
  expect(screen.getByRole('button', { name: '영상 만들기' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('장소 선택'), { target: { value: 'poi:17' } });
  fireEvent.click(screen.getByRole('button', { name: '영상 만들기' }));
  await screen.findByText('코스가 만료됐습니다.');
  const submissions = fetchMock.mock.calls.filter(([url, init]) => url === '/api/travel-video/jobs' && init?.method === 'POST');
  expect(submissions).toHaveLength(1);
  expect(JSON.parse(submissions[0][1].body).courseContext).toBe('signed');
  expect(screen.getByLabelText('장소 선택')).toHaveValue('poi:17');
});
it('requires an explicit retry after a failed job and retains the original identifier', async () => {
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/travel-video/jobs?')) return json({ items: [{ ...job, status: 'FAILED', errorCode: 'RENDER_FAILED', videoUrl: null }] });
    if (url.endsWith('/retry')) return json({ ...job, jobId: 'new-job' });
    return json({});
  });
  render(<TravelVideoPage />);
  fireEvent.click(await screen.findByRole('button', { name: /영상 생성 실패 ·/ }));
  await screen.findByRole('button', { name: '실패한 영상 다시 만들기' });
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/retry'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '실패한 영상 다시 만들기' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === `/api/travel-video/jobs/${photo}/retry`)).toBe(true));
  await screen.findByRole('link', { name: '영상 다운로드' });
});
