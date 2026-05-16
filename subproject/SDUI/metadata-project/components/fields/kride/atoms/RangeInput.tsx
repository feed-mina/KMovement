'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
  value?: number;
  min?: number;
  max?: number;
  onChange?: (id: string, value: number) => void;
}

export default function RangeInput({ id, min = 30000, max = 2000000, value = 30000, onChange }: Props) {
  return (
    <input
      type="range"
      id={id}
      min={min}
      max={max}
      value={value}
      step={10000}
      className="range-input w-full appearance-none bg-transparent"
      onChange={(e) => onChange?.(id, Number(e.target.value))}
    />
  );
}
