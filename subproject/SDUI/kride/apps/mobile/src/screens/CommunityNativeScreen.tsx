import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSessionStore } from '@kride/core';
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityComment,
  getCommunityComments,
  getCommunityFollowStatus,
  getCommunityLikeStatus,
  getCommunityPost,
  getCommunityPosts,
  reportCommunityPost,
  toggleCommunityFollow,
  toggleCommunityLike,
  updateCommunityComment,
  type CommunityComment,
  type CommunityPost,
  type CommunityPostSummary,
} from '../communityApi';

type Props = {
  apiBase: string;
  onBack?: () => void;
  /** Test/embedding override; the app normally reads this from SecureStore-backed session state. */
  currentUserSqno?: number | null;
};

const REPORT_REASONS = [
  { code: 'SPAM', label: '스팸·광고' },
  { code: 'HARASSMENT', label: '괴롭힘' },
  { code: 'HATE_SPEECH', label: '혐오 표현' },
  { code: 'MISINFORMATION', label: '허위·오해 정보' },
  { code: 'COPYRIGHT', label: '저작권 침해' },
  { code: 'PRIVACY', label: '개인정보 침해' },
  { code: 'OTHER', label: '기타' },
] as const;

const friendlyError = (error: unknown) => {
  const status = error instanceof Error ? error.message : String(error);
  if (status === '401') return '로그인 후 이용해 주세요.';
  if (status === '403') return '이 작업을 수행할 권한이 없습니다.';
  if (status === '409') return '이미 처리한 요청입니다.';
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
};

const PostComposer: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { title: string; content: string }) => Promise<void>;
}> = ({ busy, onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [validation, setValidation] = useState('');

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setValidation('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setValidation('');
    await onSubmit({ title: title.trim(), content: content.trim() });
  };

  return (
    <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <Text className="text-lg font-extrabold text-neutral-950">새 게시글</Text>
      <TextInput
        accessibilityLabel="게시글 제목"
        className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-950"
        maxLength={200}
        onChangeText={setTitle}
        placeholder="제목"
        value={title}
      />
      <TextInput
        accessibilityLabel="게시글 내용"
        className="min-h-32 rounded-xl border border-neutral-300 px-4 py-3 text-neutral-950"
        maxLength={5000}
        multiline
        onChangeText={setContent}
        placeholder="팬들과 나누고 싶은 이야기를 적어 주세요."
        textAlignVertical="top"
        value={content}
      />
      {validation ? <Text accessibilityRole="alert" className="text-sm text-rose-600">{validation}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="게시글 등록"
          className="flex-1 items-center rounded-full bg-kride px-4 py-3"
          disabled={busy}
          onPress={() => void submit()}
        >
          <Text className="font-bold text-white">{busy ? '등록 중…' : '등록하기'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="게시글 작성 취소"
          className="items-center rounded-full border border-neutral-300 px-4 py-3"
          disabled={busy}
          onPress={onCancel}
        >
          <Text className="font-bold text-neutral-700">취소</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function CommunityNativeScreen({ apiBase, onBack, currentUserSqno }: Props) {
  const sessionUserSqno = useSessionStore((state) => state.user?.userSqno ?? null);
  const viewerSqno = currentUserSqno === undefined ? sessionUserSqno : currentUserSqno;
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDetail, setReportDetail] = useState('');
  const selectedModerationStatus = String(selectedPost?.moderationStatus || '').toUpperCase();
  const selectedPostIsApproved = selectedModerationStatus === 'APPROVED';

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setPosts(await getCommunityPosts(apiBase));
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const openPost = async (postId: number) => {
    setDetailLoading(true);
    setMessage('');
    try {
      const post = await getCommunityPost(apiBase, postId);
      const approved = String(post.moderationStatus || '').toUpperCase() === 'APPROVED';
      const [nextComments, like, follow] = approved
        ? await Promise.all([
            getCommunityComments(apiBase, postId),
            getCommunityLikeStatus(apiBase, postId).catch(() => null),
            post.authorSqno
              ? getCommunityFollowStatus(apiBase, post.authorSqno).catch(() => null)
              : null,
          ])
        : [[], null, null];
      setSelectedPost(post);
      setComments(nextComments);
      setLiked(Boolean(like?.liked));
      setFollowing(Boolean(follow?.following ?? follow?.followed));
      setComposerOpen(false);
      setReportOpen(false);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitPost = async (input: { title: string; content: string }) => {
    setBusy(true);
    setMessage('');
    try {
      const post = await createCommunityPost(apiBase, input);
      setComposerOpen(false);
      setPosts((current) => [{
        ...post,
        contentPreview: post.content,
      }, ...current]);
      setSelectedPost(post);
      setComments([]);
      setMessage('게시글이 등록되어 검수를 기다리고 있습니다.');
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!selectedPost || !commentText.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const comment = await createCommunityComment(apiBase, selectedPost.postId, commentText.trim());
      setComments((current) => [...current, comment]);
      setCommentText('');
      setMessage('댓글이 등록되어 검수를 기다리고 있습니다.');
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveComment = async (commentId: number) => {
    if (!selectedPost || !editingText.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const updated = await updateCommunityComment(
        apiBase,
        selectedPost.postId,
        commentId,
        editingText.trim(),
      );
      setComments((current) => current.map((comment) => (
        comment.commentId === commentId ? updated : comment
      )));
      setEditingCommentId(null);
      setEditingText('');
      setMessage('댓글을 수정했습니다. 다시 검수를 기다립니다.');
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!selectedPost || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await deleteCommunityComment(apiBase, selectedPost.postId, commentId);
      setComments((current) => current.filter((comment) => comment.commentId !== commentId));
      setMessage('댓글을 삭제했습니다.');
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async () => {
    if (!selectedPost || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const status = await toggleCommunityLike(apiBase, selectedPost.postId);
      setLiked(status.liked);
      setSelectedPost((current) => current ? { ...current, likeCount: status.likeCount } : current);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!selectedPost?.authorSqno || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const status = await toggleCommunityFollow(apiBase, selectedPost.authorSqno);
      setFollowing(Boolean(status.following ?? status.followed));
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!selectedPost || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await reportCommunityPost(apiBase, selectedPost.postId, {
        reasonCode: reportReason,
        detailText: reportDetail.trim() || undefined,
      });
      setReportOpen(false);
      setReportDetail('');
      setMessage('신고가 접수되었습니다. 운영자가 확인할 예정입니다.');
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  const closeDetail = () => {
    setSelectedPost(null);
    setComments([]);
    setMessage('');
    setEditingCommentId(null);
    void loadPosts();
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-neutral-200 bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedPost ? '커뮤니티 목록으로' : '이전 화면'}
          className="min-w-16 py-2"
          onPress={selectedPost ? closeDetail : onBack}
        >
          <Text className="font-bold text-kride">← 이전</Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-extrabold text-neutral-950">K-RIDE 커뮤니티</Text>
        <View className="w-16" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {message ? (
          <Text accessibilityRole="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {message}
          </Text>
        ) : null}

        {detailLoading ? (
          <View accessibilityRole="progressbar" className="items-center py-16">
            <ActivityIndicator color="#e50914" />
            <Text className="mt-3 text-neutral-500">게시글을 불러오는 중…</Text>
          </View>
        ) : selectedPost ? (
          <View className="gap-4">
            <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase text-kride">{selectedPost.moderationStatus || 'COMMUNITY'}</Text>
                  <Text className="mt-1 text-2xl font-extrabold text-neutral-950">{selectedPost.title}</Text>
                  <Text className="mt-1 text-xs text-neutral-500">
                    {selectedPost.authorNickname || 'K-RIDE 사용자'} · {formatDate(selectedPost.createdAt)}
                  </Text>
                </View>
                {selectedPostIsApproved && selectedPost.authorSqno && selectedPost.authorSqno !== viewerSqno ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={following ? '작성자 팔로우 취소' : '작성자 팔로우'}
                    className="rounded-full border border-kride px-3 py-2"
                    disabled={busy}
                    onPress={() => void toggleFollow()}
                  >
                    <Text className="text-xs font-bold text-kride">{following ? '팔로잉' : '팔로우'}</Text>
                  </Pressable>
                ) : null}
              </View>

              {!selectedPostIsApproved ? (
                <View className={`rounded-xl px-4 py-3 ${selectedModerationStatus === 'REJECTED' ? 'bg-rose-50' : 'bg-amber-50'}`}>
                  <Text className={`font-bold ${selectedModerationStatus === 'REJECTED' ? 'text-rose-800' : 'text-amber-800'}`}>
                    {selectedModerationStatus === 'REJECTED'
                      ? '이 게시글은 검수에서 반려되었습니다. 작성자만 내용을 확인할 수 있습니다.'
                      : '이 게시글은 운영자 검수를 기다리고 있습니다. 승인 전에는 좋아요·팔로우·댓글·신고를 사용할 수 없습니다.'}
                  </Text>
                </View>
              ) : null}

              {selectedPost.images?.map((image) => (
                <Image
                  accessibilityLabel={image.originalName || '게시글 이미지'}
                  className="h-56 w-full rounded-xl bg-neutral-100"
                  key={String(image.postImageId)}
                  resizeMode="cover"
                  source={{ uri: image.storageUrl }}
                />
              ))}

              <Text className="text-base leading-6 text-neutral-800">{selectedPost.content}</Text>
              {selectedPostIsApproved ? <View className="flex-row flex-wrap gap-2 border-t border-neutral-100 pt-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={liked ? '좋아요 취소' : '좋아요'}
                  className={`rounded-full px-4 py-2 ${liked ? 'bg-kride' : 'border border-neutral-300 bg-white'}`}
                  disabled={busy}
                  onPress={() => void toggleLike()}
                >
                  <Text className={liked ? 'font-bold text-white' : 'font-bold text-neutral-700'}>
                    ♥ {selectedPost.likeCount ?? 0}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="게시글 신고 열기"
                  className="rounded-full border border-neutral-300 px-4 py-2"
                  onPress={() => setReportOpen((open) => !open)}
                >
                  <Text className="font-bold text-neutral-600">신고</Text>
                </Pressable>
              </View> : null}
            </View>

            {reportOpen && selectedPostIsApproved ? (
              <View className="gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <Text className="font-extrabold text-neutral-950">신고 사유</Text>
                <View className="flex-row flex-wrap gap-2">
                  {REPORT_REASONS.map((reason) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={`신고 사유 ${reason.label}`}
                      accessibilityState={{ selected: reportReason === reason.code }}
                      className={`rounded-full px-3 py-2 ${reportReason === reason.code ? 'bg-kride' : 'bg-white'}`}
                      key={reason.code}
                      onPress={() => setReportReason(reason.code)}
                    >
                      <Text className={reportReason === reason.code ? 'font-bold text-white' : 'text-neutral-700'}>{reason.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="신고 상세 내용"
                  className="min-h-20 rounded-xl border border-rose-200 bg-white px-4 py-3"
                  maxLength={1000}
                  multiline
                  onChangeText={setReportDetail}
                  placeholder="필요한 경우 상세 내용을 적어 주세요."
                  textAlignVertical="top"
                  value={reportDetail}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="신고 접수"
                  className="items-center rounded-full bg-kride px-4 py-3"
                  disabled={busy}
                  onPress={() => void submitReport()}
                >
                  <Text className="font-bold text-white">신고 접수</Text>
                </Pressable>
              </View>
            ) : null}

            <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
              <Text className="text-lg font-extrabold text-neutral-950">댓글 {comments.length}</Text>
              {selectedPostIsApproved ? <View className="flex-row gap-2">
                <TextInput
                  accessibilityLabel="댓글 내용"
                  className="min-h-12 flex-1 rounded-xl border border-neutral-300 px-4 py-3"
                  maxLength={1000}
                  onChangeText={setCommentText}
                  placeholder="댓글을 입력해 주세요."
                  value={commentText}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="댓글 등록"
                  className="items-center justify-center rounded-xl bg-kride px-4"
                  disabled={busy || !commentText.trim()}
                  onPress={() => void submitComment()}
                >
                  <Text className="font-bold text-white">등록</Text>
                </Pressable>
              </View> : null}

              {comments.length === 0 ? (
                <Text className="py-4 text-center text-sm text-neutral-500">아직 공개된 댓글이 없습니다.</Text>
              ) : comments.map((comment) => {
                const owned = viewerSqno != null && comment.authorSqno === viewerSqno;
                const editing = editingCommentId === comment.commentId;
                return (
                  <View className="gap-2 border-t border-neutral-100 pt-3" key={String(comment.commentId)}>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-bold text-neutral-800">{comment.authorNickname || 'K-RIDE 사용자'}</Text>
                      <View className="flex-row items-center gap-2">
                        {comment.moderationStatus && comment.moderationStatus !== 'APPROVED' ? (
                          <Text className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">검수 대기</Text>
                        ) : null}
                        <Text className="text-xs text-neutral-400">{formatDate(comment.createdAt)}</Text>
                      </View>
                    </View>
                    {editing ? (
                      <TextInput
                        accessibilityLabel={`댓글 ${comment.commentId} 수정 내용`}
                        className="rounded-xl border border-neutral-300 px-3 py-2"
                        maxLength={1000}
                        onChangeText={setEditingText}
                        value={editingText}
                      />
                    ) : <Text className="leading-5 text-neutral-700">{comment.content}</Text>}
                    {owned ? (
                      <View className="flex-row gap-3">
                        {editing ? (
                          <>
                            <Pressable accessibilityRole="button" accessibilityLabel={`댓글 ${comment.commentId} 수정 저장`} onPress={() => void saveComment(comment.commentId)}>
                              <Text className="font-bold text-kride">저장</Text>
                            </Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel={`댓글 ${comment.commentId} 수정 취소`} onPress={() => setEditingCommentId(null)}>
                              <Text className="font-bold text-neutral-500">취소</Text>
                            </Pressable>
                          </>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`댓글 ${comment.commentId} 수정`}
                            onPress={() => {
                              setEditingCommentId(comment.commentId);
                              setEditingText(comment.content);
                            }}
                          >
                            <Text className="font-bold text-kride">수정</Text>
                          </Pressable>
                        )}
                        <Pressable accessibilityRole="button" accessibilityLabel={`댓글 ${comment.commentId} 삭제`} onPress={() => void removeComment(comment.commentId)}>
                          <Text className="font-bold text-rose-600">삭제</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View className="gap-4">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-2xl font-extrabold text-neutral-950">팬들의 이야기</Text>
                <Text className="mt-1 text-sm text-neutral-500">검수를 통과한 게시글만 공개됩니다.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="새 게시글 작성"
                className="rounded-full bg-kride px-4 py-3"
                onPress={() => setComposerOpen((open) => !open)}
              >
                <Text className="font-bold text-white">글쓰기</Text>
              </Pressable>
            </View>

            {composerOpen ? <PostComposer busy={busy} onCancel={() => setComposerOpen(false)} onSubmit={submitPost} /> : null}

            {loading ? (
              <View accessibilityRole="progressbar" className="items-center py-16">
                <ActivityIndicator color="#e50914" />
                <Text className="mt-3 text-neutral-500">게시글을 불러오는 중…</Text>
              </View>
            ) : posts.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-14">
                <Text className="text-lg font-bold text-neutral-800">아직 공개된 게시글이 없습니다.</Text>
                <Text className="mt-2 text-sm text-neutral-500">첫 이야기를 남겨 보세요.</Text>
              </View>
            ) : posts.map((post) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`게시글 열기 ${post.title}`}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                key={String(post.postId)}
                onPress={() => void openPost(post.postId)}
              >
                {post.thumbnailUrl ? (
                  <Image className="h-44 w-full bg-neutral-100" resizeMode="cover" source={{ uri: post.thumbnailUrl }} />
                ) : null}
                <View className="gap-2 p-4">
                  <Text className="text-lg font-extrabold text-neutral-950">{post.title}</Text>
                  <Text className="text-sm leading-5 text-neutral-600" numberOfLines={2}>{post.contentPreview}</Text>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-neutral-400">{post.authorNickname || 'K-RIDE 사용자'} · {formatDate(post.createdAt)}</Text>
                    <Text className="text-xs font-bold text-kride">♥ {post.likeCount ?? 0}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
