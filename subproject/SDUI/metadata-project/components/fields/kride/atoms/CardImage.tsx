'use client';
import Image from "next/image";

interface Props {
  id: string;
  meta: any;
  data: any;
}

export default function CardImage({ id, meta, data }: Props) {
  const src = data?.imageUrl || meta?.imageUrl || "";
  const alt = data?.name || meta?.labelText || "";
  const mode = meta?.cssClass?.includes("circle") ? "circle" : "square";
  const shapeClass = mode === "circle"
    ? "rounded-full overflow-hidden"
    : "rounded-lg overflow-hidden";
  const initial = alt.charAt(0).toUpperCase();

  if (!src) {
    return (
      <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square bg-gray-700 flex items-center justify-center`}>
        <span className="text-white text-2xl font-bold">{initial}</span>
      </div>
    );
  }

  return (
    <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square`}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="150px" />
    </div>
  );
}
