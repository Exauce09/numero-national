/** Pages manage-* style Justicia : liste, recherche, export, détail acte. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActPrintCard from "./ActPrintCard";
import DataToolbar from "./DataToolbar";
import { actTypeLabel, getAct, listActs, type Act, type ActType } from "../registry";

export type ManageConfig = {
  slug: string;
  title: string;
  breadcrumb: string;
  justiciaUrl: string;
  justiciaFile: string;
  actType: ActType;
  createPath: string;
  searchHint: string;
  summaryFields: Array<{ key: string; label: string }>;
};

export const MANAGE_CONFIGS: Record<string, ManageConfig> = {
  deces: {
    slug: "deces",
    title: "Gérer les décès",
    breadcrumb: "Décès",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-deces.php",
    justiciaFile: "manage-deces.php",
    actType: "DEATH",
    createPath: "/deaths",
    searchHint: "Rechercher (n° acte, NIC, nom, lieu)…",
    summaryFields: [
      { key: "deceased_name", label: "Défunt" },
      { key: "cause_deces", label: "Cause" },
      { key: "lieu_deces", label: "Lieu décès" },
      { key: "date_deces", label: "Date décès" },
      { key: "cimetiere", label: "Cimetière" },
      { key: "responsable_name", label: "Responsable" },
    ],
  },
  divorce: {
    slug: "divorce",
    title: "Gérer les divorces",
    breadcrumb: "Divorces",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-divorce.php",
    justiciaFile: "manage-divorce.php",
    actType: "DIVORCE",
    createPath: "/divorces",
    searchHint: "Rechercher (n° acte, NIC, conjoints)…",
    summaryFields: [
      { key: "epoux_name", label: "Époux" },
      { key: "epouse_name", label: "Épouse" },
      { key: "cause", label: "Cause" },
      { key: "numero_mariage", label: "N° mariage" },
      { key: "date_divorce", label: "Date" },
    ],
  },
  adoption: {
    slug: "adoption",
    title: "Gérer les adoptions",
    breadcrumb: "Adoptions",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-adoption.php",
    justiciaFile: "manage-adoption.php",
    actType: "ADOPTION",
    createPath: "/adoptions",
    searchHint: "Rechercher (n° acte, NIC, tuteur, enfant)…",
    summaryFields: [
      { key: "enfant_name", label: "Enfant" },
      { key: "tuteur_name", label: "Tuteur" },
      { key: "lieu_adoption", label: "Lieu" },
      { key: "date_adoption", label: "Date" },
      { key: "motif", label: "Motif" },
    ],
  },
  deplacement: {
    slug: "deplacement",
    title: "Gérer les déplacements",
    breadcrumb: "Déplacements",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-deplacement.php",
    justiciaFile: "manage-deplacement.php",
    actType: "DISPLACEMENT",
    createPath: "/displacements",
    searchHint: "Rechercher (n° acte, NIC, destination)…",
    summaryFields: [
      { key: "person_name", label: "Personne" },
      { key: "lieu_a_aller", label: "Destination" },
      { key: "motif", label: "Motif" },
      { key: "date_deplacement", label: "Date départ" },
      { key: "date_retour", label: "Date retour" },
    ],
  },
  document: {
    slug: "document",
    title: "Gérer les documents",
    breadcrumb: "Documents",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-document.php",
    justiciaFile: "manage-document.php",
    actType: "DOCUMENT",
    createPath: "/documents",
    searchHint: "Rechercher (n° acte, NIC, type document)…",
    summaryFields: [
      { key: "beneficiaire_name", label: "Bénéficiaire" },
      { key: "type_document", label: "Type" },
      { key: "nom_document", label: "Nom document" },
      { key: "type_paiement", label: "Paiement" },
    ],
  },
  mariage: {
    slug: "mariage",
    title: "Gérer les mariages",
    breadcrumb: "Mariages",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-mariage.php",
    justiciaFile: "manage-mariage.php",
    actType: "MARRIAGE",
    createPath: "/marriages",
    searchHint: "Rechercher (n° acte, NIC, conjoints)…",
    summaryFields: [
      { key: "epoux_name", label: "Époux" },
      { key: "epouse_name", label: "Épouse" },
      { key: "regime_matrimonial", label: "Régime" },
      { key: "date_mariage", label: "Date" },
      { key: "lieu_etat_civil", label: "Lieu" },
    ],
  },
  naissance: {
    slug: "naissance",
    title: "Gérer les naissances",
    breadcrumb: "Naissances",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-naissance.php",
    justiciaFile: "manage-naissance.php",
    actType: "BIRTH",
    createPath: "/births",
    searchHint: "Rechercher (n° acte, NIC, nom, lieu)…",
    summaryFields: [
      { key: "nom", label: "Nom" },
      { key: "prenom", label: "Prénom" },
      { key: "sexe", label: "Sexe" },
      { key: "date_naissance", label: "Date" },
      { key: "lieu_naissance", label: "Lieu" },
    ],
  },
};

function cell(act: Act, key: string): string {
  const v = act.payload[key];
  if (v == null || v === "") return "—";
  return String(v);
}

function subjectLabel(act: Act, cfg: ManageConfig): string {
  for (const f of cfg.summaryFields) {
    const v = cell(act, f.key);
    if (v !== "—") return v;
  }
  return act.national_id || act.act_number;
}

export default function ManageActsPage({ config }: { config: ManageConfig }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [viewAct, setViewAct] = useState<Act | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listActs(config.actType).filter((act) => {
      if (!needle) return true;
      const parts = [
        act.act_number,
        act.national_id,
        ...config.summaryFields.map((f) => String(act.payload[f.key] ?? "")),
      ];
      return parts.join(" ").toLowerCase().includes(needle);
    });
  }, [config, q]);

  const exportRows = rows.map((a) => {
    const base: Record<string, string> = {
      act_number: a.act_number,
      national_id: a.national_id,
      created_at: a.created_at,
    };
    for (const f of config.summaryFields) base[f.key] = cell(a, f.key);
    return base;
  });

  const primary = config.summaryFields[0];
  const secondary = config.summaryFields[1];
  const tertiary = config.summaryFields[2];

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / {config.breadcrumb}
          </p>
          <h2 className="page-title">{config.title}</h2>
          <p className="page-lead">
            Même logique que{" "}
            <a href={config.justiciaUrl} target="_blank" rel="noreferrer">
              {config.justiciaFile}
            </a>{" "}
            — recherche, export CSV/Excel/PDF et fiche détail cliquable.
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate(config.createPath)}>
          + Ajouter
        </button>
      </div>

      <div className="metrics-row" style={{ marginBottom: "1rem" }}>
        <div className="metric-card">
          <span className="muted">Total</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Type</span>
          <strong style={{ fontSize: "1.05rem" }}>{actTypeLabel(config.actType)}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <input
              className="form-control"
              style={{ marginBottom: 0, minWidth: 220 }}
              placeholder={config.searchHint}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="muted small">{rows.length} enregistrement(s)</span>
          </div>
          <DataToolbar filename={`manage_${config.slug}`} rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>N° acte</th>
                <th>NIC</th>
                {primary ? <th>{primary.label}</th> : null}
                {secondary ? <th>{secondary.label}</th> : null}
                {tertiary ? <th>{tertiary.label}</th> : null}
                <th>Enregistré le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucun enregistrement. Cliquez « + Ajouter » pour créer.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id}>
                    <td>{a.act_number}</td>
                    <td>
                      <code>{a.national_id || "—"}</code>
                    </td>
                    {primary ? <td>{cell(a, primary.key)}</td> : null}
                    {secondary ? <td>{cell(a, secondary.key)}</td> : null}
                    {tertiary ? <td>{cell(a, tertiary.key)}</td> : null}
                    <td>{new Date(a.created_at).toLocaleString("fr-CD")}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn-add btn-sm"
                        onClick={() => setViewAct(getAct(a.id) ?? a)}
                        title={subjectLabel(a, config)}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h3 className="panel-title" style={{ margin: 0 }}>
                  {actTypeLabel(viewAct.type)} — {viewAct.act_number}
                </h3>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  Détail complet de l&apos;enregistrement
                </p>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setViewAct(null)}>
                Fermer
              </button>
            </div>
            <dl className="act-print-fields" style={{ marginBottom: "1rem" }}>
              {config.summaryFields.map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{cell(viewAct, f.key)}</dd>
                </div>
              ))}
            </dl>
            <ActPrintCard act={viewAct} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
