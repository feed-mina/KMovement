'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
}

export default function CardLabel({ meta, data }: Props) {
  const text = data?.name || meta?.labelText || meta?.label_text || "";
  return (
    <p className="card-label text-center text-sm text-white mt-1 truncate w-full">
      {text}
    </p>
  );
}
