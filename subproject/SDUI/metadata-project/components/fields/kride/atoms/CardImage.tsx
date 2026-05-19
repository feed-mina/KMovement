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

  // 로컬 이미지(/artists/...)는 <img>로 직접 렌더링 (파일명 공백/특수문자 호환)
  const isLocal = src.startsWith("/");
  if (isLocal) {
    return (
      <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={encodeURI(src)} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square`}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="150px" />
    </div>
  );
}
