'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
  index?: number;
}

export default function RouteNode({ data, index = 0 }: Props) {
  const name = data?.name || data?.placeName || data?.place_name || "";
  const desc = data?.description || data?.address || "";

  return (
    <div className="route-node flex items-start gap-3 py-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{name}</p>
        {desc && <p className="text-gray-400 text-xs truncate">{desc}</p>}
      </div>
    </div>
  );
}
