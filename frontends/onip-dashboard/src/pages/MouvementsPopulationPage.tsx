import { FormEvent, useEffect, useState } from "react";
import {
  movementsApi,
  type MovementOut,
  type MovementsCatalog,
  type MovementStats,
} from "../api";
import { getSession } from "../auth";

const TYPE_LABELS: Record<string, string> = {
  CHANGE_OF_RESIDENCE: "Changement de résidence",
  INTERNAL_MIGRATION: "Migration interne",
  TEMPORARY_MOBILITY: "Mobilité temporaire",
  FORCED_DISPLACEMENT: "Déplacement forcé",
  RETURN_RESETTLEMENT: "Retour / réinstallation",
  INTERNATIONAL: "International",
  COLLECTIVE: "Collectif",
};

export default function MouvementsPopulationPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [catalog, setCatalog] = useState<MovementsCatalog | null>(null);
  const [stats, setStats] = useState<MovementStats | null>(null);
  const [items, setItems] = useState<MovementOut[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [citizenId, setCitizenId] = useState("");
  const [movementType, setMovementType] = useState("CHANGE_OF_RESIDENCE");
  const [destCity, setDestCity] = useState("");
  const [destLine1, setDestLine1] = useState("");
  const [destProvince, setDestProvince] = useState("");
  const [updateFgp, setUpdateFgp] = useState(true);
  const [notes, setNotes] = useState("");

  async function refresh() {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, st, list] = await Promise.all([
        movementsApi.catalog(),
        movementsApi.stats(),
        movementsApi.list({
          page_size: 50,
          status: statusFilter || undefined,
        }),
      ]);
      setCatalog(cat);
      setStats(st);
      setItems(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement mouvements impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken, statusFilter]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const created = await movementsApi.create({
        citizen_id: citizenId.trim(),
        movement_type: movementType,
        destination_city: destCity.trim() || null,
        destination_line1: destLine1.trim() || null,
        destination_province_code: destProvince.trim().toUpperCase() || null,
        update_fgp_residence: updateFgp,
        notes_minimal: notes.trim() || null,
        submit: true,
      });
      setMsg(`Mouvement créé (${created.status}) — id ${created.id}`);
      setCitizenId("");
      setNotes("");
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création refusée");
    }
  }

  async function doReview(id: string, decision: "IN_REVIEW" | "COMPLEMENT_REQUIRED" | "REJECTED") {
    try {
      await movementsApi.review(id, {
        decision,
        reason:
          decision === "IN_REVIEW"
            ? "Prise en charge vérification ONIP"
            : decision === "REJECTED"
              ? "Rejet après contrôle — données insuffisantes"
              : "Complément d'information requis",
      });
      setMsg(`Décision ${decision} enregistrée`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revue refusée");
    }
  }

  async function doApprove(id: string) {
    try {
      const out = await movementsApi.approve(id, {
        reason: "Validation ONIP — effet FGP selon règles",
      });
      setMsg(
        out.fgp_residence_applied
          ? "Validé — résidence FGP mise à jour"
          : "Validé — sans modification FGP",
      );
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approbation refusée");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Module 12 — Mouvements de population</h1>
        <p>
          Événements de mobilité liés au FGP. Aucun NIN inventé ni modifié. Résidence de référence
          mise à jour uniquement après validation autorisée.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          {catalog ? (
            <div className="panel" style={{ borderLeft: "4px solid #8a1c1c" }}>
              <h2 className="panel-title" style={{ marginTop: 0 }}>
                Garde-fous
              </h2>
              <p className="muted small">{catalog.note}</p>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Inventer / modifier NIN : interdit</li>
                <li>Identité parallèle : interdite</li>
                <li>Suivi GPS : interdit</li>
                <li>Inférence PDI automatique : interdite</li>
                <li>
                  MAJ résidence FGP :{" "}
                  {catalog.fgp_residence_only_after_validation
                    ? "après validation seulement"
                    : "libre"}
                </li>
              </ul>
            </div>
          ) : null}

          {stats ? (
            <div className="panel">
              <h2 className="panel-title">Synthèse</h2>
              <p className="muted small">
                Total {stats.total} · En file {stats.pending_review} · Validés {stats.validated} ·
                MAJ FGP {stats.fgp_residence_updates}
              </p>
            </div>
          ) : null}

          {msg ? (
            <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
              {msg}
            </div>
          ) : null}
          {error ? <div className="login-error">{error}</div> : null}

          <form className="panel" onSubmit={onCreate}>
            <h2 className="panel-title">Déclarer un mouvement</h2>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <label className="small">
                Citoyen FGP (UUID)
                <input
                  className="form-control"
                  required
                  value={citizenId}
                  onChange={(e) => setCitizenId(e.target.value)}
                  placeholder="uuid citoyen"
                />
              </label>
              <label className="small">
                Type
                <select
                  className="form-control"
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                >
                  {Object.entries(TYPE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="small">
                Province destination
                <input
                  className="form-control"
                  value={destProvince}
                  onChange={(e) => setDestProvince(e.target.value)}
                  placeholder="ex. KIN"
                />
              </label>
              <label className="small">
                Ville destination
                <input
                  className="form-control"
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                />
              </label>
              <label className="small">
                Avenue / ligne 1
                <input
                  className="form-control"
                  value={destLine1}
                  onChange={(e) => setDestLine1(e.target.value)}
                />
              </label>
              <label className="small">
                Notes
                <input
                  className="form-control"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                />
              </label>
            </div>
            <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <input
                type="checkbox"
                checked={updateFgp}
                onChange={(e) => setUpdateFgp(e.target.checked)}
              />
              Demander MAJ résidence FGP après validation (hors mobilité temporaire / PDI)
            </label>
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                Créer et soumettre
              </button>
            </div>
          </form>

          <div className="panel">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>
                File des mouvements
              </h2>
              <select
                className="form-control"
                style={{ maxWidth: 220 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="SUBMITTED">Soumis</option>
                <option value="IN_REVIEW">En vérification</option>
                <option value="COMPLEMENT_REQUIRED">Complément</option>
                <option value="VALIDATED">Validé</option>
                <option value="REJECTED">Rejeté</option>
              </select>
              <button type="button" className="btn-primary" onClick={() => void refresh()} disabled={loading}>
                {loading ? "…" : "Actualiser"}
              </button>
            </div>
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Citoyen</th>
                  <th>Destination</th>
                  <th>FGP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucun mouvement.
                    </td>
                  </tr>
                ) : (
                  items.map((m) => (
                    <tr key={m.id}>
                      <td>{TYPE_LABELS[m.movement_type] || m.movement_type}</td>
                      <td>{m.status}</td>
                      <td>
                        <code className="small">{m.citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td className="small">
                        {[m.destination_city, m.destination_line1].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="small">
                        {m.fgp_residence_applied
                          ? "appliqué"
                          : m.update_fgp_residence
                            ? "demandé"
                            : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {m.status === "SUBMITTED" ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void doReview(m.id, "IN_REVIEW")}
                            >
                              Prendre en charge
                            </button>
                          ) : null}
                          {m.status === "IN_REVIEW" ? (
                            <>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => void doApprove(m.id)}
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void doReview(m.id, "COMPLEMENT_REQUIRED")}
                              >
                                Complément
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void doReview(m.id, "REJECTED")}
                              >
                                Rejeter
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
