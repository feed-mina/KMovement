'use client';
import Image from "next/image";

interface Props {
  id: string;
  meta: any;
  data: any;
}

const PURPOSE_EMOJI: Record<string, string> = {
  food: "🍜",
  kculture: "🎤",
  nature: "🌿",
  history: "🏛️",
  shopping: "🛍️",
  rest: "🛁",
};

export default function PurposeIcon({ meta, data }: Props) {
  const key = data?.purposeKey || meta?.cssClass || "";
  const emoji = PURPOSE_EMOJI[key];
  const src = data?.iconUrl || meta?.imageUrl;

  if (src) {
    return (
      <div className="purpose-icon w-10 h-10 relative">
        <Image src={src} alt={key} fill className="object-contain" />
      </div>
    );
  }

  return (
    <div className="purpose-icon w-10 h-10 flex items-center justify-center text-2xl">
      {emoji || "✈️"}
    </div>
  );
}
