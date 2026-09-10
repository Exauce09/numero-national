import { FormEvent, useState } from "react";
import { registryApi, cardsApi, type CitizenHit, type NationalCard } from "../api";
import { getSession } from "../auth";
import IdCardRdc from "./IdCardRdc";

export default function CardsPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [selected, setSelected] = useState<CitizenHit | null>(null);
  const [card, setCard] = useState<NationalCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setError(null);
    setOk(null);
    try {
      const existing = await cardsApi.getByCitizen(c.id);
      setCard(existing);
    } catch {
      setCard(null);
    }
  }

  async function generateCard() {
    if (!selected) return;
    if (!selected.nic) {
      setError("Attribuez d’abord un NIC (Campagnes → Contrôle → Promouvoir NIC).");
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
          `Carte + NIC générés — retournés à la commune de ${commune} pour livraison au citoyen.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Émission impossible");
    } finally {
      setBusy(false);
    }
  }

  function printCard() {
    window.print();
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Cartes d&apos;identité nationale</h1>
        <p>
          Modèle RDC (drapeau, patrimoine, MRZ). Après génération, la carte et le numéro retournent
          automatiquement à la commune pour livraison au titulaire.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous avec un compte admin pour émettre des cartes.</p>
        </div>
      ) : (
        <>
          <form
            className="panel"
            onSubmit={(e) => void search(e)}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="form-control"
              style={{ flex: "1 1 240px" }}
              placeholder="Nom, prénom ou NIC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "…" : "Rechercher"}
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

          {selected ? (
            <div className="panel no-print-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void generateCard()}
              >
                {card ? "Réémettre / renvoyer à la commune" : "Générer carte + envoyer à la commune"}
              </button>
              {card ? (
                <button type="button" className="btn-secondary" onClick={printCard}>
                  Imprimer recto / verso
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
