import { authHeader } from "../store/session-store";

export type KpopEvidenceGrade =
  | "EXACT_CANDIDATE"
  | "SIMILAR"
  | "INSUFFICIENT_EVIDENCE";

export type KpopProductCandidate = {
  id: string | number;
  artistId?: string | number;
  eventId?: string | number;
  name: string;
  brand?: string;
  evidenceGrade: KpopEvidenceGrade;
  confidence?: number;
  evidenceText?: string;
  officialUrl?: string;
  rightsChecked: boolean;
  savedItemId?: string | number;
  isSaved?: boolean;
  [key: string]: unknown;
};

export type KpopSavedItem = {
  id: string | number;
  itemType: "ARTIST" | "EVENT" | "PRODUCT_CANDIDATE";
  itemRef: string | number;
  createdAt?: string;
  product?: KpopProductCandidate;
  [key: string]: unknown;
};

export type KpopProductFilters = {
  q?: string | null;
  artistId?: string | number | null;
  eventId?: string | number | null;
  limit?: number | null;
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

const apiRequest = async <T>(
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

const text = (value: unknown) =>
  value === null || value === undefined ? undefined : String(value);

const evidenceGrade = (value: unknown): KpopEvidenceGrade => {
  const grade = String(value || "INSUFFICIENT_EVIDENCE").toUpperCase();
  if (grade === "EXACT_CANDIDATE" || grade === "SIMILAR") return grade;
  return "INSUFFICIENT_EVIDENCE";
};

export const normalizeKpopProductCandidate = (
  value: unknown,
): KpopProductCandidate => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    ...raw,
    id: (raw.id ?? raw.productCandidateId ?? raw.product_candidate_id ?? "") as
      | string
      | number,
    artistId: (raw.artistId ?? raw.artist_id) as string | number | undefined,
    eventId: (raw.eventId ?? raw.event_id) as string | number | undefined,
    name: text(raw.name) || "이름이 확인되지 않은 후보",
    brand: text(raw.brand),
    evidenceGrade: evidenceGrade(
      raw.evidenceGrade ?? raw.evidence_grade ?? raw.grade,
    ),
    confidence:
      raw.confidence === null || raw.confidence === undefined
        ? undefined
        : Number(raw.confidence),
    evidenceText: text(raw.evidenceText ?? raw.evidence_text ?? raw.evidence),
    officialUrl: text(
      raw.officialUrl ?? raw.official_url ?? raw.officialLink ?? raw.official_link,
    ),
    // Missing or string-like flags must not make an external link visible.
    rightsChecked: raw.rightsChecked === true || raw.rights_checked === true,
    savedItemId: (raw.savedItemId ?? raw.saved_item_id) as
      | string
      | number
      | undefined,
    isSaved: Boolean(raw.isSaved ?? raw.is_saved ?? raw.savedItemId ?? raw.saved_item_id),
  };
};

export const canOpenKpopOfficialUrl = (
  candidate: Pick<KpopProductCandidate, "officialUrl" | "rightsChecked">,
) => {
  if (candidate.rightsChecked !== true || !candidate.officialUrl) return false;
  try {
    return new URL(candidate.officialUrl).protocol === "https:";
  } catch {
    return false;
  }
};

export async function searchKpopProductCandidates(
  apiBase: string,
  filters: KpopProductFilters = {},
): Promise<KpopProductCandidate[]> {
  const query = new URLSearchParams();
  if (filters.q?.trim()) query.set("q", filters.q.trim());
  if (filters.artistId !== null && filters.artistId !== undefined && String(filters.artistId).trim()) {
    query.set("artistId", String(filters.artistId));
  }
  if (filters.eventId !== null && filters.eventId !== undefined && String(filters.eventId).trim()) {
    query.set("eventId", String(filters.eventId));
  }
  query.set("limit", String(filters.limit ?? 30));
  const rows = await apiRequest<unknown[]>(
    apiBase,
    `/api/v1/kpop/product-candidates?${query.toString()}`,
  );
  return Array.isArray(rows) ? rows.map(normalizeKpopProductCandidate) : [];
}

export async function getKpopSavedItems(
  apiBase: string,
): Promise<KpopSavedItem[]> {
  const rows = await apiRequest<unknown[]>(apiBase, "/api/v1/kpop/saved-items");
  if (!Array.isArray(rows)) return [];
  return rows.map((value) => {
    const raw = (value && typeof value === "object" ? value : {}) as Record<
      string,
      unknown
    >;
    const itemType = String(raw.itemType ?? raw.item_type ?? "PRODUCT_CANDIDATE") as
      KpopSavedItem["itemType"];
    const itemRef = (raw.itemRef ?? raw.item_ref ?? raw.productCandidateId ?? "") as
      | string
      | number;
    const hydrated = raw.product ?? raw.item;
    const productRaw = hydrated && typeof hydrated === "object"
      ? hydrated
      : itemType === "PRODUCT_CANDIDATE"
        ? { ...raw, id: itemRef }
        : undefined;
    return {
      ...raw,
      id: (raw.id ?? raw.savedItemId ?? raw.saved_item_id ?? "") as
        | string
        | number,
      itemType,
      itemRef,
      createdAt: text(raw.createdAt ?? raw.created_at),
      product: productRaw
        ? normalizeKpopProductCandidate({
            ...(productRaw as Record<string, unknown>),
            savedItemId: raw.id ?? raw.savedItemId ?? raw.saved_item_id,
            isSaved: true,
          })
        : undefined,
    };
  });
}

export async function saveKpopProductCandidate(
  apiBase: string,
  itemRef: string | number,
): Promise<KpopSavedItem> {
  const raw = await apiRequest<Record<string, unknown>>(
    apiBase,
    "/api/v1/kpop/saved-items",
    {
      method: "POST",
      body: JSON.stringify({ itemType: "PRODUCT_CANDIDATE", itemRefId: itemRef }),
    },
  );
  return {
    ...raw,
    id: (raw.id ?? raw.savedItemId ?? raw.saved_item_id ?? "") as string | number,
    itemType: "PRODUCT_CANDIDATE",
    itemRef: (raw.itemRef ?? raw.item_ref ?? itemRef) as string | number,
    createdAt: text(raw.createdAt ?? raw.created_at),
  };
}

export async function deleteKpopSavedItem(
  apiBase: string,
  savedItemId: string | number,
): Promise<void> {
  await apiRequest(
    apiBase,
    `/api/v1/kpop/saved-items/${encodeURIComponent(String(savedItemId))}`,
    { method: "DELETE" },
  );
}
