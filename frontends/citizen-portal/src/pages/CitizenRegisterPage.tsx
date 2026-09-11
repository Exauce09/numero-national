import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export default function CitizenRegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    family_name: "",
    postnom: "",
    given_names: "",
    date_of_birth: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    password_confirm: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.password_confirm) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/auth/citizen/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          phone: form.phone || null,
          postnom: form.postnom || null,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || `Erreur ${res.status}`);
      }
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Espace citoyen — Inscription</h1>
        <p className="page-lead">
          Création d'un compte citoyen. Aucun rôle administratif n'est attribué.
        </p>
        {error ? <div className="login-error">{error}</div> : null}
        <label>
          Nom *
          <input
            required
            value={form.family_name}
            onChange={(e) => setForm({ ...form, family_name: e.target.value })}
          />
        </label>
        <label>
          Postnom
          <input value={form.postnom} onChange={(e) => setForm({ ...form, postnom: e.target.value })} />
        </label>
        <label>
          Prénom *
          <input
            required
            value={form.given_names}
            onChange={(e) => setForm({ ...form, given_names: e.target.value })}
          />
        </label>
        <label>
          Date de naissance *
          <input
            type="date"
            required
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
        </label>
        <label>
          Téléphone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Nom d'utilisateur *
          <input
            required
            minLength={3}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>
        <label>
          Mot de passe *
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label>
          Confirmation *
          <input
            type="password"
            required
            minLength={8}
            value={form.password_confirm}
            onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Inscription…" : "Créer mon compte citoyen"}
        </button>
        <p>
          Déjà inscrit ? <Link to="/login">Connexion</Link>
        </p>
      </form>
    </div>
  );
}
