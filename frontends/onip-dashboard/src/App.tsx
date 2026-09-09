import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, isLocalSession } from "./auth";
import AccountsPage from "./pages/AccountsPage";
import AnomaliesPage from "./pages/AnomaliesPage";
import CampaignsPage from "./pages/CampaignsPage";
import CartographiePage from "./pages/CartographiePage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NicNumbersPage from "./pages/NicNumbersPage";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Tableau de bord",
  "/accounts": "Comptes agents",
  "/campaigns": "Campagnes & contrôle",
  "/anomalies": "Anomalies",
  "/nic": "Numéros NIC",
  "/cartographie": "Cartographie",
};

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] ?? "ONIP";

  useEffect(() => {
    setNavOpen(false);
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

  return (
    <div className={`page-wrapper${navOpen ? " nav-open" : ""}`}>
      {navOpen ? (
        <button type="button" className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setNavOpen(false)} />
      ) : null}
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
          <strong>ONIP</strong>
          <span>E-GOUV · RDC</span>
          <button type="button" className="sidebar-close" aria-label="Fermer le menu" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group-label">Vue d’ensemble</div>
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>

          <div className="nav-group-label">Agents</div>
          <NavLink to="/accounts">Comptes agents</NavLink>

          <div className="nav-group-label">Recensement</div>
          <NavLink to="/campaigns">Campagnes &amp; contrôle</NavLink>
          <NavLink to="/anomalies">Anomalies</NavLink>
          <NavLink to="/cartographie">Cartographie</NavLink>

          <div className="nav-group-label">Registre</div>
          <NavLink to="/nic">Numéros NIC</NavLink>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar">
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
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <span className="topbar-user">{session?.username}</span>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/anomalies" element={<AnomaliesPage />} />
            <Route path="/cartographie" element={<CartographiePage />} />
            <Route path="/nic" element={<NicNumbersPage />} />
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
