import { Link, Navigate, Route, Routes } from "react-router-dom";
import AccessLogPage from "./pages/AccessLog";
import CardPage from "./pages/Card";
import DocumentsPage from "./pages/Documents";
import IdentityPage from "./pages/Identity";

export default function App() {
  return (
    <div className="shell">
      <header className="top">
        <p className="brand">Numéro National</p>
        <nav>
          <Link to="/identity">Identité</Link>
          <Link to="/card">Carte</Link>
          <Link to="/documents">Documents</Link>
          <Link to="/access-log">Accès</Link>
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
