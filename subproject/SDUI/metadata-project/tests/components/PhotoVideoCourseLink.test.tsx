import { fireEvent, render, screen } from '@testing-library/react';
import PhotoVideoCourseLink from '../../components/fields/kride/PhotoVideoCourseLink';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const original = process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED;
beforeEach(() => { process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED = 'true'; push.mockReset(); sessionStorage.clear(); });
afterAll(() => { if (original === undefined) delete process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED; else process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED = original; });

it('preserves official IDs and the signed course while opening the photo workflow', () => {
  render(<PhotoVideoCourseLink data={{ courseContext: 'signed-owner-context', source_pois: [{ id: 'poi:17', name: '서울 장소', otherPrivateData: 'not-copied' }] }} />);
  fireEvent.click(screen.getByRole('button', { name: '이 코스의 여행 사진으로 영상 만들기' }));
  expect(push).toHaveBeenCalledWith('/travel/video');
  expect(JSON.parse(sessionStorage.getItem('kride_photo_video_course')!)).toEqual({ courseContext: 'signed-owner-context', places: [{ id: 'poi:17', name: '서울 장소' }] });
});
it('does not show an unsigned course or a disabled feature', () => {
  const view = render(<PhotoVideoCourseLink data={{ source_pois: [{ id: 'poi:17', name: '서울 장소' }] }} />);
  expect(screen.queryByRole('button')).toBeNull();
  process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED = 'false';
  view.rerender(<PhotoVideoCourseLink data={{ courseContext: 'signed', source_pois: [{ id: 'poi:17', name: '서울 장소' }] }} />);
  expect(screen.queryByRole('button')).toBeNull();
});
