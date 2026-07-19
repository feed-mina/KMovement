export type AnyRecord = Record<string, unknown>;

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export function readMetaProps(meta: AnyRecord | undefined): AnyRecord {
  const raw = meta?.componentProps ?? meta?.component_props ?? meta?.props ?? {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw as AnyRecord : {};
}

export function readClassName(meta: AnyRecord | undefined): string {
  return String(meta?.cssClass ?? meta?.css_class ?? "").trim();
}

export function readLabel(meta: AnyRecord | undefined, fallback = ""): string {
  return String(meta?.labelText ?? meta?.label_text ?? meta?.label ?? fallback).trim();
}

export function firstRecord(data: unknown): AnyRecord {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as AnyRecord : {};
  }
  return data && typeof data === "object" ? data as AnyRecord : {};
}

export function selectDataPath(data: unknown, props: AnyRecord): unknown {
  const rawPath = props.dataPath ?? props.data_path ?? props.seriesKey ?? props.series_key;
  if (typeof rawPath !== "string" || !rawPath.trim()) return data;

  const selected = rawPath.split(".").reduce<unknown>((current, key) => {
    if (Array.isArray(current)) {
      const index = Number(key);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (current && typeof current === "object") {
      return (current as AnyRecord)[key];
    }
    return undefined;
  }, data);

  return selected ?? [];
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readNumber(record: AnyRecord, keys: string[]): number | null {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      const value = toNumber(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

export function formatMetric(value: number, compact = false): string {
  return new Intl.NumberFormat("ko-KR", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function normalizeChartData(data: unknown, props: AnyRecord): ChartDatum[] {
  const labelKey = String(props.labelKey ?? props.label_key ?? "label");
  const valueKey = String(props.valueKey ?? props.value_key ?? "value");
  const colorKey = String(props.colorKey ?? props.color_key ?? "color");

  if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(props.series)) {
    const record = data as AnyRecord;
    return (props.series as unknown[])
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const item = entry as AnyRecord;
        const key = String(item.key ?? item.valueKey ?? item.value_key ?? "");
        if (!key) return null;
        const value = readNumber(record, [key]);
        if (value === null) return null;
        return {
          label: String(item.label ?? key),
          value,
          color: typeof item.color === "string" ? String(item.color) : undefined,
        };
      })
      .filter(Boolean) as ChartDatum[];
  }

  const source: unknown[] | null = Array.isArray(data)
    ? data
    : Array.isArray((data as AnyRecord)?.items)
      ? (data as AnyRecord).items as unknown[]
      : Array.isArray((data as AnyRecord)?.data)
        ? (data as AnyRecord).data as unknown[]
        : Array.isArray((data as AnyRecord)?.series)
          ? (data as AnyRecord).series as unknown[]
          : Array.isArray((data as AnyRecord)?.values)
            ? (data as AnyRecord).values as unknown[]
            : null;

  if (source) {
    return source
      .map((item, index) => {
        if (typeof item === "number") {
          return { label: `${index + 1}`, value: item };
        }
        if (!item || typeof item !== "object") return null;
        const record = item as AnyRecord;
        const value = readNumber(record, [valueKey, "count", "total", "amount", "score"]);
        if (value === null) return null;
        return {
          label: String(record[labelKey] ?? record.name ?? record.title ?? record.date ?? index + 1),
          value,
          color: typeof record[colorKey] === "string" ? String(record[colorKey]) : undefined,
        };
      })
      .filter(Boolean) as ChartDatum[];
  }

  if (data && typeof data === "object") {
    return Object.entries(data as AnyRecord)
      .map(([label, rawValue]) => {
        const value = toNumber(rawValue);
        return value === null ? null : { label, value };
      })
      .filter(Boolean) as ChartDatum[];
  }

  return [];
}
