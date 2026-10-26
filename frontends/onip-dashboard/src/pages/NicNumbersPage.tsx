import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ninOnipApi,
  registryApi,
  type CitizenHit,
  type NinCatalog,
  type NinEligibleItem,
  type NinExceptionItem,
  type NinStatus,
} from "../api";
import { getSession, hasPermission } from "../auth";

/**
 * Module 7 — attribution / gestion NIN (provisoire).
 * Pas de bouton « NIN officiel » (générateur bloqué).
 */
export default function NicNumbersPage() {
  const session = getSession();
  const hasToken = Boolean(session?.accessToken);
  const canAssign = hasPermission("registry:citizen:validate", session);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [eligible, setEligible] = useState<NinEligibleItem[]>([]);
  const [log, setLog] = useState<
    Array<{ nic: string; citizen_id: string; issued_at?: string | null; algorithm_version: string }>
  >([]);
  const [catalog, setCatalog] = useState<NinCatalog | null>(null);
  const [exceptions, setExceptions] = useState<NinExceptionItem[]>([]);
  const [statusId, setStatusId] = useState("");
  const [statusResult, setStatusResult] = useState<NinStatus | null>(null);
  const [excCitizenId, setExcCitizenId] = useState("");
  const [excType, setExcType] = useState("MERGE_CONFLICT");
  const [excReason, setExcReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [chosenCitizenId, setChosenCitizenId] = useState("");
  const [chosenNin, setChosenNin] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);

  const load = useCallback(
    async (query?: string) => {
      if (!hasToken) return;
      setLoading(true);
      setError(null);
      try {
        const [res, el, hist, cat, exc] = await Promise.all([
          registryApi.searchCitizens(query?.trim() || undefined),
          ninOnipApi.eligible(40).catch(() => ({ items: [] as NinEligibleItem[] })),
          ninOnipApi.issuanceLog(30).catch(() => ({ items: [] })),
          ninOnipApi.catalog().catch(() => null),
          ninOnipApi.exceptions(30).catch(() => ({ items: [] as NinExceptionItem[] })),
        ]);
        setRows(res.items);
        setTotal(res.total);
        setEligible(el.items);
        setLog(hist.items);
        setCatalog(cat);
        setExceptions(exc.items);
      } catch (e) {
        setRows([]);
        setTotal(0);
        setError(e instanceof Error ? e.message : "Impossible de charger les NIC");
      } finally {
        setLoading(false);
      }
    },
    [hasToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q);
  }

  async function assignProvisional(citizenId: string, nin?: string) {
    setAssignMsg(null);
    try {
      const key = `onip-ui-${citizenId}-${Date.now()}`;
      const r = await ninOnipApi.assignProvisional(citizenId, key, nin);
      setAssignMsg(
        r.already_processed
          ? `Reprise idempotente : ${r.nin}`
          : r.already_assigned
            ? `Déjà attribué (idempotent) : ${r.nin}`
            : `NIC provisoire attribué : ${r.nin}`,
      );
      void load(q);
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "Attribution refusée");
    }
  }

  async function suggestChosen() {
    if (!chosenCitizenId.trim()) {
      setAssignMsg("Indiquez l’UUID du dossier citoyen.");
      return;
    }
    setSuggestBusy(true);
    setAssignMsg(null);
    try {
      const s = await ninOnipApi.suggest(chosenCitizenId.trim());
      setChosenNin(s.suggested_nin);
      setAssignMsg(
        s.already_assigned
          ? `Dossier a déjà le NIC ${s.suggested_nin}`
          : `Proposition : ${s.suggested_nin} — vous pouvez la modifier puis attribuer.`,
      );
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "Suggestion impossible");
    } finally {
      setSuggestBusy(false);
    }
  }

  async function assignChosen(e: FormEvent) {
    e.preventDefault();
    if (!canAssign) return;
    const id = chosenCitizenId.trim();
    const nin = chosenNin.replace(/\D/g, "");
    if (!id) {
      setAssignMsg("UUID citoyen requis.");
      return;
    }
    if (nin && nin.length !== 14) {
      setAssignMsg("Le NIN choisi doit contenir exactement 14 chiffres (ou laissez vide pour auto).");
      return;
    }
    await assignProvisional(id, nin || undefined);
  }

  async function lookupStatus(e: FormEvent) {
    e.preventDefault();
    setStatusResult(null);
    if (!statusId.trim()) return;
    try {
      setStatusResult(await ninOnipApi.status(statusId.trim()));
    } catch (err) {
      setAssignMsg(err instanceof Error ? err.message : "Statut indisponible");
    }
  }

  async function openException(e: FormEvent) {
    e.preventDefault();
    if (!canAssign) return;
    try {
      await ninOnipApi.openException({
        citizen_id: excCitizenId.trim(),
        exception_type: excType,
        reason: excReason.trim(),
      });
      setExcReason("");
      setAssignMsg("Exception NIN ouverte (audit — nic non modifié).");
      void load(q);
    } catch (err) {
      setAssignMsg(err instanceof Error ? err.message : "Ouverture exception refusée");
    }
  }

  async function closeException(id: string) {
    if (!canAssign) return;
    try {
      await ninOnipApi.decideException(
        id,
        "CLOSED",
        "Clôture manuelle ONIP — aucune mutation NIN",
      );
      setAssignMsg("Exception clôturée (Citizen.nic intact).");
      void load(q);
    } catch (err) {
      setAssignMsg(err instanceof Error ? err.message : "Décision refusée");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Module 7 — Numéros nationaux (NIC / NIN)</h1>
        <p>
          Service central d&apos;attribution. Mode <strong>provisoire</strong> uniquement. Voir{" "}
          <Link to="/conformite">Conformité FGP / NIN</Link>. Aucun bouton NIN officiel.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous pour consulter le registre.</p>
        </div>
      ) : (
        <>
          {catalog ? (
            <div className="panel" style={{ borderLeft: "4px solid #8a1c1c" }}>
              <h2 className="panel-title" style={{ marginTop: 0 }}>
                Catalogue service NIN
              </h2>
              <p className="muted small" style={{ marginBottom: 8 }}>
                {catalog.note}
              </p>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  Officiel confirmé :{" "}
                  <strong>{catalog.official_nin_format_confirmed ? "oui" : "non"}</strong>
                </li>
                <li>
                  Génération officielle :{" "}
                  <strong>{catalog.official_generation_enabled ? "activée" : "bloquée"}</strong>
                </li>
                <li>Offline / inventer NIN : interdits</li>
                <li>Algo provisoire : {catalog.provisional_algorithm}</li>
              </ul>
              {catalog.block_reason ? (
                <p className="small" style={{ marginTop: 8 }}>
                  {catalog.block_reason}
                </p>
              ) : null}
            </div>
          ) : null}

          {assignMsg ? (
            <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
              {assignMsg}
            </div>
          ) : null}

          <form className="panel" onSubmit={assignChosen}>
            <h2 className="panel-title" style={{ marginTop: 0 }}>
              NIN provisoire au choix (DEV)
            </h2>
            <p className="muted small">
              Tant que le format officiel n&apos;est pas confirmé : générez une proposition ou
              saisissez 14 chiffres, puis attribuez. Non officiel — usage démo / transition.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ flex: "1 1 260px" }}>
                UUID dossier citoyen
                <input
                  className="form-control"
                  value={chosenCitizenId}
                  onChange={(e) => setChosenCitizenId(e.target.value)}
                  placeholder="Identifiant interne FGP"
                  required
                />
              </label>
              <label style={{ flex: "1 1 180px" }}>
                NIN / NIC (14 chiffres)
                <input
                  className="form-control"
                  inputMode="numeric"
                  maxLength={14}
                  value={chosenNin}
                  onChange={(e) => setChosenNin(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="ex. 15001202001234"
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                disabled={!canAssign || suggestBusy}
                onClick={() => void suggestChosen()}
              >
                {suggestBusy ? "…" : "Générer une proposition"}
              </button>
              <button type="submit" className="btn-primary" disabled={!canAssign}>
                Attribuer ce NIN
              </button>
            </div>
          </form>

          <form className="panel" onSubmit={lookupStatus} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <h2 className="panel-title" style={{ flex: "1 1 100%", marginTop: 0 }}>
              Statut NIN (dossier)
            </h2>
            <input
              className="form-control"
              style={{ flex: "1 1 260px" }}
              placeholder="UUID citoyen (identifiant interne)"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Consulter
            </button>
            {statusResult ? (
              <div className="muted small" style={{ flex: "1 1 100%" }}>
                has_nin={String(statusResult.has_nin)} · statut={statusResult.nin_status ?? "—"} ·
                éligible_provisoire={String(statusResult.eligible_provisional)} · blocs=
                {(statusResult.block_codes || []).join(", ") || "aucun"} · NIC=
                {statusResult.nin ?? "—"}
              </div>
            ) : null}
          </form>

          <div className="panel">
            <h2 className="panel-title">Éligibles (sans NIC)</h2>
            <p className="muted small">
              Refus automatique si dossier incomplet ou doublon OPEN. Mode officiel indisponible.
              Attribution avec clé d&apos;idempotence.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Statut</th>
                  <th>Doublons</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun éligible listé.
                    </td>
                  </tr>
                ) : (
                  eligible.map((c) => (
                    <tr key={c.id}>
                      <td>{c.family_name}</td>
                      <td>{c.given_names}</td>
                      <td>{c.status}</td>
                      <td>{c.open_duplicates}</td>
                      <td>
                        {canAssign && c.eligible_provisional ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void assignProvisional(c.id)}
                          >
                            NIC provisoire
                          </button>
                        ) : (
                          <span className="muted small">
                            {c.eligible_provisional ? "Droit validate requis" : "Non éligible"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Exceptions NIN (audit)</h2>
            <p className="muted small">
              Collisions, fusions, décès, corrections — décision journalisée sans mutation automatique du
              numéro.
            </p>
            {canAssign ? (
              <form
                onSubmit={openException}
                style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
              >
                <input
                  className="form-control"
                  style={{ flex: "1 1 200px" }}
                  placeholder="UUID citoyen"
                  value={excCitizenId}
                  onChange={(e) => setExcCitizenId(e.target.value)}
                  required
                />
                <select
                  className="form-control"
                  value={excType}
                  onChange={(e) => setExcType(e.target.value)}
                >
                  {(catalog?.exception_types ?? ["MERGE_CONFLICT", "DEATH_REVIEW"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className="form-control"
                  style={{ flex: "2 1 240px" }}
                  placeholder="Motif (≥ 8 car.)"
                  value={excReason}
                  onChange={(e) => setExcReason(e.target.value)}
                  minLength={8}
                  required
                />
                <button type="submit" className="btn-secondary">
                  Ouvrir
                </button>
              </form>
            ) : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Citoyen</th>
                  <th>Statut</th>
                  <th>Motif</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucune exception ouverte.
                    </td>
                  </tr>
                ) : (
                  exceptions.map((x) => (
                    <tr key={x.id}>
                      <td>{x.exception_type}</td>
                      <td>
                        <code className="small">{x.citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td>{x.status}</td>
                      <td className="small">{x.reason}</td>
                      <td>
                        {canAssign && x.status === "PENDING" ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void closeException(x.id)}
                          >
                            Clôturer
                          </button>
                        ) : (
                          <span className="muted small">
                            {x.nic_mutated ? "!" : "nic intact"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Historique d&apos;émission</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Citoyen</th>
                  <th>Date</th>
                  <th>Algo</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucune émission journalisée.
                    </td>
                  </tr>
                ) : (
                  log.map((r, i) => (
                    <tr key={`${r.nic}-${i}`}>
                      <td>
                        <code className="nic-code">{r.nic}</code>
                      </td>
                      <td>
                        <code className="small">{r.citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td>{r.issued_at ? r.issued_at.slice(0, 19) : "—"}</td>
                      <td className="small">{r.algorithm_version}</td>
                      <td>PROVISIONAL</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form className="panel" onSubmit={onSearch} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="form-control"
              style={{ flex: "1 1 220px" }}
              placeholder="Rechercher nom, prénom ou NIC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "…" : "Rechercher"}
            </button>
          </form>

          {error ? (
            <div className="login-error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          ) : null}

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>
              Registre <span className="muted" style={{ fontWeight: 600 }}>({total})</span>
            </h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Naissance</th>
                  <th>Statut</th>
                  <th>NIN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code className="nic-code">{c.nic || "—"}</code>
                    </td>
                    <td>{c.family_name}</td>
                    <td>{c.given_names}</td>
                    <td>{c.date_of_birth}</td>
                    <td>{c.status}</td>
                    <td>{c.nic ? "PROVISIONAL" : "—"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucun citoyen trouvé.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
