import { FormEvent, useEffect, useState } from "react";
import {
  biometricApi,
  registryApi,
  cardsApi,
  type CardsCatalog,
  type CardRequestItem,
  type CinEligibility,
  type CitizenHit,
  type NationalCard,
} from "../api";
import { getSession } from "../auth";
import { captureZkFingerprint, zkHealth } from "../zkBridge";
import IdCardRdc, { printNationalIdCard } from "./IdCardRdc";

/** Module 9 — CIN : demandes, admissibilité, prototype (pas de NIN inventé). */
export default function CardsPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [selected, setSelected] = useState<CitizenHit | null>(null);
  const [card, setCard] = useState<NationalCard | null>(null);
  const [catalog, setCatalog] = useState<CardsCatalog | null>(null);
  const [eligibility, setEligibility] = useState<CinEligibility | null>(null);
  const [requests, setRequests] = useState<CardRequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fingerBusy, setFingerBusy] = useState(false);

  useEffect(() => {
    if (!hasToken) return;
    void cardsApi.catalog().then(setCatalog).catch(() => setCatalog(null));
    void cardsApi
      .listRequests(30)
      .then((r) => setRequests(r.items))
      .catch(() => setRequests([]));
  }, [hasToken]);

  async function searchByFingerprint() {
    if (!hasToken) return;
    setFingerBusy(true);
    setError(null);
    setOk(null);
    try {
      const healthZk = await zkHealth();
      if (!healthZk?.sdk_loaded || (healthZk.device_count ?? 0) < 1) {
        throw new Error("Capteur ZK9500 indisponible — lancez le pont EngX.");
      }
      const zk = await captureZkFingerprint("INDEX_DROIT", 30000);
      const idRes = await biometricApi.identify({
        modality: "FINGERPRINT",
        template_b64: zk.template_b64,
        max_candidates: 10,
      });
      if (!idRes.candidates.length) {
        setRows([]);
        setError("Aucune correspondance empreinte.");
        return;
      }
      const found: CitizenHit[] = [];
      for (const cand of idRes.candidates) {
        try {
          found.push(await registryApi.getCitizen(cand.citizen_id));
        } catch {
          /* skip */
        }
      }
      setRows(found);
      setOk(`${found.length} citoyen(s) via empreinte.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche empreinte impossible");
      setRows([]);
    } finally {
      setFingerBusy(false);
    }
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!hasToken) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await registryApi.searchCitizens(q.trim() || undefined);
      setRows(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  async function pickCitizen(c: CitizenHit) {
    setSelected(c);
    setCard(null);
    setEligibility(null);
    setError(null);
    setOk(null);
    try {
      const [existing, elig] = await Promise.all([
        cardsApi.getByCitizen(c.id).catch(() => null),
        cardsApi.eligibility(c.id).catch(() => null),
      ]);
      setCard(existing);
      setEligibility(elig);
    } catch {
      setCard(null);
    }
  }

  async function createRequest() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await cardsApi.createRequest(
        selected.id,
        "FIRST_ISSUE",
        `cin-${selected.id}-${Date.now()}`,
      );
      setOk(
        r.already_processed
          ? `Demande déjà connue (${r.status})`
          : `Demande ${r.status} — ${r.block_reason || "admissible pour parcours prototype"}`,
      );
      const list = await cardsApi.listRequests(30);
      setRequests(list.items);
      setEligibility(await cardsApi.eligibility(selected.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demande impossible");
    } finally {
      setBusy(false);
    }
  }

  async function generateCard() {
    if (!selected) return;
    if (!selected.nic) {
      setError("Attribuez d’abord un NIC (module NIN) — le module CIN n’invente pas de NIN.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const issued = await cardsApi.issueAndActivate(selected.id);
      setCard(issued);
      const commune = issued.commune_name || issued.commune_code || "la commune";
      setOk(
        issued.routing_message ||
          `Carte prototype émise — retournée à la commune de ${commune} pour livraison.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Émission impossible");
    } finally {
      setBusy(false);
    }
  }

  function printCard() {
    printNationalIdCard("nn-id-card-print");
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Module 9 — Carte d&apos;identité nationale (CIN)</h1>
        <p>
          Demande, admissibilité, personnalisation prototype et remise commune. Le module CIN n&apos;attribue
          jamais de NIN.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Gabarit CIN prototype (non homologué). Le NIN attribué par le service central est
          officiel ; la production physique reste soumise à l&apos;admissibilité dossier / NIC.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous avec un compte admin pour émettre des cartes.</p>
        </div>
      ) : (
        <>
          {catalog ? (
            <div className="panel" style={{ borderLeft: "4px solid #8a1c1c" }}>
              <h2 className="panel-title" style={{ marginTop: 0 }}>
                Catalogue CIN
              </h2>
              <p className="muted small">{catalog.note}</p>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  Gabarit homologué :{" "}
                  <strong>{catalog.template_approved ? "oui" : "non (prototype)"}</strong>
                </li>
                <li>Version : {catalog.template_version}</li>
                <li>
                  NIN officiel confirmé :{" "}
                  {catalog.official_nin_format_confirmed ? "oui" : "non"}
                </li>
                <li>MRZ officielle : {catalog.official_mrz_forbidden ? "interdite / hors lot" : "ok"}</li>
              </ul>
            </div>
          ) : null}

          <form
            className="panel"
            onSubmit={(e) => void search(e)}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="form-control"
              style={{ flex: "1 1 240px" }}
              placeholder="Nom, prénom ou NIN…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "…" : "Rechercher"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={fingerBusy || busy}
              onClick={() => void searchByFingerprint()}
            >
              {fingerBusy ? "Capture…" : "Par empreinte"}
            </button>
          </form>

          {error ? (
            <div className="login-error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          ) : null}
          {ok ? (
            <div className="success-banner" style={{ marginBottom: 12 }}>
              {ok}
            </div>
          ) : null}

          <div className="panel">
            <h2 className="panel-title">Demandes CIN</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Citoyen</th>
                  <th>Statut</th>
                  <th>Blocage</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aucune demande.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.request_type}</td>
                      <td>
                        <code className="small">{r.citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td>{r.status}</td>
                      <td className="small">{r.block_reason || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Citoyens</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Naissance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={selected?.id === c.id ? "row-selected" : undefined}>
                    <td>
                      <code className="nic-code">{c.nic || "—"}</code>
                    </td>
                    <td>{c.family_name}</td>
                    <td>{c.given_names}</td>
                    <td>{c.date_of_birth}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ width: "auto" }}
                        onClick={() => void pickCitizen(c)}
                      >
                        Sélectionner
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun résultat — recherchez un citoyen déjà pourvu d&apos;un NIC.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selected && eligibility ? (
            <div className="panel">
              <h2 className="panel-title">Admissibilité</h2>
              <p className="muted small">
                admissible={String(eligibility.admissible)} · production_officielle=
                {String(eligibility.production_allowed)} · codes=
                {(eligibility.codes || []).join(", ") || "aucun"} · nin_status=
                {eligibility.nin_status ?? "—"}
              </p>
              <p className="small">{eligibility.note}</p>
            </div>
          ) : null}

          {selected ? (
            <div className="panel no-print-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void createRequest()}
              >
                Créer demande FIRST_ISSUE
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void generateCard()}
              >
                {card ? "Réémettre / renvoyer à la commune" : "Émettre prototype → commune"}
              </button>
              {card ? (
                <button type="button" className="btn-secondary" onClick={printCard}>
                  Imprimer aperçu HTML
                </button>
              ) : null}
            </div>
          ) : null}

          {selected && card ? (
            <>
              <div className="panel no-print-actions">
                <p style={{ margin: 0 }}>
                  <strong>Circuit :</strong>{" "}
                  {card.routing_message ||
                    `Statut ${card.status} → commune ${card.commune_name || card.commune_code || "—"}`}
                </p>
                {card.delivery_address ? (
                  <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                    Adresse de livraison : {card.delivery_address}
                  </p>
                ) : null}
              </div>
              <IdCardRdc
                card={card}
                fallback={{
                  family_name: selected.family_name,
                  given_names: selected.given_names,
                  date_of_birth: selected.date_of_birth,
                  sex: selected.sex,
                  nic: selected.nic,
                }}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
