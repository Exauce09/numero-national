import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession, updateSession } from "./auth";
import {
  canManageEcUsers,
  changeEcUserPassword,
  ensureBootstrapSuperAdmin,
  ensureCanonicalAccounts,
  getEcUserByEmail,
  hasAnyEcUser,
  isSuperAdminNational,
  permissionsForRoles,
} from "./ecUsers";
import { canAccessPath, canSeeNav, isJudicialRole, primaryRole, roleTitleFor } from "./rbac";
import {
  applyTheme,
  getPrefs,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  savePrefs,
  syncDeclarationNotifications,
  unreadCount,
  type AppNotification,
  type UserPrefs,
} from "./prefs";
import { api } from "./api";
import { listPendingOfficerDeclarations } from "./civilDeclarations";
import LoginPage from "./pages/LoginPage";
import RegisterAccountPage from "./pages/RegisterAccountPage";
import SetupFirstUserPage from "./pages/SetupFirstUserPage";
import UsersEcPage from "./pages/UsersEcPage";
import AccountRequestsReviewPage from "./pages/AccountRequestsReviewPage";
import HealthLoginPage from "./pages/HealthLoginPage";
import HealthShell, { RequireHealth } from "./HealthShell";
import DashboardPage from "./pages/DashboardPage";
import BirthsPage from "./pages/BirthsPage";
import DeathsPage from "./pages/DeathsPage";
import BureauxPage from "./pages/BureauxPage";
import PersonnelPage from "./pages/PersonnelPage";
import AccountRequestsPage from "./pages/AccountRequestsPage";
import MarriagesPage from "./pages/MarriagesPage";
import AdoptionsPage from "./pages/AdoptionsPage";
import DivorcesPage from "./pages/DivorcesPage";
import DocumentsPage from "./pages/DocumentsPage";
import FicheIdentificationPage from "./pages/FicheIdentificationPage";
import DocumentVerifyPage from "./pages/DocumentVerifyPage";
import ActsPage from "./pages/ActsPage";
import ActQrScanPage from "./pages/ActQrScanPage";
import SearchPage from "./pages/SearchPage";
import DeclarationsPage from "./pages/DeclarationsPage";
import MissionsEcPage from "./pages/MissionsEcPage";
import ProcedureEcPage from "./pages/ProcedureEcPage";
import RolesEcPage from "./pages/RolesEcPage";
import ActorsMatrixPage from "./pages/ActorsMatrixPage";
import JugeEcPage from "./pages/JugeEcPage";
import MentionsEcPage from "./pages/MentionsEcPage";
import RecognitionsPage from "./pages/RecognitionsPage";
import TranscriptionsPage from "./pages/TranscriptionsPage";
import CorrectionsInboxPage from "./pages/CorrectionsInboxPage";
import ManageDecesPage from "./pages/ManageDecesPage";
import ManageDivorcePage from "./pages/ManageDivorcePage";
import ManageAdoptionPage from "./pages/ManageAdoptionPage";
import ManageDocumentPage from "./pages/ManageDocumentPage";
import ManageMariagePage from "./pages/ManageMariagePage";
import ManageNaissancePage from "./pages/ManageNaissancePage";
import SynopticPage from "./pages/SynopticPage";
import ManageActsPage, { MANAGE_CONFIGS } from "./components/ManageActsPage";
import TerritoryPage from "./pages/TerritoryPage";
import TopbarSearch from "./components/TopbarSearch";
import PasswordField from "./components/PasswordField";
import {
  IconBaby,
  IconCar,
  IconClipboard,
  IconCross,
  IconDashboard,
  IconFile,
  IconHome,
  IconRing,
  IconSplit,
  IconTable,
  IconUsers,
} from "./components/Icons";
import PopulationPage from "./pages/PopulationPage";
import PersonDetailPage from "./pages/PersonDetailPage";
import DisplacementsPage from "./pages/DisplacementsPage";
import ManageDeplacementPage from "./pages/ManageDeplacementPage";

function RequireCivil({ children }: { children: ReactNode }) {
  if (!hasAnyEcUser()) return <Navigate to="/setup" replace />;
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function pathMatchesPrefixes(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || (p.length > 1 && pathname.startsWith(p)),
  );
}

/** Groupe sidebar repliable : ouvert au clic ou si la route courante est dans le groupe. */
function NavCollapsibleGroup({
  label,
  icon,
  activePrefixes,
  children,
}: {
  label: string;
  icon: ReactNode;
  activePrefixes: string[];
  children: ReactNode;
}) {
  const location = useLocation();
  const routeOpen = pathMatchesPrefixes(location.pathname, activePrefixes);
  const [forced, setForced] = useState<"open" | "closed" | null>(null);

  useEffect(() => {
    setForced(null);
  }, [location.pathname]);

  const open = routeOpen ? forced !== "closed" : forced === "open";

  return (
    <div className={`nav-group${open ? " is-open" : ""}${routeOpen ? " is-route-active" : ""}`}>
      <button
        type="button"
        className="nav-group-label"
        aria-expanded={open}
        onClick={() => setForced(open ? "closed" : "open")}
      >
        <span className="nav-group-label-main">
          {icon} {label}
        </span>
        <span className="nav-group-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <div className="nav-group-items">{children}</div> : null}
    </div>
  );
}

function RequireCivilBureau({ children }: { children: ReactNode }) {
  const session = getSession();
  if (isJudicialRole(session?.roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequirePath({ children }: { children: ReactNode }) {
  const session = getSession();
  const location = useLocation();
  if (!canAccessPath(location.pathname, session?.roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, bumpSession] = useState(0);
  const session = getSession();
  void bumpSession;

  useEffect(() => {
    void (async () => {
      await ensureCanonicalAccounts();
      ensureBootstrapSuperAdmin();
      const s = getSession();
      if (!s?.username) return;
      const local = getEcUserByEmail(s.username);
      if (!local) return;
      const nextPerms = permissionsForRoles(local.roles);
      const rolesChanged =
        JSON.stringify([...(s.roles ?? [])].sort()) !==
        JSON.stringify([...local.roles].sort());
      const permsChanged =
        JSON.stringify([...(s.permissions ?? [])].sort()) !==
        JSON.stringify([...nextPerms].sort());
      const title = roleTitleFor(local.roles);
      if (
        !rolesChanged &&
        !permsChanged &&
        s.displayName === local.fullName &&
        s.roleTitle === title
      ) {
        return;
      }
      updateSession({
        displayName: local.fullName,
        roles: local.roles,
        permissions: nextPerms,
        roleTitle: title,
      });
      bumpSession((n) => n + 1);
    })();
  }, []);

  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(() => getPrefs());
  const [notifs, setNotifs] = useState<AppNotification[]>(() => listNotifications());
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    let cancelled = false;
    async function refreshNotifs() {
      const local = listPendingOfficerDeclarations().filter(
        (d) => d.declaration_type === "BIRTH" || d.declaration_type === "DEATH",
      );
      try {
        const remote = await api.listDeclarations("PENDING_OFFICER");
        if (cancelled) return;
        const byId = new Map<string, (typeof local)[number]>();
        for (const d of local) byId.set(d.id, d);
        for (const d of remote) {
          const type = String(d.declaration_type || "").toUpperCase();
          if (type !== "BIRTH" && type !== "DEATH") continue;
          byId.set(d.id, {
            id: d.id,
            source: (d.source as "HOSPITAL" | "COMMUNE" | "CITIZEN") || "HOSPITAL",
            declaration_type: type as "BIRTH" | "DEATH",
            payload: (d.payload as Record<string, unknown>) || {},
            status: "PENDING_OFFICER",
            created_at: d.created_at,
          });
        }
        syncDeclarationNotifications([...byId.values()]);
        setNotifs(listNotifications());
      } catch {
        if (cancelled) return;
        syncDeclarationNotifications(local);
        setNotifs(listNotifications());
      }
    }
    void refreshNotifs();
    const timer = window.setInterval(() => void refreshNotifs(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen || notifOpen || profileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen, notifOpen, profileOpen]);

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function persistPrefs(next: UserPrefs) {
    savePrefs(next);
    setPrefs(next);
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = String(reader.result ?? "");
      persistPrefs({ ...prefs, photoDataUrl });
      updateSession({ photoDataUrl });
    };
    reader.readAsDataURL(file);
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    setPwdError(null);
    if (!session?.username) {
      setPwdError("Session invalide.");
      return;
    }
    if (newPwd.length < 8) {
      setPwdError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("La confirmation ne correspond pas.");
      return;
    }
    try {
      await changeEcUserPassword(session.username, currentPwd, newPwd);
      persistPrefs({ ...prefs, passwordOverride: undefined });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg("Mot de passe mis à jour.");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Impossible de changer le mot de passe.");
    }
  }

  const responsableLabel = session?.displayName ?? session?.username ?? "—";
  const roleTitle = session?.roleTitle || "Officier de l'état civil";
  const communeLabel = session?.commune_name
    ? `Commune de ${session.commune_name}`
    : null;
  const territoryLine = [
    session?.commune_province,
    session?.commune_ville,
    session?.commune_name ? `Commune de ${session.commune_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const roles = session?.roles ?? ["OFFICIER_ETAT_CIVIL"];
  const judicialOnly = isJudicialRole(roles);
  const judicialKind = primaryRole(roles);
  const role = primaryRole(roles);
  const badge = unreadCount();
  const photo = prefs.photoDataUrl || session?.photoDataUrl;

  const brandSub =
    judicialOnly
      ? judicialKind === "JUGE"
        ? "Module judiciaire · tribunal"
        : "Module judiciaire · greffe"
      : role === "AGENT_ETAT_CIVIL"
        ? "Espace agent · saisie"
        : role === "AUDITEUR"
          ? "Espace auditeur · consultation"
          : role === "RESPONSABLE_BUREAU"
            ? "Bureau · direction locale"
            : role === "SUPER_ADMIN_NATIONAL"
              ? "Administration nationale"
              : "Bureau d'état civil · registres & actes";

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
      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-brand">
          <img src="/logo-rdc.jpg" alt="République démocratique du Congo" />
          <strong>État civil — RDC</strong>
          <span>{brandSub}</span>
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
          {/* Menu Justicia e-Gouv (hors recensement) */}
          <NavLink to="/" end>
            <IconDashboard size={18} /> Tableau de bord
          </NavLink>

          {canSeeNav("synoptique", roles) ? (
            <NavLink
              to="/synoptique/naissances"
              className={({ isActive }) =>
                isActive || location.pathname.startsWith("/synoptique") ? "active" : undefined
              }
            >
              <IconTable size={18} /> Tableau synoptique
            </NavLink>
          ) : null}

          {canSeeNav("naissances", roles) ? (
            <NavLink to="/manage/naissance">
              <IconBaby size={18} /> Naissances
            </NavLink>
          ) : null}

          {canSeeNav("mariages", roles) ? (
            <NavLink to="/manage/mariage">
              <IconRing size={18} /> Mariages
            </NavLink>
          ) : null}

          {canSeeNav("divorces", roles) || canSeeNav("judiciaire", roles) ? (
            <NavLink to="/manage/divorce">
              <IconSplit size={18} /> Divorce
            </NavLink>
          ) : null}

          {canSeeNav("naissances", roles) || canSeeNav("judiciaire", roles) ? (
            <NavLink to="/manage/adoption">
              <IconHome size={18} /> Adoption
            </NavLink>
          ) : null}

          {canSeeNav("deces", roles) ? (
            <NavLink to="/manage/deces">
              <IconCross size={18} /> Décès
            </NavLink>
          ) : null}

          {canSeeNav("naissances", roles) || canSeeNav("create_acts", roles) ? (
            <NavLink to="/manage/deplacement">
              <IconCar size={18} /> Déplacement
            </NavLink>
          ) : null}

          {isSuperAdminNational(roles) ? (
            <NavCollapsibleGroup
              label="Administration"
              icon={<IconUsers size={18} />}
              activePrefixes={["/register", "/account-requests", "/users", "/admin/account-requests"]}
            >
              <NavLink to="/register">Créer un compte</NavLink>
              <NavLink to="/account-requests">Demandes de compte</NavLink>
              <NavLink to="/users">Utilisateurs</NavLink>
            </NavCollapsibleGroup>
          ) : null}
          {!isSuperAdminNational(roles) && canManageEcUsers(roles) ? (
            <NavLink to="/users">
              <IconUsers size={18} /> Utilisateurs du bureau
            </NavLink>
          ) : null}
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
              aria-controls="app-sidebar"
              onClick={() => setNavOpen((o) => !o)}
            >
              <span />
            </button>
          </div>

          <div className="topbar-center">
            <TopbarSearch />
            
          </div>

          <div className="topbar-right">
            <div
              className="topbar-identity"
              title={[roleTitle, territoryLine || communeLabel].filter(Boolean).join(" · ")}
            >
              <strong className="topbar-responsable">{responsableLabel}</strong>
              <span className="topbar-role">{roleTitle}</span>
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true);
                setProfileOpen(false);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              {badge > 0 ? <span className="topbar-badge">{badge}</span> : null}
            </button>

            <button
              type="button"
              className="topbar-icon-btn topbar-profile-btn"
              aria-label="Profil"
              onClick={() => {
                setProfileOpen(true);
                setNotifOpen(false);
              }}
            >
              {photo ? (
                <img className="profile-photo-lg" src={photo} alt="" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M5 19.5c1.8-3.2 4.2-4.5 7-4.5s5.2 1.3 7 4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>
        <main className="shell">
          <RequirePath>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/population" element={<PopulationPage />} />
            <Route path="/population/:id" element={<PersonDetailPage />} />
            <Route path="/procedure" element={<ProcedureEcPage />} />
            <Route path="/missions" element={<MissionsEcPage />} />
            <Route path="/roles" element={<RolesEcPage />} />
            <Route path="/matrice" element={<ActorsMatrixPage />} />
            <Route path="/juge" element={<JugeEcPage />} />
            <Route path="/mentions" element={<MentionsEcPage />} />
            <Route
              path="/synoptique"
              element={
                canSeeNav("synoptique", getSession()?.roles ?? []) ? (
                  <SynopticPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/synoptique/:section"
              element={
                canSeeNav("synoptique", getSession()?.roles ?? []) ? (
                  <SynopticPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="/manage/deces" element={<RequireCivilBureau><ManageDecesPage /></RequireCivilBureau>} />
            <Route path="/manage/divorce" element={<ManageDivorcePage />} />
            <Route path="/manage/adoption" element={<ManageAdoptionPage />} />
            <Route path="/manage/document" element={<ManageDocumentPage />} />
            <Route path="/manage/mariage" element={<RequireCivilBureau><ManageMariagePage /></RequireCivilBureau>} />
            <Route path="/manage/naissance" element={<RequireCivilBureau><ManageNaissancePage /></RequireCivilBureau>} />
            <Route path="/manage/deplacement" element={<RequireCivilBureau><ManageDeplacementPage /></RequireCivilBureau>} />
            <Route path="/displacements" element={<RequireCivilBureau><DisplacementsPage /></RequireCivilBureau>} />
            <Route path="/lists/deces" element={<RequireCivilBureau><ManageActsPage config={MANAGE_CONFIGS.deces} showAnalytics /></RequireCivilBureau>} />
            <Route path="/lists/divorce" element={<ManageActsPage config={MANAGE_CONFIGS.divorce} showAnalytics />} />
            <Route path="/lists/adoption" element={<ManageActsPage config={MANAGE_CONFIGS.adoption} showAnalytics />} />
            <Route path="/lists/mariage" element={<RequireCivilBureau><ManageActsPage config={MANAGE_CONFIGS.mariage} showAnalytics /></RequireCivilBureau>} />
            <Route path="/lists/naissance" element={<RequireCivilBureau><ManageActsPage config={MANAGE_CONFIGS.naissance} showAnalytics /></RequireCivilBureau>} />
            <Route path="/lists/acts" element={<RequireCivilBureau><ActsPage showAnalytics /></RequireCivilBureau>} />
            <Route path="/births" element={<RequireCivilBureau><BirthsPage /></RequireCivilBureau>} />
            <Route path="/deaths" element={<RequireCivilBureau><DeathsPage /></RequireCivilBureau>} />
            <Route path="/marriages" element={<RequireCivilBureau><MarriagesPage /></RequireCivilBureau>} />
            <Route path="/adoptions" element={<AdoptionsPage />} />
            <Route path="/recognitions" element={<RequireCivilBureau><RecognitionsPage /></RequireCivilBureau>} />
            <Route path="/divorces" element={<DivorcesPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/fiche-identification" element={<FicheIdentificationPage />} />
            <Route path="/verify-document" element={<RequireCivilBureau><DocumentVerifyPage /></RequireCivilBureau>} />
            <Route path="/acts" element={<RequireCivilBureau><ActsPage /></RequireCivilBureau>} />
            <Route path="/acts/qrcode" element={<RequireCivilBureau><ActQrScanPage /></RequireCivilBureau>} />
            <Route path="/declarations" element={<RequireCivilBureau><DeclarationsPage /></RequireCivilBureau>} />
            <Route path="/transcriptions" element={<TranscriptionsPage />} />
            <Route path="/corrections" element={<RequireCivilBureau><CorrectionsInboxPage /></RequireCivilBureau>} />
            <Route path="/admin/bureaux" element={<BureauxPage />} />
            <Route path="/admin/personnel" element={<PersonnelPage />} />
            <Route path="/admin/account-requests" element={<AccountRequestsPage />} />
            <Route path="/territory" element={<TerritoryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/register" element={<RegisterAccountPage />} />
            <Route path="/users" element={<UsersEcPage />} />
            <Route path="/account-requests" element={<AccountRequestsReviewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </RequirePath>
        </main>
      </div>

      {notifOpen ? (
        <div className="modal-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Notifications
              </h3>
              <div className="modal-actions" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="btn-add btn-sm"
                  onClick={() => setNotifs(markAllNotificationsRead())}
                >
                  Tout marquer lu
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setNotifOpen(false)}>
                  Fermer
                </button>
              </div>
            </div>
            {notifs.map((n) => (
              <article key={n.id} className={`notif-item${n.read ? "" : " unread"}`}>
                <h4 className="notif-title">{n.title}</h4>
                <p className="muted" style={{ margin: "0 0 0.5rem" }}>
                  {n.body}
                </p>
                <p className="muted small" style={{ margin: "0 0 0.65rem" }}>
                  {new Date(n.created_at).toLocaleString("fr-CD")}
                </p>
                <div className="table-actions">
                  {!n.read ? (
                    <button
                      type="button"
                      className="btn-add btn-sm"
                      onClick={() => setNotifs(markNotificationRead(n.id))}
                    >
                      Marquer lu
                    </button>
                  ) : null}
                  {n.href ? (
                    <button
                      type="button"
                      className="btn-next btn-sm"
                      onClick={() => {
                        setNotifs(markNotificationRead(n.id));
                        setNotifOpen(false);
                        navigate(n.href!);
                      }}
                    >
                      Ouvrir
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Profil
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setProfileOpen(false)}>
                Fermer
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
              {photo ? (
                <img className="profile-photo" src={photo} alt="Profil" />
              ) : (
                <div className="profile-photo" style={{ display: "grid", placeItems: "center" }}>
                  <span className="muted">Photo</span>
                </div>
              )}
              <div>
                <strong>{responsableLabel}</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0.65rem" }}>
                  @{session?.username}
                </p>
                <label className="btn-add btn-sm" style={{ cursor: "pointer" }}>
                  Ajouter / changer photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 0 }}>
              <h4 className="panel-title">Apparence</h4>
              <div className="theme-switch">
                <button
                  type="button"
                  className={prefs.theme === "light" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "light" })}
                >
                  Mode clair
                </button>
                <button
                  type="button"
                  className={prefs.theme === "dark" ? "btn-next" : "btn-secondary"}
                  onClick={() => persistPrefs({ ...prefs, theme: "dark" })}
                >
                  Mode sombre
                </button>
              </div>
            </div>

            <form className="panel" onSubmit={(e) => void onChangePassword(e)}>
              <h4 className="panel-title">Changer le mot de passe</h4>
              {pwdError ? <div className="login-error">{pwdError}</div> : null}
              {pwdMsg ? <div className="success-banner">{pwdMsg}</div> : null}
              <PasswordField
                label="Mot de passe actuel"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
              />
              <PasswordField
                label="Nouveau mot de passe"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirmer"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 160 }}>
                Enregistrer
              </button>
            </form>

            <button type="button" className="btn-logout" style={{ width: "100%", marginTop: "0.75rem" }} onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    applyTheme(getPrefs().theme);
  }, []);

  return (
    <Routes>
      <Route path="/setup" element={<SetupFirstUserPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sante/login" element={<HealthLoginPage />} />
      <Route
        path="/sante/*"
        element={
          <RequireHealth>
            <HealthShell />
          </RequireHealth>
        }
      />
      <Route
        path="/*"
        element={
          <RequireCivil>
            <Shell />
          </RequireCivil>
        }
      />
    </Routes>
  );
}
