import { authHeader } from "../store/session-store";

export const KPOP_ANALYSIS_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const KPOP_ANALYSIS_MAX_BYTES = 10 * 1024 * 1024;
export const KPOP_ANALYSIS_CONSENT_SCOPE = "user-owned-image-analysis";

export type KpopAnalysisStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type KpopAnalysisPresign = {
  sourceKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt?: string;
};

export type KpopAnalysisCandidate = {
  id?: string | number;
  name?: string;
  brand?: string;
  evidenceGrade?: string;
  confidence?: number;
  evidence?: KpopAnalysisEvidence | KpopAnalysisEvidence[];
  officialUrl?: string;
  [key: string]: unknown;
};

export type KpopAnalysisResult = {
  evidenceGrade?: string;
  grade?: string;
  confidence?: number;
  evidence?: KpopAnalysisEvidence | KpopAnalysisEvidence[];
  candidates?: KpopAnalysisCandidate[];
  [key: string]: unknown;
};

export type KpopAnalysisEvidence =
  | string
  | {
      type?: string;
      score?: number;
      source?: string;
      message?: string;
      description?: string;
      [key: string]: unknown;
    };

export type KpopAnalysisJob = {
  jobId: string | number;
  celeryTaskId?: string;
  status: KpopAnalysisStatus;
  progressPct?: number;
  progressStep?: string;
  result?: KpopAnalysisResult;
  errorMessage?: string;
  sourceDeletedAt?: string;
  sourceDeleted?: boolean;
  expiresAt?: string;
  [key: string]: unknown;
};

type ApiEnvelope<T> = { data?: T; message?: string; error?: string };

const joinApi = (apiBase: string, path: string) =>
  `${apiBase.replace(/\/$/, "")}${path}`;

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const ownedRequest = async <T>(
  apiBase: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(joinApi(apiBase, path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<T> | T | null;
  if (!response.ok) {
    const envelope = payload as ApiEnvelope<T> | null;
    throw new Error(envelope?.message || envelope?.error || String(response.status));
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
};

const statusOf = (value: unknown): KpopAnalysisStatus => {
  const status = String(value || "QUEUED").toUpperCase();
  if (["SUCCESS", "SUCCEEDED"].includes(status)) return "SUCCEEDED";
  if (["FAILURE", "FAILED"].includes(status)) return "FAILED";
  if (["REVOKED", "CANCELLED"].includes(status)) return "CANCELLED";
  if (status === "EXPIRED") return "EXPIRED";
  if (["STARTED", "RETRY", "RETRYING", "PROGRESS", "RUNNING"].includes(status)) {
    return "RUNNING";
  }
  return "QUEUED";
};

const resultOf = (raw: Record<string, unknown>): KpopAnalysisResult | undefined => {
  const value = raw.result ?? raw.resultJson ?? raw.result_json;
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as KpopAnalysisResult;
    } catch {
      return { evidence: value };
    }
  }
  return value as KpopAnalysisResult;
};

export const normalizeKpopAnalysisJob = (value: unknown): KpopAnalysisJob => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    ...raw,
    jobId: (raw.jobId ?? raw.id ?? "") as string | number,
    celeryTaskId: (raw.celeryTaskId ?? raw.celery_task_id) as string | undefined,
    status: statusOf(raw.status),
    progressPct: Number(raw.progressPct ?? raw.progress_pct ?? 0),
    progressStep: (raw.progressStep ?? raw.progress_step) as string | undefined,
    result: resultOf(raw),
    errorMessage: (raw.errorMessage ?? raw.error_message ?? raw.error) as string | undefined,
    sourceDeletedAt: (raw.sourceDeletedAt ?? raw.source_deleted_at) as string | undefined,
    sourceDeleted: Boolean(
      raw.sourceDeleted ?? raw.source_deleted ?? raw.sourceDeletedAt ?? raw.source_deleted_at,
    ),
    expiresAt: (raw.expiresAt ?? raw.expires_at) as string | undefined,
  };
};

export async function presignKpopAnalysisAsset(
  apiBase: string,
  input: { contentType: string; fileSize: number },
): Promise<KpopAnalysisPresign> {
  const raw = await ownedRequest<Record<string, unknown>>(
    apiBase,
    "/api/v1/kpop/analysis-assets/presign",
    { method: "POST", body: JSON.stringify(input) },
  );
  return {
    sourceKey: String(raw.sourceKey ?? raw.objectKey ?? raw.key ?? ""),
    uploadUrl: String(raw.uploadUrl ?? raw.presignedUrl ?? raw.url ?? ""),
    headers: (raw.headers ?? raw.requiredHeaders ?? {}) as Record<string, string>,
    expiresAt: (raw.expiresAt ?? raw.expires_at) as string | undefined,
  };
}

export async function putKpopAnalysisAsset(
  presign: KpopAnalysisPresign,
  body: Blob,
): Promise<void> {
  if (!presign.sourceKey || !presign.uploadUrl) {
    throw new Error("Upload destination was not returned.");
  }
  const response = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body,
  });
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
}

export async function createKpopAnalysisJob(
  apiBase: string,
  input: {
    sourceKey: string;
    contentType: string;
    idempotencyKey: string;
  },
): Promise<KpopAnalysisJob> {
  const raw = await ownedRequest<Record<string, unknown>>(
    apiBase,
    "/api/v1/kpop/analysis-jobs",
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        consented: true,
        consentScope: KPOP_ANALYSIS_CONSENT_SCOPE,
      }),
    },
  );
  return normalizeKpopAnalysisJob(raw);
}

export async function getKpopAnalysisJob(
  apiBase: string,
  jobId: string | number,
): Promise<KpopAnalysisJob> {
  const raw = await ownedRequest<Record<string, unknown>>(
    apiBase,
    `/api/v1/kpop/analysis-jobs/${encodeURIComponent(String(jobId))}`,
  );
  return normalizeKpopAnalysisJob(raw);
}

export async function deleteKpopAnalysisSource(
  apiBase: string,
  jobId: string | number,
): Promise<void> {
  await ownedRequest(
    apiBase,
    `/api/v1/kpop/analysis-jobs/${encodeURIComponent(String(jobId))}/source`,
    { method: "DELETE" },
  );
}

export async function streamKpopAnalysisJob(
  apiBase: string,
  jobId: string | number,
  onSnapshot: (job: KpopAnalysisJob) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    joinApi(
      apiBase,
      `/api/v1/kpop/analysis-jobs/${encodeURIComponent(String(jobId))}/stream`,
    ),
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/event-stream", ...authHeader() },
      signal,
    },
  );
  if (!response.ok) throw new Error(`Live status failed (${response.status}).`);
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("Streaming is unavailable in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data) as ApiEnvelope<unknown> | unknown;
      const value = parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as ApiEnvelope<unknown>).data
        : parsed;
      onSnapshot(normalizeKpopAnalysisJob(value));
    } catch {
      // Ignore keep-alives or non-JSON diagnostic events; polling is the fallback.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach(consume);
    if (done) {
      if (buffer.trim()) consume(buffer);
      break;
    }
  }
}

export const isKpopAnalysisTerminal = (status?: string) =>
  ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"].includes(String(status));

export const makeKpopAnalysisIdempotencyKey = () =>
  `kpop-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
