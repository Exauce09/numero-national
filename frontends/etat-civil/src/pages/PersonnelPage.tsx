import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { getSession } from "../auth";

export default function PersonnelPage() {
  const session = getSession();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [matricule, setMatricule] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [givenNames, setGivenNames] = useState("");
  const [emailPro, setEmailPro] = useState("");
  const [functionTitle, setFunctionTitle] = useState("");

  async function load() {
    setError(null);
    try {
      setRows(await api.listPersonnel());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chargement impossible";
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("personnel")) {
        setError(
          "Accès refusé : permission personnel insuffisante. Un officier ne gère pas le personnel — utilisez un compte admin / responsable de bureau.",
        );
      } else {
        setError(msg);
      }
    }
  }

  useEffect(() => {
    if (session?.accessToken) void load();
  }, [session?.accessToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.createPersonnel({
        matricule: matricule.trim(),
        family_name: familyName.trim(),
        given_names: givenNames.trim(),
        email_pro: emailPro.trim() || null,
        function_title: functionTitle.trim() || null,
      });
      setMatricule("");
      setFamilyName("");
      setGivenNames("");
      setEmailPro("");
      setFunctionTitle("");
      setMessage("Personnel enregistré (sans compte encore).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  if (!session?.accessToken) {
    return (
      <div className="panel">
        <p className="muted">Connectez-vous pour gérer le personnel.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Personnel administratif</h2>
      <p className="page-lead">
        La personne physique est enregistrée ici avant toute affectation et avant tout compte
        informatique.
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}
      <form className="panel form-grid" onSubmit={onSubmit}>
        <div>
          <label className="form-label">Matricule *</label>
          <input
            className="form-control"
            value={matricule}
            onChange={(e) => setMatricule(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Nom *</label>
          <input
            className="form-control"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Prénom(s) *</label>
          <input
            className="form-control"
            value={givenNames}
            onChange={(e) => setGivenNames(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Fonction</label>
          <input
            className="form-control"
            value={functionTitle}
            onChange={(e) => setFunctionTitle(e.target.value)}
          />
        </div>
        <div className="full">
          <label className="form-label">E-mail professionnel</label>
          <input
            className="form-control"
            type="email"
            value={emailPro}
            onChange={(e) => setEmailPro(e.target.value)}
          />
        </div>
        <div className="full">
          <button type="submit" className="btn-primary">
            Enregistrer le personnel
          </button>
        </div>
      </form>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Fonction</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={String(p.id)}>
                <td>{String(p.matricule ?? "")}</td>
                <td>{String(p.family_name ?? "")}</td>
                <td>{String(p.given_names ?? "")}</td>
                <td>{String(p.function_title ?? "—")}</td>
                <td>{String(p.status ?? "")}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun personnel.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
