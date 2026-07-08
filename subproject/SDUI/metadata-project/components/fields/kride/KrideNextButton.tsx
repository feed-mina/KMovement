'use client';

import { KrideButton } from './atoms/KridePrimitives';

export default function KrideNextButton({ id, meta, onAction, formData }: any) {
  const props = meta?.componentProps || meta?.component_props || {};
  const checkKey: string = props.checkKey ?? '';
  const minCount: number = props.minCount ?? 1;

  const items = checkKey ? formData?.[checkKey] : null;
  const isVisible = !checkKey || (Array.isArray(items) && items.length >= minCount);

  if (!isVisible) return null;

  let label = meta?.labelText || meta?.label_text || '다음';
  if (label.includes('AI') && (label.includes('상담') || label.includes('챗'))) {
    label = '라이와 코스 상담';
  }

  const wrapperClass: string = meta?.cssClass || meta?.css_class || '';
  const handleClick = () => onAction?.(meta, {});

  return (
    <div className={wrapperClass}>
      <KrideButton id={id} onClick={handleClick} size="lg" className="w-full">
        {label}
      </KrideButton>
    </div>
  );
}
