'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
  minPercent?: number;
  maxPercent?: number;
}

export default function RangeTrack({ minPercent = 0, maxPercent = 100 }: Props) {
  return (
    <div className="range-track relative h-2 w-full bg-gray-700 rounded-full">
      <div
        className="absolute h-full bg-red-600 rounded-full"
        style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
      />
    </div>
  );
}
