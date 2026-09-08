import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, DEMO_PASSWORD, getSession, updateSession } from "./auth";
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
import BirthsPage from "./pages/BirthsPage";
import CensusPage from "./pages/CensusPage";
import DeathsPage from "./pages/DeathsPage";
import MarriagesPage from "./pages/MarriagesPage";
import AdoptionsPage from "./pages/AdoptionsPage";
import DisplacementsPage from "./pages/DisplacementsPage";
import DivorcesPage from "./pages/DivorcesPage";
import DocumentsPage from "./pages/DocumentsPage";
import ActsPage from "./pages/ActsPage";
import SearchPage from "./pages/SearchPage";
import TerritoryPage from "./pages/TerritoryPage";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>État civil</strong>
          <span>E-GOUV · Commune</span>
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
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/births">Naissances</NavLink>
          <NavLink to="/census">Recensement</NavLink>
          <NavLink to="/deaths">Décès</NavLink>
          <NavLink to="/marriages">Mariages</NavLink>
          <NavLink to="/adoptions">Adoption</NavLink>
          <NavLink to="/displacements">Déplacement</NavLink>
          <NavLink to="/divorces">Divorce</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/acts">Actes</NavLink>
          <NavLink to="/territory">Territoire RDC</NavLink>
          <NavLink to="/search">Recherche</NavLink>
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
            <h1 className="topbar-title">État civil</h1>
          </div>

          <div className="topbar-center" title={roleTitle}>
            <span className="topbar-role">{roleTitle}</span>
            <strong className="topbar-responsable">{responsableLabel}</strong>
          </div>

          <div className="topbar-right">
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
            <Route path="/births" element={<BirthsPage />} />
            <Route path="/census" element={<CensusPage />} />
            <Route path="/deaths" element={<DeathsPage />} />
            <Route path="/marriages" element={<MarriagesPage />} />
            <Route path="/adoptions" element={<AdoptionsPage />} />
            <Route path="/displacements" element={<DisplacementsPage />} />
            <Route path="/divorces" element={<DivorcesPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/acts" element={<ActsPage />} />
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
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
