import { FormEvent, useState } from "react";
import { registryApi, cardsApi, type CitizenHit, type NationalCard } from "../api";
import { getSession } from "../auth";

function qrImgUrl(payload: Record<string, unknown> | null | undefined): string {
  const data = encodeURIComponent(JSON.stringify(payload ?? {}));
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${data}`;
}

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
      setOk(`Carte générée — n° ${issued.serial_number} (${issued.status})`);
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
          Recherchez un citoyen (avec NIC), générez la carte ONIP, puis imprimez-la. Le QR permet la
          vérification sans exposer toute l&apos;identité.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous avec un compte admin pour émettre des cartes.</p>
        </div>
      ) : (
        <>
          <form className="panel" onSubmit={(e) => void search(e)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          {error ? <div className="login-error" style={{ marginBottom: 12 }}>{error}</div> : null}
          {ok ? <div className="success-banner" style={{ marginBottom: 12 }}>{ok}</div> : null}

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
                      <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={() => void pickCitizen(c)}>
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
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void generateCard()}>
                {card ? "Régénérer / activer la carte" : "Générer la carte d’identité"}
              </button>
              {card ? (
                <button type="button" className="btn-secondary" onClick={printCard}>
                  Imprimer la carte
                </button>
              ) : null}
            </div>
          ) : null}

          {selected && card ? (
            <div className="id-card-print-wrap">
              <article className="id-card" aria-label="Carte d'identité nationale">
                <header className="id-card-head">
                  <div className="id-card-stripe" />
                  <div className="id-card-head-text">
                    <strong>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</strong>
                    <span>ONIP — Carte d&apos;identité nationale</span>
                  </div>
                </header>
                <div className="id-card-body">
                  <div className="id-card-photo" aria-hidden>
                    {selected.sex === "F" ? "F" : "M"}
                  </div>
                  <div className="id-card-fields">
                    <div>
                      <span className="id-label">Nom</span>
                      <strong>{selected.family_name}</strong>
                    </div>
                    <div>
                      <span className="id-label">Prénom(s)</span>
                      <strong>{selected.given_names}</strong>
                    </div>
                    <div>
                      <span className="id-label">Date de naissance</span>
                      <strong>{selected.date_of_birth}</strong>
                    </div>
                    <div>
                      <span className="id-label">NIC</span>
                      <strong className="nic-code">{selected.nic}</strong>
                    </div>
                    <div>
                      <span className="id-label">N° carte</span>
                      <strong>{card.serial_number}</strong>
                    </div>
                    <div>
                      <span className="id-label">Statut</span>
                      <strong>{card.status}</strong>
                    </div>
                  </div>
                  <div className="id-card-qr">
                    <img src={qrImgUrl(card.qr_payload)} alt="QR code carte" width={140} height={140} />
                    <small>Scanner pour vérifier</small>
                  </div>
                </div>
                <footer className="id-card-foot">
                  Émise le {card.issued_at ? new Date(card.issued_at).toLocaleDateString("fr-FR") : "—"}
                  {card.expires_at
                    ? ` · Expire le ${new Date(card.expires_at).toLocaleDateString("fr-FR")}`
                    : ""}
                </footer>
              </article>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
