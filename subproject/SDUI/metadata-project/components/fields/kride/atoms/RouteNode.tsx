'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
  index?: number;
  onSelect?: () => void;
}

function buildExternalUrls(data: any) {
  const lat = data?.lat ?? data?.latitude;
  const lng = data?.lng ?? data?.lon ?? data?.longitude;
  const name = data?.name || data?.placeName || data?.place_name || 'place';
  if (!lat || !lng) return null;
  const encoded = encodeURIComponent(name);
  return {
    kakao: `https://map.kakao.com/link/map/${encoded},${lat},${lng}`,
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  };
}

export default function RouteNode({ data, index = 0, onSelect }: Props) {
  const name = data?.name || data?.placeName || data?.place_name || "";
  const desc = data?.description || data?.address || "";
  const urls = buildExternalUrls(data);

  return (
    <div className="route-node flex w-full items-start gap-3 py-2">
      <button
        type="button"
        className="flex flex-1 items-start gap-3 text-left min-w-0"
        onClick={onSelect}
      >
        <div className="relative flex-shrink-0 w-6 h-8 flex items-center justify-center">
          <svg className="absolute w-full h-full text-red-600 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <span className="relative text-white font-bold" style={{ fontSize: "10px", marginTop: "-6px" }}>
            {index + 1}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {desc && <p className="text-gray-400 text-xs truncate">{desc}</p>}
        </div>
      </button>
      {urls && (
        <div className="flex-shrink-0 flex gap-1 items-center pt-0.5">
          <a
            href={urls.kakao}
            target="_blank"
            rel="noreferrer"
            className="route-node__link"
            title="카카오맵에서 보기"
            onClick={(e) => e.stopPropagation()}
          >
            K
          </a>
          <a
            href={urls.google}
            target="_blank"
            rel="noreferrer"
            className="route-node__link"
            title="구글 지도에서 보기"
            onClick={(e) => e.stopPropagation()}
          >
            G
          </a>
        </div>
      )}
    </div>
  );
}
