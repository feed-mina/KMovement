'use client';

import {
  firstRecord,
  formatMetric,
  readClassName,
  readLabel,
  readMetaProps,
  readNumber,
  toNumber,
} from "./statsUtils";

export default function StatCard({ id, meta, data }: any) {
  const props = readMetaProps(meta);
  const record = firstRecord(data);
  const valueKey = String(props.valueKey ?? props.value_key ?? meta?.refDataId ?? meta?.ref_data_id ?? "value");
  const previousKey = String(props.previousKey ?? props.previous_key ?? "previous");
  const trendKey = String(props.trendKey ?? props.trend_key ?? "trend");
  const compact = props.compact === true || props.compact === "true";

  const value = typeof data === "number"
    ? data
    : readNumber(record, [valueKey, "value", "count", "total", "amount", "score"]) ?? 0;
  const previous = readNumber(record, [previousKey, "previousValue", "previous_value"]);
  const explicitTrend = toNumber(record[trendKey]);
  const trend = explicitTrend ?? (previous && previous !== 0 ? ((value - previous) / previous) * 100 : null);
  const trendTone = trend === null || trend === 0 ? "neutral" : trend > 0 ? "positive" : "negative";

  const label = readLabel(meta, String(props.label ?? record.label ?? record.name ?? "지표"));
  const prefix = String(props.prefix ?? "");
  const suffix = String(props.suffix ?? record.suffix ?? "");
  const helperText = String(props.helperText ?? props.helper_text ?? record.description ?? record.caption ?? "");
  const className = ["stat-card", readClassName(meta)].filter(Boolean).join(" ");

  return (
    <section id={id} className={className} aria-label={label}>
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        <strong className="stat-card__value">
          {prefix}{formatMetric(value, compact)}{suffix}
        </strong>
        {(trend !== null || helperText) && (
          <div className="stat-card__footer">
            {trend !== null && (
              <span className={`stat-card__trend stat-card__trend--${trendTone}`}>
                {trend > 0 ? "+" : ""}{formatMetric(trend)}%
              </span>
            )}
            {helperText && <span className="stat-card__helper">{helperText}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
