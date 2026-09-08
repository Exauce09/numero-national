import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "./auth";
import AnomaliesPage from "./pages/AnomaliesPage";
import CampaignsPage from "./pages/CampaignsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

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
            ONIP
            <small>E-GOUV · {session?.accountType ?? "Session"}</small>
          </div>
        </div>
        <nav>
          <Link to="/">Vue nationale</Link>
          <Link to="/campaigns">Campagnes</Link>
          <Link to="/anomalies">Anomalies</Link>
          <button type="button" className="btn-logout" onClick={logout}>
            Déconnexion
          </button>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
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
