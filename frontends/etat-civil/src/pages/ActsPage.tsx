import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ActWorkflowPanel from "../components/ActWorkflowPanel";
import ActsDocsNav from "../components/ActsDocsNav";
import { BarChart, PieChart } from "../components/Charts";
import DataToolbar from "../components/DataToolbar";
import { SimpleStatBlocks } from "../components/StatBlocks";
import { api } from "../api";
import { getSession } from "../auth";
import {
  actRefLabel,
  actTypeLabel,
  getAct,
  getPersonByNic,
  isActCountedInTotals,
  listActs,
  updateAct,
  upsertActsFromApi,
  type Act,
  type ActType,
} from "../registry";
import { RDC_CHART_SERIES, rdcColor } from "../rdcColors";

const TYPES: Array<ActType | ""> = [
  "",
  "BIRTH",
  "DEATH",
  "MARRIAGE",
  "ADOPTION",
  "DIVORCE",
  "DOCUMENT",
];

const API_KINDS = ["births", "deaths", "marriages", "divorces", "adoptions", "recognitions", "rectifications"] as const;

const PAGE_SIZE = 10;
const COLORS = RDC_CHART_SERIES;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  UNDER_REVIEW: "En révision",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
  RECORDED: "Enregistré",
};

function displayActStatus(a: Act): string {
  // Recensement : jamais « Brouillon » civil — même si ancien cache local en DRAFT.
  if (a.type === "CENSUS") {
    const raw = (a.status || "RECORDED").toUpperCase();
    if (raw === "DRAFT" || !a.status) return "Enregistré (hors workflow civil)";
    if (raw === "RECORDED") return "Enregistré (hors workflow civil)";
    return STATUS_LABEL[raw] ?? "Enregistré (hors workflow civil)";
  }
  const raw = (a.status || "").toUpperCase();
  if (raw && STATUS_LABEL[raw]) return STATUS_LABEL[raw];
  return "Brouillon";
}

export default function ActsPage({ showAnalytics = false }: { showAnalytics?: boolean }) {
  const navigate = useNavigate();
  const session = getSession();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ActType | "">("");
  const [statusFocus, setStatusFocus] = useState<"all" | "drafts" | "validated">("all");
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    // Anciens CEN- locaux restés en DRAFT → Enregistré (hors workflow).
    for (const a of listActs()) {
      if (a.type === "CENSUS" && (!a.status || a.status.toUpperCase() === "DRAFT")) {
        updateAct(a.id, { status: "RECORDED" });
      }
    }
    if (!session?.accessToken) {
      setTick((n) => n + 1);
      return;
    }
    try {
      const batches = await Promise.all(
        API_KINDS.map((kind) => api.listActs(kind).catch(() => [])),
      );
      upsertActsFromApi(batches.flat());
    } catch {
      /* keep cache */
    }
    setTick((n) => n + 1);
  }, [session?.accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runServerSearch() {
    if (!session?.accessToken || !q.trim()) {
      await refresh();
      return;
    }
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (filter) params.set("type", filter);
      const rows = await api.searchActs(params);
      upsertActsFromApi(rows);
      setTick((n) => n + 1);
    } catch {
      setTick((n) => n + 1);
    }
  }

  const all = useMemo(() => listActs(), [tick]);
  const counted = useMemo(() => all.filter(isActCountedInTotals), [all]);

  function monthKey(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

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

  const draftStatuses = useMemo(
    () =>
      new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PENDING_OFFICER", "CORRECTION_REQUIRED", ""]),
    [],
  );

  const acts = useMemo(() => {
    const base = (filter ? all.filter((a) => a.type === filter) : all).filter(
      (a) => a.type !== "CENSUS" && a.type !== "DISPLACEMENT",
    );
    return base.filter((a) => {
      if (monthFilter && monthKey(a.created_at) !== monthFilter) return false;
      const st = String(a.status ?? "DRAFT").toUpperCase().trim();
      if (statusFocus === "drafts" && !(draftStatuses.has(st) || !st)) return false;
      if (statusFocus === "validated" && !isActCountedInTotals(a)) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return `${a.act_number} ${a.national_id} ${a.type} ${a.status ?? ""} ${JSON.stringify(a.payload)}`
        .toLowerCase()
        .includes(needle);
    });
  }, [all, filter, q, monthFilter, statusFocus, draftStatuses]);

  const countedFiltered = useMemo(
    () =>
      counted.filter((a) => {
        if (monthFilter && monthKey(a.created_at) !== monthFilter) return false;
        return true;
      }),
    [counted, monthFilter],
  );

  useEffect(() => {
    const type = params.get("type");
    if (type && TYPES.includes(type as ActType)) {
      setFilter(type as ActType);
    }
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [filter, q, monthFilter, statusFocus]);

  useEffect(() => {
    const editId = params.get("edit");
    if (!editId) return;
    const act = getAct(editId);
    if (act) {
      setEditAct(act);
      setEditJson(JSON.stringify(act.payload, null, 2));
    }
    params.delete("edit");
    setParams(params, { replace: true });
  }, [params, setParams]);

  function saveEdit() {
    if (!editAct) return;
    try {
      const payload = JSON.parse(editJson) as Record<string, unknown>;
      updateAct(editAct.id, { payload });
      setEditAct(null);
      setTick((n) => n + 1);
      setError(null);
    } catch {
      setError("JSON invalide.");
    }
  }

  const pageCount = Math.max(1, Math.ceil(acts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = acts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of counted) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    return [...map.entries()].map(([type, value], i) => ({
      label: actTypeLabel(type as ActType),
      value,
      color: COLORS[i % COLORS.length],
    }));
  }, [counted]);

  const exportRows = acts.map((a) => ({
    act_number: a.act_number,
    type: a.type,
    status: a.status ?? "",
    created_at: a.created_at,
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Actes
          </p>
          <h2 className="page-title">{showAnalytics ? "Liste des actes" : "Actes"}</h2>
          <p className="page-lead">
            {showAnalytics
              ? "Vue statistique — totaux, brouillons en attente de validation, graphiques mensuels."
              : "Registre opérationnel — filtre par type, recherche, export et fiche détail. Déclarations santé = naissances/décès hôpital à valider. Transcriptions = reprise d’actes papier. Corrections = rectification d’état civil."}
          </p>
          <ActsDocsNav />
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/documents")}>
          + Document
        </button>
      </div>

      {showAnalytics ? (
        <>
          <div className="eg-filter-bar no-print" style={{ marginBottom: "0.75rem" }}>
            <label className="muted small" htmlFor="acts-month-stat">
              Filtrer par mois :
            </label>
            <select
              id="acts-month-stat"
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
            title="LISTE DES ACTES"
            items={[
              {
                label: "TOTAL GÉNÉRAL",
                value: all.filter((a) => !["CENSUS", "DISPLACEMENT"].includes(a.type)).length,
                color: rdcColor(0),
                onClick: () => setStatusFocus("all"),
                active: statusFocus === "all",
              },
              {
                label: "BROUILLONS",
                value: all.filter((a) => {
                  if (["CENSUS", "DISPLACEMENT"].includes(a.type)) return false;
                  const s = String(a.status ?? "DRAFT").toUpperCase();
                  return ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PENDING_OFFICER", "CORRECTION_REQUIRED", ""].includes(s);
                }).length,
                color: rdcColor(3),
                onClick: () => setStatusFocus((s) => (s === "drafts" ? "all" : "drafts")),
                active: statusFocus === "drafts",
              },
              {
                label: "VALIDÉS",
                value: counted.length,
                color: rdcColor(1),
                onClick: () => setStatusFocus((s) => (s === "validated" ? "all" : "validated")),
                active: statusFocus === "validated",
              },
              {
                label: monthFilter ? `MOIS ${monthFilter}` : "FILTRÉS (MOIS)",
                value: countedFiltered.length,
                color: rdcColor(2),
              },
            ]}
          />

          <div className="eg-charts-row">
            <PieChart
              title="Répartition par type (camembert)"
              data={byType.length ? byType : [{ label: "—", value: 0, color: COLORS[0] }]}
            />
            <BarChart
              title="Histogramme par type"
              data={byType.length ? byType : [{ label: "—", value: 0, color: COLORS[0] }]}
            />
          </div>
        </>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <label className="muted small" htmlFor="acts-search">
              Search:
            </label>
            <input
              id="acts-search"
              className="form-control"
              style={{ marginBottom: 0, minWidth: 180 }}
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runServerSearch();
              }}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => void runServerSearch()}>
              Chercher API
            </button>
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={filter}
              onChange={(e) => setFilter(e.target.value as ActType | "")}
            >
              <option value="">Tous types</option>
              {TYPES.filter(Boolean).map((t) => (
                <option key={t} value={t}>
                  {actTypeLabel(t as ActType)}
                </option>
              ))}
            </select>
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
          </div>
          <div className="toolbar" style={{ margin: 0, display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-primary btn-sm" onClick={() => navigate("/documents")}>
              Ajouter
            </button>
            <DataToolbar filename="tous_actes" rows={exportRows} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Photo</th>
                <th>{actRefLabel(filter || undefined)}</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Enregistré le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucun acte.
                  </td>
                </tr>
              ) : (
                pageRows.map((a, i) => {
                  const person = a.national_id ? getPersonByNic(a.national_id) : undefined;
                  return (
                    <tr key={a.id}>
                      <td>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td>
                        {person?.photo_data_url ? (
                          <img src={person.photo_data_url} alt="" className="eg-avatar-sm" />
                        ) : (
                          <span className="eg-avatar-sm eg-avatar-empty" aria-hidden>
                            {actTypeLabel(a.type).slice(0, 1)}
                          </span>
                        )}
                      </td>
                      <td>{a.act_number}</td>
                      <td>{actTypeLabel(a.type)}</td>
                      <td>{displayActStatus(a)}</td>
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
                          onClick={() => {
                            setEditAct(a);
                            setEditJson(JSON.stringify(a.payload, null, 2));
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          title="Rectification officielle"
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
            Showing {acts.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(safePage * PAGE_SIZE, acts.length)} of {acts.length} entries
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

      {editAct ? (
        <div className="modal-backdrop" onClick={() => setEditAct(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier l&apos;acte {editAct.act_number}</h3>
            {error ? <div className="login-error">{error}</div> : null}
            <textarea
              className="form-control code-area"
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditAct(null)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveEdit}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
