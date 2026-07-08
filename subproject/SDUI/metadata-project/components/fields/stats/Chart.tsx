'use client';

import { formatMetric, normalizeChartData, readClassName, readLabel, readMetaProps, selectDataPath } from "./statsUtils";

const PALETTE = ["#e11d48", "#0f9f6e", "#2563eb", "#f59e0b", "#7c3aed", "#0891b2"];

function chartTypeFrom(metaClass: string, explicitType?: unknown) {
  const type = String(explicitType ?? "").toLowerCase();
  if (type === "line" || type === "donut" || type === "bar") return type;
  if (/\bline\b/.test(metaClass)) return "line";
  if (/\bdonut\b|\bpie\b/.test(metaClass)) return "donut";
  return "bar";
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="stats-chart__empty" role="status">
      <span>{title || "차트"}</span>
    </div>
  );
}

function BarChart({ points }: { points: ReturnType<typeof normalizeChartData> }) {
  const max = Math.max(...points.map((item) => item.value), 1);
  const width = 320;
  const height = 180;
  const gap = 10;
  const barWidth = Math.max(12, (width - gap * (points.length + 1)) / points.length);

  return (
    <svg className="stats-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img">
      {points.map((item, index) => {
        const barHeight = Math.max(4, (item.value / max) * 118);
        const x = gap + index * (barWidth + gap);
        const y = 132 - barHeight;
        return (
          <g key={`${item.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill={item.color ?? PALETTE[index % PALETTE.length]}
            />
            <text x={x + barWidth / 2} y="154" textAnchor="middle" className="stats-chart__axis">
              {item.label.slice(0, 7)}
            </text>
            <text x={x + barWidth / 2} y={Math.max(14, y - 6)} textAnchor="middle" className="stats-chart__value">
              {formatMetric(item.value, true)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ points }: { points: ReturnType<typeof normalizeChartData> }) {
  const width = 320;
  const height = 180;
  const max = Math.max(...points.map((item) => item.value), 1);
  const step = points.length <= 1 ? 0 : 260 / (points.length - 1);
  const coords = points.map((item, index) => ({
    ...item,
    x: 30 + step * index,
    y: 132 - (item.value / max) * 112,
  }));
  const path = coords.map((item) => `${item.x},${item.y}`).join(" ");

  return (
    <svg className="stats-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline points={path} fill="none" stroke="#e11d48" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((item, index) => (
        <g key={`${item.label}-${index}`}>
          <circle cx={item.x} cy={item.y} r="5" fill={item.color ?? PALETTE[index % PALETTE.length]} />
          <text x={item.x} y="154" textAnchor="middle" className="stats-chart__axis">
            {item.label.slice(0, 7)}
          </text>
          <text x={item.x} y={Math.max(14, item.y - 10)} textAnchor="middle" className="stats-chart__value">
            {formatMetric(item.value, true)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ points }: { points: ReturnType<typeof normalizeChartData> }) {
  const total = points.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  let offset = 25;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="stats-chart__donut-layout">
      <svg className="stats-chart__donut" viewBox="0 0 120 120" role="img">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(17,24,39,0.12)" strokeWidth="18" />
        {points.map((item, index) => {
          const length = (Math.max(0, item.value) / total) * circumference;
          const dash = `${length} ${circumference - length}`;
          const segment = (
            <circle
              key={`${item.label}-${index}`}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={item.color ?? PALETTE[index % PALETTE.length]}
              strokeWidth="18"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          );
          offset -= length;
          return segment;
        })}
        <text x="60" y="57" textAnchor="middle" className="stats-chart__donut-total">
          {formatMetric(total, true)}
        </text>
        <text x="60" y="73" textAnchor="middle" className="stats-chart__donut-caption">
          total
        </text>
      </svg>
      <ul className="stats-chart__legend">
        {points.slice(0, 6).map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span style={{ background: item.color ?? PALETTE[index % PALETTE.length] }} />
            <b>{item.label}</b>
            <em>{formatMetric(item.value, true)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Chart({ id, meta, data }: any) {
  const props = readMetaProps(meta);
  const metaClass = readClassName(meta);
  const type = chartTypeFrom(metaClass, props.type ?? props.chartType ?? props.chart_type);
  const title = readLabel(meta, String(props.title ?? "통계"));
  const points = normalizeChartData(selectDataPath(data, props), props).slice(0, Number(props.limit ?? 12));
  const caption = props.caption === undefined || props.caption === null ? "" : String(props.caption);
  const className = ["stats-chart", `stats-chart--${type}`, metaClass].filter(Boolean).join(" ");

  return (
    <section id={id} className={className} aria-label={title}>
      <div className="stats-chart__header">
        <h3>{title}</h3>
        {caption && <p>{caption}</p>}
      </div>
      {points.length === 0 ? (
        <EmptyChart title={title} />
      ) : type === "line" ? (
        <LineChart points={points} />
      ) : type === "donut" ? (
        <DonutChart points={points} />
      ) : (
        <BarChart points={points} />
      )}
    </section>
  );
}
