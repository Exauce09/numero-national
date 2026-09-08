import { Link, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CivilPortal from "./portals/CivilPortal";
import MinistryStatsPortal from "./portals/MinistryStatsPortal";
import GovPortal from "./portals/GovPortal";

export default function App() {
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">Identité Nationale</div>
        <nav>
          <Link to="/">Portails</Link>
          <Link to="/civil">État civil</Link>
          <Link to="/ministry">Ministère — stats</Link>
          <Link to="/gov/presidency/overview">Présidence</Link>
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
