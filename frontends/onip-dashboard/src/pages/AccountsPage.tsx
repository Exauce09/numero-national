import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { accountsApi, geoApi, type DirectoryUser, type GeoItem } from "../api";
import { getSession } from "../auth";

const ROLE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "CENSUS_AGENT", label: "Agent de recensement (téléphone)" },
  { code: "CENSUS_SUPERVISOR", label: "Superviseur recensement (contrôle)" },
  { code: "ONIP_OPS", label: "Opérations ONIP" },
  { code: "CENTRAL_ADMIN", label: "Administrateur central" },
];

/**
 * Création de comptes modèle élections RDC :
 * 1) choisir la province
 * 2) choisir la ville (chef-lieu / territoire urbain)
 * 3) rôle opérationnel
 * Puis affectation fine en Campagnes → Zones.
 */
export default function AccountsPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleCode, setRoleCode] = useState("CENSUS_AGENT");

  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [villes, setVilles] = useState<GeoItem[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [villeId, setVilleId] = useState("");

  const reload = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await accountsApi.listUsers();
      setUsers(rows);
    } catch (e) {
      setUsers([]);
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de charger les comptes (permission users:manage requise)",
      );
    } finally {
      setLoading(false);
    }
  }, [hasToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!hasToken) return;
    void geoApi
      .provinces()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, [hasToken]);

  useEffect(() => {
    setVilleId("");
    setVilles([]);
    if (!provinceId) return;
    void geoApi
      .villes(provinceId)
      .then(setVilles)
      .catch(() => setVilles([]));
  }, [provinceId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!provinceId || !villeId) {
      setError("Sélectionnez la province puis la ville (affectation type élections RDC).");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const created = await accountsApi.registerUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role_codes: [roleCode],
        province_id: provinceId,
        ville_id: villeId,
      });
      const provName = provinces.find((p) => p.id === provinceId)?.name ?? "";
      const villeName = villes.find((v) => v.id === villeId)?.name ?? "";
      setMsg(`Compte créé : ${created.email} — ${provName} / ${villeName}`);
      setEmail("");
      setPassword("");
      setFullName("");
      setRoleCode("CENSUS_AGENT");
      setProvinceId("");
      setVilleId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: DirectoryUser) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await accountsApi.setUserActive(u.id, !u.is_active);
      setMsg(`${u.email} → ${u.is_active ? "désactivé" : "activé"}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: DirectoryUser) {
    const current = (u.roles ?? []).join(", ");
    const next = window.prompt(
      `Rôles pour ${u.email} (codes séparés par des virgules)\nEx. CENSUS_AGENT, CENSUS_SUPERVISOR`,
      current || roleCode,
    );
    if (next == null) return;
    const codes = next
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!codes.length) {
      setError("Au moins un rôle est requis");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await accountsApi.assignRoles(u.id, codes);
      setMsg(`Rôles mis à jour pour ${u.email}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Affectation des rôles impossible");
    } finally {
      setBusy(false);
    }
  }

  function geoLabel(u: DirectoryUser): string {
    const p = provinces.find((x) => x.id === u.province_id)?.name;
    if (!p && !u.province_id) return "—";
    return [p || u.province_id?.slice(0, 8), u.ville_id ? "ville liée" : null]
      .filter(Boolean)
      .join(" · ");
  }

  if (!hasToken) {
    return (
      <div>
        <div className="hero-banner">
          <h1>Comptes utilisateurs</h1>
          <p>Étape 1 — créer les comptes avant les campagnes et le terrain.</p>
        </div>
        <div className="panel">
          <p className="muted">
            Connectez-vous avec un compte admin API (ex.{" "}
            <code>admin.recensement@example.gov</code> / <code>CensusAdmin123!</code>) pour créer
            des utilisateurs. La session démo sans JWT ne permet pas la gestion des comptes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Comptes utilisateurs</h1>
        <p>
          Création type élections RDC : province → ville, puis rôle. Ensuite :{" "}
          <Link to="/campaigns">Campagnes → Affectations</Link> pour les zones.
        </p>
      </div>

      {error ? (
        <div className="login-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {msg ? (
        <div className="success-banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Créer un compte</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Comme pour l’enrôlement électoral : l’agent est d’abord rattaché à une{" "}
          <strong>province</strong>, puis à une <strong>ville</strong> (périmètre de travail).
        </p>
        <form onSubmit={onCreate} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <div>
            <label className="form-label" htmlFor="acc-province">
              Province *
            </label>
            <select
              id="acc-province"
              className="form-control"
              required
              value={provinceId}
              onChange={(ev) => setProvinceId(ev.target.value)}
            >
              <option value="">— Choisir la province —</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="acc-ville">
              Ville *
            </label>
            <select
              id="acc-ville"
              className="form-control"
              required
              disabled={!provinceId}
              value={villeId}
              onChange={(ev) => setVilleId(ev.target.value)}
            >
              <option value="">— Choisir la ville —</option>
              {villes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="acc-email">
              E-mail
            </label>
            <input
              id="acc-email"
              className="form-control"
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="agent.nom@example.gov"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="acc-name">
              Nom complet
            </label>
            <input
              id="acc-name"
              className="form-control"
              required
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              placeholder="Nom Prénom"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="acc-password">
              Mot de passe
            </label>
            <input
              id="acc-password"
              className="form-control"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="Min. 8 caractères, politique API"
            />
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Exemple valide : <code>CensusAgent123!</code>
            </p>
          </div>
          <div>
            <label className="form-label" htmlFor="acc-role">
              Rôle
            </label>
            <select
              id="acc-role"
              className="form-control"
              value={roleCode}
              onChange={(ev) => setRoleCode(ev.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={busy} style={{ width: "auto", minWidth: 180 }}>
            {busy ? "Création…" : "Créer le compte"}
          </button>
        </form>
      </div>

      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Liste des comptes</h2>
          <button type="button" className="btn-secondary" onClick={() => void reload()} disabled={loading}>
            Rafraîchir
          </button>
        </div>
        {loading ? <p className="muted">Chargement…</p> : null}
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Nom</th>
              <th>Territoire</th>
              <th>Rôles</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.full_name || "—"}</td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {geoLabel(u)}
                </td>
                <td>
                  <code style={{ fontSize: 12 }}>{(u.roles ?? []).join(", ") || "—"}</code>
                </td>
                <td>{u.is_active ? "Actif" : "Inactif"}</td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void toggleActive(u)}>
                    {u.is_active ? "Désactiver" : "Activer"}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void changeRole(u)}>
                    Rôles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
