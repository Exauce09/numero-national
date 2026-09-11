import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { clearSession, DEMO_PASSWORD, getSession, updateSession } from "./auth";
import { canSeeNav } from "./rbac";
import {
  clearHealthSession,
  getHealthSession,
  isHealthAccountActive,
  updateHealthPassword,
} from "./healthAuth";
import {
  applyHealthTheme,
  getHealthPrefs,
  healthUnreadCount,
  listHealthNotifications,
  markAllHealthNotificationsRead,
  markHealthNotificationRead,
  saveHealthPrefs,
  type HealthNotification,
  type HealthPrefs,
} from "./healthPrefs";
import {
  applyTheme,
  getPrefs,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  savePrefs,
  unreadCount,
  type AppNotification,
  type UserPrefs,
} from "./prefs";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PopulationPage from "./pages/PopulationPage";
import PersonDetailPage from "./pages/PersonDetailPage";
import NewbornsPage from "./pages/NewbornsPage";
import BirthsPage from "./pages/BirthsPage";
import CensusPage from "./pages/CensusPage";
import CouponScanPage from "./pages/CouponScanPage";
import DeathsPage from "./pages/DeathsPage";
import BureauxPage from "./pages/BureauxPage";
import PersonnelPage from "./pages/PersonnelPage";
import AccountRequestsPage from "./pages/AccountRequestsPage";
import DocumentVerifyPage from "./pages/DocumentVerifyPage";
import MarriagesPage from "./pages/MarriagesPage";
import AdoptionsPage from "./pages/AdoptionsPage";
import DisplacementsPage from "./pages/DisplacementsPage";
import DivorcesPage from "./pages/DivorcesPage";
import DocumentsPage from "./pages/DocumentsPage";
import CardDeliveryPage from "./pages/CardDeliveryPage";
import ActsPage from "./pages/ActsPage";
import SearchPage from "./pages/SearchPage";
import DeclarationsPage from "./pages/DeclarationsPage";
import TranscriptionsPage from "./pages/TranscriptionsPage";
import HealthDashboardPage from "./pages/HealthDashboardPage";
import HealthBirthsPage from "./pages/HealthBirthsPage";
import HealthDeathsPage from "./pages/HealthDeathsPage";
import HealthLoginPage from "./pages/HealthLoginPage";
import HealthSynopticPage from "./pages/HealthSynopticPage";
import ManageDecesPage from "./pages/ManageDecesPage";
import ManageDivorcePage from "./pages/ManageDivorcePage";
import ManageAdoptionPage from "./pages/ManageAdoptionPage";
import ManageDeplacementPage from "./pages/ManageDeplacementPage";
import ManageDocumentPage from "./pages/ManageDocumentPage";
import ManageMariagePage from "./pages/ManageMariagePage";
import ManageNaissancePage from "./pages/ManageNaissancePage";
import SynopticPage from "./pages/SynopticPage";
import ManageActsPage, { MANAGE_CONFIGS } from "./components/ManageActsPage";
import TerritoryPage from "./pages/TerritoryPage";
import BiometricDashboardPage from "./pages/BiometricDashboardPage";
import BiometricEnrollPage from "./pages/BiometricEnrollPage";
import BiometricIdentifyPage from "./pages/BiometricIdentifyPage";
import TopbarSearch from "./components/TopbarSearch";
import {
  IconBaby,
  IconCar,
  IconClipboard,
  IconCross,
  IconDashboard,
  IconFile,
  IconHome,
  IconRing,
  IconSplit,
  IconTable,
  IconUsers,
} from "./components/Icons";

function RequireCivil({ children }: { children: ReactNode }) {
  if (getHealthSession()) return <Navigate to="/sante" replace />;
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PersonDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/population/${id ?? ""}`} replace />;
}

function RequireHealth({ children }: { children: ReactNode }) {
  const session = getHealthSession();
  if (!session) return <Navigate to="/sante/login" replace />;
  if (!isHealthAccountActive(session.facilityId)) {
    clearHealthSession();
    return <Navigate to="/sante/login" replace />;
  }
  return <>{children}</>;
}

function HealthShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getHealthSession()!;
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefs, setPrefs] = useState<HealthPrefs>(() => getHealthPrefs());
  const [notifs, setNotifs] = useState<HealthNotification[]>(() => listHealthNotifications());
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    applyHealthTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen || notifOpen || profileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen, notifOpen, profileOpen]);

  function logout() {
    clearHealthSession();
    navigate("/sante/login", { replace: true });
  }

  function persistPrefs(next: HealthPrefs) {
    saveHealthPrefs(next);
    setPrefs(next);
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      persistPrefs({ ...prefs, photoDataUrl: String(reader.result ?? "") });
    };
    reader.readAsDataURL(file);
  }

  function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    setPwdError(null);
    if (newPwd !== confirmPwd) {
      setPwdError("La confirmation ne correspond pas.");
      return;
    }
    try {
      updateHealthPassword(session.username, currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg("Mot de passe mis à jour.");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Changement impossible.");
    }
  }

  const communeLabel = session.commune_name ? `Commune de ${session.commune_name}` : null;
  const badge = healthUnreadCount();
  const photo = prefs.photoDataUrl;

  return (
    <div className={`page-wrapper${navOpen ? " nav-open" : ""}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>Structure sanitaire</strong>
          <span>E-GOUV · Santé</span>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setNavOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/sante" end onClick={() => setNavOpen(false)}>
            <IconDashboard size={18} /> Tableau de bord
          </NavLink>
          <NavLink
            to="/sante/synoptique/naissances"
            className={({ isActive }) =>
              isActive || location.pathname.startsWith("/sante/synoptique") ? "active" : undefined
            }
            onClick={() => setNavOpen(false)}
          >
            <IconTable size={18} /> Tableau synoptique
          </NavLink>
          <NavLink to="/sante/births" onClick={() => setNavOpen(false)}>
            <IconBaby size={18} /> Nouveau-né
          </NavLink>
          <NavLink to="/sante/deaths" onClick={() => setNavOpen(false)}>
            <IconCross size={18} /> Décès
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar topbar-3">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label={navOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={navOpen}
              aria-controls="app-sidebar"
              onClick={() => setNavOpen((o) => !o)}
            >
              <span />
            </button>
            <h1 className="topbar-title">Structure sanitaire</h1>
          </div>

          <div className="topbar-center" title={session.roleTitle}>
            <span className="topbar-role">{session.roleTitle}</span>
            {communeLabel ? <span className="topbar-commune">{communeLabel}</span> : null}
            <strong className="topbar-responsable">{session.facilityName}</strong>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true);
                setProfileOpen(false);
                setNotifs(listHealthNotifications());
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              {badge > 0 ? <span className="topbar-badge">{badge}</span> : null}
            </button>

            <button
              type="button"
              className="topbar-icon-btn topbar-profile-btn"
              aria-label="Profil"
              onClick={() => {
                setProfileOpen(true);
                setNotifOpen(false);
              }}
            >
              {photo ? (
                <img className="profile-photo-lg" src={photo} alt="" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M5 19.5c1.8-3.2 4.2-4.5 7-4.5s5.2 1.3 7 4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="shell">
          <Routes>
            <Route path="/" element={<HealthDashboardPage />} />
            <Route path="/synoptique" element={<HealthSynopticPage />} />
            <Route path="/synoptique/:section" element={<HealthSynopticPage />} />
            <Route path="/births" element={<HealthBirthsPage />} />
            <Route path="/deaths" element={<HealthDeathsPage />} />
            <Route path="*" element={<Navigate to="/sante" replace />} />
          </Routes>
        </main>
      </div>

      {notifOpen ? (
        <div className="modal-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Notifications
              </h3>
              <div className="modal-actions" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="btn-add btn-sm"
                  onClick={() => setNotifs(markAllHealthNotificationsRead())}
                >
                  Tout marquer lu
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNotifOpen(false)}>
                  Fermer
                </button>
              </div>
            </div>
            {notifs.map((n) => (
              <article key={n.id} className={`notif-item${n.read ? "" : " unread"}`}>
                <h4 className="notif-title">{n.title}</h4>
                <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                  {n.body}
                </p>
                <p className="muted small" style={{ margin: "0 0 0.65rem" }}>
                  {new Date(n.created_at).toLocaleString("fr-CD")}
                </p>
                <div className="table-actions">
                  {!n.read ? (
                    <button
                      type="button"
                      className="btn-add btn-sm"
                      onClick={() => setNotifs(markHealthNotificationRead(n.id))}
                    >
                      Marquer lu
                    </button>
                  ) : null}
                  {n.href ? (
                    <button
                      type="button"
                      className="btn-next btn-sm"
                      onClick={() => {
                        setNotifs(markHealthNotificationRead(n.id));
                        setNotifOpen(false);
                        navigate(n.href!);
                      }}
                    >
                      Ouvrir
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Profil
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setProfileOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
              {photo ? (
                <img className="profile-photo" src={photo} alt="Profil" />
              ) : (
                <div className="profile-photo" style={{ display: "grid", placeItems: "center" }}>
                  <span className="muted">Photo</span>
                </div>
              )}
              <div>
                <strong>{session.facilityName}</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0.65rem" }}>
                  @{session.username}
                </p>
                <label className="btn-add btn-sm" style={{ cursor: "pointer" }}>
                  Ajouter / changer photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 0 }}>
              <h4 className="panel-title">Apparence</h4>
              <div className="theme-switch">
                <button
                  type="button"
                  className={prefs.theme === "light" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "light" })}
                >
                  Mode clair
                </button>
                <button
                  type="button"
                  className={prefs.theme === "dark" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "dark" })}
                >
                  Mode sombre
                </button>
              </div>
            </div>

            <form className="panel" onSubmit={onChangePassword}>
              <h4 className="panel-title">Changer le mot de passe</h4>
              {pwdError ? <div className="login-error">{pwdError}</div> : null}
              {pwdMsg ? <div className="success-banner">{pwdMsg}</div> : null}
              <label className="form-label">Mot de passe actuel</label>
              <input
                className="form-control"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
              />
              <label className="form-label">Nouveau mot de passe</label>
              <input
                className="form-control"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
              />
              <label className="form-label">Confirmer</label>
              <input
                className="form-control"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 160 }}>
                Enregistrer
              </button>
            </form>

            <button type="button" className="btn-logout" style={{ width: "100%", marginTop: "0.75rem" }} onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(() => getPrefs());
  const [notifs, setNotifs] = useState<AppNotification[]>(() => listNotifications());
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen || notifOpen || profileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen, notifOpen, profileOpen]);

  function logout() {
    clearSession();
    clearHealthSession();
    navigate("/login", { replace: true });
  }

  function persistPrefs(next: UserPrefs) {
    savePrefs(next);
    setPrefs(next);
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = String(reader.result ?? "");
      persistPrefs({ ...prefs, photoDataUrl });
      updateSession({ photoDataUrl });
    };
    reader.readAsDataURL(file);
  }

  function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    setPwdError(null);
    const expected = prefs.passwordOverride || DEMO_PASSWORD;
    if (currentPwd !== expected) {
      setPwdError("Mot de passe actuel incorrect.");
      return;
    }
    if (newPwd.length < 8) {
      setPwdError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("La confirmation ne correspond pas.");
      return;
    }
    persistPrefs({ ...prefs, passwordOverride: newPwd });
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdMsg("Mot de passe mis à jour.");
  }

  const responsableLabel = session?.displayName ?? session?.username ?? "—";
  const roleTitle = session?.roleTitle ?? "Responsable — Officier d'état civil";
  const communeLabel = session?.commune_name
    ? `Commune de ${session.commune_name}`
    : null;
  const territoryLine = [
    session?.commune_province,
    session?.commune_ville,
    session?.commune_name ? `Commune de ${session.commune_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const roles = session?.roles ?? ["OFFICIER_ETAT_CIVIL"];
  const permissions = session?.permissions ?? [];
  const badge = unreadCount();
  const photo = prefs.photoDataUrl || session?.photoDataUrl;

  return (
    <div className={`page-wrapper${navOpen ? " nav-open" : ""}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="République démocratique du Congo" />
          <strong>Système national de gestion de la population</strong>
          <span>RDC · E-GOUV</span>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setNavOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          {canSeeNav("dashboard", roles, permissions) ? (
            <NavLink to="/" end>
              <IconDashboard size={18} /> Tableau de bord
            </NavLink>
          ) : null}
          {canSeeNav("synoptique", roles, permissions) ? (
            <NavLink
              to="/synoptique/naissances"
              className={({ isActive }) =>
                isActive || location.pathname.startsWith("/synoptique") ? "active" : undefined
              }
            >
              <IconTable size={18} /> Tableau synoptique
            </NavLink>
          ) : null}
          {canSeeNav("population", roles, permissions) ? (
            <NavLink
              to="/population"
              className={({ isActive }) =>
                isActive ||
                location.pathname.startsWith("/population") ||
                location.pathname.startsWith("/personnes") ||
                location.pathname.startsWith("/lists/population")
                  ? "active"
                  : undefined
              }
            >
              <IconUsers size={18} /> Population
            </NavLink>
          ) : null}
          {canSeeNav("biometrie", roles, permissions) ? (
            <NavLink
              to="/biometrie"
              className={({ isActive }) =>
                isActive || location.pathname.startsWith("/biometrie") ? "active" : undefined
              }
            >
              <IconClipboard size={18} /> Biométrie
            </NavLink>
          ) : null}
          {canSeeNav("naissances", roles, permissions) ? (
            <NavLink to="/manage/naissance">
              <IconBaby size={18} /> Naissances
            </NavLink>
          ) : null}
          {canSeeNav("census", roles, permissions) ? (
            <NavLink to="/census">
              <IconClipboard size={18} /> Recensement
            </NavLink>
          ) : null}
          {canSeeNav("census", roles, permissions) ? (
            <NavLink to="/census/scan-coupon">
              <IconClipboard size={18} /> Scan coupon APK
            </NavLink>
          ) : null}
          {canSeeNav("deces", roles, permissions) ? (
            <NavLink to="/manage/deces">
              <IconCross size={18} /> Décès
            </NavLink>
          ) : null}
          {canSeeNav("mariages", roles, permissions) ? (
            <NavLink to="/manage/mariage">
              <IconRing size={18} /> Mariages
            </NavLink>
          ) : null}
          {canSeeNav("naissances", roles, permissions) ? (
            <NavLink to="/manage/adoption">
              <IconHome size={18} /> Adoption
            </NavLink>
          ) : null}
          {canSeeNav("census", roles, permissions) ? (
            <NavLink to="/manage/deplacement">
              <IconCar size={18} /> Déplacement
            </NavLink>
          ) : null}
          {canSeeNav("divorces", roles, permissions) ? (
            <NavLink to="/manage/divorce">
              <IconSplit size={18} /> Divorce
            </NavLink>
          ) : null}
          {canSeeNav("documents", roles, permissions) ? (
            <NavLink to="/acts">
              <IconFile size={18} /> Actes & documents
            </NavLink>
          ) : null}
          {canSeeNav("cartes", roles, permissions) ? (
            <NavLink to="/cartes-livraison">
              <IconFile size={18} /> Livraison cartes ID
            </NavLink>
          ) : null}
          {canSeeNav("declarations", roles, permissions) ? (
            <NavLink to="/declarations">
              <IconClipboard size={18} /> Déclarations santé
            </NavLink>
          ) : null}
          {canSeeNav("validation", roles, permissions) ? (
            <NavLink to="/transcriptions">
              <IconFile size={18} /> Transcriptions
            </NavLink>
          ) : null}
          {canSeeNav("admin_bureaux", roles, permissions) ? (
            <NavLink to="/admin/bureaux">
              <IconHome size={18} /> Bureaux EC
            </NavLink>
          ) : null}
          {canSeeNav("admin_personnel", roles, permissions) ? (
            <NavLink to="/admin/personnel">
              <IconUsers size={18} /> Personnel
            </NavLink>
          ) : null}
          {canSeeNav("admin_accounts", roles, permissions) ? (
            <NavLink to="/admin/account-requests">
              <IconClipboard size={18} /> Demandes de compte
            </NavLink>
          ) : null}
          {canSeeNav("documents", roles, permissions) ? (
            <NavLink to="/verify-document">
              <IconFile size={18} /> Vérifier document
            </NavLink>
          ) : null}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar topbar-3">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label={navOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={navOpen}
              aria-controls="app-sidebar"
              onClick={() => setNavOpen((o) => !o)}
            >
              <span />
            </button>
            <div title="République démocratique du Congo">
              <h1 className="topbar-title">Population</h1>
            </div>
          </div>

          <div className="topbar-center">
            <TopbarSearch />
          </div>

          <div className="topbar-right">
            <div
              className="topbar-identity"
              title={[roleTitle, territoryLine || communeLabel].filter(Boolean).join(" · ")}
            >
              <strong className="topbar-responsable">{responsableLabel}</strong>
              <span className="topbar-role">{roleTitle}</span>
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true);
                setProfileOpen(false);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              {badge > 0 ? <span className="topbar-badge">{badge}</span> : null}
            </button>

            <button
              type="button"
              className="topbar-icon-btn topbar-profile-btn"
              aria-label="Profil"
              onClick={() => {
                setProfileOpen(true);
                setNotifOpen(false);
              }}
            >
              {photo ? (
                <img className="profile-photo-lg" src={photo} alt="" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M5 19.5c1.8-3.2 4.2-4.5 7-4.5s5.2 1.3 7 4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/synoptique" element={<SynopticPage />} />
            <Route path="/synoptique/:section" element={<SynopticPage />} />
            <Route path="/population" element={<PopulationPage />} />
            <Route path="/population/:id" element={<PersonDetailPage />} />
            <Route path="/biometrie" element={<BiometricDashboardPage />} />
            <Route path="/biometrie/enrolement" element={<BiometricEnrollPage />} />
            <Route path="/biometrie/identification" element={<BiometricIdentifyPage />} />
            <Route path="/lists/population" element={<PopulationPage showAnalytics />} />
            <Route path="/personnes" element={<Navigate to="/population" replace />} />
            <Route path="/personnes/:id" element={<PersonDetailRedirect />} />
            <Route path="/newborns" element={<NewbornsPage />} />
            <Route path="/manage/deces" element={<ManageDecesPage />} />
            <Route path="/manage/divorce" element={<ManageDivorcePage />} />
            <Route path="/manage/adoption" element={<ManageAdoptionPage />} />
            <Route path="/manage/deplacement" element={<ManageDeplacementPage />} />
            <Route path="/manage/document" element={<ManageDocumentPage />} />
            <Route path="/manage/mariage" element={<ManageMariagePage />} />
            <Route path="/manage/naissance" element={<ManageNaissancePage />} />
            <Route path="/lists/deces" element={<ManageActsPage config={MANAGE_CONFIGS.deces} showAnalytics />} />
            <Route path="/lists/divorce" element={<ManageActsPage config={MANAGE_CONFIGS.divorce} showAnalytics />} />
            <Route path="/lists/adoption" element={<ManageActsPage config={MANAGE_CONFIGS.adoption} showAnalytics />} />
            <Route path="/lists/deplacement" element={<ManageActsPage config={MANAGE_CONFIGS.deplacement} showAnalytics />} />
            <Route path="/lists/mariage" element={<ManageActsPage config={MANAGE_CONFIGS.mariage} showAnalytics />} />
            <Route path="/lists/naissance" element={<ManageActsPage config={MANAGE_CONFIGS.naissance} showAnalytics />} />
            <Route path="/lists/acts" element={<ActsPage showAnalytics />} />
            <Route path="/births" element={<BirthsPage />} />
            <Route path="/census" element={<CensusPage />} />
            <Route path="/census/scan-coupon" element={<CouponScanPage />} />
            <Route path="/deaths" element={<DeathsPage />} />
            <Route path="/marriages" element={<MarriagesPage />} />
            <Route path="/adoptions" element={<AdoptionsPage />} />
            <Route path="/displacements" element={<DisplacementsPage />} />
            <Route path="/divorces" element={<DivorcesPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/cartes-livraison" element={<CardDeliveryPage />} />
            <Route path="/acts" element={<ActsPage />} />
            <Route path="/declarations" element={<DeclarationsPage />} />
            <Route path="/transcriptions" element={<TranscriptionsPage />} />
            <Route path="/admin/bureaux" element={<BureauxPage />} />
            <Route path="/admin/personnel" element={<PersonnelPage />} />
            <Route path="/admin/account-requests" element={<AccountRequestsPage />} />
            <Route path="/verify-document" element={<DocumentVerifyPage />} />
            <Route path="/territory" element={<TerritoryPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </main>
      </div>

      {notifOpen ? (
        <div className="modal-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Notifications
              </h3>
              <div className="modal-actions" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="btn-add btn-sm"
                  onClick={() => setNotifs(markAllNotificationsRead())}
                >
                  Tout marquer lu
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNotifOpen(false)}>
                  Fermer
                </button>
              </div>
            </div>
            {notifs.map((n) => (
              <article key={n.id} className={`notif-item${n.read ? "" : " unread"}`}>
                <h4 className="notif-title">{n.title}</h4>
                <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                  {n.body}
                </p>
                <p className="muted small" style={{ margin: "0 0 0.65rem" }}>
                  {new Date(n.created_at).toLocaleString("fr-CD")}
                </p>
                <div className="table-actions">
                  {!n.read ? (
                    <button
                      type="button"
                      className="btn-add btn-sm"
                      onClick={() => setNotifs(markNotificationRead(n.id))}
                    >
                      Marquer lu
                    </button>
                  ) : null}
                  {n.href ? (
                    <button
                      type="button"
                      className="btn-next btn-sm"
                      onClick={() => {
                        setNotifs(markNotificationRead(n.id));
                        setNotifOpen(false);
                        navigate(n.href!);
                      }}
                    >
                      Ouvrir
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Profil
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setProfileOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
              {photo ? (
                <img className="profile-photo" src={photo} alt="Profil" />
              ) : (
                <div className="profile-photo" style={{ display: "grid", placeItems: "center" }}>
                  <span className="muted">Photo</span>
                </div>
              )}
              <div>
                <strong>{responsableLabel}</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0.65rem" }}>
                  @{session?.username}
                </p>
                <label className="btn-add btn-sm" style={{ cursor: "pointer" }}>
                  Ajouter / changer photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 0 }}>
              <h4 className="panel-title">Apparence</h4>
              <div className="theme-switch">
                <button
                  type="button"
                  className={prefs.theme === "light" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "light" })}
                >
                  Mode clair
                </button>
                <button
                  type="button"
                  className={prefs.theme === "dark" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "dark" })}
                >
                  Mode sombre
                </button>
              </div>
            </div>

            <form className="panel" onSubmit={onChangePassword}>
              <h4 className="panel-title">Changer le mot de passe</h4>
              {pwdError ? <div className="login-error">{pwdError}</div> : null}
              {pwdMsg ? <div className="success-banner">{pwdMsg}</div> : null}
              <label className="form-label">Mot de passe actuel</label>
              <input
                className="form-control"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
              />
              <label className="form-label">Nouveau mot de passe</label>
              <input
                className="form-control"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
              />
              <label className="form-label">Confirmer</label>
              <input
                className="form-control"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 160 }}>
                Enregistrer
              </button>
            </form>

            <button type="button" className="btn-logout" style={{ width: "100%", marginTop: "0.75rem" }} onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    applyTheme(getPrefs().theme);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sante/login" element={<HealthLoginPage />} />
      <Route
        path="/sante/*"
        element={
          <RequireHealth>
            <HealthShell />
          </RequireHealth>
        }
      />
      <Route
        path="/*"
        element={
          <RequireCivil>
            <Shell />
          </RequireCivil>
        }
      />
    </Routes>
  );
}
