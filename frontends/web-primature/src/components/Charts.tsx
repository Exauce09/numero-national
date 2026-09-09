/** Graphiques SVG légers (sans dépendance) pour le tableau de bord Santé. */

const COLORS = ["#1a5f4a", "#2d7a5f", "#c9a227", "#8a4b1a", "#3b6ea5", "#6b4c9a", "#b03a3a"];

export type ChartDatum = { label: string; value: number; color?: string };

function withColors(data: ChartDatum[]): Array<ChartDatum & { color: string }> {
  return data.map((d, i) => ({ ...d, color: d.color ?? COLORS[i % COLORS.length] }));
}

/** Camembert / donut */
export function PieChart({
  data,
  title,
  size = 180,
  donut = false,
}: {
  data: ChartDatum[];
  title: string;
  size?: number;
  donut?: boolean;
}) {
  const rows = withColors(data.filter((d) => d.value > 0));
  const total = rows.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const inner = donut ? r * 0.55 : 0;

  let angle = -Math.PI / 2;
  const slices = rows.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const path =
      sweep >= Math.PI * 2 - 0.001
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...d, path, pct: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="muted small">Aucune donnée.</p>
      ) : (
        <div className="chart-pie-wrap">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
            {slices.map((s) => (
              <path key={s.label} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5} />
            ))}
            {donut ? <circle cx={cx} cy={cy} r={inner} fill="#fff" /> : null}
            {donut ? (
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1a5f4a">
                {total}
              </text>
            ) : null}
          </svg>
          <ul className="chart-legend">
            {slices.map((s) => (
              <li key={s.label}>
                <span className="chart-swatch" style={{ background: s.color }} />
                <span>
                  {s.label} — <strong>{s.value}</strong> ({s.pct}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Histogramme (barres verticales) */
export function BarChart({
  data,
  title,
  height = 200,
}: {
  data: ChartDatum[];
  title: string;
  height?: number;
}) {
  const rows = withColors(data);
  const max = Math.max(...rows.map((d) => d.value), 1);
  const barW = 36;
  const gap = 18;
  const padL = 36;
  const padB = 48;
  const padT = 16;
  const width = Math.max(280, padL + rows.length * (barW + gap) + gap);
  const plotH = height - padB - padT;

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="muted small">Aucune donnée.</p>
      ) : (
        <div className="chart-scroll">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = padT + plotH * (1 - t);
              return (
                <g key={t}>
                  <line x1={padL} y1={y} x2={width - 8} y2={y} stroke="#e4ebe7" strokeWidth={1} />
                  <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6b7c74">
                    {Math.round(max * t)}
                  </text>
                </g>
              );
            })}
            {rows.map((d, i) => {
              const h = (d.value / max) * plotH;
              const x = padL + gap + i * (barW + gap);
              const y = padT + plotH - h;
              return (
                <g key={d.label}>
                  <rect x={x} y={y} width={barW} height={Math.max(h, 2)} rx={4} fill={d.color} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1a2e26">
                    {d.value}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={height - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#4a5a52"
                  >
                    {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/** Barres groupées (ex. naissances vs décès par province) */
export function GroupedBarChart({
  categories,
  series,
  title,
  height = 220,
}: {
  categories: string[];
  series: Array<{ name: string; color: string; values: number[] }>;
  title: string;
  height?: number;
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const groupW = 64;
  const gap = 28;
  const padL = 36;
  const padB = 52;
  const padT = 16;
  const width = Math.max(300, padL + categories.length * (groupW + gap) + gap);
  const plotH = height - padB - padT;
  const barW = Math.max(10, (groupW - 8) / Math.max(series.length, 1));

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {!categories.length ? (
        <p className="muted small">Aucune donnée.</p>
      ) : (
        <>
          <div className="chart-scroll">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
              {[0, 0.5, 1].map((t) => {
                const y = padT + plotH * (1 - t);
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={width - 8} y2={y} stroke="#e4ebe7" strokeWidth={1} />
                    <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6b7c74">
                      {Math.round(max * t)}
                    </text>
                  </g>
                );
              })}
              {categories.map((cat, i) => {
                const gx = padL + gap + i * (groupW + gap);
                return (
                  <g key={cat}>
                    {series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      const h = (v / max) * plotH;
                      const x = gx + si * barW;
                      const y = padT + plotH - h;
                      return (
                        <rect key={s.name} x={x} y={y} width={barW - 2} height={Math.max(h, 1)} rx={3} fill={s.color} />
                      );
                    })}
                    <text x={gx + groupW / 2 - 4} y={height - 14} textAnchor="middle" fontSize="10" fill="#4a5a52">
                      {cat.length > 12 ? `${cat.slice(0, 11)}…` : cat}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <ul className="chart-legend chart-legend-row">
            {series.map((s) => (
              <li key={s.name}>
                <span className="chart-swatch" style={{ background: s.color }} />
                {s.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Barres horizontales */
export function HorizontalBarChart({
  data,
  title,
}: {
  data: ChartDatum[];
  title: string;
}) {
  const rows = withColors(data);
  const max = Math.max(...rows.map((d) => d.value), 1);

  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="muted small">Aucune donnée.</p>
      ) : (
        <div className="hbar-list">
          {rows.map((d) => (
            <div key={d.label} className="hbar-row">
              <span className="hbar-label" title={d.label}>
                {d.label}
              </span>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, background: d.color }}
                />
              </div>
              <strong className="hbar-value">{d.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
