/** Blocs récapitulatifs Hommes / Femmes / Total — nationalité × mineur/majeur. */

export type NatCounts = { congolais: number; etranger: number; total: number };

export type SexAgeNatCounts = NatCounts & {
  mineurs: NatCounts;
  majeurs: NatCounts;
};

function natRows(prefixCong: string, counts: NatCounts, strongTotal = false) {
  return [
    { label: prefixCong, value: counts.congolais },
    { label: "ETRANGER", value: counts.etranger },
    { label: "TOTAL", value: counts.total, strong: strongTotal },
  ];
}

export function PopulationStatBlocks({
  hommes,
  femmes,
  total,
  listTitle = "LISTE DE LA POPULATION",
}: {
  hommes: SexAgeNatCounts;
  femmes: SexAgeNatCounts;
  total: SexAgeNatCounts;
  listTitle?: string;
}) {
  return (
    <div className="eg-list-stats">
      <h3 className="eg-list-stats-title">{listTitle}</h3>
      <p className="eg-list-stats-note muted small">
        Majeur = 18 ans et plus · Mineur = moins de 18 ans · Congolais ou étranger
      </p>
      <div className="eg-list-stats-grid">
        <StatColumn
          title="HOMMES"
          sections={[
            { heading: "MINEURS", rows: natRows("CONGOLAIS", hommes.mineurs) },
            { heading: "MAJEURS", rows: natRows("CONGOLAIS", hommes.majeurs) },
            { heading: "TOTAL HOMMES", rows: natRows("CONGOLAIS", hommes, true) },
          ]}
        />
        <StatColumn
          title="FEMMES"
          sections={[
            { heading: "MINEURES", rows: natRows("CONGOLAISE", femmes.mineurs) },
            { heading: "MAJEURES", rows: natRows("CONGOLAISE", femmes.majeurs) },
            { heading: "TOTAL FEMMES", rows: natRows("CONGOLAISE", femmes, true) },
          ]}
        />
        <StatColumn
          title="TOTAL GEN"
          highlight
          sections={[
            { heading: "MINEURS", rows: natRows("CONGOLAIS(E)", total.mineurs) },
            { heading: "MAJEURS", rows: natRows("CONGOLAIS(E)", total.majeurs) },
            { heading: "TOTAL GÉNÉRAL", rows: natRows("CONGOLAIS(E)", total, true) },
          ]}
        />
      </div>
    </div>
  );
}

function StatColumn({
  title,
  sections,
  highlight,
}: {
  title: string;
  sections: Array<{
    heading: string;
    rows: Array<{ label: string; value: number; strong?: boolean }>;
  }>;
  highlight?: boolean;
}) {
  return (
    <div className={`eg-stat-col${highlight ? " is-highlight" : ""}`}>
      <div className="eg-stat-col-head">{title}</div>
      {sections.map((sec) => (
        <div key={sec.heading} className="eg-stat-section">
          <div className="eg-stat-section-head">{sec.heading}</div>
          <ul>
            {sec.rows.map((r) => (
              <li key={`${sec.heading}-${r.label}`} className={r.strong ? "is-total" : undefined}>
                <span>{r.label}:</span>
                <strong>{r.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
