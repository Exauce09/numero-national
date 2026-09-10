import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import ExportToolbar from "../components/ExportToolbar";
import { TYPE_LABELS, getNationalSnapshot, listProvinces, upsertCivilOffice } from "../nationalData";

function PageShell({
  title,
  lead,
  onRefresh,
  children,
}: {
  title: string;
  lead: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">{lead}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm no-print" onClick={onRefresh}>
          Actualiser
        </button>
      </div>
      {children}
    </div>
  );
}

export function PopulationPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const rows = snap.population_by_province.map((p) => ({
    province: p.province,
    total: p.total,
    hommes: p.m,
    femmes: p.f,
  }));
  return (
    <PageShell
      title="Population"
      lead="Effectifs nationaux consolidés (lecture Présidence)."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="metric">
          <div className="label">Total</div>
          <div className="value">{snap.population_total.toLocaleString("fr-FR")}</div>
        </div>
        <div className="metric">
          <div className="label">Hommes</div>
          <div className="value">{snap.population_m.toLocaleString("fr-FR")}</div>
        </div>
        <div className="metric">
          <div className="label">Femmes</div>
          <div className="value">{snap.population_f.toLocaleString("fr-FR")}</div>
        </div>
      </div>
      <ExportToolbar
        filename="presidence_population"
        title="Population nationale par province"
        rows={rows}
        columns={["province", "total", "hommes", "femmes"]}
        tableName="presidence_population"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Province</th>
              <th>Total</th>
              <th>Hommes</th>
              <th>Femmes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.province}>
                <td>{p.province}</td>
                <td>{p.total.toLocaleString("fr-FR")}</td>
                <td>{p.hommes.toLocaleString("fr-FR")}</td>
                <td>{p.femmes.toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function CivilOfficesPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const provinces = useMemo(() => listProvinces(), [tick]);
  const [commune, setCommune] = useState("");
  const [code, setCode] = useState("");
  const [prov, setProv] = useState("");
  const [ville, setVille] = useState("");
  const [officer, setOfficer] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const rows = snap.civil_offices.filter((o) => {
    if (province && o.province !== province) return false;
    if (status === "active" && !o.active) return false;
    if (status === "inactive" && o.active) return false;
    return `${o.commune} ${o.province} ${o.officer} ${o.code}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((o) => ({
    commune: o.commune,
    code: o.code,
    province: o.province,
    ville: o.ville,
    officier: o.officer,
    statut: o.active ? "Actif" : "Inactif",
  }));

  function onAdd(e: FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    if (!commune.trim() || !prov.trim()) {
      setFormMsg("Commune et province requis.");
      return;
    }
    upsertCivilOffice({
      id: `co-${Date.now().toString(36)}`,
      commune: commune.trim(),
      code: code.trim() || commune.trim().toUpperCase().replace(/\s+/g, "-"),
      province: prov.trim(),
      ville: ville.trim() || prov.trim(),
      officer: officer.trim() || "—",
      active: true,
    });
    setCommune("");
    setCode("");
    setProv("");
    setVille("");
    setOfficer("");
    setFormMsg("Bureau d'état civil enregistré.");
    setTick((n) => n + 1);
  }

  return (
    <PageShell
      title="États civils"
      lead="Registre vierge — ajoutez les communes / bureaux d'état civil."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="panel no-print" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          Nouveau bureau
        </h3>
        <form onSubmit={onAdd} className="toolbar" style={{ flexWrap: "wrap" }}>
          <input className="form-control" placeholder="Commune" value={commune} onChange={(e) => setCommune(e.target.value)} />
          <input className="form-control" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="form-control" placeholder="Province" value={prov} onChange={(e) => setProv(e.target.value)} />
          <input className="form-control" placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
          <input className="form-control" placeholder="Officier" value={officer} onChange={(e) => setOfficer(e.target.value)} />
          <button type="submit" className="btn-primary btn-sm">
            Ajouter
          </button>
        </form>
        {formMsg ? <p className="muted small">{formMsg}</p> : null}
      </div>
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="form-control"
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | "active" | "inactive")}
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
      </div>
      <ExportToolbar
        filename="presidence_etats_civils"
        title="Bureaux d'état civil"
        rows={exportRows}
        columns={["commune", "code", "province", "ville", "officier", "statut"]}
        tableName="presidence_etats_civils"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Commune</th>
              <th>Code</th>
              <th>Province</th>
              <th>Ville</th>
              <th>Officier</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.commune}</td>
                <td>
                  <code>{o.code}</code>
                </td>
                <td>{o.province}</td>
                <td>{o.ville}</td>
                <td>{o.officer}</td>
                <td style={{ color: o.active ? "#1a5f4a" : "#8a4b1a", fontWeight: 700 }}>
                  {o.active ? "Actif" : "Inactif"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function FacilitiesPage() {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [type, setType] = useState("");
  const provinces = useMemo(() => listProvinces(), [tick]);
  const types = useMemo(
    () => [...new Set(snap.health_facilities.map((f) => f.type))].sort(),
    [snap],
  );

  const rows = snap.health_facilities.filter((f) => {
    if (province && f.province !== province) return false;
    if (type && f.type !== type) return false;
    return `${f.name} ${f.commune} ${f.province} ${f.type}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const exportRows = rows.map((f) => ({
    nom: f.name,
    type: TYPE_LABELS[f.type] ?? f.type,
    province: f.province,
    commune: f.commune,
    statut: f.active ? "Actif" : "Désactivé",
    naissances: f.births,
    deces: f.deaths,
  }));

  return (
    <PageShell
      title="Structures sanitaires"
      lead="Réseau sanitaire national — filtres dynamiques et exports."
      onRefresh={() => setTick((n) => n + 1)}
    >
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar
        filename="presidence_structures_sante"
        title="Structures sanitaires nationales"
        rows={exportRows}
        columns={["nom", "type", "province", "commune", "statut", "naissances", "deces"]}
        tableName="presidence_structures"
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Province</th>
              <th>Commune</th>
              <th>Statut</th>
              <th>Naissances</th>
              <th>Décès</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{TYPE_LABELS[f.type] ?? f.type}</td>
                <td>{f.province}</td>
                <td>{f.commune}</td>
                <td style={{ color: f.active ? "#1a5f4a" : "#8a4b1a", fontWeight: 700 }}>
                  {f.active ? "Actif" : "Désactivé"}
                </td>
                <td>{f.births}</td>
                <td>{f.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function ActsPage({
  title,
  lead,
  type,
  filename,
}: {
  title: string;
  lead: string;
  type: string;
  filename: string;
}) {
  const [tick, setTick] = useState(0);
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const provinces = useMemo(() => listProvinces(), [tick]);

  const all = snap.acts.filter((a) => a.type === type);
  const rows = all.filter((a) => {
    if (province && a.province !== province) return false;
    return `${a.summary} ${a.commune} ${a.province}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const total =
    type === "BIRTH"
      ? snap.births
      : type === "DEATH"
        ? snap.deaths
        : type === "MARRIAGE"
          ? snap.marriages
          : type === "DIVORCE"
            ? snap.divorces
            : rows.length;

  const exportRows = rows.map((a) => ({
    resume: a.summary,
    commune: a.commune,
    province: a.province,
    sexe: a.sexe ?? "",
    date: new Date(a.created_at).toLocaleString("fr-FR"),
  }));

  return (
    <PageShell title={title} lead={lead} onRefresh={() => setTick((n) => n + 1)}>
      <div className="metric" style={{ marginBottom: "1rem", maxWidth: 240 }}>
        <div className="label">Total national</div>
        <div className="value">{total.toLocaleString("fr-FR")}</div>
      </div>
      <div className="toolbar filters-bar no-print">
        <input className="form-control" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <ExportToolbar
        filename={filename}
        title={title}
        rows={exportRows}
        columns={["resume", "commune", "province", "sexe", "date"]}
        tableName={filename}
      />
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Résumé</th>
              <th>Commune</th>
              <th>Province</th>
              <th>Sexe</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.summary}</td>
                <td>{a.commune}</td>
                <td>{a.province}</td>
                <td>{a.sexe ?? "—"}</td>
                <td>{new Date(a.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun enregistrement récent — total national : {total.toLocaleString("fr-FR")}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function BirthsPage() {
  return (
    <ActsPage
      title="Naissances"
      lead="Naissances enregistrées / déclarées au niveau national."
      type="BIRTH"
      filename="presidence_naissances"
    />
  );
}

export function DeathsPage() {
  return (
    <ActsPage
      title="Décès"
      lead="Décès enregistrés / déclarés au niveau national."
      type="DEATH"
      filename="presidence_deces"
    />
  );
}

export function MarriagesPage() {
  return (
    <ActsPage
      title="Mariages"
      lead="Mariages enregistrés au niveau national."
      type="MARRIAGE"
      filename="presidence_mariages"
    />
  );
}

export function DivorcesPage() {
  return (
    <ActsPage
      title="Divorces"
      lead="Divorces enregistrés au niveau national."
      type="DIVORCE"
      filename="presidence_divorces"
    />
  );
}
