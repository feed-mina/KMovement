type EvidenceBadgeProps = {
  label: string;
  grade?: string;
  id?: string;
};

const evidenceTone = (grade?: string) => {
  switch (String(grade || '').toUpperCase()) {
    case 'EXACT_CANDIDATE':
      return { className: 'is-strong', symbol: '✓' };
    case 'SIMILAR':
      return { className: 'is-similar', symbol: '≈' };
    default:
      return { className: 'is-insufficient', symbol: '!' };
  }
};

export default function KpopEvidenceBadge({ label, grade, id }: EvidenceBadgeProps) {
  const tone = evidenceTone(grade);
  return (
    <p className={`kpop-evidence-badge ${tone.className}`} id={id} role="note">
      <span className="kpop-evidence-symbol" aria-hidden="true">{tone.symbol}</span>
      <span><strong>근거 수준:</strong> {label}</span>
    </p>
  );
}
