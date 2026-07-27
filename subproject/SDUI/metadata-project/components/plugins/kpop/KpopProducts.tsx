'use client';

import { FormEvent, useEffect, useId, useState } from 'react';

type ProductCandidate = {
    id: string | number;
    name: string;
    brand?: string;
    evidenceGrade: 'EXACT_CANDIDATE' | 'SIMILAR' | 'INSUFFICIENT_EVIDENCE';
    confidence?: number;
    evidenceText?: string;
    officialUrl?: string;
    rightsChecked: boolean;
    savedItemId?: string | number;
};

type SavedItem = {
    id: string | number;
    itemType: string;
    itemRef: string | number;
    product?: ProductCandidate;
};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || String(response.status));
    return (payload?.data ?? payload) as T;
}

const valueText = (value: unknown) => value == null ? undefined : String(value);

function normalizeCandidate(value: unknown): ProductCandidate {
    const raw = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
    const grade = String(raw.evidenceGrade ?? raw.evidence_grade ?? raw.grade ?? '').toUpperCase();
    return {
        id: raw.id ?? raw.productCandidateId ?? raw.product_candidate_id ?? '',
        name: valueText(raw.name) || '이름이 확인되지 않은 상품 후보',
        brand: valueText(raw.brand),
        evidenceGrade: grade === 'EXACT_CANDIDATE' || grade === 'SIMILAR' ? grade : 'INSUFFICIENT_EVIDENCE',
        confidence: raw.confidence == null ? undefined : Number(raw.confidence),
        evidenceText: valueText(raw.evidenceText ?? raw.evidence_text ?? raw.evidence),
        officialUrl: valueText(raw.officialUrl ?? raw.official_url ?? raw.officialLink ?? raw.official_link),
        rightsChecked: raw.rightsChecked === true || raw.rights_checked === true,
        savedItemId: raw.savedItemId ?? raw.saved_item_id,
    };
}

function normalizeSavedItem(value: unknown): SavedItem {
    const raw = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
    const itemType = String(raw.itemType ?? raw.item_type ?? 'PRODUCT_CANDIDATE');
    const itemRef = raw.itemRef ?? raw.item_ref ?? raw.productCandidateId ?? '';
    const productValue = raw.product ?? raw.item ?? (itemType === 'PRODUCT_CANDIDATE' ? raw : null);
    return {
        id: raw.id ?? raw.savedItemId ?? raw.saved_item_id ?? '',
        itemType,
        itemRef,
        product: productValue ? normalizeCandidate({
            ...productValue,
            id: productValue.id ?? itemRef,
            savedItemId: raw.id ?? raw.savedItemId ?? raw.saved_item_id,
        }) : undefined,
    };
}

function canOpenOfficialUrl(candidate: ProductCandidate) {
    if (!candidate.rightsChecked || !candidate.officialUrl) return false;
    try {
        return new URL(candidate.officialUrl).protocol === 'https:';
    } catch {
        return false;
    }
}

function errorCopy(error: unknown, action: string) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        return `${action}하려면 로그인해 주세요.`;
    }
    return `${action}을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
}

function gradeCopy(grade: ProductCandidate['evidenceGrade']) {
    if (grade === 'EXACT_CANDIDATE') return '근거가 비교적 강한 후보 · 동일 상품 확정 아님';
    if (grade === 'SIMILAR') return '유사 후보';
    return '근거 부족 · 상품을 단정할 수 없음';
}

function ProductCard({ candidate, onRemoved }: { candidate: ProductCandidate; onRemoved?: () => void }) {
    const titleId = useId();
    const [savedItemId, setSavedItemId] = useState(candidate.savedItemId);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const toggleSaved = async () => {
        if (!candidate.id || busy) return;
        setBusy(true);
        setMessage('');
        try {
            if (savedItemId) {
                await requestJson(`/api/v1/kpop/saved-items/${encodeURIComponent(String(savedItemId))}`, { method: 'DELETE' });
                setSavedItemId(undefined);
                setMessage('저장을 해제했습니다.');
                onRemoved?.();
            } else {
                const saved = await requestJson<Record<string, any>>('/api/v1/kpop/saved-items', {
                    method: 'POST',
                    body: JSON.stringify({ itemType: 'PRODUCT_CANDIDATE', itemRefId: candidate.id }),
                });
                setSavedItemId(saved.id ?? saved.savedItemId ?? saved.saved_item_id);
                setMessage('후보를 저장했습니다.');
            }
        } catch (error) {
            setMessage(errorCopy(error, savedItemId ? '저장 해제' : '저장'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <article className="kpop-product-card" role="listitem" aria-labelledby={titleId}>
            <small className={`kpop-evidence-badge is-${candidate.evidenceGrade.toLowerCase()}`}>{gradeCopy(candidate.evidenceGrade)}</small>
            <h3 id={titleId}>{candidate.name}</h3>
            {candidate.brand && <p>{candidate.brand}</p>}
            {typeof candidate.confidence === 'number' && <p><strong>모델 참고 점수:</strong> {Math.round(candidate.confidence)} / 100</p>}
            <p><strong>확인 근거:</strong> {candidate.evidenceText || '제공되지 않았습니다. 근거 부족은 정상적인 결과입니다.'}</p>
            <div className="kpop-card-actions">
                <button type="button" aria-pressed={Boolean(savedItemId)} aria-busy={busy} disabled={busy || !candidate.id} onClick={toggleSaved}>
                    {busy ? '처리 중...' : savedItemId ? '저장 해제' : '후보 저장'}
                </button>
                {canOpenOfficialUrl(candidate) && (
                    <a href={candidate.officialUrl} target="_blank" rel="noreferrer">권리 확인된 공식 출처 <span>(새 창)</span></a>
                )}
            </div>
            {message && <p className="kpop-analysis-message" role="status">{message}</p>}
        </article>
    );
}

export function KpopProductSearch() {
    const helpId = useId();
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState<ProductCandidate[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const search = async (nextQuery = query) => {
        setBusy(true);
        setMessage('상품 후보를 찾고 있어요.');
        try {
            const params = new URLSearchParams(window.location.search);
            if (nextQuery.trim()) params.set('q', nextQuery.trim()); else params.delete('q');
            params.set('limit', '30');
            const [rows, savedRows] = await Promise.all([
                requestJson<unknown[]>(`/api/v1/kpop/product-candidates?${params.toString()}`),
                requestJson<unknown[]>('/api/v1/kpop/saved-items').catch(() => []),
            ]);
            const saved = (Array.isArray(savedRows) ? savedRows : []).map(normalizeSavedItem);
            const savedIds = new Map(saved.map((item) => [String(item.itemRef), item.id]));
            const normalized = (Array.isArray(rows) ? rows : []).map(normalizeCandidate).map((candidate) => ({
                ...candidate,
                savedItemId: candidate.savedItemId ?? savedIds.get(String(candidate.id)),
            }));
            setProducts(normalized);
            setMessage(normalized.length ? `${normalized.length}개의 후보를 찾았습니다.` : '조건에 맞는 후보가 없습니다. 근거 부족도 정상적인 결과입니다.');
        } catch (error) {
            setProducts([]);
            setMessage(errorCopy(error, '검색'));
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
        setQuery(initialQuery);
        void search(initialQuery);
    }, []);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void search();
    };

    return (
        <section className="kpop-product-panel" aria-labelledby="kpop-product-title">
            <div>
                <span className="kpop-eyebrow">EVIDENCE-FIRST SEARCH</span>
                <h2 id="kpop-product-title">상품 후보 검색</h2>
                <p id={helpId}>검색 결과는 후보이며 동일 상품·정품·구매 적합성을 보증하지 않습니다.</p>
            </div>
            <form className="kpop-product-filters" role="search" onSubmit={submit}>
                <label htmlFor="kpop-product-query">상품명 또는 브랜드</label>
                <div>
                    <input id="kpop-product-query" type="search" aria-describedby={helpId} value={query} onChange={(event) => setQuery(event.target.value)} />
                    <button type="submit" className="kpop-primary-btn" aria-busy={busy} disabled={busy}>{busy ? '검색 중...' : '후보 검색'}</button>
                </div>
            </form>
            {message && <p className="kpop-analysis-message" role="status">{message}</p>}
            <div className="kpop-product-list" role="list" aria-label="상품 검색 후보">
                {products.map((candidate) => <ProductCard key={String(candidate.id)} candidate={candidate} />)}
            </div>
        </section>
    );
}

export function KpopSavedItemList() {
    const [items, setItems] = useState<SavedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let active = true;
        requestJson<unknown[]>('/api/v1/kpop/saved-items')
            .then((rows) => {
                if (!active) return;
                const normalized = (Array.isArray(rows) ? rows : []).map(normalizeSavedItem);
                setItems(normalized);
                if (!normalized.length) setMessage('저장한 상품 후보가 없습니다.');
            })
            .catch((error) => { if (active) setMessage(errorCopy(error, '저장 목록 확인')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    return (
        <section className="kpop-product-panel" aria-labelledby="kpop-saved-title">
            <div>
                <span className="kpop-eyebrow">MY SAVED CANDIDATES</span>
                <h2 id="kpop-saved-title">저장한 상품 후보</h2>
            </div>
            {loading && <p role="status">저장 목록을 불러오고 있어요.</p>}
            {message && <p className="kpop-analysis-message" role="status">{message}</p>}
            <div className="kpop-product-list" role="list" aria-label="저장한 상품 후보">
                {items.filter((item) => item.itemType === 'PRODUCT_CANDIDATE' && item.product).map((item) => (
                    <ProductCard
                        key={String(item.id)}
                        candidate={{ ...item.product!, savedItemId: item.id }}
                        onRemoved={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                    />
                ))}
            </div>
        </section>
    );
}