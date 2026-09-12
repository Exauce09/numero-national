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
  actTypeLabel,
  getAct,
  getPersonByNic,
  listActs,
  updateAct,
  upsertActsFromApi,
  type Act,
  type ActType,
} from "../registry";

const TYPES: Array<ActType | ""> = [
  "",
  "BIRTH",
  "DEATH",
  "CENSUS",
  "MARRIAGE",
  "ADOPTION",
  "DISPLACEMENT",
  "DIVORCE",
  "DOCUMENT",
];

const API_KINDS = ["births", "deaths", "marriages", "divorces", "adoptions", "recognitions", "rectifications"] as const;

const PAGE_SIZE = 10;
const COLORS = ["#5d87ff", "#13deb9", "#fa896b", "#ffae1f", "#539bff", "#763ebd", "#49beff", "#fdd835"];

export default function ActsPage({ showAnalytics = false }: { showAnalytics?: boolean }) {
  const navigate = useNavigate();
  const session = getSession();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ActType | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
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

  const acts = useMemo(() => {
    const base = filter ? all.filter((a) => a.type === filter) : all;
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((a) =>
      `${a.act_number} ${a.national_id} ${a.type} ${a.status ?? ""} ${JSON.stringify(a.payload)}`
        .toLowerCase()
        .includes(needle),
    );
  }, [all, filter, q]);

  useEffect(() => {
    const type = params.get("type");
    if (type && TYPES.includes(type as ActType)) {
      setFilter(type as ActType);
    }
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [filter, q]);

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
    for (const a of all) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    return [...map.entries()].map(([type, value], i) => ({
      label: actTypeLabel(type as ActType),
      value,
      color: COLORS[i % COLORS.length],
    }));
  }, [all]);

  const docs = all.filter((a) => a.type === "DOCUMENT").length;

  const exportRows = acts.map((a) => ({
    act_number: a.act_number,
    type: a.type,
    national_id: a.national_id,
    created_at: a.created_at,
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Actes & documents
          </p>
          <h2 className="page-title">{showAnalytics ? "Liste des actes & documents" : "Actes & documents"}</h2>
          <p className="page-lead">
            {showAnalytics
              ? "Vue statistique depuis le tableau de bord — camembert, histogramme, recherche et pagination."
              : "Registre opérationnel — filtre par type, recherche, export et fiche détail. Déclarations santé = naissances/décès hôpital à valider. Transcriptions = reprise d’actes papier. Corrections = rectification d’état civil. Vérifier document = contrôle d’authenticité."}
          </p>
          <ActsDocsNav />
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/documents")}>
          + Document
        </button>
      </div>

      {showAnalytics ? (
        <>
          <SimpleStatBlocks
            title="LISTE DES ACTES & DOCUMENTS"
            items={[
              { label: "TOTAL ACTES", value: all.length, color: "#5d87ff" },
              { label: "DOCUMENTS", value: docs, color: "#13deb9" },
              { label: "AUTRES ACTES", value: all.length - docs, color: "#ffae1f" },
              { label: "FILTRÉS", value: acts.length, color: "#fa896b" },
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
          </div>
          <DataToolbar filename="tous_actes" rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Photo</th>
                <th>N° acte</th>
                <th>Type</th>
                <th>Num. national</th>
                <th>Statut</th>
                <th>Enregistré le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
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
                      <td>
                        <code>{a.national_id || "—"}</code>
                      </td>
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
                          onClick={() => {
                            setEditAct(a);
                            setEditJson(JSON.stringify(a.payload, null, 2));
                          }}
                        >
                          Modifier
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
