'use client';
import { memo } from "react";

const LABEL_TO_VALUE: Record<string, string> = {
  "당일치기": "day",
  "1박 2일": "onenight",
  "2박 3일": "twonight",
};

const DurationButton = memo(({ id, meta, data, onChange, onAction }: any) => {
  const label = meta?.labelText || meta?.label_text || "";
  const value = LABEL_TO_VALUE[label] || label;
  const isSelected = data?.duration === value;

  const handleClick = () => {
    onChange?.("duration", value);
    onAction?.(meta, { value });
  };

  return (
    <button
      id={id}
      type="button"
      onClick={handleClick}
      className={`duration-btn w-full px-8 py-4 text-lg font-bold rounded-full border-2 transition-all
        ${isSelected
          ? "bg-red-600 border-red-600 text-white"
          : "bg-transparent border-red-600 text-red-500 hover:bg-red-600 hover:text-white"
        }`}
    >
      {label}
    </button>
  );
});

DurationButton.displayName = "DurationButton";
export default DurationButton;
