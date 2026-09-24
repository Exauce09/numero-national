/** Inscription de mention / rectification sur un acte. */

import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import { getSession } from "../auth";
import { getActFormSchema } from "../ecActForms";
import { getLoggedOfficer } from "../officerContext";
import { addAct, type Act } from "../registry";
import { canSeeNav } from "../rbac";

export default function MentionsEcPage() {
  const roles = getSession()?.roles ?? [];
  const allowed = canSeeNav("mentions", roles);
  const [typeActe, setTypeActe] = useState("NAISSANCE");
  const [referenceActe, setReferenceActe] = useState("");
  const [nature, setNature] = useState("MENTION");
  const [fondement, setFondement] = useState("ERREUR_MATERIELLE");
  const [refJugement, setRefJugement] = useState("");
  const [texte, setTexte] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  if (!allowed) {
    return (
      <div>
        <h2 className="page-title">Mentions / rectifications</h2>
        <div className="panel">
          <p className="muted">
            Réservé à l&apos;officier d&apos;état civil et aux autorités habilitées. Le super
            administrateur n&apos;inscrit pas de mentions juridiques.
          </p>
          <Link className="btn-secondary btn-sm" to="/">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!referenceActe.trim() || !texte.trim()) {
      setError("Référence de l'acte et texte de la mention sont obligatoires.");
      return;
    }
    if (fondement === "JUGEMENT" && !refJugement.trim()) {
      setError("Référence du jugement obligatoire lorsque le fondement est judiciaire.");
      return;
    }
    try {
      const officer = getLoggedOfficer();
      const payload = {
        type_acte_concerne: typeActe,
        reference_acte: referenceActe.trim(),
        nature_mention: nature,
        fondement,
        ref_jugement: fondement === "JUGEMENT" ? refJugement.trim() : null,
        texte_mention: texte.trim(),
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        note: "Inscription de mention / rectification — état civil RDC",
      };
      const act = await addAct("RECTIFICATION", payload, referenceActe.trim());
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <ActFormShell
      schema={getActFormSchema("mention")!}
      extraLead={
        <p className="muted small">
          File des demandes citoyennes : <Link to="/corrections">Demandes de correction</Link>
        </p>
      }
    >
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div>
            <label className="form-label">Type d&apos;acte *</label>
            <select className="form-control" value={typeActe} onChange={(e) => setTypeActe(e.target.value)}>
              <option value="NAISSANCE">Acte de naissance</option>
              <option value="MARIAGE">Acte de mariage</option>
              <option value="DECES">Acte de décès</option>
              <option value="RECONNAISSANCE">Reconnaissance</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="form-label">Référence de l&apos;acte *</label>
            <input
              className="form-control"
              value={referenceActe}
              onChange={(e) => setReferenceActe(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Nature *</label>
            <select className="form-control" value={nature} onChange={(e) => setNature(e.target.value)}>
              <option value="MENTION">Mention marginale</option>
              <option value="RECTIFICATION">Rectification</option>
            </select>
          </div>
          <div>
            <label className="form-label">Fondement *</label>
            <select
              className="form-control"
              value={fondement}
              onChange={(e) => setFondement(e.target.value)}
            >
              <option value="ERREUR_MATERIELLE">Erreur matérielle</option>
              <option value="JUGEMENT">Jugement / décision judiciaire</option>
              <option value="AUTRE">Autre fondement régulier</option>
            </select>
          </div>
          {fondement === "JUGEMENT" ? (
            <div className="full">
              <label className="form-label">Référence du jugement *</label>
              <input
                className="form-control"
                value={refJugement}
                onChange={(e) => setRefJugement(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="full">
            <label className="form-label">Texte de la mention à porter *</label>
            <textarea
              className="form-control"
              rows={4}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" style={{ width: "auto", minWidth: 220 }}>
              Inscrire la mention
            </button>
          </div>
        </form>
      </div>
      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Mention / rectification enregistrée</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
