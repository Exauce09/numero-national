/** Pages manage-* style Justicia : stats, graphiques, liste paginée, détail. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActWorkflowPanel from "./ActWorkflowPanel";
import { BarChart, PieChart } from "./Charts";
import DataToolbar from "./DataToolbar";
import { SimpleStatBlocks } from "./StatBlocks";
import { api } from "../api";
import { getSession } from "../auth";
import {
  actRefLabel,
  getAct,
  getPersonByNic,
  isActCountedInTotals,
  listActs,
  upsertActsFromApi,
  type Act,
  type ActType,
} from "../registry";
import { RDC_CHART_SERIES, rdcColor } from "../rdcColors";

export type ManageConfig = {
  slug: string;
  title: string;
  listTitle: string;
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
    title: "Enregistrement de décès",
    listTitle: "Enregistrement de décès",
    breadcrumb: "Enregistrement de décès",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-deces.php",
    justiciaFile: "manage-deces.php",
    actType: "DEATH",
    createPath: "/deaths",
    searchHint: "Rechercher (n° acte, nom, lieu)…",
    summaryFields: [
      { key: "deceased_name", label: "Personne" },
      { key: "type_deces_label", label: "Type" },
      { key: "cause_deces", label: "Cause du décès" },
      { key: "lieu_deces", label: "Lieu du décès" },
      { key: "date_deces", label: "Date du décès" },
      { key: "cimetiere", label: "Cimetière" },
      { key: "declarant_name", label: "Déclarant" },
    ],
  },
  divorce: {
    slug: "divorce",
    title: "Transcriptions de divorce",
    listTitle: "Jugements de divorce transcrits",
    breadcrumb: "Divorce",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-divorce.php",
    justiciaFile: "manage-divorce.php",
    actType: "DIVORCE",
    createPath: "/divorces",
    searchHint: "Rechercher (n° acte, époux, jugement)…",
    summaryFields: [
      { key: "epoux_name", label: "Époux" },
      { key: "epouse_name", label: "Épouse" },
      { key: "ref_jugement", label: "Jugement" },
      { key: "numero_mariage", label: "Acte de mariage" },
      { key: "date_divorce", label: "Date jugement" },
    ],
  },
  adoption: {
    slug: "adoption",
    title: "Adoptions (après jugement)",
    listTitle: "Adoptions enregistrées",
    breadcrumb: "Adoption",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-adoption.php",
    justiciaFile: "manage-adoption.php",
    actType: "ADOPTION",
    createPath: "/adoptions",
    searchHint: "Rechercher (n° acte, adoptant, enfant)…",
    summaryFields: [
      { key: "enfant_name", label: "Enfant adopté" },
      { key: "adoptant_name", label: "Adoptant" },
      { key: "tuteur_name", label: "Adoptant (legacy)" },
      { key: "type_adoption", label: "Type" },
      { key: "ref_jugement", label: "Jugement" },
      { key: "date_adoption", label: "Date inscription" },
    ],
  },
  deplacement: {
    slug: "deplacement",
    title: "Gérer les déplacements",
    listTitle: "LISTE DES DÉPLACEMENTS",
    breadcrumb: "Déplacements",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-deplacement.php",
    justiciaFile: "manage-deplacement.php",
    actType: "DISPLACEMENT",
    createPath: "/displacements",
    searchHint: "Rechercher (n° acte, destination)…",
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
    title: "Copies & extraits",
    listTitle: "Délivrances enregistrées",
    breadcrumb: "Copies & extraits",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-document.php",
    justiciaFile: "manage-document.php",
    actType: "DOCUMENT",
    createPath: "/documents",
    searchHint: "Rechercher (extrait, copie, ayant droit)…",
    summaryFields: [
      { key: "ayant_droit_name", label: "Ayant droit" },
      { key: "beneficiaire_name", label: "Bénéficiaire" },
      { key: "type_delivrance", label: "Type délivrance" },
      { key: "type_document", label: "Type" },
      { key: "reference_acte", label: "Acte source" },
      { key: "motif_demande", label: "Motif" },
    ],
  },
  mariage: {
    slug: "mariage",
    title: "Registre des mariages",
    listTitle: "Actes de mariage",
    breadcrumb: "Actes de mariage",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-mariage.php",
    justiciaFile: "manage-mariage.php",
    actType: "MARRIAGE",
    createPath: "/marriages",
    searchHint: "Rechercher (n° acte, époux, date)…",
    summaryFields: [
      { key: "epoux_name", label: "Époux" },
      { key: "epouse_name", label: "Épouse" },
      { key: "regime_matrimonial", label: "Régime" },
      { key: "date_mariage", label: "Date célébration" },
      { key: "lieu_etat_civil", label: "Bureau" },
    ],
  },
  naissance: {
    slug: "naissance",
    title: "Enregistrement de nouveau-né",
    listTitle: "Enregistrement de nouveau-né",
    breadcrumb: "Enregistrement de nouveau-né",
    justiciaUrl: "https://www.justicia.website/egouv/COMMUNE/manage-naissance.php",
    justiciaFile: "manage-naissance.php",
    actType: "BIRTH",
    createPath: "/births",
    searchHint: "Rechercher (n° acte, nom)…",
    summaryFields: [
      { key: "nom", label: "Nom" },
      { key: "prenom", label: "Prénom" },
      { key: "sexe", label: "Sexe" },
      { key: "date_naissance", label: "Date" },
      { key: "lieu_naissance", label: "Lieu" },
      { key: "mode", label: "Mode" },
    ],
  },
};

const PAGE_SIZE = 10;
const COLORS = RDC_CHART_SERIES;

const ACT_KIND: Partial<Record<ActType, string>> = {
  BIRTH: "births",
  DEATH: "deaths",
  MARRIAGE: "marriages",
  DIVORCE: "divorces",
  ADOPTION: "adoptions",
  RECOGNITION: "recognitions",
  RECTIFICATION: "rectifications",
  DOCUMENT: "documents",
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
  return act.act_number;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ManageActsPage({
  config,
  showAnalytics = false,
}: {
  config: ManageConfig;
  showAnalytics?: boolean;
}) {
  const navigate = useNavigate();
  const session = getSession();
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState<"api" | "cache">("cache");

  const refresh = useCallback(async () => {
    const kind = ACT_KIND[config.actType];
    if (session?.accessToken && kind) {
      try {
        const rows = await api.listActs(kind);
        upsertActsFromApi(rows);
        setSource("api");
        setTick((n) => n + 1);
        return;
      } catch {
        /* fall through to cache */
      }
    }
    setSource("cache");
    setTick((n) => n + 1);
  }, [config.actType, session?.accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const all = useMemo(() => listActs(config.actType), [config.actType, tick]);
  const counted = useMemo(() => all.filter(isActCountedInTotals), [all]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const a of all) {
      const k = monthKey(a.created_at);
      if (k !== "—") set.add(k);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [all]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((act) => {
      if (monthFilter && monthKey(act.created_at) !== monthFilter) return false;
      if (!needle) return true;
      const parts = [
        act.act_number,
        act.national_id,
        act.status ?? "",
        ...config.summaryFields.map((f) => String(act.payload[f.key] ?? "")),
      ];
      return parts.join(" ").toLowerCase().includes(needle);
    });
  }, [all, config.summaryFields, q, monthFilter]);

  useEffect(() => {
    setPage(1);
  }, [q, monthFilter, config.slug]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const countedFiltered = useMemo(
    () =>
      counted.filter((a) => {
        if (monthFilter && monthKey(a.created_at) !== monthFilter) return false;
        return true;
      }),
    [counted, monthFilter],
  );

  const draftStatuses = useMemo(
    () =>
      new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PENDING_OFFICER", "CORRECTION_REQUIRED", ""]),
    [],
  );

  const draftsCount = useMemo(
    () =>
      all.filter((a) => {
        const s = String(a.status ?? "DRAFT").toUpperCase().trim();
        return draftStatuses.has(s) || !s;
      }).length,
    [all, draftStatuses],
  );

  const totalGeneral = all.length;

  const last30 = useMemo(() => {
    const cut = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return counted.filter((a) => new Date(a.created_at).getTime() >= cut).length;
  }, [counted]);

  const last90 = useMemo(() => {
    const cut = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return counted.filter((a) => new Date(a.created_at).getTime() >= cut).length;
  }, [counted]);

  const monthBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of counted) {
      const k = monthKey(a.created_at);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([label, value], i) => ({
        label: label.slice(5),
        value,
        color: COLORS[i % COLORS.length],
      }));
  }, [counted]);

  const breakdownField = config.summaryFields.find((f) =>
    ["sexe", "cause_deces", "cause", "type_document", "regime_matrimonial", "motif"].includes(f.key),
  );

  const pieBreakdown = useMemo(() => {
    if (!breakdownField) {
      return [
        { label: "Total", value: counted.length, color: COLORS[0] },
        { label: "30 j", value: last30, color: COLORS[1] },
      ];
    }
    const map = new Map<string, number>();
    for (const a of counted) {
      const k = cell(a, breakdownField.key);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({
        label: label === "M" ? "Garçons" : label === "F" ? "Filles" : label.slice(0, 18),
        value,
        color: COLORS[i % COLORS.length],
      }));
  }, [counted, breakdownField, last30]);

  const exportRows = rows.map((a) => {
    const base: Record<string, string> = {
      act_number: a.act_number,
      status: a.status ?? "",
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
          <h2 className="page-title">{showAnalytics ? `Liste — ${config.breadcrumb}` : config.title}</h2>
          <p className="page-lead">
            {showAnalytics ? (
              <>
                Vue statistique depuis le tableau de bord — référence{" "}
                <a href={config.justiciaUrl} target="_blank" rel="noreferrer">
                  {config.justiciaFile}
                </a>
                .
              </>
            ) : (
              <>
                Gestion opérationnelle — recherche, export et fiche détail.{" "}
                <a href={config.justiciaUrl} target="_blank" rel="noreferrer">
                  {config.justiciaFile}
                </a>
                {source === "api" ? " · source API" : " · cache local"}
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate(config.createPath)}>
          + Ajouter
        </button>
      </div>

      {showAnalytics ? (
        <>
          <div className="eg-filter-bar no-print" style={{ marginBottom: "0.75rem" }}>
            <label className="muted small" htmlFor={`month-stat-${config.slug}`}>
              Filtrer par mois :
            </label>
            <select
              id={`month-stat-${config.slug}`}
              className="form-control"
              style={{ marginBottom: 0, width: "auto", minWidth: 140 }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="">Tous les mois</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <SimpleStatBlocks
            title={config.listTitle}
            items={[
              { label: "TOTAL GÉNÉRAL", value: totalGeneral, color: rdcColor(0) },
              { label: "BROUILLONS", value: draftsCount, color: rdcColor(3) },
              { label: "VALIDÉS", value: counted.length, color: rdcColor(1) },
              {
                label: monthFilter ? `MOIS ${monthFilter}` : "FILTRÉS (MOIS)",
                value: countedFiltered.length,
                color: rdcColor(2),
              },
            ]}
          />

          <div className="eg-charts-row">
            <PieChart
              title={breakdownField ? `Répartition (${breakdownField.label})` : "Répartition"}
              data={pieBreakdown}
            />
            <BarChart
              title="Histogramme mensuel"
              data={
                monthBars.length
                  ? monthBars
                  : [{ label: "—", value: 0, color: COLORS[0] }]
              }
            />
          </div>
        </>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <label className="muted small" htmlFor={`search-${config.slug}`}>
              Search:
            </label>
            <input
              id={`search-${config.slug}`}
              className="form-control"
              style={{ marginBottom: 0, minWidth: 220 }}
              placeholder={config.searchHint}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filtrer par mois"
            >
              <option value="">Tous les mois</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void refresh()}>
              Actualiser
            </button>
          </div>
          <DataToolbar filename={`manage_${config.slug}`} rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Photo</th>
                <th>{actRefLabel(config.actType)}</th>
                {primary ? <th>{primary.label}</th> : null}
                {secondary ? <th>{secondary.label}</th> : null}
                {tertiary ? <th>{tertiary.label}</th> : null}
                <th>Statut</th>
                <th>Enregistré le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Aucun enregistrement. Cliquez « + Ajouter » pour créer.
                  </td>
                </tr>
              ) : (
                pageRows.map((a, i) => {
                  const person = a.national_id ? getPersonByNic(a.national_id) : undefined;
                  const label = subjectLabel(a, config);
                  return (
                    <tr key={a.id}>
                      <td>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td>
                        {person?.photo_data_url ? (
                          <img src={person.photo_data_url} alt="" className="eg-avatar-sm" />
                        ) : (
                          <span className="eg-avatar-sm eg-avatar-empty" aria-hidden>
                            {label.slice(0, 1)}
                          </span>
                        )}
                      </td>
                      <td>{a.act_number}</td>
                      {primary ? <td>{cell(a, primary.key)}</td> : null}
                      {secondary ? <td>{cell(a, secondary.key)}</td> : null}
                      {tertiary ? <td>{cell(a, tertiary.key)}</td> : null}
                      <td>{a.status ?? "—"}</td>
                      <td>{new Date(a.created_at).toLocaleString("fr-CD")}</td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="btn-add btn-sm"
                          onClick={() => setViewAct(getAct(a.id) ?? a)}
                        >
                          Voir
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setViewAct(getAct(a.id) ?? a)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          title="Les actes validés se rectifient via Corrections"
                          onClick={() => navigate("/corrections")}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="eg-pager">
          <span className="muted small">
            Showing {rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length} entries
          </span>
          <div className="eg-pager-btns">
            <button type="button" className="btn-secondary btn-sm" disabled={safePage <= 1} onClick={() => setPage(1)}>
              «
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span className="eg-pager-num">
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage(pageCount)}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <ActWorkflowPanel
              act={viewAct}
              summaryFields={config.summaryFields}
              onClose={() => setViewAct(null)}
              onUpdated={(a) => {
                upsertActsFromApi([
                  {
                    id: a.id,
                    act_type: a.type,
                    act_number: a.act_number,
                    status: a.status ?? "DRAFT",
                    payload: a.payload,
                    created_at: a.created_at,
                    verification_code:
                      typeof a.payload.verification_code === "string"
                        ? a.payload.verification_code
                        : null,
                  },
                ]);
                setViewAct(a);
                setTick((n) => n + 1);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
