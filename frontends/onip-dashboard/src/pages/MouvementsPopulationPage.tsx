import { FormEvent, useEffect, useState } from "react";
import {
  biometricApi,
  movementsApi,
  registryApi,
  type CitizenHit,
  type MovementOut,
  type MovementsCatalog,
  type MovementStats,
} from "../api";
import { getSession } from "../auth";
import { captureZkFingerprint, zkHealth } from "../zkBridge";

const TYPE_LABELS: Record<string, string> = {
  CHANGE_OF_RESIDENCE: "Changement de résidence",
  INTERNAL_MIGRATION: "Migration interne",
  TEMPORARY_MOBILITY: "Mobilité temporaire",
  FORCED_DISPLACEMENT: "Déplacement forcé",
  RETURN_RESETTLEMENT: "Retour / réinstallation",
  INTERNATIONAL: "International",
  COLLECTIVE: "Collectif",
};

type LookupMode = "nin" | "name" | "finger" | "photo";

type SelectedCitizen = {
  id: string;
  nic: string | null;
  label: string;
  via: LookupMode;
};

function citizenLabel(c: Pick<CitizenHit, "family_name" | "given_names" | "post_name" | "nic">): string {
  const name = [c.given_names, c.family_name, c.post_name].filter(Boolean).join(" ");
  return c.nic ? `${name} · NIN ${c.nic}` : name || "Citoyen FGP";
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function MouvementsPopulationPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [catalog, setCatalog] = useState<MovementsCatalog | null>(null);
  const [stats, setStats] = useState<MovementStats | null>(null);
  const [items, setItems] = useState<MovementOut[]>([]);
  const [citizenLabels, setCitizenLabels] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lookupMode, setLookupMode] = useState<LookupMode>("nin");
  const [ninQuery, setNinQuery] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [givenNames, setGivenNames] = useState("");
  const [hits, setHits] = useState<CitizenHit[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [selected, setSelected] = useState<SelectedCitizen | null>(null);

  const [movementType, setMovementType] = useState("CHANGE_OF_RESIDENCE");
  const [destCity, setDestCity] = useState("");
  const [destLine1, setDestLine1] = useState("");
  const [destProvince, setDestProvince] = useState("");
  const [updateFgp, setUpdateFgp] = useState(true);
  const [notes, setNotes] = useState("");

  async function resolveCitizenLabels(rows: MovementOut[]) {
    const ids = [...new Set(rows.map((r) => r.citizen_id))];
    const missing = ids.filter((id) => !citizenLabels[id]);
    if (missing.length === 0) return;
    const next: Record<string, string> = {};
    await Promise.all(
      missing.slice(0, 40).map(async (id) => {
        try {
          const c = await registryApi.getCitizen(id);
          next[id] = citizenLabel(c);
        } catch {
          next[id] = id.slice(0, 8) + "…";
        }
      }),
    );
    setCitizenLabels((prev) => ({ ...prev, ...next }));
  }

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
      void resolveCitizenLabels(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement mouvements impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken, statusFilter]);

  function pickCitizen(c: CitizenHit, via: LookupMode) {
    const sel: SelectedCitizen = {
      id: c.id,
      nic: c.nic,
      label: citizenLabel(c),
      via,
    };
    setSelected(sel);
    setCitizenLabels((prev) => ({ ...prev, [c.id]: sel.label }));
    setHits([]);
    setMsg(`Citoyen sélectionné : ${sel.label}`);
  }

  async function searchByNin(e: FormEvent) {
    e.preventDefault();
    setLookupBusy(true);
    setError(null);
    setHits([]);
    try {
      const nic = ninQuery.replace(/\D/g, "").trim();
      if (nic.length < 8) throw new Error("Saisissez un NIN / NIC (chiffres).");
      const res = await registryApi.searchCitizens({ nic, page_size: 20 });
      if (res.items.length === 1) {
        pickCitizen(res.items[0], "nin");
      } else if (res.items.length === 0) {
        setError("Aucun citoyen FGP pour ce NIN.");
      } else {
        setHits(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche NIN impossible");
    } finally {
      setLookupBusy(false);
    }
  }

  async function searchByName(e: FormEvent) {
    e.preventDefault();
    setLookupBusy(true);
    setError(null);
    setHits([]);
    try {
      if (!familyName.trim() && !givenNames.trim()) {
        throw new Error("Indiquez au moins le nom ou le prénom.");
      }
      const res = await registryApi.searchCitizens({
        family_name: familyName.trim() || undefined,
        given_names: givenNames.trim() || undefined,
        page_size: 30,
      });
      if (res.items.length === 0) setError("Aucun citoyen trouvé pour ce nom.");
      else if (res.items.length === 1) pickCitizen(res.items[0], "name");
      else setHits(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche nominative impossible");
    } finally {
      setLookupBusy(false);
    }
  }

  async function identifyByFinger() {
    setLookupBusy(true);
    setError(null);
    setHits([]);
    try {
      const health = await zkHealth();
      if (!health?.sdk_loaded || (health.device_count ?? 0) < 1) {
        throw new Error(
          "Capteur ZK9500 indisponible — lancez scripts/start-zkteco-bridge.ps1 et branchez le lecteur.",
        );
      }
      setMsg("Posez le doigt à plat sur le ZK9500…");
      const zk = await captureZkFingerprint("INDEX_DROIT", 30000);
      const idRes = await biometricApi.identify({
        modality: "FINGERPRINT",
        template_b64: zk.template_b64,
        max_candidates: 5,
      });
      if (!idRes.candidates.length) {
        setError("Aucune correspondance empreinte. Vérifiez l’enrôlement biométrique FGP.");
        setMsg(null);
        return;
      }
      const resolved: CitizenHit[] = [];
      for (const cand of idRes.candidates) {
        try {
          const c = await registryApi.getCitizen(cand.citizen_id);
          resolved.push(c);
        } catch {
          /* skip */
        }
      }
      if (resolved.length === 1) pickCitizen(resolved[0], "finger");
      else if (resolved.length > 1) {
        setHits(resolved);
        setMsg(`${resolved.length} candidats empreinte — choisissez la personne.`);
      } else {
        setError("Match biométrique sans dossier FGP lisible.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identification empreinte refusée");
      setMsg(null);
    } finally {
      setLookupBusy(false);
    }
  }

  async function identifyByPhoto(file: File | null) {
    if (!file) return;
    setLookupBusy(true);
    setError(null);
    setHits([]);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Fichier image requis (photo visage).");
      if (file.size > 4_000_000) throw new Error("Image trop lourde (max 4 Mo).");
      const b64 = await fileToBase64(file);
      const idRes = await biometricApi.identify({
        modality: "FACE",
        template_b64: b64,
        max_candidates: 5,
      });
      if (!idRes.candidates.length) {
        setError(
          "Aucune reconnaissance faciale. Le visage doit être déjà enregistré en biométrie FACE, ou utilisez NIN / nom / empreinte.",
        );
        return;
      }
      const resolved: CitizenHit[] = [];
      for (const cand of idRes.candidates) {
        try {
          resolved.push(await registryApi.getCitizen(cand.citizen_id));
        } catch {
          /* skip */
        }
      }
      if (resolved.length === 1) pickCitizen(resolved[0], "photo");
      else if (resolved.length > 1) {
        setHits(resolved);
        setMsg(`${resolved.length} candidats photo — choisissez la personne.`);
      } else {
        setError("Match visage sans dossier FGP lisible.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconnaissance photo refusée");
    } finally {
      setLookupBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!selected?.id) {
      setError("Identifiez d’abord le citoyen (NIN, nom, empreinte ou photo).");
      return;
    }
    try {
      const created = await movementsApi.create({
        citizen_id: selected.id,
        movement_type: movementType,
        destination_city: destCity.trim() || null,
        destination_line1: destLine1.trim() || null,
        destination_province_code: destProvince.trim().toUpperCase() || null,
        update_fgp_residence: updateFgp,
        notes_minimal: notes.trim() || null,
        submit: true,
      });
      setMsg(`Mouvement créé (${created.status}) pour ${selected.label}`);
      setSelected(null);
      setNotes("");
      setNinQuery("");
      setFamilyName("");
      setGivenNames("");
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
          Identifiez le citoyen FGP par NIN, nom, empreinte ou photo — aucun UUID à saisir. Aucun NIN
          inventé ni modifié.
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
            </div>
          ) : null}

          {stats ? (
            <div className="panel">
              <h2 className="panel-title">Synthèse</h2>
              <p className="muted small">
                Total {stats.total} · En file {stats.pending_review} · Validés {stats.validated} · MAJ
                FGP {stats.fgp_residence_updates}
              </p>
            </div>
          ) : null}

          {msg ? (
            <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
              {msg}
            </div>
          ) : null}
          {error ? <div className="login-error">{error}</div> : null}

          <div className="panel">
            <h2 className="panel-title">1. Identifier le citoyen FGP</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {(
                [
                  ["nin", "NIN / NIC"],
                  ["name", "Nom"],
                  ["finger", "Empreinte"],
                  ["photo", "Photo / visage"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={lookupMode === mode ? "btn-primary" : "btn-secondary"}
                  onClick={() => {
                    setLookupMode(mode);
                    setHits([]);
                    setError(null);
                  }}
                  disabled={lookupBusy}
                >
                  {label}
                </button>
              ))}
            </div>

            {lookupMode === "nin" ? (
              <form onSubmit={(e) => void searchByNin(e)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: "1 1 220px" }}
                  value={ninQuery}
                  onChange={(e) => setNinQuery(e.target.value)}
                  placeholder="NIN / NIC (chiffres)"
                  inputMode="numeric"
                />
                <button type="submit" className="btn-primary" disabled={lookupBusy}>
                  {lookupBusy ? "…" : "Rechercher"}
                </button>
              </form>
            ) : null}

            {lookupMode === "name" ? (
              <form onSubmit={(e) => void searchByName(e)} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
                <input
                  className="form-control"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Nom de famille"
                />
                <input
                  className="form-control"
                  value={givenNames}
                  onChange={(e) => setGivenNames(e.target.value)}
                  placeholder="Prénom(s)"
                />
                <button type="submit" className="btn-primary" disabled={lookupBusy}>
                  {lookupBusy ? "…" : "Rechercher"}
                </button>
              </form>
            ) : null}

            {lookupMode === "finger" ? (
              <div>
                <p className="muted small">Capture live ZK9500 → identification 1:N biométrique.</p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={lookupBusy}
                  onClick={() => void identifyByFinger()}
                >
                  {lookupBusy ? "Capture…" : "Capturer l’empreinte"}
                </button>
              </div>
            ) : null}

            {lookupMode === "photo" ? (
              <div>
                <p className="muted small">
                  Photo ou reconnaissance faciale (modalité FACE déjà enrôlée). Sinon utilisez NIN /
                  nom / empreinte.
                </p>
                <input
                  className="form-control"
                  type="file"
                  accept="image/*"
                  capture="user"
                  disabled={lookupBusy}
                  onChange={(e) => void identifyByPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}

            {selected ? (
              <div
                className="panel"
                style={{ marginTop: 12, borderLeft: "4px solid #1a7f37", marginBottom: 0 }}
              >
                <strong>Sélectionné</strong>
                <div>{selected.label}</div>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  Via {selected.via}
                  {selected.nic ? ` · NIN ${selected.nic}` : " · sans NIN"}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => setSelected(null)}
                >
                  Changer de personne
                </button>
              </div>
            ) : null}

            {hits.length > 0 ? (
              <table className="data-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>NIN</th>
                    <th>Naissance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {[c.given_names, c.family_name, c.post_name].filter(Boolean).join(" ")}
                      </td>
                      <td>
                        <code className="small">{c.nic || "—"}</code>
                      </td>
                      <td className="small">{c.date_of_birth}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => pickCitizen(c, lookupMode)}
                        >
                          Choisir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          <form className="panel" onSubmit={(e) => void onCreate(e)}>
            <h2 className="panel-title">2. Déclarer le mouvement</h2>
            {!selected ? (
              <p className="muted small">Sélectionnez un citoyen ci-dessus avant de déclarer.</p>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              }}
            >
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
            <label
              className="small"
              style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}
            >
              <input
                type="checkbox"
                checked={updateFgp}
                onChange={(e) => setUpdateFgp(e.target.checked)}
              />
              Demander MAJ résidence FGP après validation (hors mobilité temporaire / PDI)
            </label>
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={loading || !selected}>
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
              <button
                type="button"
                className="btn-primary"
                onClick={() => void refresh()}
                disabled={loading}
              >
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
                      <td className="small">{citizenLabels[m.citizen_id] || "…"}</td>
                      <td className="small">
                        {[m.destination_city, m.destination_line1].filter(Boolean).join(" · ") ||
                          "—"}
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
