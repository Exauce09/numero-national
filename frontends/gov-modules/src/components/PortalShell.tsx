import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const session = getSession(portal);
  const [navOpen, setNavOpen] = useState(false);
  setActivePortal(portal);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  function logout() {
    clearSession(portal);
    navigate(`/${portal}/login`, { replace: true });
  }

  return (
    <div className={`page-wrapper${navOpen ? " nav-open" : ""}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="sidebar" id={`${portal}-sidebar`}>
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="RDC" />
          <strong>{brand}</strong>
          <span>{tagline}</span>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setNavOpen(false)}
          >
            ×
          </button>
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
        <header className="topbar topbar-3">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label={navOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={navOpen}
              aria-controls={`${portal}-sidebar`}
              onClick={() => setNavOpen((o) => !o)}
            >
              <span />
            </button>
            <h1 className="topbar-title">{title}</h1>
          </div>
          <div className="topbar-center">
            <span className="topbar-role">{session?.roleTitle || brand}</span>
            {session?.territoryLabel ? (
              <span className="topbar-commune">{session.territoryLabel}</span>
            ) : null}
            <strong className="topbar-responsable">
              {session?.displayName || session?.username}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-user">{session?.username}</span>
          </div>
        </header>
        <main className="shell">{children}</main>
      </div>
    </div>
  );
}
