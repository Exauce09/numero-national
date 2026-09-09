import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, updateCitizenPassword } from "./auth";
import {
  applyCitizenTheme,
  citizenUnreadCount,
  getCitizenPrefs,
  listCitizenNotifications,
  markAllCitizenNotificationsRead,
  markCitizenNotificationRead,
  saveCitizenPrefs,
  type CitizenNotification,
  type CitizenPrefs,
} from "./citizenPrefs";
import { displayCitizenName, getCitizenProfile } from "./citizenProfile";
import CardPage from "./pages/Card";
import DashboardPage from "./pages/Dashboard";
import DocumentsPage from "./pages/Documents";
import LoginPage from "./pages/LoginPage";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession()!;
  const profile = getCitizenProfile();
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefs, setPrefs] = useState<CitizenPrefs>(() => getCitizenPrefs());
  const [notifs, setNotifs] = useState<CitizenNotification[]>(() => listCitizenNotifications());
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    applyCitizenTheme(prefs.theme);
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

  function persistPrefs(next: CitizenPrefs) {
    saveCitizenPrefs(next);
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
      updateCitizenPassword(currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg("Mot de passe mis à jour.");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Changement impossible.");
    }
  }

  const badge = citizenUnreadCount();
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
          <strong>Numéro National</strong>
          <span>E-GOUV · Citoyen</span>
          <button type="button" className="sidebar-close" aria-label="Fermer le menu" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={() => setNavOpen(false)}>
            Tableau de bord
          </NavLink>
          <NavLink to="/card" onClick={() => setNavOpen(false)}>
            Carte
          </NavLink>
          <NavLink to="/documents" onClick={() => setNavOpen(false)}>
            Documents
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
            <h1 className="topbar-title">Portail citoyen</h1>
          </div>

          <div className="topbar-center" title={displayCitizenName(profile)}>
            <span className="topbar-role">Citoyen</span>
            <span className="topbar-commune">{profile.commune}</span>
            <strong className="topbar-responsable">{displayCitizenName(profile)}</strong>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true);
                setProfileOpen(false);
                setNotifs(listCitizenNotifications());
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
            <Route path="/card" element={<CardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
                  onClick={() => setNotifs(markAllCitizenNotificationsRead())}
                >
                  Tout marquer lu
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNotifOpen(false)}>
                  Fermer
                </button>
              </div>
            </div>
            {notifs.length === 0 ? <p className="muted">Aucune notification.</p> : null}
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
                      onClick={() => setNotifs(markCitizenNotificationRead(n.id))}
                    >
                      Marquer lu
                    </button>
                  ) : null}
                  {n.href ? (
                    <button
                      type="button"
                      className="btn-next btn-sm"
                      onClick={() => {
                        setNotifs(markCitizenNotificationRead(n.id));
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
                <strong>{displayCitizenName(profile)}</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0.65rem" }}>
                  @{session.username} · {profile.nic}
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
