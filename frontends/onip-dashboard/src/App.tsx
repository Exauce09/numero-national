import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, hasPermission } from "./auth";
import AccountsPage from "./pages/AccountsPage";
import AdminTechniquePage from "./pages/AdminTechniquePage";
import AnomaliesPage from "./pages/AnomaliesPage";
import BiometriePage from "./pages/BiometriePage";
import CampaignsPage from "./pages/CampaignsPage";
import CardsPage from "./pages/CardsPage";
import CartographiePage from "./pages/CartographiePage";
import ConformitePage from "./pages/ConformitePage";
import DashboardPage from "./pages/DashboardPage";
import EnrolementPage from "./pages/EnrolementPage";
import EtatCivilOnipPage from "./pages/EtatCivilOnipPage";
import FeuilleDeRoutePage from "./pages/FeuilleDeRoutePage";
import LoginPage from "./pages/LoginPage";
import NicNumbersPage from "./pages/NicNumbersPage";
import PopulationFgpPage from "./pages/PopulationFgpPage";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Tableau de bord national",
  "/accounts": "Comptes agents",
  "/enrolement": "Enrôlement",
  "/campaigns": "Campagnes & contrôle",
  "/anomalies": "Anomalies",
  "/population": "Population / FGP",
  "/biometrie": "Biométrie",
  "/etat-civil": "État civil → FGP",
  "/nic": "Numéros NIC",
  "/conformite": "Conformité FGP / NIN",
  "/feuille-de-route": "Feuille de route",
  "/admin": "Administration technique",
  "/cards": "Cartes d'identité",
  "/cartographie": "Cartographie",
};

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] ?? "SIGPOP-RDC";

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
          <strong>SIGPOP-RDC</strong>
          <span>E-GOUV · ONIP / FGP</span>
          <button type="button" className="sidebar-close" aria-label="Fermer le menu" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Menu principal SIGPOP-RDC">
          <div className="nav-group-label">Vue d’ensemble</div>
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/feuille-de-route">Feuille de route</NavLink>
          <NavLink to="/conformite">Conformité FGP / NIN</NavLink>

          {hasPermission("users:manage", session) ? (
            <>
              <div className="nav-group-label">Agents</div>
              <NavLink to="/accounts">Comptes agents</NavLink>
            </>
          ) : null}

          <div className="nav-group-label">Recensement</div>
          <NavLink to="/enrolement">Enrôlement</NavLink>
          <NavLink to="/campaigns">Campagnes &amp; contrôle</NavLink>
          <NavLink to="/anomalies">Anomalies</NavLink>
          <NavLink to="/cartographie">Cartographie</NavLink>

          <div className="nav-group-label">FGP</div>
          <NavLink to="/population">Population / FGP</NavLink>
          <NavLink to="/nic">Numéros NIC</NavLink>
          <NavLink to="/biometrie">Biométrie</NavLink>
          <NavLink to="/etat-civil">État civil</NavLink>
          <NavLink to="/cards">Cartes d&apos;identité</NavLink>

          <div className="nav-group-label">Exploitation</div>
          <NavLink to="/admin">Administration technique</NavLink>
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
          <span className="topbar-user">
            {session?.displayName || session?.username}
            {session?.roles?.length ? ` · ${session.roles[0]}` : ""}
          </span>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/enrolement" element={<EnrolementPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/anomalies" element={<AnomaliesPage />} />
            <Route path="/cartographie" element={<CartographiePage />} />
            <Route path="/population" element={<PopulationFgpPage />} />
            <Route path="/nic" element={<NicNumbersPage />} />
            <Route path="/biometrie" element={<BiometriePage />} />
            <Route path="/etat-civil" element={<EtatCivilOnipPage />} />
            <Route path="/conformite" element={<ConformitePage />} />
            <Route path="/feuille-de-route" element={<FeuilleDeRoutePage />} />
            <Route path="/admin" element={<AdminTechniquePage />} />
            <Route path="/cards" element={<CardsPage />} />
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
