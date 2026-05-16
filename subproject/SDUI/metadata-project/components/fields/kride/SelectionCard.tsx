'use client';
import CardImage from "./atoms/CardImage";
import CardLabel from "./atoms/CardLabel";
import CheckIndicator from "./atoms/CheckIndicator";

interface ContentItem { id: number; name: string; imageUrl: string; }

export default function SelectionCard({ id, meta, data, onChange, onAction, formData }: any) {
  const cssClass: string = meta?.cssClass || meta?.css_class || "";
  const mode = cssClass.includes("circle") ? "circle"
             : cssClass.includes("chip")   ? "chip"
             : "square";
  const isArtist = mode === "circle";

  const selectedArtists: ContentItem[] = formData?.selectedArtists ?? [];
  const selectedRegions: ContentItem[] = formData?.selectedRegions ?? [];
  const selected = isArtist
    ? selectedArtists.some((a) => a.id === data?.id)
    : selectedRegions.some((r) => r.id === data?.id);

  // 아티스트 최대 5개, 지역 최대 2개
  const maxReached = isArtist ? selectedArtists.length >= 5 : selectedRegions.length >= 2;
  const disabled = maxReached && !selected;

  const handleClick = () => {
    if (disabled) {
      const msg = isArtist ? "5개 이상은 클릭이 어렵습니다" : "지역은 두 곳까지 가능합니다";
      window.dispatchEvent(new CustomEvent('kride-warning', { detail: { msg } }));
      return;
    }
    const list = isArtist ? selectedArtists : selectedRegions;
    const key = isArtist ? "selectedArtists" : "selectedRegions";
    const exists = list.some((x) => x.id === data?.id);
    const updated = exists ? list.filter((x) => x.id !== data.id) : [...list, data];
    onChange?.(key, updated);
    onAction?.(meta, data);
  };

  // chip 모드: TED 스타일 텍스트 태그 (INTRO3 지역 선택)
  if (mode === "chip") {
    return (
      <div
        className={`cursor-pointer w-full flex items-center justify-center px-3 py-2.5 rounded-full border-2 text-sm font-medium transition-all
          ${selected
            ? "bg-white text-black border-white"
            : "bg-transparent text-white border-white/40 hover:border-white"}
          ${disabled && !selected ? "opacity-40" : ""}
        `}
        onClick={handleClick}
      >
        {data?.name ?? ""}
      </div>
    );
  }

  return (
    <div
      className={`selection-card relative flex flex-col items-center gap-1 cursor-pointer transition-opacity ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
      onClick={handleClick}
    >
      <div className={`relative w-24 h-24 ${mode === "circle" ? "rounded-full" : "rounded-lg"} overflow-hidden`}>
        <CardImage id={id} meta={{ ...meta, cssClass: mode }} data={data} />
        <CheckIndicator id={id} meta={meta} data={data} selected={selected} />
      </div>
      <CardLabel id={id} meta={meta} data={data} />
    </div>
  );
}
