'use client';
import { useState, useRef, useEffect } from "react";
import RangeTrack from "./atoms/RangeTrack";

const MIN = 30000;
const MAX = 2000000;
const STEP = 10000;

function formatWon(v: number) {
  return `₩${v.toLocaleString("ko-KR")}`;
}

function clampToStep(v: number) {
  return Math.round(Math.min(MAX, Math.max(MIN, v)) / STEP) * STEP;
}

export default function DualRangeSlider({ id, data, onChange }: any) {
  const [localMin, setLocalMin] = useState<number>(data?.budget?.min ?? MIN);
  const [localMax, setLocalMax] = useState<number>(data?.budget?.max ?? MAX);
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const minPercent = ((localMin - MIN) / (MAX - MIN)) * 100;
  const maxPercent = ((localMax - MIN) / (MAX - MIN)) * 100;

  useEffect(() => {
    if ((editingMin || editingMax) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingMin, editingMax]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), localMax - STEP);
    setLocalMin(v);
    onChange?.("budget", { min: v, max: localMax });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), localMin + STEP);
    setLocalMax(v);
    onChange?.("budget", { min: localMin, max: v });
  };

  const startEdit = (which: "min" | "max") => {
    const raw = which === "min" ? localMin : localMax;
    setEditValue(String(raw));
    if (which === "min") setEditingMin(true);
    else setEditingMax(true);
  };

  const commitEdit = (which: "min" | "max") => {
    const parsed = parseInt(editValue.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) {
      const clamped = clampToStep(parsed);
      if (which === "min") {
        const v = Math.min(clamped, localMax - STEP);
        setLocalMin(v);
        onChange?.("budget", { min: v, max: localMax });
      } else {
        const v = Math.max(clamped, localMin + STEP);
        setLocalMax(v);
        onChange?.("budget", { min: localMin, max: v });
      }
    }
    setEditingMin(false);
    setEditingMax(false);
  };

  const handleKeyDown = (which: "min" | "max", e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit(which);
    if (e.key === "Escape") { setEditingMin(false); setEditingMax(false); }
  };

  const midPercent = (minPercent + maxPercent) / 2;
  const minLabelTransform = minPercent <= 8 ? "translateX(0)" : "translateX(-50%)";
  const maxLabelTransform = maxPercent >= 92 ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div id={id} className="dual-range-slider flex flex-col gap-6 w-full px-2">
      {/* 슬라이더 가운데 위에 현재 범위 표시 */}
      <div className="relative h-6">
        <div
          className="absolute -translate-x-1/2 text-center whitespace-nowrap"
          style={{ left: `${midPercent}%` }}
        >
          <span className="text-white text-lg font-bold">
            {formatWon(localMin)} ~ {formatWon(localMax)}
          </span>
        </div>
      </div>

      {/* 슬라이더 트랙 + 썸 위치 라벨 */}
      <div className="relative">
        {/* 왼쪽(min) 라벨 — 클릭 시 편집 */}
        <div
          className="absolute -top-7 cursor-pointer"
          style={{ left: `${minPercent}%`, transform: minLabelTransform }}
          onClick={() => startEdit("min")}
        >
          {editingMin ? (
            <input
              ref={inputRef}
              className="w-24 bg-gray-800 text-white text-xs text-center rounded px-1 py-0.5 border border-red-600 outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit("min")}
              onKeyDown={(e) => handleKeyDown("min", e)}
            />
          ) : (
            <span className="text-white text-xs font-medium bg-gray-800 px-2 py-0.5 rounded-full">
              {formatWon(localMin)}
            </span>
          )}
        </div>

        {/* 오른쪽(max) 라벨 — 클릭 시 편집 */}
        <div
          className="absolute -top-7 cursor-pointer"
          style={{ left: `${maxPercent}%`, transform: maxLabelTransform }}
          onClick={() => startEdit("max")}
        >
          {editingMax ? (
            <input
              ref={inputRef}
              className="w-24 bg-gray-800 text-white text-xs text-center rounded px-1 py-0.5 border border-red-600 outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit("max")}
              onKeyDown={(e) => handleKeyDown("max", e)}
            />
          ) : (
            <span className="text-white text-xs font-medium bg-gray-800 px-2 py-0.5 rounded-full">
              {formatWon(localMax)}
            </span>
          )}
        </div>

        {/* 트랙 */}
        <div className="h-8 flex items-center">
          <RangeTrack id="track" meta={{}} data={{}} minPercent={minPercent} maxPercent={maxPercent} />
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={localMin}
            onChange={handleMinChange}
            className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
            style={{ pointerEvents: "auto" }}
          />
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={localMax}
            onChange={handleMaxChange}
            className="absolute w-full h-2 opacity-0 cursor-pointer z-20"
            style={{ pointerEvents: "auto" }}
          />
        </div>
      </div>

      {/* 하단 최소/최대 범위 기준선 */}
      <div className="flex justify-between text-xs text-gray-600">
        <span>{formatWon(MIN)}</span>
        <span>{formatWon(MAX)}</span>
      </div>
    </div>
  );
}
