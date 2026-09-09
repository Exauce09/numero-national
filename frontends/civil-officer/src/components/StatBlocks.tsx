/** Blocs récapitulatifs Hommes / Femmes / Total (style Justicia). */

export type NatCounts = { congolais: number; etranger: number; total: number };

export function PopulationStatBlocks({
  hommes,
  femmes,
  total,
  listTitle = "LISTE DE LA POPULATION",
}: {
  hommes: NatCounts;
  femmes: NatCounts;
  total: NatCounts;
  listTitle?: string;
}) {
  return (
    <div className="eg-list-stats">
      <h3 className="eg-list-stats-title">{listTitle}</h3>
      <div className="eg-list-stats-grid">
        <StatColumn
          title="HOMMES"
          rows={[
            { label: "CONGOLAIS", value: hommes.congolais },
            { label: "ETRANGER", value: hommes.etranger },
            { label: "TOTAL", value: hommes.total, strong: true },
          ]}
        />
        <StatColumn
          title="FEMMES"
          rows={[
            { label: "CONGOLAISE", value: femmes.congolais },
            { label: "ETRANGER", value: femmes.etranger },
            { label: "TOTAL", value: femmes.total, strong: true },
          ]}
        />
        <StatColumn
          title="TOTAL GEN"
          rows={[
            { label: "CONGOLAIS(E)", value: total.congolais },
            { label: "ETRANGER", value: total.etranger },
            { label: "TOTAL", value: total.total, strong: true },
          ]}
          highlight
        />
      </div>
    </div>
  );
}

function StatColumn({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: Array<{ label: string; value: number; strong?: boolean }>;
  highlight?: boolean;
}) {
  return (
    <div className={`eg-stat-col${highlight ? " is-highlight" : ""}`}>
      <div className="eg-stat-col-head">{title}</div>
      <ul>
        {rows.map((r) => (
          <li key={r.label} className={r.strong ? "is-total" : undefined}>
            <span>{r.label}:</span>
            <strong>{r.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimpleStatBlocks({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; color?: string }>;
}) {
  return (
    <div className="eg-list-stats">
      <h3 className="eg-list-stats-title">{title}</h3>
      <div className="eg-simple-stats">
        {items.map((it) => (
          <div key={it.label} className="eg-simple-stat" style={it.color ? { borderTopColor: it.color } : undefined}>
            <span className="muted">{it.label}</span>
            <strong>{it.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
