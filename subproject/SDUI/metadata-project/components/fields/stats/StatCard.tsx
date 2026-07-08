'use client';

import { useEffect, useState } from "react";
import { KrideSkeleton } from "@/components/fields/kride/atoms/KridePrimitives";
import {
  firstRecord,
  formatMetric,
  readClassName,
  readLabel,
  readMetaProps,
  readNumber,
  toNumber,
} from "./statsUtils";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(value: number, duration = 720) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startValue = displayValue;
    const delta = value - startValue;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + delta * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function StatCardSkeleton({ id, label }: { id?: string; label: string }) {
  return (
    <section id={id} className="stat-card is-loading" aria-label={label} aria-busy="true">
      <div className="stat-card__body">
        <KrideSkeleton width="48%" height={12} />
        <KrideSkeleton width="68%" height={34} />
        <KrideSkeleton width="58%" height={18} />
      </div>
    </section>
  );
}

export default function StatCard({ id, meta, data }: any) {
  const props = readMetaProps(meta);
  const fallbackLabel = String(props.label ?? "Metric");

  if (data === undefined) {
    return <StatCardSkeleton id={id} label={readLabel(meta, fallbackLabel)} />;
  }

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
  const displayValue = useCountUp(value);

  const label = readLabel(meta, String(props.label ?? record.label ?? record.name ?? "지표"));
  const prefix = String(props.prefix ?? "");
  const suffix = String(props.suffix ?? record.suffix ?? "");
  const helperText = String(props.helperText ?? props.helper_text ?? record.description ?? record.caption ?? "");
  const className = ["stat-card", "stat-card--countup", readClassName(meta)].filter(Boolean).join(" ");

  return (
    <section id={id} className={className} aria-label={label}>
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        <strong className="stat-card__value">
          {prefix}{formatMetric(displayValue, compact)}{suffix}
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
