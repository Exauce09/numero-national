import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "./auth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import CivilPortal from "./portals/CivilPortal";
import GovPortal from "./portals/GovPortal";
import MinistryStatsPortal from "./portals/MinistryStatsPortal";

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
          <strong>Identité Nationale</strong>
          <span>E-GOUV</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            Portails
          </NavLink>
          <NavLink to="/civil">État civil</NavLink>
          <NavLink to="/ministry">Ministère — stats</NavLink>
          <NavLink to="/gov/presidency/overview">Présidence</NavLink>
          <NavLink to="/gov/primature/overview">Primature</NavLink>
          <NavLink to="/gov/interior/overview">Intérieur</NavLink>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar">
          <h1 className="topbar-title">Portails institutionnels</h1>
          <div>
            <span className="topbar-user">{session?.username}</span>
          </div>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/civil" element={<CivilPortal />} />
            <Route path="/ministry" element={<MinistryStatsPortal />} />
            <Route path="/gov/:org/:domain" element={<GovPortal />} />
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
