'use client';

import { KrideButton } from './atoms/KridePrimitives';

/**
 * 온보딩 "다음" 버튼.
 * componentProps.checkKey 가 있으면 formData[checkKey] 의 선택 수로 하한(minCount)을 검사한다.
 * 벤치마킹 G3: 하한 미만이면 버튼을 숨기지 않고 **비활성 + 이유 문구** 로 보여준다 (Spotify/Pinterest/Netflix 3/4).
 * 라벨에는 선택 수를 붙인다: "다음 · 2명 선택됨".
 */
export default function KrideNextButton({ id, meta, onAction, formData }: any) {
  const props = meta?.componentProps || meta?.component_props || {};
  const checkKey: string = props.checkKey ?? '';
  const minCount: number = Number(props.minCount ?? 1);
  const unit: string = props.unit ?? (checkKey === 'selectedRegions' ? '곳' : '명');

  const items = checkKey ? formData?.[checkKey] : null;
  const count = Array.isArray(items) ? items.length : 0;
  const gated = !!checkKey;
  const satisfied = !gated || count >= minCount;

  let label = meta?.labelText || meta?.label_text || '다음';
  if (label.includes('AI') && (label.includes('상담') || label.includes('챗'))) {
    label = '라이와 코스 상담';
  }
  const buttonLabel = gated && count > 0 ? `${label} · ${count}${unit} 선택됨` : label;

  const wrapperClass: string = meta?.cssClass || meta?.css_class || '';
  const handleClick = () => {
    if (!satisfied) return;
    onAction?.(meta, {});
  };

  return (
    <div className={`${wrapperClass} kride-next-bar`.trim()}>
      {gated && !satisfied && (
        <p className="kride-next-bar__hint" id={`${id}-hint`} role="status">
          {minCount}{unit} 이상 골라야 다음으로 갈 수 있어요
        </p>
      )}
      <KrideButton
        id={id}
        onClick={handleClick}
        size="lg"
        className="w-full"
        disabled={!satisfied}
        aria-describedby={gated && !satisfied ? `${id}-hint` : undefined}
      >
        {buttonLabel}
      </KrideButton>
    </div>
  );
}
