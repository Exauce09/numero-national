import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
    <div className="shell">
      <header className="top">
        <div className="brand-block">
          <img className="brand-logo" src="/logo-rdc.jpg" alt="RDC" />
          <div className="brand">
            Numéro National
            <small>E-GOUV · {session?.accountType ?? "Citoyen"}</small>
          </div>
        </div>
        <nav>
          <Link to="/identity">Identité</Link>
          <Link to="/card">Carte</Link>
          <Link to="/documents">Documents</Link>
          <Link to="/access-log">Accès</Link>
          <button type="button" className="btn-logout" onClick={logout}>
            Déconnexion
          </button>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/identity" replace />} />
          <Route path="/identity" element={<IdentityPage />} />
          <Route path="/card" element={<CardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/access-log" element={<AccessLogPage />} />
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
