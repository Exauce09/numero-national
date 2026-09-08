import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "./auth";
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

  useEffect(() => {
    setNavOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const responsableLabel = session?.displayName ?? session?.username ?? "—";
  const roleTitle = session?.roleTitle ?? "Responsable — Officier d'état civil";

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
            <div className="topbar-icon-wrap">
              <button
                type="button"
                className="topbar-icon-btn"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((o) => !o);
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
                <span className="topbar-badge">2</span>
              </button>
              {notifOpen ? (
                <div className="topbar-dropdown">
                  <p className="topbar-dropdown-title">Notifications</p>
                  <button type="button" className="topbar-dropdown-item">
                    Nouvelle déclaration en attente
                  </button>
                  <button type="button" className="topbar-dropdown-item">
                    Acte à valider — commune
                  </button>
                </div>
              ) : null}
            </div>

            <div className="topbar-icon-wrap">
              <button
                type="button"
                className="topbar-icon-btn topbar-profile-btn"
                aria-label="Profil"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M5 19.5c1.8-3.2 4.2-4.5 7-4.5s5.2 1.3 7 4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {profileOpen ? (
                <div className="topbar-dropdown topbar-dropdown-right">
                  <p className="topbar-dropdown-title">{responsableLabel}</p>
                  <p className="muted small" style={{ margin: "0 0 0.5rem", padding: "0 0.75rem" }}>
                    @{session?.username}
                  </p>
                  <button type="button" className="topbar-dropdown-item" onClick={logout}>
                    Déconnexion
                  </button>
                </div>
              ) : null}
            </div>
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
