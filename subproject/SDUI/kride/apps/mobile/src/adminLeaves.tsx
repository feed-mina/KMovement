import type React from 'react';
import { Text, View } from 'react-native';
import {
  firstRecord,
  formatMetric,
  normalizeChartData,
  readMetaProps,
  readNumber,
  selectDataPath,
  type SduiLeafProps,
} from '@kride/core';

/**
 * RN ports of the web admin dashboard leaves (STAT_CARD / CHART). They read the
 * same component_props contract (valueKey, labelKey, dataPath, series, limit)
 * against DATA_SOURCE payloads bound through ref_data_id, so the ADMIN_DASHBOARD
 * metadata renders on mobile without its own screen code.
 */

const CHART_COLORS = ['#e11d48', '#0ea5e9', '#0f9f6e', '#f59e0b', '#7c3aed', '#64748b'];

const labelFor = (meta: any, fallback: string) =>
  String(meta?.labelText ?? meta?.label_text ?? fallback).trim();

/**
 * For object-typed sources the engine hands leaves the whole pageData map, so
 * a leaf bound to `ref_data_id` must pluck its own slice first (arrays and
 * already-plucked records pass through untouched).
 */
const boundSlice = (meta: any, data: unknown): unknown => {
  const refId = meta?.refDataId ?? meta?.ref_data_id;
  if (refId && data && typeof data === 'object' && !Array.isArray(data)) {
    const slice = (data as Record<string, unknown>)[String(refId)];
    if (slice !== undefined) return slice;
  }
  return data;
};

export const StatCardLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const props = readMetaProps(meta);
  const bound = boundSlice(meta, data);
  const record = firstRecord(bound);
  const valueKey = String(props.valueKey ?? props.value_key ?? meta?.refDataId ?? meta?.ref_data_id ?? 'value');
  const compact = props.compact === true || props.compact === 'true';
  const value =
    typeof bound === 'number'
      ? bound
      : readNumber(record, [valueKey, 'value', 'count', 'total', 'amount', 'score']) ?? 0;
  const label = labelFor(meta, String(props.label ?? '지표'));
  const helperText = String(props.helperText ?? props.helper_text ?? '');
  const prefix = String(props.prefix ?? '');
  const suffix = String(props.suffix ?? '');

  return (
    <View className="min-w-[45%] flex-1 gap-1 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">{label}</Text>
      <Text className="text-2xl font-extrabold text-gray-950">
        {prefix}
        {formatMetric(value, compact)}
        {suffix}
      </Text>
      {helperText ? <Text className="text-xs text-gray-400">{helperText}</Text> : null}
    </View>
  );
};

export const ChartLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const props = readMetaProps(meta);
  const allRows = normalizeChartData(selectDataPath(boundSlice(meta, data), props), props);
  const limit = Number(props.limit ?? 0);
  // Trend charts declare e.g. limit 14 for "last 14 days" — keep the tail.
  const rows = Number.isFinite(limit) && limit > 0 ? allRows.slice(-limit) : allRows;
  const isDonut = String(props.type ?? '') === 'donut';
  const title = labelFor(meta, String(props.caption ?? '차트'));
  const caption = String(props.caption ?? '');
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = rows.reduce((currentMax, row) => Math.max(currentMax, row.value), 0);

  return (
    <View className="w-full gap-2 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-sm font-bold text-gray-950">{title}</Text>
      {caption ? <Text className="text-xs text-gray-400">{caption}</Text> : null}
      {rows.length === 0 ? (
        <Text className="py-2 text-sm text-gray-400">표시할 데이터가 없습니다.</Text>
      ) : (
        rows.map((row, index) => {
          const color = row.color || CHART_COLORS[index % CHART_COLORS.length];
          const ratio = isDonut
            ? total > 0
              ? row.value / total
              : 0
            : max > 0
              ? row.value / max
              : 0;
          return (
            <View key={`${row.label}-${index}`} className="gap-1">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center gap-2 pr-2">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <Text className="flex-1 text-xs text-gray-600" numberOfLines={1}>
                    {row.label}
                  </Text>
                </View>
                <Text className="text-xs font-semibold text-gray-950">
                  {formatMetric(row.value)}
                  {isDonut && total > 0 ? `  (${Math.round(ratio * 100)}%)` : ''}
                </Text>
              </View>
              <View className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <View
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max(ratio * 100, row.value > 0 ? 3 : 0)}%`, backgroundColor: color }}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};
