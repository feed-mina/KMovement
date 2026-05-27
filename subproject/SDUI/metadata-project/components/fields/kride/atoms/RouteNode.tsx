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
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">
          {index + 1}
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
