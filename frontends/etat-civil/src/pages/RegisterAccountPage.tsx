/**
 * Création de compte — réservé au SUPER_ADMIN_NATIONAL.
 * Crée l'identité ; n'attribue jamais un rôle privilégié automatiquement.
 */

import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ACCOUNT_TYPE_OPTIONS,
  checkPasswordStrength,
  getAccountTypeOption,
  getLocalOtpHint,
  maskPhone,
  resendRegistrationOtp,
  submitAccountRegistration,
  verifyRegistrationOtp,
  type AccountRegistrationRequest,
  type AccountRequestType,
} from "../accountRegistration";
import { getSession } from "../auth";
import PasswordField from "../components/PasswordField";
import { isSuperAdminNational } from "../ecUsers";

type Step = "form" | "otp" | "done";

export default function RegisterAccountPage() {
  const session = getSession();
  const allowed = isSuperAdminNational(session?.roles);

  const [step, setStep] = useState<Step>("form");
  const [accountType, setAccountType] = useState<AccountRequestType>("CITOYEN");
  const typeOpt = getAccountTypeOption(accountType);

  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");

  const [matricule, setMatricule] = useState("");
  const [fonction, setFonction] = useState("");
  const [institution, setInstitution] = useState("");
  const [province, setProvince] = useState("");
  const [villeTerritoire, setVilleTerritoire] = useState("");
  const [communeSecteur, setCommuneSecteur] = useState("");
  const [serviceBureau, setServiceBureau] = useState("");
  const [juridiction, setJuridiction] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [idJudiciaire, setIdJudiciaire] = useState("");

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [localOtp, setLocalOtp] = useState<string | null>(null);
  const [result, setResult] = useState<AccountRegistrationRequest | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => checkPasswordStrength(password), [password]);
  const canSubmit = acceptTerms && acceptPrivacy && !busy;

  if (!session) return <Navigate to="/login" replace />;
  if (!allowed) {
    return (
      <div className="register-page">
        <div className="register-shell">
          <h2 className="register-title">Accès réservé</h2>
          <p className="register-subtitle">
            Seul le <strong>super administrateur national</strong> (SUPER_ADMIN_NATIONAL) peut créer
            des comptes via cet écran.
          </p>
          <Link className="btn-primary register-submit" to="/" style={{ display: "block", textAlign: "center" }}>
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!strength.ok) {
      setError("Le mot de passe ne respecte pas les exigences de sécurité.");
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      setError("Acceptez les conditions et la politique de confidentialité.");
      return;
    }
    setBusy(true);
    try {
      const { request, localOtpCode } = await submitAccountRegistration({
        accountType,
        nom,
        postnom,
        prenom,
        dateNaissance,
        sexe,
        telephone,
        email,
        loginId: loginId.trim() || email,
        password,
        matricule,
        fonction,
        institution,
        province,
        villeTerritoire,
        communeSecteur,
        serviceBureau,
        juridiction,
        tribunal,
        idJudiciaire,
        createdBySuperAdminEmail: session!.username,
      });
      setResult(request);
      setLocalOtp(localOtpCode);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setError("Saisissez le code à 6 chiffres.");
      return;
    }
    setBusy(true);
    try {
      const verified = await verifyRegistrationOtp(code);
      setResult(verified);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vérification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setBusy(true);
    try {
      const code = await resendRegistrationOtp();
      setLocalOtp(code);
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Renvoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  function setOtpAt(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) {
      const el = document.getElementById(`otp-${index + 1}`);
      el?.focus();
    }
  }

  const progress =
    step === "form" ? 33 : step === "otp" ? 66 : 100;

  return (
    <div className="register-page">
      <div className="register-shell">
        <header className="register-brand">
          <img src="/logo-rdc.jpg" alt="RDC" className="register-logo" />
          <div>
            <p className="register-brand-kicker">République Démocratique du Congo</p>
            <h1 className="register-brand-title">Plateforme Nationale de l&apos;État Civil</h1>
          </div>
        </header>

        <div className="register-progress" aria-hidden>
          <div className="register-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="register-progress-label muted small">
          {step === "form"
            ? "Étape 1 / 3 — Formulaire"
            : step === "otp"
              ? "Étape 2 / 3 — Vérification téléphone"
              : "Étape 3 / 3 — Confirmation"}
        </p>

        {step === "form" ? (
          <>
            <h2 className="register-title">Créer un compte</h2>
            <p className="register-subtitle">
              Créez un compte pour un utilisateur de la plateforme nationale de l&apos;état civil.
            </p>
            <p className="register-note muted small">
              Réservé au <strong>SUPER_ADMIN_NATIONAL</strong> ({session.username}). Le type de
              compte demandé <strong>n&apos;attribue aucun rôle</strong> automatiquement —
              l&apos;habilitation se fait séparément.
            </p>

            <form className="register-form" onSubmit={(e) => void onSubmitForm(e)} autoComplete="off">
              {error ? (
                <div className="login-error" role="alert">
                  {error}
                </div>
              ) : null}

              <section className="register-section">
                <h3 className="register-section-title">Type de compte</h3>
                <div className="register-type-grid" role="radiogroup" aria-label="Type de compte">
                  {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      className={`register-type-card${accountType === opt.code ? " is-selected" : ""}`}
                      onClick={() => setAccountType(opt.code)}
                      aria-pressed={accountType === opt.code}
                    >
                      <strong>{opt.label}</strong>
                      <span>{opt.summary}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="register-section">
                <h3 className="register-section-title">Informations personnelles</h3>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Nom *</label>
                    <input
                      className="form-control"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="form-label">Postnom *</label>
                    <input
                      className="form-control"
                      value={postnom}
                      onChange={(e) => setPostnom(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="form-label">Prénom *</label>
                    <input
                      className="form-control"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="form-label">Date de naissance *</label>
                    <input
                      className="form-control"
                      type="date"
                      value={dateNaissance}
                      onChange={(e) => setDateNaissance(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="form-label">Sexe *</label>
                    <select
                      className="form-control"
                      value={sexe}
                      onChange={(e) => setSexe(e.target.value as "M" | "F")}
                      disabled={busy}
                    >
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Numéro de téléphone *</label>
                    <input
                      className="form-control"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="+243 …"
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="full">
                    <label className="form-label">Adresse e-mail *</label>
                    <input
                      className="form-control"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                </div>
              </section>

              {typeOpt.institutional ? (
                <section className="register-section">
                  <h3 className="register-section-title">Informations professionnelles</h3>
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Matricule professionnel</label>
                      <input
                        className="form-control"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="form-label">Fonction</label>
                      <input
                        className="form-control"
                        value={fonction}
                        onChange={(e) => setFonction(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="full">
                      <label className="form-label">Institution *</label>
                      <input
                        className="form-control"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        required
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="form-label">Province *</label>
                      <input
                        className="form-control"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        required
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="form-label">Ville / Territoire</label>
                      <input
                        className="form-control"
                        value={villeTerritoire}
                        onChange={(e) => setVilleTerritoire(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="form-label">Commune / Secteur</label>
                      <input
                        className="form-control"
                        value={communeSecteur}
                        onChange={(e) => setCommuneSecteur(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="form-label">Service ou bureau</label>
                      <input
                        className="form-control"
                        value={serviceBureau}
                        onChange={(e) => setServiceBureau(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    {typeOpt.needsJudgeFields ? (
                      <>
                        <div>
                          <label className="form-label">Juridiction *</label>
                          <input
                            className="form-control"
                            value={juridiction}
                            onChange={(e) => setJuridiction(e.target.value)}
                            required
                            disabled={busy}
                          />
                        </div>
                        <div>
                          <label className="form-label">Tribunal *</label>
                          <input
                            className="form-control"
                            value={tribunal}
                            onChange={(e) => setTribunal(e.target.value)}
                            required
                            disabled={busy}
                          />
                        </div>
                        <div className="full">
                          <label className="form-label">N° / identifiant professionnel judiciaire</label>
                          <input
                            className="form-control"
                            value={idJudiciaire}
                            onChange={(e) => setIdJudiciaire(e.target.value)}
                            disabled={busy}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="register-section">
                <h3 className="register-section-title">Sécurité du compte</h3>
                <div className="form-grid">
                  <div className="full">
                    <label className="form-label">Adresse e-mail ou identifiant *</label>
                    <input
                      className="form-control"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="Par défaut : votre e-mail"
                      disabled={busy}
                    />
                  </div>
                  <div className="full">
                    <PasswordField
                      label="Mot de passe *"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={busy}
                      autoComplete="new-password"
                    />
                    <div className="pwd-meter" aria-live="polite">
                      <div className="pwd-meter-track">
                        <div
                          className={`pwd-meter-fill score-${strength.score}`}
                          style={{ width: `${(strength.score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="muted small">Robustesse : {strength.label}</span>
                    </div>
                    <ul className="pwd-rules muted small">
                      <li className={strength.minLength ? "ok" : ""}>Minimum 8 caractères</li>
                      <li className={strength.upper ? "ok" : ""}>Une majuscule</li>
                      <li className={strength.lower ? "ok" : ""}>Une minuscule</li>
                      <li className={strength.digit ? "ok" : ""}>Un chiffre</li>
                      <li className={strength.special ? "ok" : ""}>Un caractère spécial</li>
                    </ul>
                  </div>
                  <div className="full">
                    <PasswordField
                      label="Confirmer le mot de passe *"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      disabled={busy}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </section>

              <section className="register-section">
                <h3 className="register-section-title">Conditions d&apos;utilisation</h3>
                <label className="register-check">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    disabled={busy}
                  />
                  <span>J&apos;accepte les conditions d&apos;utilisation.</span>
                </label>
                <label className="register-check">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    J&apos;accepte la politique de confidentialité et de protection des données.
                  </span>
                </label>
              </section>

              <button className="btn-primary register-submit" type="submit" disabled={!canSubmit}>
                {busy ? "Envoi…" : "Créer le compte"}
              </button>
            </form>
          </>
        ) : null}

        {step === "otp" ? (
          <form className="register-form" onSubmit={(e) => void onVerifyOtp(e)}>
            <h2 className="register-title">Vérification de votre numéro</h2>
            <p className="register-subtitle">
              Un code de vérification a été envoyé au{" "}
              <strong>{maskPhone(result?.telephone || telephone)}</strong>
            </p>
            {localOtp || getLocalOtpHint() ? (
              <p className="muted small register-note">
                Environnement local — code de test :{" "}
                <code>{localOtp || getLocalOtpHint()}</code>
              </p>
            ) : null}
            {error ? (
              <div className="login-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="otp-row">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  className="otp-cell form-control"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setOtpAt(i, e.target.value)}
                  disabled={busy}
                  aria-label={`Chiffre ${i + 1}`}
                />
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={() => void onResend()} disabled={busy}>
              Renvoyer le code
            </button>
            <button className="btn-primary register-submit" type="submit" disabled={busy}>
              {busy ? "Vérification…" : "Vérifier"}
            </button>
          </form>
        ) : null}

        {step === "done" && result ? (
          <div className="register-done">
            <h2 className="register-title">Compte enregistré</h2>
            {result.created_by_super_admin ? (
              <>
                <div className="success-banner">Identité créée par le super administrateur</div>
                <p className="muted">
                  Téléphone vérifié. Attribuez ensuite le rôle via{" "}
                  <Link to="/users">Utilisateurs</Link> ou le module d&apos;habilitation — aucun rôle
                  n&apos;a été accordé automatiquement.
                </p>
              </>
            ) : getAccountTypeOption(result.accountType).institutional ? (
              <>
                <div className="success-banner">Compte en attente de validation</div>
                <ol className="register-flow muted">
                  <li>Demande de création</li>
                  <li>Vérification des informations</li>
                  <li>Vérification de l&apos;institution</li>
                  <li>Validation par une autorité habilitée</li>
                  <li>Attribution du rôle (séparée)</li>
                  <li>Activation du compte</li>
                </ol>
              </>
            ) : (
              <>
                <div className="success-banner">Identité citoyenne créée</div>
                <p className="muted">
                  Numéro vérifié. Les accès métier restent soumis aux procédures de la plateforme.
                </p>
              </>
            )}
            <p className="muted small">
              Réf. : <code>{result.id.slice(0, 8)}</code> — {result.email}
            </p>
            <button
              type="button"
              className="btn-primary register-submit"
              onClick={() => {
                setStep("form");
                setResult(null);
                setNom("");
                setPostnom("");
                setPrenom("");
                setDateNaissance("");
                setTelephone("");
                setEmail("");
                setPassword("");
                setConfirm("");
                setOtpDigits(["", "", "", "", "", ""]);
                setAcceptTerms(false);
                setAcceptPrivacy(false);
              }}
            >
              Créer un autre compte
            </button>
            <Link
              className="btn-secondary register-submit"
              to="/"
              style={{ display: "block", textAlign: "center", marginTop: "0.5rem" }}
            >
              Tableau de bord
            </Link>
          </div>
        ) : null}

        {step !== "done" ? (
          <p className="register-footer muted">
            <Link to="/">← Retour au tableau de bord</Link>
            {" · "}
            <Link to="/account-requests">Demandes de compte</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
