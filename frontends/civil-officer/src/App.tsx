import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
          <NavLink to="/births">Naissances</NavLink>
          <NavLink to="/census">Recensement</NavLink>
          <NavLink to="/deaths">Décès</NavLink>
          <NavLink to="/marriages">Mariages</NavLink>
          <NavLink to="/adoptions">Adoption</NavLink>
          <NavLink to="/displacements">Déplacement</NavLink>
          <NavLink to="/divorces">Divorce</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/acts">Actes</NavLink>
          <NavLink to="/search">Recherche</NavLink>
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
            <Route path="/births" element={<BirthsPage />} />
            <Route path="/census" element={<CensusPage />} />
            <Route path="/deaths" element={<DeathsPage />} />
            <Route path="/marriages" element={<MarriagesPage />} />
            <Route path="/adoptions" element={<AdoptionsPage />} />
            <Route path="/displacements" element={<DisplacementsPage />} />
            <Route path="/divorces" element={<DivorcesPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/acts" element={<ActsPage />} />
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
