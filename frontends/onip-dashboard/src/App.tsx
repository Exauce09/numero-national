import { Link, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import AnomaliesPage from "./pages/AnomaliesPage";
import CampaignsPage from "./pages/CampaignsPage";

export default function App() {
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">ONIP</div>
        <nav>
          <Link to="/">Vue nationale</Link>
          <Link to="/campaigns">Campagnes</Link>
          <Link to="/anomalies">Anomalies</Link>
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
