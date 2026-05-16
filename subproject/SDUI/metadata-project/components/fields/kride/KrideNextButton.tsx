'use client';

// KRIDE_NEXT_BTN: formData 조건 기반 조건부 다음 버튼
// component_props: { "checkKey": "selectedArtists", "minCount": 1 }
// checkKey에 해당하는 formData 배열이 minCount 이상일 때만 렌더링
export default function KrideNextButton({ id, meta, onAction, formData }: any) {
  const props = meta?.componentProps || meta?.component_props || {};
  const checkKey: string = props.checkKey ?? "";
  const minCount: number = props.minCount ?? 1;

  const items = checkKey ? formData?.[checkKey] : null;
  const isVisible = !checkKey || (Array.isArray(items) && items.length >= minCount);

  if (!isVisible) return null;

  const label = meta?.labelText || meta?.label_text || "다음";
  const wrapperClass: string = meta?.cssClass || meta?.css_class || "";

  const handleClick = () => onAction?.(meta, {});

  return (
    <div className={wrapperClass}>
      <button
        id={id}
        type="button"
        onClick={handleClick}
        className="w-full py-4 rounded-full bg-red-600 text-white font-bold text-lg"
      >
        {label}
      </button>
    </div>
  );
}
