'use client';

import { useMemo } from "react";
import { readLabel, readMetaProps, type AnyRecord } from "@/components/fields/stats/statsUtils";

function readValue(item: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function readList(item: AnyRecord, keys: string[]): string[] {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  }
  return [];
}

function toItems(data: unknown): AnyRecord[] {
  if (Array.isArray(data)) return data.filter((item): item is AnyRecord => !!item && typeof item === "object");
  if (data && typeof data === "object") {
    const record = data as AnyRecord;
    if (Array.isArray(record.items)) return toItems(record.items);
    if (Array.isArray(record.data)) return toItems(record.data);
  }
  return [];
}

function formatMetric(value: unknown, suffix: string) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(numeric)}${suffix}`;
}

export default function HistoryList({ id, meta, data }: any) {
  const props = readMetaProps(meta);
  const title = readLabel(meta, String(props.title ?? "Travel history"));
  const emptyText = String(props.emptyText ?? props.empty_text ?? "No travel history yet");
  const actionText = String(props.actionText ?? props.action_text ?? "Recommend again");
  const actionUrl = String(props.actionUrl ?? props.action_url ?? "/view/INTRO1");
  const items = useMemo(() => toItems(data), [data]);

  return (
    <section id={id} className="history-list" aria-label={title}>
      <div className="history-list__header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="history-list__empty" role="status">{emptyText}</div>
      ) : (
        <ol className="history-list__items">
          {items.map((item, index) => {
            const titleText = readValue(item, ["title", "route", "activity_type"]) || `History ${index + 1}`;
            const dateText = readValue(item, ["date", "activity_date", "created_at"]);
            const summary = readValue(item, ["summary", "description", "caption"]);
            const regions = readList(item, ["regions", "visited_regions"]);
            const artists = readList(item, ["artists", "selected_artists"]);
            const distance = formatMetric(item.distance_km, "km");
            const poiCount = formatMetric(item.poi_count, " POI");

            return (
              <li key={String(item.id ?? `${titleText}-${index}`)} className="history-list__item">
                <time>{dateText}</time>
                <div className="history-list__body">
                  <strong>{titleText}</strong>
                  {summary && <p>{summary}</p>}
                  <div className="history-list__chips">
                    {[...regions.slice(0, 3), ...artists.slice(0, 2), distance, poiCount]
                      .filter(Boolean)
                      .map((label, chipIndex) => (
                        <span key={`${label}-${chipIndex}`}>{label}</span>
                      ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <a className="history-list__action" href={actionUrl}>{actionText}</a>
    </section>
  );
}
