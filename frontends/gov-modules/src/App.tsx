import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSession, setActivePortal, type Portal } from "./auth";
import LoginForm from "./components/LoginForm";
import PortalShell, { type NavItem } from "./components/PortalShell";
import LandingPage from "./pages/LandingPage";

import SanteDashboard from "./pages/sante/DashboardPage";
import SanteIndicators from "./pages/sante/IndicatorsPage";
import SanteFacilities from "./pages/sante/FacilitiesPage";
import SanteExport from "./pages/sante/ExportPage";

import InterieurDashboard from "./pages/interieur/DashboardPage";
import CivilSupervision from "./pages/interieur/CivilSupervisionPage";
import CardsPage from "./pages/interieur/CardsPage";
import SecurityAudit from "./pages/interieur/SecurityAuditPage";
import AnomaliesPage from "./pages/interieur/AnomaliesPage";

import PresidenceDashboard from "./pages/presidence/DashboardPage";
import DomainsPage from "./pages/presidence/DomainsPage";
import AlertsPage from "./pages/presidence/AlertsPage";
import BriefingPage from "./pages/presidence/BriefingPage";

import AdminDashboard from "./pages/admin/DashboardPage";
import UsersPage from "./pages/admin/UsersPage";
import RolesPage from "./pages/admin/RolesPage";
import InstitutionsPage from "./pages/admin/InstitutionsPage";
import AuditPage from "./pages/admin/AuditPage";
import ConfigPage from "./pages/admin/ConfigPage";

function RequireAuth({ portal, children }: { portal: Portal; children: ReactNode }) {
  if (!getSession(portal)) return <Navigate to={`/${portal}/login`} replace />;
  setActivePortal(portal);
  return <>{children}</>;
}

const SANTE_NAV: NavItem[] = [
  { to: "/sante", label: "Tableau de bord" },
  { to: "/sante/indicateurs", label: "Indicateurs" },
  { to: "/sante/structures", label: "Structures" },
  { to: "/sante/export", label: "Export" },
];

const INTERIEUR_NAV: NavItem[] = [
  { to: "/interieur", label: "Tableau de bord" },
  { to: "/interieur/etat-civil", label: "État civil" },
  { to: "/interieur/cartes", label: "Cartes" },
  { to: "/interieur/audit", label: "Audit sécurité" },
  { to: "/interieur/anomalies", label: "Anomalies" },
];

const PRESIDENCE_NAV: NavItem[] = [
  { to: "/presidence", label: "Tableau de bord" },
  { to: "/presidence/domaines", label: "Domaines" },
  { to: "/presidence/alertes", label: "Alertes" },
  { to: "/presidence/briefing", label: "Briefing" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Tableau de bord" },
  { to: "/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/admin/roles", label: "Rôles" },
  { to: "/admin/institutions", label: "Institutions" },
  { to: "/admin/audit", label: "Audit" },
  { to: "/admin/config", label: "Configuration" },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/sante/login"
        element={
          <LoginForm
            portal="sante"
            title="E-GOUV — Santé"
            subtitle="Portail Ministère de la Santé"
          />
        }
      />
      <Route
        path="/sante/*"
        element={
          <RequireAuth portal="sante">
            <PortalShell
              portal="sante"
              brand="Santé"
              tagline="E-GOUV · Ministère"
              nav={SANTE_NAV}
              title="Ministère de la Santé"
            >
              <Routes>
                <Route index element={<SanteDashboard />} />
                <Route path="indicateurs" element={<SanteIndicators />} />
                <Route path="structures" element={<SanteFacilities />} />
                <Route path="export" element={<SanteExport />} />
                <Route path="*" element={<Navigate to="/sante" replace />} />
              </Routes>
            </PortalShell>
          </RequireAuth>
        }
      />

      <Route
        path="/interieur/login"
        element={
          <LoginForm
            portal="interieur"
            title="E-GOUV — Intérieur"
            subtitle="Portail Ministère de l'Intérieur"
          />
        }
      />
      <Route
        path="/interieur/*"
        element={
          <RequireAuth portal="interieur">
            <PortalShell
              portal="interieur"
              brand="Intérieur"
              tagline="E-GOUV · Sécurité & état civil"
              nav={INTERIEUR_NAV}
              title="Ministère de l'Intérieur"
            >
              <Routes>
                <Route index element={<InterieurDashboard />} />
                <Route path="etat-civil" element={<CivilSupervision />} />
                <Route path="cartes" element={<CardsPage />} />
                <Route path="audit" element={<SecurityAudit />} />
                <Route path="anomalies" element={<AnomaliesPage />} />
                <Route path="*" element={<Navigate to="/interieur" replace />} />
              </Routes>
            </PortalShell>
          </RequireAuth>
        }
      />

      <Route
        path="/presidence/login"
        element={
          <LoginForm
            portal="presidence"
            title="E-GOUV — Présidence"
            subtitle="Portail stratégique Présidence"
          />
        }
      />
      <Route
        path="/presidence/*"
        element={
          <RequireAuth portal="presidence">
            <PortalShell
              portal="presidence"
              brand="Présidence"
              tagline="E-GOUV · Vue nationale"
              nav={PRESIDENCE_NAV}
              title="Présidence de la République"
            >
              <Routes>
                <Route index element={<PresidenceDashboard />} />
                <Route path="domaines" element={<DomainsPage />} />
                <Route path="alertes" element={<AlertsPage />} />
                <Route path="briefing" element={<BriefingPage />} />
                <Route path="*" element={<Navigate to="/presidence" replace />} />
              </Routes>
            </PortalShell>
          </RequireAuth>
        }
      />

      <Route
        path="/admin/login"
        element={
          <LoginForm
            portal="admin"
            title="E-GOUV — Administration"
            subtitle="Portail administration système"
          />
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAuth portal="admin">
            <PortalShell
              portal="admin"
              brand="Admin"
              tagline="E-GOUV · IAM & config"
              nav={ADMIN_NAV}
              title="Administration système"
            >
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="utilisateurs" element={<UsersPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="institutions" element={<InstitutionsPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="config" element={<ConfigPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </PortalShell>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
