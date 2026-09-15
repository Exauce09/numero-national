/** Portail maternité / structure sanitaire → déclarations vers l'officier EC. */

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import { IconBaby, IconCross, IconDashboard, IconTable } from "./components/Icons";
import PasswordField from "./components/PasswordField";
import HealthDashboardPage from "./pages/HealthDashboardPage";
import HealthBirthsPage from "./pages/HealthBirthsPage";
import HealthDeathsPage from "./pages/HealthDeathsPage";
import HealthSynopticPage from "./pages/HealthSynopticPage";

export function RequireHealth({ children }: { children: ReactNode }) {
  const session = getHealthSession();
  if (!session) return <Navigate to="/sante/login" replace />;
  if (!isHealthAccountActive(session.facilityId)) {
    clearHealthSession();
    return <Navigate to="/sante/login" replace />;
  }
  return <>{children}</>;
}

export default function HealthShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getHealthSession()!;
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [prefs, setPrefs] = useState<HealthPrefs>(() => getHealthPrefs());
  const [notifs, setNotifs] = useState<HealthNotification[]>(() => listHealthNotifications());
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    applyHealthTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  function logout() {
    clearHealthSession();
    navigate("/sante/login", { replace: true });
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

  const badge = healthUnreadCount();

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
          <strong>Maternité / Santé</strong>
          <span>Déclarations → Officier d&apos;état civil</span>
          <button type="button" className="sidebar-close" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/sante" end onClick={() => setNavOpen(false)}>
            <IconDashboard size={18} /> Tableau de bord
          </NavLink>
          <NavLink to="/sante/synoptique/naissances" onClick={() => setNavOpen(false)}>
            <IconTable size={18} /> Synoptique
          </NavLink>
          <NavLink to="/sante/births" onClick={() => setNavOpen(false)}>
            <IconBaby size={18} /> Notification de naissance
          </NavLink>
          <NavLink to="/sante/deaths" onClick={() => setNavOpen(false)}>
            <IconCross size={18} /> Notification de décès
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
              aria-label="Menu"
              onClick={() => setNavOpen((o) => !o)}
            >
              <span />
            </button>
            <h1 className="topbar-title">État civil · Structure sanitaire</h1>
          </div>
          <div className="topbar-center">
            <span className="topbar-role">{session.roleTitle}</span>
            <strong className="topbar-responsable">{session.facilityName}</strong>
            {session.commune_name ? (
              <span className="topbar-commune">Commune de {session.commune_name}</span>
            ) : null}
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true);
                setNotifs(listHealthNotifications());
              }}
            >
              🔔
              {badge > 0 ? <span className="topbar-badge">{badge}</span> : null}
            </button>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Profil"
              onClick={() => setProfileOpen(true)}
            >
              👤
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
              <button
                type="button"
                className="btn-add btn-sm"
                onClick={() => setNotifs(markAllHealthNotificationsRead())}
              >
                Tout marquer lu
              </button>
            </div>
            {notifs.map((n) => (
              <article key={n.id} className={`notif-item${n.read ? "" : " unread"}`}>
                <h4 className="notif-title">{n.title}</h4>
                <p className="muted">{n.body}</p>
                {!n.read ? (
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => setNotifs(markHealthNotificationRead(n.id))}
                  >
                    Lu
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="panel-title">Profil — {session.facilityName}</h3>
            <div className="theme-switch" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={prefs.theme === "light" ? "btn-next" : "btn-secondary"}
                onClick={() => {
                  const next = { ...prefs, theme: "light" as const };
                  saveHealthPrefs(next);
                  setPrefs(next);
                }}
              >
                Clair
              </button>
              <button
                type="button"
                className={prefs.theme === "dark" ? "btn-next" : "btn-secondary"}
                onClick={() => {
                  const next = { ...prefs, theme: "dark" as const };
                  saveHealthPrefs(next);
                  setPrefs(next);
                }}
              >
                Sombre
              </button>
            </div>
            <form onSubmit={onChangePassword}>
              {pwdError ? <div className="login-error">{pwdError}</div> : null}
              {pwdMsg ? <div className="success-banner">{pwdMsg}</div> : null}
              <PasswordField
                label="Mot de passe actuel"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
              />
              <PasswordField
                label="Nouveau"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirmer"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" className="btn-primary" style={{ width: "auto" }}>
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
