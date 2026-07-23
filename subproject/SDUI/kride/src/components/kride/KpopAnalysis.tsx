'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  streamKpopAnalysisJob,
  type KpopAnalysisCandidate,
  type KpopAnalysisEvidence,
  type KpopAnalysisJob,
  type KpopAnalysisResult,
} from '@kride/core';
import KpopEvidenceBadge from '@/components/kride/KpopEvidenceBadge';

type LeafProps = {
  data?: Record<string, any>;
  meta?: Record<string, any>;
  onAction?: (meta: Record<string, any>, data?: Record<string, any>) => void;
  apiBase?: string;
};

const contentTypes = new Set<string>(KPOP_ANALYSIS_CONTENT_TYPES);

const readableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === '401' || message.toLowerCase().includes('unauthorized')) {
    return '로그인 후 이용해 주세요.';
  }
  if (message === '413' || message.toLowerCase().includes('payload too large')) {
    return '파일 용량이 너무 큽니다. 10MB 이하 이미지를 선택해 주세요.';
  }
  if (message === '415' || message.toLowerCase().includes('unsupported media')) {
    return '지원하지 않는 파일 형식입니다. JPG, PNG, WebP 이미지를 선택해 주세요.';
  }
  if (message === '429' || message.toLowerCase().includes('too many requests')) {
    return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

export function UploadConsent({ meta, onAction, apiBase = '' }: LeafProps) {
  const fileInputId = useId();
  const helpId = useId();
  const messageId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const choose = (next?: File) => {
    setMessage('');
    if (!next) return;
    if (!contentTypes.has(next.type)) {
      setFile(null);
      setMessage('JPG, PNG, WebP 이미지만 선택할 수 있습니다.');
      return;
    }
    if (next.size > KPOP_ANALYSIS_MAX_BYTES) {
      setFile(null);
      setMessage('이미지는 10MB 이하로 선택해 주세요.');
      return;
    }
    setFile(next);
  };

  const submit = async () => {
    if (!file || !consented || busy) return;
    setBusy(true);
    setMessage('안전한 업로드 주소를 준비하고 있어요.');
    try {
      const presign = await presignKpopAnalysisAsset(apiBase, {
        contentType: file.type,
        fileSize: file.size,
      });
      setMessage('사진을 업로드하고 있어요.');
      await putKpopAnalysisAsset(presign, file);
      setMessage('분석 작업을 시작하고 있어요.');
      const job = await createKpopAnalysisJob(apiBase, {
        sourceKey: presign.sourceKey,
        contentType: file.type,
        idempotencyKey: makeKpopAnalysisIdempotencyKey(),
      });
      if (!job.jobId) throw new Error('분석 작업 번호를 받지 못했습니다.');
      onAction?.(
        {
          ...meta,
          actionType: 'ROUTE',
          actionUrl: `/kpop/ai/result?jobId=${encodeURIComponent(String(job.jobId))}`,
        },
        job,
      );
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="kpop-analysis-upload" aria-labelledby="kpop-analysis-upload-title">
      <div>
        <p className="kpop-eyebrow">사진 기반 후보 찾기</p>
        <h2 id="kpop-analysis-upload-title">내가 소유한 의상 사진을 선택해 주세요</h2>
        <p>
          AI가 비슷해 보이는 상품 후보와 확인 근거를 정리합니다. 동일 상품, 정품 또는 구매 적합성을
          확정하지 않습니다.
        </p>
      </div>

      <p className="kpop-field-help" id={helpId}>지원 형식 JPG, PNG, WebP · 최대 10MB</p>
      <label className="kpop-file-picker" htmlFor={fileInputId}>
        <span>{file ? '다른 사진 선택' : '사진 선택'}</span>
        <input
          id={fileInputId}
          type="file"
          accept={KPOP_ANALYSIS_CONTENT_TYPES.join(',')}
          aria-describedby={`${helpId}${message ? ` ${messageId}` : ''}`}
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>

      {file ? (
        <div className="kpop-upload-preview">
          <img src={previewUrl} alt={`선택한 분석 사진 미리보기: ${file.name}`} />
          <div>
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(1)}MB · 분석 후 직접 삭제할 수 있어요.</small>
          </div>
        </div>
      ) : null}

      <label className="kpop-consent-row">
        <input
          type="checkbox"
          checked={consented}
          aria-describedby={helpId}
          onChange={(event) => setConsented(event.target.checked)}
        />
        <span>
          이 사진을 직접 촬영했거나 사용할 권한이 있으며, 의상 후보 분석을 위해 업로드하는 데
          동의합니다.
        </span>
      </label>

      <button
        type="button"
        className="kpop-primary-btn"
        aria-busy={busy}
        disabled={!file || !consented || busy}
        onClick={submit}
      >
        {busy ? '분석 준비 중…' : '후보 분석 시작'}
      </button>
      {message ? (
        <p className="kpop-analysis-message" id={messageId} role="status" aria-live="polite" aria-atomic="true">
          {message}
        </p>
      ) : null}
    </section>
  );
}

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
    case 'EXACT_CANDIDATE':
      return '근거가 비교적 강한 후보 (동일 상품 확정 아님)';
    case 'SIMILAR':
      return '유사 후보';
    default:
      return '근거 부족';
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

function CandidateCard({ candidate, apiBase = '' }: { candidate: KpopAnalysisCandidate; apiBase?: string }) {
  const titleId = useId();
  const evidenceId = useId();
  const grade = candidate.evidenceGrade || String(candidate.grade || '');
  const evidence = evidenceList(candidate.evidence);
  const candidateId = candidate.id ?? candidate.productCandidateId ?? candidate.productRef;
  const [savedItemId, setSavedItemId] = useState<string | number | undefined>(
    (candidate.savedItemId ?? candidate.saved_item_id) as string | number | undefined,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const url = typeof candidate.officialUrl === 'string'
    ? candidate.officialUrl
    : typeof candidate.officialLink === 'string'
      ? candidate.officialLink
      : '';
  const canOpen = canOpenKpopOfficialUrl({
    officialUrl: url,
    rightsChecked: candidate.rightsChecked === true,
  });

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
      setMessage(readableError(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className="kpop-result-candidate" role="listitem" aria-labelledby={titleId} aria-describedby={evidenceId}>
      <KpopEvidenceBadge id={evidenceId} grade={grade} label={gradeCopy(grade)} />
      <h3 id={titleId}>{candidate.name || '이름이 확인되지 않은 후보'}</h3>
      {candidate.brand ? <p>{candidate.brand}</p> : null}
      {typeof candidate.confidence === 'number' ? (
        <p className="kpop-evidence"><strong>모델 참고 점수:</strong> {Math.round(candidate.confidence)} / 100</p>
      ) : null}
      {evidence.length ? (
        <ul aria-label="후보 확인 근거">{evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
      ) : <p><strong>확인 근거:</strong> 아직 제공되지 않았습니다.</p>}
      <div className="kpop-result-actions">
        {candidateId !== undefined && candidateId !== null && candidateId !== '' ? (
          <button type="button" aria-pressed={Boolean(savedItemId)} aria-busy={saving} disabled={saving} onClick={toggleSaved}>
            {saving ? '처리 중…' : savedItemId ? '저장 해제' : '후보 저장'}
          </button>
        ) : null}
        {canOpen ? <a href={url} target="_blank" rel="noreferrer">권리 확인된 공식 출처 <span>(새 창)</span></a> : null}
      </div>
      {message ? <p className="kpop-analysis-message" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
    </article>
  );
}

function ResultBody({ result, apiBase = '' }: { result: KpopAnalysisResult; apiBase?: string }) {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const grade = result.evidenceGrade || result.grade;
  const evidence = evidenceList(result.evidence);
  return (
    <div className="kpop-analysis-results">
      <div className="kpop-result-notice">
        <KpopEvidenceBadge grade={grade} label={gradeCopy(grade)} />
        <p>AI 결과는 비교를 시작하기 위한 후보입니다. 동일 상품·정품·구매 적합성을 보증하지 않습니다.</p>
        {typeof result.confidence === 'number' ? <p><strong>모델 참고 점수:</strong> {Math.round(result.confidence)} / 100</p> : null}
      </div>
      {evidence.length ? <ul aria-label="분석 전체 확인 근거">{evidence.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
      {candidates.length ? (
        <div className="kpop-candidate-list" role="list" aria-label="분석 상품 후보">
          {candidates.map((candidate, index) => (
            <CandidateCard key={String(candidate.id ?? index)} candidate={candidate} apiBase={apiBase} />
          ))}
        </div>
      ) : <p>제시할 만한 상품 후보가 없습니다. 근거 부족은 정상적인 분석 결과입니다.</p>}
    </div>
  );
}

export function AiResultCard({ data, apiBase = '' }: LeafProps) {
  const titleId = useId();
  const progressId = useId();
  const jobId = String(data?.jobId ?? data?.id ?? '');
  const [job, setJob] = useState<KpopAnalysisJob | null>(null);
  const [message, setMessage] = useState('');
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [deleting, setDeleting] = useState(false);
  const terminalRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;

    const apply = (next: KpopAnalysisJob) => {
      terminalRef.current = isKpopAnalysisTerminal(next.status);
      setJob(next);
    };
    const refresh = () => getKpopAnalysisJob(apiBase, jobId).then(apply);
    const startPolling = () => {
      if (controller.signal.aborted || terminalRef.current || timer) return;
      setStreamMode('polling');
      timer = setInterval(() => {
        void refresh().catch((error) => setMessage(readableError(error)));
      }, 3000);
    };

    void refresh()
      .then(() => {
        if (terminalRef.current) return;
        setStreamMode('live');
        return streamKpopAnalysisJob(apiBase, jobId, apply, controller.signal)
          .then(startPolling)
          .catch((error) => {
            if (!controller.signal.aborted) {
              setMessage('실시간 연결이 끊겨 자동 새로고침으로 전환했습니다.');
              startPolling();
            }
          });
      })
      .catch((error) => setMessage(readableError(error)));

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [apiBase, jobId]);

  const refresh = async () => {
    try {
      setJob(await getKpopAnalysisJob(apiBase, jobId));
      setMessage('최신 상태로 갱신했습니다.');
    } catch (error) {
      setMessage(readableError(error));
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
      setMessage(readableError(error));
    } finally {
      setDeleting(false);
    }
  };

  if (!jobId) {
    return (
      <section className="kpop-analysis-card" aria-labelledby={titleId}>
        <h2 id={titleId}>분석 결과를 불러올 수 없습니다.</h2>
        <p role="alert">분석 작업 번호가 없습니다. 분석 화면에서 사진을 다시 선택해 주세요.</p>
      </section>
    );
  }

  const terminal = isKpopAnalysisTerminal(job?.status);
  const progressPct = Math.max(0, Math.min(100, job?.progressPct || 0));

  return (
    <section className="kpop-analysis-card" aria-labelledby={titleId} aria-busy={!terminal}>
      <div className="kpop-result-heading">
        <div>
          <p className="kpop-eyebrow">작업 #{jobId}</p>
          <h2 id={titleId} role="status" aria-live="polite" aria-atomic="true">
            {statusCopy[job?.status || 'QUEUED']}
          </h2>
        </div>
        {!terminal ? (
          <small role="status" aria-live="polite">
            {streamMode === 'polling' ? '연결 방식: 자동 새로고침' : '연결 방식: 실시간 상태 연결'}
          </small>
        ) : null}
      </div>
      {job && !terminal ? (
        <div className="kpop-progress-row">
          <div
            className="kpop-progress"
            id={progressId}
            role="progressbar"
            aria-label="의상 후보 분석 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-valuetext={`${progressPct}% 완료`}
          >
            <span aria-hidden="true" style={{ width: `${progressPct}%` }} />
          </div>
          <strong aria-hidden="true">{progressPct}% 완료</strong>
        </div>
      ) : null}
      {job?.status === 'SUCCEEDED' && job.result ? <ResultBody result={job.result} apiBase={apiBase} /> : null}
      {job?.status === 'FAILED' ? (
        <p role="alert">분석을 완료하지 못했습니다. 잠시 후 새 사진으로 다시 시도해 주세요.</p>
      ) : null}
      <div className="kpop-result-actions">
        <button type="button" onClick={refresh}>상태 새로고침</button>
        <button
          type="button"
          onClick={removeSource}
          aria-busy={deleting}
          disabled={Boolean(job?.sourceDeleted || job?.sourceDeletedAt) || deleting}
        >
          {job?.sourceDeleted || job?.sourceDeletedAt ? '원본 사진 삭제됨' : deleting ? '삭제 중…' : '원본 사진 삭제'}
        </button>
      </div>
      <p className="kpop-evidence">원본 삭제 후에도 이미 생성된 분석 결과와 최소 작업 기록은 보관 정책에 따라 남을 수 있습니다.</p>
      {message ? <p className="kpop-analysis-message" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
    </section>
  );
}
