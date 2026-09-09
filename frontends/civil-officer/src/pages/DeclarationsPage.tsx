import { useEffect, useState } from "react";
import {
  api,
  demoListDeclarations,
  demoValidateDeclaration,
  type Declaration,
} from "../api";
import { addAct, addPerson, getPersonByNic, type Sexe } from "../registry";
import { pushNotification } from "../prefs";
import { setDeclarationStatus } from "../civilDeclarations";

export default function DeclarationsPage() {
  const [rows, setRows] = useState<Declaration[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Declaration | null>(null);

  async function refresh() {
    try {
      setRows(await api.listDeclarations("PENDING_OFFICER"));
    } catch {
      setRows(demoListDeclarations());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function applyToRegistry(d: Declaration) {
    const commune = String(d.payload.commune_code ?? "KIN-GOMBE");
    if (d.declaration_type === "BIRTH") {
      const sexe = (String(d.payload.sexe ?? "M").toUpperCase() === "F" ? "F" : "M") as Sexe;
      const child = addPerson({
        nom: String(d.payload.child_nom ?? "INCONNU"),
        postnom: String(d.payload.child_postnom ?? ""),
        prenom: String(d.payload.child_prenom ?? ""),
        sexe,
        date_naissance: String(d.payload.date_naissance ?? ""),
        lieu_naissance: String(d.payload.lieu_naissance ?? d.payload.facility_name ?? ""),
        etat_civil: "CELIBATAIRE",
      });
      addAct(
        "BIRTH",
        {
          ...d.payload,
          child_id: child.id,
          nom: child.nom,
          postnom: child.postnom,
          prenom: child.prenom,
          sexe: child.sexe,
          date_naissance: child.date_naissance,
          lieu_naissance: child.lieu_naissance,
          commune_code: commune,
          source: "HOSPITAL",
          declaration_id: d.id,
        },
        child.nic,
      );
      return child.nic;
    }
    if (d.declaration_type === "DEATH") {
      const name = String(d.payload.deceased_name ?? "INCONNU");
      const existing = getPersonByNic(String(d.payload.deceased_nic ?? ""));
      addAct(
        "DEATH",
        {
          ...d.payload,
          deceased_id: existing?.id ?? null,
          deceased_name: name,
          commune_code: commune,
          source: "HOSPITAL",
          declaration_id: d.id,
        },
        existing?.nic ?? `HOSP-${d.id.slice(0, 8)}`,
      );
      return name;
    }
    return null;
  }

  async function onValidate(id: string, reject: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await api.validateDeclaration(id, {
        commune_code: String(rows.find((r) => r.id === id)?.payload.commune_code ?? "KIN-GOMBE"),
        reject,
        rejection_reason: reject ? "Rejeté par l'officier" : undefined,
      });
      setMessage(reject ? "Déclaration rejetée." : "Déclaration validée via API.");
    } catch {
      const d = rows.find((x) => x.id === id);
      if (!reject && d) {
        try {
          applyToRegistry(d);
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Validation locale partielle.");
        }
      }
      demoValidateDeclaration(id, reject);
      setDeclarationStatus(id, reject ? "REJECTED" : "VALIDATED");
      setMessage(
        reject
          ? "Déclaration rejetée (mode local)."
          : "Déclaration validée — registre mis à jour (naissance/décès).",
      );
      pushNotification({
        title: reject ? "Déclaration rejetée" : "Déclaration validée",
        body: reject
          ? "La structure sanitaire a été informée du rejet (statut local)."
          : "Le registre communal a été mis à jour suite à la validation hôpital.",
        href: d?.declaration_type === "DEATH" ? "/deaths" : "/births",
      });
    }
    setSelected(null);
    await refresh();
    setBusy(false);
  }

  return (
    <div>
      <h2 className="page-title">Déclarations structures sanitaires</h2>
      <p className="page-lead">
        File d&apos;attente des naissances et décès notifiés par les hôpitaux / cliniques — à valider pour mise à
        jour du système.
      </p>

      {message ? <div className="success-banner">{message}</div> : null}

      <div className="panel">
        <div className="toolbar">
          <button type="button" className="btn-secondary" onClick={() => void refresh()}>
            Actualiser la file
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Structure</th>
              <th>Résumé</th>
              <th>Créée</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune déclaration en attente.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.declaration_type === "BIRTH" ? "Naissance" : "Décès"}</td>
                  <td>{String(d.payload.facility_name ?? d.source)}</td>
                  <td>
                    {d.declaration_type === "BIRTH"
                      ? `${d.payload.child_nom ?? ""} ${d.payload.child_prenom ?? ""}`.trim() || "—"
                      : String(d.payload.deceased_name ?? "—")}
                  </td>
                  <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
                  <td className="table-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(d)}>
                      Voir
                    </button>{" "}
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void onValidate(d.id, false)}
                    >
                      Valider
                    </button>{" "}
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => void onValidate(d.id, true)}
                    >
                      Rejeter
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>
              Déclaration {selected.declaration_type === "BIRTH" ? "naissance" : "décès"}
            </h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                disabled={busy}
                onClick={() => void onValidate(selected.id, false)}
              >
                Valider et mettre à jour
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
