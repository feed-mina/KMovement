'use client';
import { useState } from "react";
import RangeLabel from "./atoms/RangeLabel";
import RangeTrack from "./atoms/RangeTrack";

const MIN = 30000;
const MAX = 2000000;

export default function DualRangeSlider({ id, data, onChange }: any) {
  const [localMin, setLocalMin] = useState<number>(data?.budget?.min ?? MIN);
  const [localMax, setLocalMax] = useState<number>(data?.budget?.max ?? MAX);

  const minPercent = ((localMin - MIN) / (MAX - MIN)) * 100;
  const maxPercent = ((localMax - MIN) / (MAX - MIN)) * 100;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), localMax - 10000);
    setLocalMin(v);
    onChange?.("budget", { min: v, max: localMax });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), localMin + 10000);
    setLocalMax(v);
    onChange?.("budget", { min: localMin, max: v });
  };

  return (
    <div id={id} className="dual-range-slider flex flex-col gap-4 w-full px-2">
      <div className="flex justify-between items-center">
        <RangeLabel id="min-label" meta={{}} data={{}} value={localMin} />
        <span className="text-gray-400 mx-2">~</span>
        <RangeLabel id="max-label" meta={{}} data={{}} value={localMax} />
      </div>

      <div className="relative h-8 flex items-center">
        <RangeTrack id="track" meta={{}} data={{}} minPercent={minPercent} maxPercent={maxPercent} />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={10000}
          value={localMin}
          onChange={handleMinChange}
          className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
          style={{ pointerEvents: "auto" }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={10000}
          value={localMax}
          onChange={handleMaxChange}
          className="absolute w-full h-2 opacity-0 cursor-pointer z-20"
          style={{ pointerEvents: "auto" }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>₩{MIN.toLocaleString("ko-KR")}</span>
        <span>₩{MAX.toLocaleString("ko-KR")}</span>
      </div>
    </div>
  );
}
