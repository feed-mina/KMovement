'use client';

interface Props {
  id: string;
  meta: any;
  data: any;
  label?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function CollapseHeader({ meta, label, isOpen, onToggle }: Props) {
  const text = label || meta?.labelText || meta?.label_text || "";
  return (
    <button
      className="collapse-header flex items-center justify-between w-full py-3 px-4 text-white font-semibold bg-gray-900 hover:bg-gray-800 transition-colors"
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <span>{text}</span>
      <svg
        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
