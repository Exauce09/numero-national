import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "./auth";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SearchPage from "./pages/SearchPage";
import ActPage from "./pages/ActPage";
import DeclarationsPage from "./pages/DeclarationsPage";
import ResidencePage from "./pages/ResidencePage";
import StatsPage from "./pages/StatsPage";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell() {
  const navigate = useNavigate();
  const session = getSession();

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="page-wrapper">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>État civil</strong>
          <span>E-GOUV · Commune</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            Tableau de bord
          </NavLink>
          <NavLink to="/search">Recherche population</NavLink>
          <NavLink to="/births">Naissances</NavLink>
          <NavLink to="/marriages">Mariages</NavLink>
          <NavLink to="/divorces">Divorces</NavLink>
          <NavLink to="/deaths">Décès</NavLink>
          <NavLink to="/recognitions">Reconnaissances</NavLink>
          <NavLink to="/rectifications">Rectifications</NavLink>
          <NavLink to="/declarations">Déclarations</NavLink>
          <NavLink to="/residence">Résidence</NavLink>
          <NavLink to="/statistics">Statistiques</NavLink>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar">
          <h1 className="topbar-title">Officier d&apos;état civil</h1>
          <span className="topbar-user">{session?.username}</span>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/births" element={<ActPage kind="births" title="Naissances" />} />
            <Route path="/marriages" element={<ActPage kind="marriages" title="Mariages" />} />
            <Route path="/divorces" element={<ActPage kind="divorces" title="Divorces" />} />
            <Route path="/deaths" element={<ActPage kind="deaths" title="Décès" />} />
            <Route
              path="/recognitions"
              element={<ActPage kind="recognitions" title="Reconnaissances" />}
            />
            <Route
              path="/rectifications"
              element={<ActPage kind="rectifications" title="Rectifications" />}
            />
            <Route path="/declarations" element={<DeclarationsPage />} />
            <Route path="/residence" element={<ResidencePage />} />
            <Route path="/statistics" element={<StatsPage />} />
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
