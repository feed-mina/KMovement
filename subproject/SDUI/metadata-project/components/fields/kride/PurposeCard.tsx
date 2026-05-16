'use client';
import PurposeIcon from "./atoms/PurposeIcon";

const PURPOSE_LABELS: Record<string, string> = {
  food: "맛집 탐방",
  kculture: "K-컬처",
  nature: "자연 힐링",
  history: "역사 문화",
  shopping: "쇼핑",
  rest: "휴식",
};

export default function PurposeCard({ id, meta, data, onChange, onAction, formData }: any) {
  const purposeKey = (data?.purposeKey || meta?.cssClass || "") as string;
  const label = PURPOSE_LABELS[purposeKey] || meta?.labelText || meta?.label_text || "";
  const purposes: string[] = formData?.purposes ?? [];
  const selected = purposes.includes(purposeKey);

  const handleClick = () => {
    const updated = selected ? [] : [purposeKey];
    onChange?.("purposes", updated);
    onAction?.(meta, { value: purposeKey });
  };

  return (
    <button
      id={id}
      type="button"
      onClick={handleClick}
      className={`purpose-card flex items-center gap-3 px-5 py-4 rounded-xl border-2 w-full transition-all
        ${selected
          ? "bg-red-900 border-red-600 text-white"
          : "bg-gray-900 border-gray-700 text-gray-300 hover:border-red-600"
        }`}
    >
      <PurposeIcon id={id} meta={{ ...meta, cssClass: purposeKey }} data={data} />
      <span className="font-medium text-base">{label}</span>
    </button>
  );
}
