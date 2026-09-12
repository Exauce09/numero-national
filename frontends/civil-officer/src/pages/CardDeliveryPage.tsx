import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { getSession } from "../auth";
import { getOfficerCommune } from "../commune";

type InboxCard = {
  card_id: string;
  serial_number: string;
  status: string;
  commune_code?: string | null;
  commune_name?: string | null;
  delivery_address?: string | null;
  dispatched_at?: string | null;
  routing_message?: string | null;
  holder?: {
    nic?: string | null;
    family_name?: string | null;
    given_names?: string | null;
    date_of_birth?: string | null;
    sex?: string | null;
  } | null;
};

export default function CardDeliveryPage() {
  const session = getSession();
  const commune = getOfficerCommune();
  const [items, setItems] = useState<InboxCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.cardsInbox(commune.code);
      setItems((res.items as InboxCard[]) ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les cartes en attente (API / droits).",
      );
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [commune.code]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deliver(cardId: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.deliverCard(cardId);
      setOk("Carte remise au citoyen — statut ACTIVE.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remise impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Impression / livraison des cartes d&apos;identité</h1>
        <p>
          Après génération ONIP, chaque carte revient à votre commune (
          <strong>
            {commune.name}
            {commune.ville ? ` · ${commune.ville}` : ""}
          </strong>
          ) pour être remise au titulaire.
        </p>
      </div>

      {!session?.accessToken ? (
        <div className="panel">
          <p className="muted">
            Connectez-vous avec le compte API ({`officier.etatcivil@example.gov`}) pour recevoir
            les cartes envoyées par l&apos;ONIP.
          </p>
        </div>
      ) : null}

      <div className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={() => void load()}>
          {busy ? "…" : "Actualiser"}
        </button>
        <span className="muted" style={{ alignSelf: "center" }}>
          Code commune : {commune.code} · {items.length} en attente
        </span>
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {ok ? <div className="success-banner">{ok}</div> : null}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Boîte de réception commune</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>NIC</th>
              <th>Titulaire</th>
              <th>N° carte</th>
              <th>Adresse</th>
              <th>Reçue le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.card_id}>
                <td>
                  <code>{c.holder?.nic || "—"}</code>
                </td>
                <td>
                  {[c.holder?.family_name, c.holder?.given_names].filter(Boolean).join(" ") || "—"}
                </td>
                <td>{c.serial_number}</td>
                <td>{c.delivery_address || "—"}</td>
                <td>
                  {c.dispatched_at
                    ? new Date(c.dispatched_at).toLocaleString("fr-FR")
                    : "—"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: "auto" }}
                    disabled={busy}
                    onClick={() => void deliver(c.card_id)}
                  >
                    Remettre au citoyen
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune carte en attente pour cette commune.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
