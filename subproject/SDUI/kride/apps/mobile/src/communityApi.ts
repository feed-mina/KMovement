import { authHeader } from '@kride/core';
import * as FileSystem from 'expo-file-system';

export type CommunityPostSummary = {
  postId: number;
  title: string;
  contentPreview?: string;
  authorSqno?: number;
  authorNickname?: string;
  likeCount?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  moderationStatus?: string;
};

export type CommunityPost = CommunityPostSummary & {
  content: string;
  reportCount?: number;
  updatedAt?: string;
  images?: Array<{
    postImageId: number;
    storageUrl: string;
    originalName?: string;
  }>;
};

export type CommunityComment = {
  commentId: number;
  postId: number;
  authorSqno?: number;
  authorNickname?: string;
  content: string;
  moderationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LikeStatus = { liked: boolean; likeCount: number };
export type FollowStatus = { followed?: boolean; following?: boolean; followerCount?: number };

export const communityPaths = {
  posts: '/api/v1/community/posts',
  post: (postId: number) => `/api/v1/community/posts/${postId}`,
  likes: (postId: number) => `/api/v1/community/posts/${postId}/likes`,
  likeStatus: (postId: number) => `/api/v1/community/posts/${postId}/likes/status`,
  reports: (postId: number) => `/api/v1/community/posts/${postId}/reports`,
  comments: (postId: number) => `/api/v1/community/posts/${postId}/comments`,
  comment: (postId: number, commentId: number) =>
    `/api/v1/community/posts/${postId}/comments/${commentId}`,
  follow: (userSqno: number) => `/api/v1/community/users/${userSqno}/follow`,
  followStatus: (userSqno: number) => `/api/v1/community/users/${userSqno}/follow/status`,
} as const;

const withBase = (apiBase: string, path: string) => `${apiBase.replace(/\/$/, '')}${path}`;

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const requestJson = async <T,>(
  apiBase: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(withBase(apiBase, path), {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(String(response.status));
  if (response.status === 204) return undefined as T;
  return unwrap<T>(await response.json());
};

export const getCommunityPosts = async (apiBase: string, page = 0, size = 20) => {
  const result = await requestJson<{ content?: CommunityPostSummary[] } | CommunityPostSummary[]>(
    apiBase,
    `${communityPaths.posts}?page=${page}&size=${size}`,
  );
  return Array.isArray(result) ? result : (result.content ?? []);
};

export const getCommunityPost = (apiBase: string, postId: number) =>
  requestJson<CommunityPost>(apiBase, communityPaths.post(postId));

/**
 * Spring's existing endpoint consumes multipart with an application/json
 * `post` part. React Native FormData only preserves a part media type for
 * URI-backed native files (not web Blob objects), so write the small JSON part
 * to the Expo cache and remove it after the request. Omitting Content-Type lets
 * the native networking layer add the multipart boundary.
 */
export const createCommunityPost = async (
  apiBase: string,
  input: { title: string; content: string },
) => {
  if (!FileSystem.cacheDirectory) throw new Error('FILE_CACHE_UNAVAILABLE');
  const jsonUri = `${FileSystem.cacheDirectory}community-post-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(input), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const body = new FormData();
  body.append('post', {
    uri: jsonUri,
    type: 'application/json',
    name: 'post.json',
  } as unknown as Blob);
  try {
    return await requestJson<CommunityPost>(apiBase, communityPaths.posts, { method: 'POST', body });
  } finally {
    await FileSystem.deleteAsync(jsonUri, { idempotent: true }).catch(() => undefined);
  }
};

export const toggleCommunityLike = (apiBase: string, postId: number) =>
  requestJson<LikeStatus>(apiBase, communityPaths.likes(postId), { method: 'POST' });

export const getCommunityLikeStatus = (apiBase: string, postId: number) =>
  requestJson<LikeStatus>(apiBase, communityPaths.likeStatus(postId));

export const reportCommunityPost = (
  apiBase: string,
  postId: number,
  input: { reasonCode: string; detailText?: string },
) => requestJson<void>(apiBase, communityPaths.reports(postId), {
  method: 'POST',
  body: JSON.stringify(input),
});

export const getCommunityComments = async (apiBase: string, postId: number) => {
  const result = await requestJson<{ content?: CommunityComment[] } | CommunityComment[]>(
    apiBase,
    communityPaths.comments(postId),
  );
  return Array.isArray(result) ? result : (result.content ?? []);
};

export const createCommunityComment = (apiBase: string, postId: number, content: string) =>
  requestJson<CommunityComment>(apiBase, communityPaths.comments(postId), {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export const updateCommunityComment = (
  apiBase: string,
  postId: number,
  commentId: number,
  content: string,
) => requestJson<CommunityComment>(apiBase, communityPaths.comment(postId, commentId), {
  method: 'PATCH',
  body: JSON.stringify({ content }),
});

export const deleteCommunityComment = (apiBase: string, postId: number, commentId: number) =>
  requestJson<void>(apiBase, communityPaths.comment(postId, commentId), { method: 'DELETE' });

export const toggleCommunityFollow = (apiBase: string, userSqno: number) =>
  requestJson<FollowStatus>(apiBase, communityPaths.follow(userSqno), { method: 'POST' });

export const getCommunityFollowStatus = (apiBase: string, userSqno: number) =>
  requestJson<FollowStatus>(apiBase, communityPaths.followStatus(userSqno));
