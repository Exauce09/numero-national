/** Camembert et histogramme SVG (sans dépendance chart). */

export type ChartSlice = { label: string; value: number; color: string };

function sumValues(data: ChartSlice[]): number {
  return data.reduce((s, d) => s + Math.max(0, d.value), 0);
}

export function PieChart({
  data,
  size = 180,
  title,
}: {
  data: ChartSlice[];
  size?: number;
  title?: string;
}) {
  const total = sumValues(data);
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;

  const slices =
    total <= 0
      ? []
      : data
          .filter((d) => d.value > 0)
          .map((d) => {
            const sweep = (d.value / total) * Math.PI * 2;
            const x1 = cx + r * Math.cos(angle);
            const y1 = cy + r * Math.sin(angle);
            angle += sweep;
            const x2 = cx + r * Math.cos(angle);
            const y2 = cy + r * Math.sin(angle);
            const large = sweep > Math.PI ? 1 : 0;
            return {
              ...d,
              dAttr: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
              pct: Math.round((d.value / total) * 100),
            };
          });

  return (
    <div className="eg-chart-card">
      {title ? <h4 className="eg-chart-title">{title}</h4> : null}
      <div className="eg-chart-body">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
          {slices.length === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="#e5eaf2" />
          ) : slices.length === 1 ? (
            <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
          ) : (
            slices.map((s) => <path key={s.label} d={s.dAttr} fill={s.color} />)
          )}
          <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--egouv-card, #fff)" />
          <text x={cx} y={cy + 4} textAnchor="middle" className="eg-chart-center">
            {total}
          </text>
        </svg>
        <ul className="eg-chart-legend">
          {data.map((d) => (
            <li key={d.label}>
              <span className="eg-swatch" style={{ background: d.color }} />
              {d.label}: <strong>{d.value}</strong>
              {total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BarChart({
  data,
  title,
  height = 160,
}: {
  data: ChartSlice[];
  title?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="eg-chart-card">
      {title ? <h4 className="eg-chart-title">{title}</h4> : null}
      <div className="eg-bar-chart" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="eg-bar-col">
            <span className="eg-bar-value">{d.value}</span>
            <div
              className="eg-bar"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: d.color,
              }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="eg-bar-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
