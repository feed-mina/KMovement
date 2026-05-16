'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
}

export default function DurationLabel({ meta, data }: Props) {
  const text = data?.label || meta?.labelText || meta?.label_text || "";
  return <span className="duration-label text-base font-semibold">{text}</span>;
}
