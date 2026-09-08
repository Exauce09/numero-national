import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
    <div className="shell">
      <header className="top">
        <div className="brand-block">
          <img className="brand-logo" src="/logo-rdc.jpg" alt="RDC" />
          <div className="brand">
            Identité Nationale
            <small>E-GOUV · {session?.accountType ?? "Institution"}</small>
          </div>
        </div>
        <nav>
          <Link to="/">Portails</Link>
          <Link to="/civil">État civil</Link>
          <Link to="/ministry">Ministère — stats</Link>
          <Link to="/gov/presidency/overview">Présidence</Link>
          <button type="button" className="btn-logout" onClick={logout}>
            Déconnexion
          </button>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/civil" element={<CivilPortal />} />
          <Route path="/ministry" element={<MinistryStatsPortal />} />
          <Route path="/gov/:org/:domain" element={<GovPortal />} />
        </Routes>
      </main>
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
