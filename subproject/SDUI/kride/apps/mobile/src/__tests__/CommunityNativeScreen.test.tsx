import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import CommunityNativeScreen from '../screens/CommunityNativeScreen';

const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///test-cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

jest.mock('@kride/core', () => ({
  authHeader: () => ({ Authorization: 'Bearer mobile-test-token' }),
  useSessionStore: (selector: (state: unknown) => unknown) => selector({
    user: { userSqno: 7 },
    isLoggedIn: true,
  }),
}));

jest.setTimeout(90000);

const ok = (data?: unknown, status = 200) => Promise.resolve({
  ok: true,
  status,
  json: async () => ({ data }),
});

const posts = [{
  postId: 11,
  title: '서울 팬 투어 후기',
  contentPreview: '즐거웠던 팬 투어 이야기입니다.',
  authorSqno: 9,
  authorNickname: '라이친구',
  likeCount: 2,
  createdAt: '2026-07-23T09:00:00',
}];

const post = {
  ...posts[0],
  content: '즐거웠던 팬 투어 이야기입니다. 다음에도 함께해요.',
  reportCount: 0,
  moderationStatus: 'APPROVED',
  images: [],
};

const approvedComment = {
  commentId: 31,
  postId: 11,
  authorSqno: 7,
  authorNickname: '나',
  content: '좋은 후기예요.',
  moderationStatus: 'APPROVED',
  createdAt: '2026-07-23T10:00:00',
};

const installFetch = (
  postDetail: typeof post = post,
  postRows: Array<(typeof posts)[number] & { moderationStatus?: string }> = posts,
) => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/api/v1/community/posts?page=0&size=20')) return ok({ content: postRows });
    if (url.endsWith('/api/v1/community/posts') && method === 'POST') {
      return ok({
        postId: 55,
        title: '새 팬 이야기',
        content: '모바일에서 작성했습니다.',
        authorSqno: 7,
        authorNickname: '나',
        likeCount: 0,
        moderationStatus: 'PENDING',
        images: [],
      });
    }
    if (url.endsWith('/api/v1/community/posts/11/comments') && method === 'GET') {
      return ok({ content: [approvedComment], number: 0, size: 20, totalElements: 1 });
    }
    if (url.endsWith('/api/v1/community/posts/11/likes/status')) return ok({ liked: false, likeCount: 2 });
    if (url.endsWith('/api/v1/community/users/9/follow/status')) return ok({ following: false, followerCount: 3 });
    if (url.endsWith('/api/v1/community/posts/11') && method === 'GET') return ok(postDetail);
    if (url.endsWith('/api/v1/community/posts/11/comments') && method === 'POST') {
      return ok({
        commentId: 44,
        postId: 11,
        authorSqno: 7,
        authorNickname: '나',
        content: '검수할 새 댓글',
        moderationStatus: 'PENDING',
      });
    }
    if (url.endsWith('/api/v1/community/posts/11/comments/31') && method === 'PATCH') {
      return ok({ ...approvedComment, content: '수정한 댓글', moderationStatus: 'PENDING' });
    }
    if (url.endsWith('/api/v1/community/posts/11/comments/31') && method === 'DELETE') return ok(undefined, 204);
    if (url.endsWith('/api/v1/community/posts/11/likes') && method === 'POST') return ok({ liked: true, likeCount: 3 });
    if (url.endsWith('/api/v1/community/users/9/follow') && method === 'POST') return ok({ following: true, followerCount: 4 });
    if (url.endsWith('/api/v1/community/posts/11/reports') && method === 'POST') return ok(undefined);

    throw new Error(`Unexpected request: ${method} ${url}`);
  }) as jest.Mock;
};

const renderDetail = async () => {
  const screen = render(
    <CommunityNativeScreen apiBase="https://api.example.com" currentUserSqno={7} />,
  );
  await waitFor(() => expect(screen.getByText('서울 팬 투어 후기')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('게시글 열기 서울 팬 투어 후기'));
  await waitFor(() => expect(screen.getByText('좋은 후기예요.')).toBeTruthy());
  return screen;
};

describe('CommunityNativeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFetch();
  });

  it('opens an approved post and its approved comments from the existing mobile route', async () => {
    const screen = await renderDetail();

    expect(screen.getByText('즐거웠던 팬 투어 이야기입니다. 다음에도 함께해요.')).toBeTruthy();
    expect(screen.getByLabelText('작성자 팔로우')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/community/posts/11/comments',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mobile-test-token' }),
      }),
    );
  });

  it('creates a text post with the backend multipart contract', async () => {
    const screen = render(
      <CommunityNativeScreen apiBase="https://api.example.com" currentUserSqno={7} />,
    );
    await waitFor(() => expect(screen.getByText('서울 팬 투어 후기')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('새 게시글 작성'));
    fireEvent.changeText(screen.getByLabelText('게시글 제목'), '새 팬 이야기');
    fireEvent.changeText(screen.getByLabelText('게시글 내용'), '모바일에서 작성했습니다.');
    fireEvent.press(screen.getByLabelText('게시글 등록'));

    await waitFor(() => expect(screen.getByText('게시글이 등록되어 검수를 기다리고 있습니다.')).toBeTruthy());
    expect(screen.getByText('모바일에서 작성했습니다.')).toBeTruthy();
    expect(screen.getByText('이 게시글은 운영자 검수를 기다리고 있습니다. 승인 전에는 좋아요·팔로우·댓글·신고를 사용할 수 없습니다.')).toBeTruthy();
    expect(screen.queryByLabelText('좋아요')).toBeNull();
    expect(screen.queryByLabelText('댓글 내용')).toBeNull();
    expect(screen.queryByLabelText('게시글 신고 열기')).toBeNull();
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/v1/community/posts') && init?.method === 'POST',
    );
    expect(postCall?.[1]?.body).toBeInstanceOf(FormData);
    expect(postCall?.[1]?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer mobile-test-token' }));
    expect(postCall?.[1]?.headers).not.toEqual(expect.objectContaining({ 'Content-Type': 'application/json' }));
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/test-cache\/community-post-.*\.json$/),
      JSON.stringify({ title: '새 팬 이야기', content: '모바일에서 작성했습니다.' }),
      { encoding: 'utf8' },
    );
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/test-cache\/community-post-.*\.json$/),
      { idempotent: true },
    );
  });

  it('shows an owner-visible pending post without calling approved-only interaction endpoints', async () => {
    const pendingPost = { ...post, title: '검수 대기 게시글', moderationStatus: 'PENDING' };
    installFetch(pendingPost, [{ ...posts[0], title: pendingPost.title, moderationStatus: 'PENDING' }]);
    const screen = render(
      <CommunityNativeScreen apiBase="https://api.example.com" currentUserSqno={7} />,
    );
    await waitFor(() => expect(screen.getByText('검수 대기 게시글')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('게시글 열기 검수 대기 게시글'));
    await waitFor(() => expect(screen.getByText('이 게시글은 운영자 검수를 기다리고 있습니다. 승인 전에는 좋아요·팔로우·댓글·신고를 사용할 수 없습니다.')).toBeTruthy());

    const requestedUrls = (global.fetch as jest.Mock).mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain('https://api.example.com/api/v1/community/posts/11/comments');
    expect(requestedUrls).not.toContain('https://api.example.com/api/v1/community/posts/11/likes/status');
    expect(requestedUrls).not.toContain('https://api.example.com/api/v1/community/users/9/follow/status');
  });

  it('creates a pending comment and edits an owned approved comment', async () => {
    const screen = await renderDetail();

    fireEvent.changeText(screen.getByLabelText('댓글 내용'), '검수할 새 댓글');
    fireEvent.press(screen.getByLabelText('댓글 등록'));
    await waitFor(() => expect(screen.getByText('댓글이 등록되어 검수를 기다리고 있습니다.')).toBeTruthy());
    expect(screen.getByText('검수할 새 댓글')).toBeTruthy();
    expect(screen.getAllByText('검수 대기').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('댓글 31 수정'));
    fireEvent.changeText(screen.getByLabelText('댓글 31 수정 내용'), '수정한 댓글');
    fireEvent.press(screen.getByLabelText('댓글 31 수정 저장'));
    await waitFor(() => expect(screen.getByText('수정한 댓글')).toBeTruthy());

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/community/posts/11/comments/31',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: '수정한 댓글' }),
      }),
    );
  });

  it('likes, follows, and submits a reason-coded report', async () => {
    const screen = await renderDetail();

    fireEvent.press(screen.getByLabelText('좋아요'));
    await waitFor(() => expect(screen.getByLabelText('좋아요 취소')).toBeTruthy());
    expect(screen.getByText('♥ 3')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('작성자 팔로우'));
    await waitFor(() => expect(screen.getByLabelText('작성자 팔로우 취소')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('게시글 신고 열기'));
    fireEvent.press(screen.getByLabelText('신고 사유 허위·오해 정보'));
    fireEvent.changeText(screen.getByLabelText('신고 상세 내용'), '출처를 확인해 주세요.');
    fireEvent.press(screen.getByLabelText('신고 접수'));
    await waitFor(() => expect(screen.getByText('신고가 접수되었습니다. 운영자가 확인할 예정입니다.')).toBeTruthy());

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/community/posts/11/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          reasonCode: 'MISINFORMATION',
          detailText: '출처를 확인해 주세요.',
        }),
      }),
    );
  });

  it('deletes only a comment owned by the signed-in user', async () => {
    const screen = await renderDetail();

    fireEvent.press(screen.getByLabelText('댓글 31 삭제'));
    await waitFor(() => expect(screen.queryByText('좋은 후기예요.')).toBeNull());
    expect(screen.getByText('댓글을 삭제했습니다.')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/community/posts/11/comments/31',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
