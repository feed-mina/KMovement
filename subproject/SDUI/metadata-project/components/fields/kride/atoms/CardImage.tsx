'use client';
import Image from "next/image";
import { useState } from "react";
import { artistImageSource } from "@/lib/kride/artistImages";

interface Props {
  id: string;
  meta: any;
  data: any;
}

/**
 * 이미지가 없을 때 쓰는 이니셜. 두 단어면 각 첫 글자, 한 단어면 앞 두 글자.
 * "MONSTA X" → "MX", "THE BOYZ" → "TB", "TXT" → "TX", "(G)I-DLE" → "GI"
 */
export function artistInitials(name: string): string {
  const cleaned = (name || "").replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  const raw = words.length >= 2 ? words[0][0] + words[1][0] : cleaned.slice(0, 2);
  return raw.toUpperCase();
}

export default function CardImage({ id, meta, data }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const candidate = data?.imageUrl || meta?.imageUrl || "";
  const alt = data?.name || meta?.labelText || "";
  const mode = meta?.cssClass?.includes("circle") ? "circle" : "square";
  const shapeClass = mode === "circle"
    ? "rounded-full overflow-hidden"
    : "rounded-lg overflow-hidden";

  const src = artistImageSource(candidate, alt, mode === "circle");

  if (!src || failedSrc === src) {
    // 벤치마킹 G3: 폴백 아바타는 브랜드 톤(연한 레드 배경 + 레드 이니셜) 으로 통일한다.
    return (
      <div
        className={`card-image-wrapper card-image-fallback ${shapeClass} relative w-full aspect-square flex items-center justify-center`}
        role="img"
        aria-label={alt || '이미지 준비 중'}
      >
        <span className="card-image-fallback__initials" aria-hidden="true">{artistInitials(alt)}</span>
      </div>
    );
  }

  // 로컬 이미지(/artists/...)는 <img>로 직접 렌더링 (파일명 공백/특수문자 호환)
  const isLocal = src.startsWith("/");
  if (isLocal) {
    return (
      <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={encodeURI(src)}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      </div>
    );
  }

  return (
    <div className={`card-image-wrapper ${shapeClass} relative w-full aspect-square`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="150px"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
