import type { ChartSeries } from '../lib/reports';

interface Props {
  series: ChartSeries;
  height?: number;
}

const DEFAULT_COLORS = ['#2756e8', '#7c3aed', '#d97706', '#10b981', '#0f766e', '#dc2626', '#0891b2', '#1d4ed8', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6'];

export default function ReportChart({ series, height = 220 }: Props) {
  if (series.kind === 'none' || series.data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-6 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        No chart for this report
      </div>
    );
  }
  if (series.kind === 'bar') return <BarChart series={series} height={height} />;
  if (series.kind === 'pie') return <PieChart series={series} height={height} />;
  if (series.kind === 'funnel') return <FunnelChart series={series} height={height} />;
  return null;
}

function colorAt(c: string | undefined, i: number) {
  return c || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

// ─── Bar ──────────────────────────────────────────────────────────

function BarChart({ series, height }: { series: ChartSeries; height: number }) {
  const max = Math.max(1, ...series.data.map((d) => d.value));
  const barCount = series.data.length;
  const width = Math.max(360, barCount * 56);
  const barWidth = Math.min(40, (width - 32) / Math.max(barCount, 1) * 0.6);
  const step = (width - 32) / Math.max(barCount, 1);
  const usableH = height - 40;
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-slate-600 dark:text-slate-300">
        {/* baseline */}
        <line x1={16} y1={height - 24} x2={width - 16} y2={height - 24} stroke="currentColor" strokeOpacity={0.2} />
        {series.data.map((d, i) => {
          const h = (d.value / max) * usableH;
          const x = 16 + i * step + step / 2;
          const y = height - 24 - h;
          const color = colorAt(d.color, i);
          return (
            <g key={i}>
              <rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={h}
                rx={4}
                fill={color}
                opacity={0.92}
              />
              <text x={x} y={y - 4} textAnchor="middle" fontSize="10" fill="currentColor">{d.value}</text>
              <text x={x} y={height - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.75}>
                {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Pie ──────────────────────────────────────────────────────────

function PieChart({ series, height }: { series: ChartSeries; height: number }) {
  const total = series.data.reduce((s, d) => s + d.value, 0) || 1;
  const r = Math.min(height, 200) / 2 - 8;
  const cx = r + 8;
  const cy = r + 8;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={(r + 8) * 2} height={(r + 8) * 2} className="text-slate-600 dark:text-slate-300">
        {series.data.map((d, i) => {
          const startAngle = (acc / total) * Math.PI * 2;
          acc += d.value;
          const endAngle = (acc / total) * Math.PI * 2;
          const x1 = cx + r * Math.sin(startAngle);
          const y1 = cy - r * Math.cos(startAngle);
          const x2 = cx + r * Math.sin(endAngle);
          const y2 = cy - r * Math.cos(endAngle);
          const large = endAngle - startAngle > Math.PI ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return <path key={i} d={path} fill={colorAt(d.color, i)} opacity={0.92} stroke="white" strokeWidth={1} className="dark:[stroke:#0b1220]" />;
        })}
      </svg>
      <ul className="flex flex-col gap-1.5">
        {series.data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-200">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorAt(d.color, i) }} />
            <span className="font-medium">{d.label}</span>
            <span className="text-slate-500 dark:text-slate-400">
              {d.value} ({Math.round((d.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────

function FunnelChart({ series, height }: { series: ChartSeries; height: number }) {
  const max = Math.max(1, ...series.data.map((d) => d.value));
  const rowH = Math.min(36, (height - 8) / Math.max(series.data.length, 1));
  return (
    <div className="flex flex-col gap-1.5">
      {series.data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-24 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{d.label}</div>
            <div className="flex-1 rounded bg-slate-100 dark:bg-slate-800" style={{ height: rowH * 0.45 }}>
              <div
                className="h-full rounded text-end pe-2 text-[10px] font-bold text-white flex items-center justify-end"
                style={{ width: `${pct}%`, background: colorAt(d.color, i) }}
              >
                {d.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
