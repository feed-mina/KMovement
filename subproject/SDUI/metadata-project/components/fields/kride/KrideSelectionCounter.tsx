'use client';

/**
 * 선택 카운터 — "2 / 5 선택" (벤치마킹 G3).
 * SDUI 메타데이터 `KRIDE_SELECTION_COUNTER` 로 등록하고 component_props 로 조정한다:
 *   { "checkKey": "selectedArtists", "min": 1, "max": 5, "unit": "명" }
 * Spotify/Pinterest/Weverse/Netflix 4/4 가 선택 수와 상한을 상시 표시한다.
 */
export default function KrideSelectionCounter({ meta, formData }: any) {
    const props = meta?.componentProps || meta?.component_props || {};
    const checkKey: string = props.checkKey ?? 'selectedArtists';
    const min: number = Number(props.min ?? 1);
    const max: number = Number(props.max ?? 5);
    const unit: string = props.unit ?? (checkKey === 'selectedRegions' ? '곳' : '명');
    const items = formData?.[checkKey];
    const count = Array.isArray(items) ? items.length : 0;
    const full = count >= max;
    const short = count < min;

    return (
        <div className="kride-selection-counter" role="status" aria-live="polite">
            <span className="kride-selection-counter__hint">
                {min}{unit} 이상, 최대 {max}{unit}
            </span>
            <span className={`kride-selection-counter__value${full ? ' is-full' : ''}${short ? ' is-short' : ''}`}>
                {count} / {max} 선택
            </span>
        </div>
    );
}
