import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearSession, getSession, setActivePortal, type Portal } from "../auth";

export type NavItem = { to: string; label: string };

type Props = {
  portal: Portal;
  brand: string;
  tagline: string;
  nav: NavItem[];
  title: string;
  children: ReactNode;
};

export default function PortalShell({ portal, brand, tagline, nav, title, children }: Props) {
  const navigate = useNavigate();
  const session = getSession(portal);
  setActivePortal(portal);

  function logout() {
    clearSession(portal);
    navigate(`/${portal}/login`, { replace: true });
  }

  return (
    <div className="page-wrapper">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>{brand}</strong>
          <span>{tagline}</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === `/${portal}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn-logout" style={{ width: "100%" }} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="body-wrap">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <span className="topbar-user">{session?.username}</span>
        </header>
        <main className="shell">{children}</main>
      </div>
    </div>
  );
}
