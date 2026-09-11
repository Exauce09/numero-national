/** Camembert, barres et lignes SVG (sans dépendance chart). */

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
      {total <= 0 ? <p className="muted small eg-chart-empty">Pas encore de données disponibles</p> : null}
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
  const hasData = data.some((d) => d.value > 0);
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
      {!hasData ? <p className="muted small eg-chart-empty">Pas encore de données disponibles</p> : null}
    </div>
  );
}

export type LineSeries = { name: string; color: string; values: number[] };

/** Courbe(s) temporelles — labels = mois / périodes. */
export function LineChart({
  title,
  labels,
  series,
  height = 220,
}: {
  title?: string;
  labels: string[];
  series: LineSeries[];
  height?: number;
}) {
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const width = Math.max(320, labels.length * 48 + padL + padR);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const hasData = all.some((v) => v > 0);

  function xAt(i: number) {
    if (labels.length <= 1) return padL + plotW / 2;
    return padL + (i / (labels.length - 1)) * plotW;
  }
  function yAt(v: number) {
    return padT + plotH - (v / max) * plotH;
  }

  return (
    <div className="eg-chart-card">
      {title ? <h4 className="eg-chart-title">{title}</h4> : null}
      <svg
        className="eg-line-svg"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--egouv-line)" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} textAnchor="end" className="eg-axis-label">
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={pts} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={`${s.name}-${i}`} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={s.color} />
              ))}
            </g>
          );
        })}
        {labels.map((lab, i) => (
          <text key={lab} x={xAt(i)} y={height - 10} textAnchor="middle" className="eg-axis-label">
            {lab}
          </text>
        ))}
      </svg>
      <ul className="eg-chart-legend eg-chart-legend-row">
        {series.map((s) => (
          <li key={s.name}>
            <span className="eg-swatch" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
      {!hasData ? <p className="muted small eg-chart-empty">Pas encore de données disponibles</p> : null}
    </div>
  );
}

/** Mini sparkline pour KPI. */
export function Sparkline({
  values,
  color = "#0b3d91",
  width = 88,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => {
      const x = values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}
