import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  type AccountProvisionResult,
  type AssignableRolesResponse,
  type Bureau,
  type GeoItem,
  type Personnel,
} from "../../api";

const STEPS = [
  "Personnel",
  "Affectation",
  "Compte",
  "Habilitations",
  "Vérification",
] as const;

const FUNCTIONS = [
  { value: "AGENT_ETAT_CIVIL", label: "Agent d'état civil" },
  { value: "OFFICIER_ETAT_CIVIL", label: "Officier de l'état civil" },
  { value: "RESPONSABLE_BUREAU", label: "Responsable de bureau" },
  { value: "AUTRE", label: "Autre fonction autorisée" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountProvisionResult | null>(null);

  // Step 1
  const [personnelMode, setPersonnelMode] = useState<"select" | "create">("select");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Personnel[]>([]);
  const [selected, setSelected] = useState<Personnel | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [newPers, setNewPers] = useState({
    matricule: "",
    family_name: "",
    postnom: "",
    given_names: "",
    function_title: "",
    phone_pro: "",
    email_pro: "",
    status: "ACTIVE",
  });

  // Step 2
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [villes, setVilles] = useState<GeoItem[]>([]);
  const [communes, setCommunes] = useState<GeoItem[]>([]);
  const [bureaux, setBureaux] = useState<Bureau[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [villeId, setVilleId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [bureauId, setBureauId] = useState("");
  const [functionCode, setFunctionCode] = useState("AGENT_ETAT_CIVIL");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [openEnded, setOpenEnded] = useState(true);
  const [justification, setJustification] = useState("");
  const [documentRef, setDocumentRef] = useState("");

  // Step 3
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accessMode, setAccessMode] = useState<"invite" | "temporary_password">("invite");
  const [tempPassword, setTempPassword] = useState("");

  // Step 4
  const [rolesPack, setRolesPack] = useState<AssignableRolesResponse | null>(null);
  const [roleCode, setRoleCode] = useState("AGENT_ETAT_CIVIL");

  useEffect(() => {
    void api.geoProvinces().then(setProvinces);
    void api.assignableRoles().then(setRolesPack).catch(() => setRolesPack({ roles: [] }));
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setVilles([]);
      return;
    }
    void api.geoVilles(provinceId).then(setVilles);
    void api.listBureaux({ province_id: provinceId }).then(setBureaux);
  }, [provinceId]);

  useEffect(() => {
    if (!villeId) {
      setCommunes([]);
      return;
    }
    void api.geoCommunes(villeId).then(setCommunes);
    void api.listBureaux({ province_id: provinceId, ville_id: villeId }).then(setBureaux);
  }, [villeId, provinceId]);

  useEffect(() => {
    if (!communeId) return;
    void api
      .listBureaux({ province_id: provinceId, ville_id: villeId, commune_id: communeId })
      .then(setBureaux);
  }, [communeId, provinceId, villeId]);

  const selectedRole = useMemo(
    () => rolesPack?.roles.find((r) => r.code === roleCode) ?? null,
    [rolesPack, roleCode],
  );

  const scopePreview = useMemo(() => {
    const province = provinces.find((p) => p.id === provinceId)?.name ?? "—";
    const ville = villes.find((v) => v.id === villeId)?.name ?? "—";
    const commune = communes.find((c) => c.id === communeId)?.name ?? "—";
    const bureau = bureaux.find((b) => b.id === bureauId)?.name ?? "—";
    if (roleCode === "ADMIN_NATIONAL" || roleCode === "SUPER_ADMIN_NATIONAL") {
      return { kind: "NATIONAL", province: "NATIONAL", ville: "—", commune: "—", bureau: "—" };
    }
    if (roleCode === "ADMIN_PROVINCIAL") {
      return { kind: "PROVINCE", province, ville: "—", commune: "—", bureau: "—" };
    }
    return { kind: "BUREAU", province, ville, commune, bureau };
  }, [roleCode, provinces, villes, communes, bureaux, provinceId, villeId, communeId, bureauId]);

  async function onSearchPersonnel() {
    setError(null);
    try {
      setHits(await api.searchPersonnel(search.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible");
    }
  }

  async function selectPersonnel(p: Personnel) {
    setSelected(p);
    setHasAccount(false);
    setUsername(
      `${(p.given_names || "").split(" ")[0]}.${p.family_name}`.toLowerCase().replace(/\s+/g, ""),
    );
    setEmail(p.email_pro || "");
    try {
      const check = await api.personnelAccountCheck(p.id);
      setHasAccount(check.has_active_account);
    } catch {
      setHasAccount(false);
    }
  }

  function canNext(): boolean {
    if (step === 0) {
      if (personnelMode === "select") return !!selected && !hasAccount;
      return !!(newPers.matricule && newPers.family_name && newPers.given_names && newPers.function_title);
    }
    if (step === 1) {
      if (!provinceId || !bureauId || !functionCode || !startDate) return false;
      if (!openEnded && endDate && endDate < startDate) return false;
      return true;
    }
    if (step === 2) {
      if (!username.trim()) return false;
      if (accessMode === "temporary_password" && tempPassword.length < 8) return false;
      return true;
    }
    if (step === 3) return !!roleCode;
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        personnel:
          personnelMode === "select"
            ? { mode: "select", personnel_id: selected!.id }
            : { mode: "create", new_personnel: { ...newPers, email_pro: newPers.email_pro || null } },
        assignment: {
          province_id: provinceId,
          ville_id: villeId || null,
          commune_id: communeId || null,
          bureau_id: bureauId,
          function_code: functionCode,
          start_date: startDate,
          end_date: openEnded ? null : endDate || null,
          open_ended: openEnded,
          justification: justification || null,
          document_reference: documentRef || null,
        },
        credentials: {
          username: username.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          access_mode: accessMode,
          temporary_password: accessMode === "temporary_password" ? tempPassword : null,
        },
        role_code: roleCode,
      };
      const res = await api.provisionAccount(body);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="panel">
        <h2 className="page-title">Compte créé avec succès</h2>
        <p>
          Utilisateur : <strong>{result.username}</strong> ({result.email})
        </p>
        <p>
          Statut : <strong>{result.account_status === "PENDING" ? "EN ATTENTE" : result.account_status}</strong>
        </p>
        {result.invite_url ? (
          <p className="success-banner">Une invitation d'activation a été générée.</p>
        ) : null}
        <div className="action-row" style={{ marginTop: "1rem" }}>
          <Link className="btn-primary" to={`../${result.user_id}`}>
            Voir le compte
          </Link>
          {result.invite_token ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void navigator.clipboard.writeText(result.invite_token || "")}
            >
              Copier le jeton d'invitation
            </button>
          ) : null}
          <Link className="btn-secondary" to="..">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Nouveau compte</h2>
          <p className="page-lead">Assistant de création — ne créez jamais un personnel fictif.</p>
        </div>
        <Link className="btn-secondary" to="..">
          Retour
        </Link>
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? "active" : i < step ? "done" : ""}`}>
            <span className="wizard-num">{i + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) {
            if (canNext()) setStep((s) => s + 1);
            else setError("Complétez les champs obligatoires avant de continuer.");
            return;
          }
          void onSubmit(e);
        }}
      >
        {step === 0 ? (
          <div>
            <h3>Informations du personnel</h3>
            <div className="radio-row">
              <label>
                <input
                  type="radio"
                  checked={personnelMode === "select"}
                  onChange={() => setPersonnelMode("select")}
                />{" "}
                Sélectionner un personnel existant
              </label>
              <label>
                <input
                  type="radio"
                  checked={personnelMode === "create"}
                  onChange={() => setPersonnelMode("create")}
                />{" "}
                Créer un nouveau dossier personnel
              </label>
            </div>

            {personnelMode === "select" ? (
              <>
                <div className="toolbar">
                  <input
                    className="form-control"
                    placeholder="Matricule, nom, postnom, prénom…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="button" className="btn-secondary" onClick={() => void onSearchPersonnel()}>
                    Rechercher
                  </button>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Matricule</th>
                        <th>Nom complet</th>
                        <th>Fonction</th>
                        <th>Statut</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {hits.map((p) => (
                        <tr key={p.id}>
                          <td>{p.matricule}</td>
                          <td>
                            {p.given_names} {p.postnom || ""} {p.family_name}
                          </td>
                          <td>{p.function_title || "—"}</td>
                          <td>{p.status}</td>
                          <td>
                            <button type="button" className="btn-sm btn-secondary" onClick={() => void selectPersonnel(p)}>
                              Sélectionner
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selected ? (
                  <div className={`info-card ${hasAccount ? "danger" : ""}`}>
                    <strong>
                      {selected.given_names} {selected.family_name}
                    </strong>
                    <div>Matricule : {selected.matricule}</div>
                    <div>Fonction : {selected.function_title || "—"}</div>
                    <div>Statut : {selected.status}</div>
                    {hasAccount ? (
                      <p className="login-error" style={{ marginTop: "0.75rem" }}>
                        Cette personne possède déjà un compte actif.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="form-grid">
                <div>
                  <label className="form-label">Matricule *</label>
                  <input
                    className="form-control"
                    required
                    value={newPers.matricule}
                    onChange={(e) => setNewPers({ ...newPers, matricule: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Nom *</label>
                  <input
                    className="form-control"
                    required
                    value={newPers.family_name}
                    onChange={(e) => setNewPers({ ...newPers, family_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Postnom</label>
                  <input
                    className="form-control"
                    value={newPers.postnom}
                    onChange={(e) => setNewPers({ ...newPers, postnom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Prénom *</label>
                  <input
                    className="form-control"
                    required
                    value={newPers.given_names}
                    onChange={(e) => setNewPers({ ...newPers, given_names: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Fonction *</label>
                  <input
                    className="form-control"
                    required
                    value={newPers.function_title}
                    onChange={(e) => setNewPers({ ...newPers, function_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Téléphone professionnel</label>
                  <input
                    className="form-control"
                    value={newPers.phone_pro}
                    onChange={(e) => setNewPers({ ...newPers, phone_pro: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Email professionnel</label>
                  <input
                    className="form-control"
                    type="email"
                    value={newPers.email_pro}
                    onChange={(e) => setNewPers({ ...newPers, email_pro: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h3>Affectation administrative</h3>
            <div className="form-grid">
              <div>
                <label className="form-label">Province *</label>
                <select
                  className="form-control"
                  required
                  value={provinceId}
                  onChange={(e) => {
                    setProvinceId(e.target.value);
                    setVilleId("");
                    setCommuneId("");
                    setBureauId("");
                  }}
                >
                  <option value="">—</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Ville</label>
                <select
                  className="form-control"
                  value={villeId}
                  onChange={(e) => {
                    setVilleId(e.target.value);
                    setCommuneId("");
                    setBureauId("");
                  }}
                >
                  <option value="">—</option>
                  {villes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Commune / secteur / chefferie</label>
                <select
                  className="form-control"
                  value={communeId}
                  onChange={(e) => {
                    setCommuneId(e.target.value);
                    setBureauId("");
                  }}
                >
                  <option value="">—</option>
                  {communes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="full">
                <label className="form-label">Bureau d'état civil *</label>
                <select
                  className="form-control"
                  required
                  value={bureauId}
                  onChange={(e) => setBureauId(e.target.value)}
                >
                  <option value="">—</option>
                  {bureaux.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Fonction dans le bureau *</label>
                <select
                  className="form-control"
                  value={functionCode}
                  onChange={(e) => setFunctionCode(e.target.value)}
                >
                  {FUNCTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Date de début *</label>
                <input
                  className="form-control"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="full">
                <label>
                  <input
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => setOpenEnded(e.target.checked)}
                  />{" "}
                  Affectation sans date de fin
                </label>
              </div>
              {!openEnded ? (
                <div>
                  <label className="form-label">Date de fin</label>
                  <input
                    className="form-control"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              ) : null}
              <div>
                <label className="form-label">Référence de l'affectation</label>
                <input
                  className="form-control"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                />
              </div>
              <div className="full">
                <label className="form-label">Motif / justification</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h3>Configuration du compte</h3>
            <div className="form-grid">
              <div>
                <label className="form-label">Nom d'utilisateur *</label>
                <input
                  className="form-control"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email de connexion</label>
                <input
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Téléphone</label>
                <input
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="full radio-row">
                <label>
                  <input
                    type="radio"
                    checked={accessMode === "invite"}
                    onChange={() => setAccessMode("invite")}
                  />{" "}
                  Envoyer une invitation (recommandé)
                </label>
                <label>
                  <input
                    type="radio"
                    checked={accessMode === "temporary_password"}
                    onChange={() => setAccessMode("temporary_password")}
                  />{" "}
                  Générer un mot de passe temporaire
                </label>
              </div>
              {accessMode === "temporary_password" ? (
                <div>
                  <label className="form-label">Mot de passe temporaire *</label>
                  <input
                    className="form-control"
                    type="password"
                    minLength={8}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                </div>
              ) : (
                <p className="muted full">
                  Le compte sera créé en statut PENDING avec un lien d'activation à durée limitée. Aucun mot de
                  passe définitif ne sera affiché.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h3>Rôle et habilitations</h3>
            <div className="form-grid">
              <div>
                <label className="form-label">Rôle *</label>
                <select
                  className="form-control"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                >
                  {(rolesPack?.roles || []).map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedRole ? (
              <div className="info-card" style={{ marginTop: "1rem" }}>
                <strong>{selectedRole.code}</strong>
                <ul className="perm-list">
                  {selectedRole.permissions.slice(0, 12).map((p) => (
                    <li key={p}>✓ {p}</li>
                  ))}
                </ul>
                <p className="muted">Les permissions critiques ne sont pas modifiables depuis ce formulaire.</p>
              </div>
            ) : null}
            <div className="info-card" style={{ marginTop: "1rem" }}>
              <strong>Périmètre d'accès</strong>
              <div>Type : {scopePreview.kind}</div>
              <div>Province : {scopePreview.province}</div>
              <div>Ville : {scopePreview.ville}</div>
              <div>Commune : {scopePreview.commune}</div>
              <div>Bureau : {scopePreview.bureau}</div>
              <p className="muted">
                L'utilisateur pourra accéder uniquement aux ressources autorisées de ce périmètre.
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h3>Récapitulatif du compte</h3>
            <div className="recap-box">
              <section>
                <h4>Personnel</h4>
                <p>
                  {personnelMode === "select" && selected
                    ? `${selected.given_names} ${selected.family_name} (${selected.matricule})`
                    : `${newPers.given_names} ${newPers.family_name} (${newPers.matricule})`}
                </p>
              </section>
              <section>
                <h4>Affectation</h4>
                <p>
                  {scopePreview.province} / {scopePreview.ville} / {scopePreview.commune}
                  <br />
                  Bureau : {scopePreview.bureau}
                  <br />
                  Fonction : {functionCode}
                </p>
              </section>
              <section>
                <h4>Compte</h4>
                <p>
                  Utilisateur : {username}
                  <br />
                  Email : {email || "(dérivé du nom d'utilisateur)"}
                  <br />
                  Accès : {accessMode === "invite" ? "Invitation" : "Mot de passe temporaire"}
                </p>
              </section>
              <section>
                <h4>Rôle & périmètre</h4>
                <p>
                  {roleCode}
                  <br />
                  Scope : {scopePreview.kind}
                </p>
              </section>
              <section>
                <h4>Statut</h4>
                <p>{accessMode === "invite" ? "En attente d'activation" : "Actif"}</p>
              </section>
            </div>
          </div>
        ) : null}

        <div className="wizard-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={step === 0 || busy}
            onClick={() => {
              setError(null);
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            Retour
          </button>
          <button type="submit" className="btn-primary" disabled={busy || (step < 4 && !canNext())}>
            {step < 4 ? "Continuer" : busy ? "Création…" : "Créer le compte"}
          </button>
        </div>
      </form>
    </div>
  );
}
