import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "./auth";
import AccessLogPage from "./pages/AccessLog";
import CardPage from "./pages/Card";
import DocumentsPage from "./pages/Documents";
import IdentityPage from "./pages/Identity";
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
    <div className="page-wrapper">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>Numéro National</strong>
          <span>E-GOUV · Citoyen</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/identity">Identité</NavLink>
          <NavLink to="/card">Carte</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/access-log">Accès</NavLink>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar">
          <h1 className="topbar-title">Portail citoyen</h1>
          <div>
            <span className="topbar-user">{session?.username}</span>
          </div>
        </header>
        <main className="shell">
          <Routes>
            <Route path="/" element={<Navigate to="/identity" replace />} />
            <Route path="/identity" element={<IdentityPage />} />
            <Route path="/card" element={<CardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/access-log" element={<AccessLogPage />} />
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
