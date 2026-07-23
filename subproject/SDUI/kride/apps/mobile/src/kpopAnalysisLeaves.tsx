import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  canOpenKpopOfficialUrl,
  createKpopAnalysisJob,
  deleteKpopSavedItem,
  deleteKpopAnalysisSource,
  getKpopAnalysisJob,
  isKpopAnalysisTerminal,
  KPOP_ANALYSIS_CONTENT_TYPES,
  KPOP_ANALYSIS_MAX_BYTES,
  makeKpopAnalysisIdempotencyKey,
  presignKpopAnalysisAsset,
  putKpopAnalysisAsset,
  saveKpopProductCandidate,
  type KpopAnalysisCandidate,
  type KpopAnalysisEvidence,
  type KpopAnalysisJob,
  type KpopAnalysisResult,
  type SduiLeafProps,
} from '@kride/core';

const allowedTypes = new Set<string>(KPOP_ANALYSIS_CONTENT_TYPES);

const errorCopy = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === '401' || message.toLowerCase().includes('unauthorized')) {
    return '로그인 후 이용해 주세요.';
  }
  return message || '요청을 처리하지 못했습니다.';
};

export const UploadConsentLeaf: React.FC<SduiLeafProps> = ({ meta, onAction, apiBase = '' }) => {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'status' | 'error'>('status');

  const pickImage = async () => {
    setMessage('');
    setMessageKind('status');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessageKind('error');
      setMessage('사진을 선택하려면 사진 보관함 접근을 허용해 주세요.');
      return;
    }
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (selection.canceled) return;
    const next = selection.assets[0];
    const contentType = next.mimeType || 'image/jpeg';
    if (!allowedTypes.has(contentType)) {
      setMessageKind('error');
      setMessage('JPG, PNG, WebP 이미지만 선택할 수 있습니다.');
      return;
    }
    if (next.fileSize && next.fileSize > KPOP_ANALYSIS_MAX_BYTES) {
      setMessageKind('error');
      setMessage('이미지는 10MB 이하로 선택해 주세요.');
      return;
    }
    setAsset(next);
  };

  const submit = async () => {
    if (!asset || !consented || busy) return;
    setBusy(true);
    setMessageKind('status');
    try {
      setMessage('사진을 확인하고 있어요.');
      const localResponse = await fetch(asset.uri);
      const blob = await localResponse.blob();
      const contentType = asset.mimeType || blob.type || 'image/jpeg';
      const fileSize = asset.fileSize || blob.size;
      if (!allowedTypes.has(contentType)) throw new Error('JPG, PNG, WebP 이미지만 선택할 수 있습니다.');
      if (!fileSize || fileSize > KPOP_ANALYSIS_MAX_BYTES) throw new Error('이미지는 10MB 이하로 선택해 주세요.');

      setMessage('안전한 업로드 주소를 준비하고 있어요.');
      const presign = await presignKpopAnalysisAsset(apiBase, { contentType, fileSize });
      setMessage('사진을 업로드하고 있어요.');
      await putKpopAnalysisAsset(presign, blob);
      setMessage('분석 작업을 시작하고 있어요.');
      const job = await createKpopAnalysisJob(apiBase, {
        sourceKey: presign.sourceKey,
        contentType,
        idempotencyKey: makeKpopAnalysisIdempotencyKey(),
      });
      if (!job.jobId) throw new Error('분석 작업 번호를 받지 못했습니다.');
      onAction?.({
        ...meta,
        actionType: 'ROUTE',
        actionUrl: `/kpop/ai/result?jobId=${encodeURIComponent(String(job.jobId))}`,
      }, job);
    } catch (error) {
      setMessageKind('error');
      setMessage(errorCopy(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase text-kride">사진 기반 후보 찾기</Text>
        <Text className="text-2xl font-bold text-neutral-950">내가 소유한 의상 사진을 선택해 주세요</Text>
        <Text className="text-sm leading-5 text-neutral-600">
          AI가 비슷해 보이는 상품 후보와 확인 근거를 정리합니다. 동일 상품, 정품 또는 구매 적합성을 확정하지 않습니다.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={asset ? '다른 사진 선택' : '사진 선택'}
        accessibilityHint="사진 보관함에서 분석할 사진 한 장을 선택합니다."
        accessibilityState={{ disabled: busy }}
        className="min-h-12 self-start justify-center rounded-full border border-kride px-4 py-3"
        disabled={busy}
        onPress={pickImage}
      >
        <Text className="font-bold text-kride">{asset ? '다른 사진 선택' : '사진 선택'}</Text>
      </Pressable>

      {asset ? (
        <View className="flex-row items-center gap-3 rounded-xl bg-neutral-100 p-3">
          <Image
            accessibilityLabel={`선택한 분석 사진 ${asset.fileName || ''}`.trim()}
            accessible
            source={{ uri: asset.uri }}
            className="h-24 w-24 rounded-xl"
            resizeMode="cover"
          />
          <View className="flex-1 gap-1">
            <Text className="font-bold text-neutral-950" numberOfLines={1}>{asset.fileName || '선택한 사진'}</Text>
            <Text className="text-xs text-neutral-500">
              {asset.fileSize ? `${(asset.fileSize / 1024 / 1024).toFixed(1)}MB · ` : ''}분석 후 직접 삭제할 수 있어요.
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consented, disabled: busy }}
        accessibilityLabel="소유 사진 분석 동의"
        accessibilityHint="직접 촬영했거나 사용 권한이 있는 사진임을 확인합니다."
        className="flex-row items-start gap-3 rounded-xl bg-neutral-100 p-4"
        disabled={busy}
        onPress={() => setConsented((current) => !current)}
      >
        <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${consented ? 'border-kride bg-kride' : 'border-neutral-400'}`}>
          {consented ? <Text className="text-xs font-bold text-white">✓</Text> : null}
        </View>
        <Text className="flex-1 text-sm leading-5 text-neutral-700">
          이 사진을 직접 촬영했거나 사용할 권한이 있으며, 의상 후보 분석을 위해 업로드하는 데 동의합니다.
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="후보 분석 시작"
        accessibilityHint="선택한 사진을 업로드하고 상품 후보 분석을 시작합니다."
        accessibilityState={{ disabled: !asset || !consented || busy }}
        accessibilityValue={{ text: busy ? message || '분석 준비 중' : '분석 시작 가능' }}
        disabled={!asset || !consented || busy}
        className={`min-h-12 items-center justify-center rounded-full px-4 py-3 ${!asset || !consented || busy ? 'bg-neutral-300' : 'bg-kride'}`}
        onPress={submit}
      >
        <Text className="font-bold text-white">{busy ? '분석 준비 중…' : '후보 분석 시작'}</Text>
      </Pressable>
      {message ? (
        <Text
          accessibilityLiveRegion={messageKind === 'error' ? 'assertive' : 'polite'}
          accessibilityRole={messageKind === 'error' ? 'alert' : undefined}
          className={`text-sm ${messageKind === 'error' ? 'text-rose-700' : 'text-neutral-700'}`}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const statusCopy: Record<string, string> = {
  QUEUED: '분석 순서를 기다리고 있어요.',
  RUNNING: '사진에서 특징과 근거를 살펴보고 있어요.',
  SUCCEEDED: '후보 정리가 끝났어요.',
  FAILED: '분석을 완료하지 못했습니다.',
  CANCELLED: '분석이 취소되었습니다.',
  EXPIRED: '보관 기간이 지나 결과가 만료되었습니다.',
};

const gradeCopy = (grade?: string) => {
  switch (String(grade || '').toUpperCase()) {
    case 'EXACT_CANDIDATE': return '근거가 비교적 강한 후보 (동일 상품 확정 아님)';
    case 'SIMILAR': return '유사 후보';
    default: return '근거 부족';
  }
};

const evidenceLine = (value: KpopAnalysisEvidence) => {
  if (typeof value === 'string') return value;
  const description = value.message || value.description;
  const details = [
    value.type ? `근거 유형 ${value.type}` : '',
    typeof value.score === 'number' ? `근거 참고 점수 ${value.score}` : '',
    value.source ? `출처 ${value.source}` : '',
  ].filter(Boolean);
  return [description, ...details].filter(Boolean).join(' · ') || '구조화된 근거가 제공되었습니다.';
};

const evidenceList = (value?: KpopAnalysisEvidence | KpopAnalysisEvidence[]) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(evidenceLine);
};

const Candidate: React.FC<{ candidate: KpopAnalysisCandidate; apiBase?: string }> = ({ candidate, apiBase = '' }) => {
  const evidence = evidenceList(candidate.evidence);
  const candidateId = candidate.id ?? candidate.productCandidateId ?? candidate.productRef;
  const [savedItemId, setSavedItemId] = useState<string | number | undefined>(
    (candidate.savedItemId ?? candidate.saved_item_id) as string | number | undefined,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const officialUrl = typeof candidate.officialUrl === 'string'
    ? candidate.officialUrl
    : typeof candidate.officialLink === 'string'
      ? candidate.officialLink
      : '';
  const canOpen = canOpenKpopOfficialUrl({
    officialUrl,
    rightsChecked: candidate.rightsChecked === true,
  });
  const evidenceGrade = gradeCopy(candidate.evidenceGrade || String(candidate.grade || ''));

  const toggleSaved = async () => {
    if (candidateId === undefined || candidateId === null || candidateId === '' || saving) return;
    setSaving(true);
    setMessage('');
    try {
      if (savedItemId) {
        await deleteKpopSavedItem(apiBase, savedItemId);
        setSavedItemId(undefined);
        setMessage('저장을 해제했습니다.');
      } else {
        const saved = await saveKpopProductCandidate(apiBase, candidateId as string | number);
        setSavedItemId(saved.id);
        setMessage('후보를 저장했습니다.');
      }
    } catch (error) {
      setMessage(errorCopy(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <Text accessibilityLabel={`근거 등급: ${evidenceGrade}`} className="text-xs font-bold uppercase text-kride">
        근거 등급 · {evidenceGrade}
      </Text>
      <Text accessibilityRole="header" className="text-lg font-bold text-neutral-950">{candidate.name || '이름이 확인되지 않은 후보'}</Text>
      {candidate.brand ? <Text className="text-sm text-neutral-600">{candidate.brand}</Text> : null}
      {typeof candidate.confidence === 'number' ? <Text className="text-xs text-neutral-500">모델 참고 점수 {Math.round(candidate.confidence)} / 100</Text> : null}
      {evidence.length ? evidence.map((item, index) => <Text key={index} className="text-sm text-neutral-600">• {item}</Text>) : <Text className="text-sm text-neutral-600">확인 가능한 근거가 아직 없습니다.</Text>}
      <View className="flex-row flex-wrap gap-2">
      {candidateId !== undefined && candidateId !== null && candidateId !== '' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={savedItemId ? '저장 해제' : '후보 저장'}
          accessibilityHint={savedItemId ? '저장한 후보 목록에서 제거합니다.' : '나중에 다시 볼 후보 목록에 저장합니다.'}
          accessibilityState={{ disabled: saving, selected: Boolean(savedItemId) }}
          className="min-h-12 justify-center px-2"
          disabled={saving}
          onPress={toggleSaved}
        >
          <Text className="font-bold text-kride">{saving ? '처리 중…' : savedItemId ? '저장 해제' : '후보 저장'}</Text>
        </Pressable>
      ) : null}
      {canOpen ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${candidate.name || '상품 후보'} 권리 확인된 공식 출처 열기`}
          accessibilityHint="외부 브라우저에서 열립니다."
          className="min-h-12 justify-center px-2"
          onPress={() => void Linking.openURL(officialUrl)}
        >
          <Text className="font-bold text-kride">권리 확인된 공식 출처</Text>
        </Pressable>
      ) : null}
      </View>
      {message ? <Text accessibilityLiveRegion="polite" className="text-sm text-neutral-700">{message}</Text> : null}
    </View>
  );
};

const AnalysisResult: React.FC<{ result: KpopAnalysisResult; apiBase?: string }> = ({ result, apiBase = '' }) => {
  const evidence = evidenceList(result.evidence);
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const evidenceGrade = gradeCopy(result.evidenceGrade || result.grade);
  return (
    <View className="gap-3">
      <View className="gap-2 rounded-xl bg-rose-50 p-4">
        <Text accessibilityLabel={`분석 근거 등급: ${evidenceGrade}`} className="font-bold text-rose-900">
          분석 근거 등급 · {evidenceGrade}
        </Text>
        <Text className="text-sm leading-5 text-rose-900">AI 결과는 비교를 시작하기 위한 후보입니다. 동일 상품·정품·구매 적합성을 보증하지 않습니다.</Text>
        {typeof result.confidence === 'number' ? <Text className="text-xs text-rose-700">모델 참고 점수 {Math.round(result.confidence)} / 100</Text> : null}
      </View>
      {evidence.map((item, index) => <Text key={index} className="text-sm text-neutral-600">• {item}</Text>)}
      {candidates.length ? candidates.map((candidate, index) => <Candidate key={String(candidate.id ?? index)} candidate={candidate} apiBase={apiBase} />) : (
        <Text className="text-sm text-neutral-600">제시할 만한 상품 후보가 없습니다. 근거 부족은 정상적인 분석 결과입니다.</Text>
      )}
    </View>
  );
};

export const AiResultCardLeaf: React.FC<SduiLeafProps> = ({ data, apiBase = '' }) => {
  const jobId = String(data?.jobId ?? data?.id ?? '');
  const [job, setJob] = useState<KpopAnalysisJob | null>(null);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await getKpopAnalysisJob(apiBase, jobId);
        if (!mounted) return;
        setJob(next);
        if (!isKpopAnalysisTerminal(next.status)) timer = setTimeout(poll, 3000);
      } catch (error) {
        if (!mounted) return;
        setMessage(errorCopy(error));
        timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [apiBase, jobId]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      setJob(await getKpopAnalysisJob(apiBase, jobId));
      setMessage('최신 상태로 갱신했습니다.');
    } catch (error) {
      setMessage(errorCopy(error));
    } finally {
      setRefreshing(false);
    }
  };

  const removeSource = async () => {
    if (!jobId || deleting) return;
    setDeleting(true);
    try {
      await deleteKpopAnalysisSource(apiBase, jobId);
      setJob((current) => current ? { ...current, sourceDeleted: true, sourceDeletedAt: new Date().toISOString() } : current);
      setMessage('업로드한 원본 사진을 삭제했습니다.');
    } catch (error) {
      setMessage(errorCopy(error));
    } finally {
      setDeleting(false);
    }
  };

  if (!jobId) return <View className="rounded-xl bg-white p-5"><Text>분석 작업 번호가 없습니다.</Text></View>;
  const progressPct = Math.max(0, Math.min(100, Math.round(job?.progressPct || 0)));

  return (
    <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <View className="gap-1">
        <Text className="text-xs font-bold uppercase text-kride">작업 #{jobId}</Text>
        <Text accessibilityRole="header" className="text-2xl font-bold text-neutral-950">{statusCopy[job?.status || 'QUEUED']}</Text>
        {!isKpopAnalysisTerminal(job?.status) ? <Text className="text-xs text-neutral-500">3초마다 안전하게 상태를 확인합니다.</Text> : null}
      </View>
      {job && !isKpopAnalysisTerminal(job.status) ? (
        <View
          accessibilityLabel="상품 후보 분석 진행률"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: progressPct, text: `${progressPct}% 완료` }}
          className="gap-2"
        >
          <View className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <View className="h-full rounded-full bg-kride" style={{ width: `${Math.max(4, progressPct)}%` }} />
          </View>
          <Text className="text-xs font-semibold text-neutral-700">진행률 {progressPct}%</Text>
        </View>
      ) : null}
      {job?.status === 'SUCCEEDED' && job.result ? <AnalysisResult result={job.result} apiBase={apiBase} /> : null}
      {job?.status === 'FAILED' ? <Text accessibilityRole="alert" className="text-sm text-rose-700">{job.errorMessage || '잠시 후 새 사진으로 다시 시도해 주세요.'}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="상태 새로고침"
          accessibilityState={{ disabled: refreshing }}
          className="min-h-12 justify-center rounded-full border border-kride px-4 py-2"
          disabled={refreshing}
          onPress={refresh}
        >
          <Text className="font-bold text-kride">{refreshing ? '새로고침 중…' : '상태 새로고침'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="원본 사진 삭제"
          accessibilityState={{ disabled: Boolean(job?.sourceDeleted || job?.sourceDeletedAt) || deleting }}
          disabled={Boolean(job?.sourceDeleted || job?.sourceDeletedAt) || deleting}
          className={`min-h-12 justify-center rounded-full border px-4 py-2 ${job?.sourceDeleted || job?.sourceDeletedAt || deleting ? 'border-neutral-300' : 'border-kride'}`}
          onPress={removeSource}
        >
          <Text className={job?.sourceDeleted || job?.sourceDeletedAt || deleting ? 'font-bold text-neutral-400' : 'font-bold text-kride'}>
            {job?.sourceDeleted || job?.sourceDeletedAt ? '원본 사진 삭제됨' : deleting ? '삭제 중…' : '원본 사진 삭제'}
          </Text>
        </Pressable>
      </View>
      <Text className="text-xs leading-4 text-neutral-500">원본 삭제 후에도 이미 생성된 분석 결과와 최소 작업 기록은 보관 정책에 따라 남을 수 있습니다.</Text>
      {message ? <Text accessibilityLiveRegion="polite" className="text-sm text-neutral-700">{message}</Text> : null}
    </View>
  );
};
