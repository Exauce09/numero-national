import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CitizenDetail, type PersonCivilEvent } from "../api";
import { getSession } from "../auth";
import { displayName, getPerson, listActs, type Person } from "../registry";
import { nationalHitToPerson } from "../nationalSearch";

type TabId =
  | "identite"
  | "etat_civil"
  | "filiation"
  | "actes"
  | "mariage"
  | "divorce"
  | "deces"
  | "mentions"
  | "documents"
  | "biometrie"
  | "historique";

const TABS: { id: TabId; label: string }[] = [
  { id: "identite", label: "Identité" },
  { id: "etat_civil", label: "État civil" },
  { id: "filiation", label: "Filiation" },
  { id: "actes", label: "Actes" },
  { id: "mariage", label: "Mariage" },
  { id: "divorce", label: "Divorce" },
  { id: "deces", label: "Décès" },
  { id: "mentions", label: "Mentions" },
  { id: "documents", label: "Documents" },
  { id: "biometrie", label: "Biométrie" },
  { id: "historique", label: "Historique" },
];

function sexLabel(sex: string): string {
  const s = sex.toUpperCase();
  if (s === "F" || s === "FEMALE" || s === "FEMININ") return "Féminin";
  if (s === "M" || s === "MALE" || s === "MASCULIN") return "Masculin";
  return sex || "—";
}

function statusBadge(status: string, deceased: boolean): string {
  if (deceased) return "DECEASED";
  return status || "—";
}

export default function PersonDetailPage() {
  const { id = "" } = useParams();
  const hasApi = Boolean(getSession()?.accessToken);
  const [tab, setTab] = useState<TabId>("identite");
  const [citizen, setCitizen] = useState<CitizenDetail | null>(null);
  const [events, setEvents] = useState<PersonCivilEvent[]>([]);
  const [prints, setPrints] = useState<
    Array<{
      id: string;
      finger_label: string;
      quality_score: number | null;
      status: string;
      created_at: string;
    }>
  >([]);
  const [local, setLocal] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      const localHit = getPerson(id);
      if (localHit) setLocal(localHit);

      if (!hasApi) {
        if (!localHit) setError("Personne introuvable (hors ligne / sans jeton API).");
        setBusy(false);
        return;
      }

      try {
        const detail = await api.getCitizen(id);
        if (cancelled) return;
        setCitizen(detail);
        nationalHitToPerson({
          id: detail.id,
          nic: detail.nic,
          status: detail.status,
          family_name: detail.family_name,
          given_names: detail.given_names,
          date_of_birth: detail.date_of_birth,
          sex: detail.sex,
          place_of_birth: detail.place_of_birth,
        });
        setLocal(getPerson(detail.id) ?? localHit ?? null);
        try {
          const hist = await api.personCivilHistory(detail.id);
          if (!cancelled) setEvents(hist.events ?? []);
        } catch {
          if (!cancelled) setEvents([]);
        }
        try {
          const fp = await api.biometricCitizenPrints(detail.id);
          if (!cancelled) setPrints(fp);
        } catch {
          if (!cancelled) setPrints([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chargement impossible.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, hasApi]);

  const localActs = useMemo(() => {
    const nic = citizen?.nic || local?.nic;
    return listActs().filter(
      (a) =>
        a.national_id === nic ||
        String(a.payload.person_id ?? a.payload.citizen_id ?? "") === id,
    );
  }, [citizen?.nic, local?.nic, id]);

  const title = citizen
    ? `${citizen.family_name} ${citizen.given_names}`.trim()
    : local
      ? displayName(local)
      : "Personne";

  const nic = citizen?.nic || local?.nic || "—";
  const deceased = Boolean(citizen?.deceased_at);

  return (
    <div>
      <p className="eg-breadcrumb">
        <Link to="/population">Population</Link> / Fiche
      </p>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">
            Numéro : <code>{nic}</code>
            {" · "}
            Statut :{" "}
            <span className="status-badge">
              {statusBadge(citizen?.status || local?.etat_civil || "LOCAL", deceased)}
            </span>
          </p>
        </div>
        <Link className="btn-secondary" to="/population">
          ← Retour à la population
        </Link>
      </div>

      {busy ? <p className="muted">Chargement de la fiche…</p> : null}
      {error ? (
        <div className="login-error" role="alert">
          {error}
        </div>
      ) : null}

      {!busy && (citizen || local) ? (
        <>
          <div className="panel" style={{ marginBottom: "1rem" }}>
            <div className="action-row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn-secondary btn-sm${tab === t.id ? " active" : ""}`}
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            {tab === "identite" ? (
              <dl className="act-print-fields">
                <div>
                  <dt>Nom</dt>
                  <dd>{citizen?.family_name || local?.nom || "—"}</dd>
                </div>
                <div>
                  <dt>Prénoms / postnom</dt>
                  <dd>{citizen?.given_names || `${local?.prenom ?? ""} ${local?.postnom ?? ""}`.trim() || "—"}</dd>
                </div>
                <div>
                  <dt>Sexe</dt>
                  <dd>{sexLabel(citizen?.sex || local?.sexe || "")}</dd>
                </div>
                <div>
                  <dt>Date de naissance</dt>
                  <dd>{(citizen?.date_of_birth || local?.date_naissance || "—").toString().slice(0, 10)}</dd>
                </div>
                <div>
                  <dt>Lieu de naissance</dt>
                  <dd>{citizen?.place_of_birth || local?.lieu_naissance || "—"}</dd>
                </div>
                <div>
                  <dt>Nationalité</dt>
                  <dd>{citizen?.nationality || local?.nationalite || "—"}</dd>
                </div>
                <div>
                  <dt>NIC</dt>
                  <dd>
                    <code>{nic}</code>
                  </dd>
                </div>
              </dl>
            ) : null}

            {tab === "etat_civil" ? (
              <dl className="act-print-fields">
                <div>
                  <dt>Statut registre</dt>
                  <dd>{citizen?.status || "LOCAL"}</dd>
                </div>
                <div>
                  <dt>État civil (local)</dt>
                  <dd>{local?.etat_civil || "—"}</dd>
                </div>
                <div>
                  <dt>Validé le</dt>
                  <dd>{citizen?.validated_at ? new Date(citizen.validated_at).toLocaleString("fr-CD") : "—"}</dd>
                </div>
                <div>
                  <dt>Décédé le</dt>
                  <dd>
                    {citizen?.deceased_at
                      ? new Date(citizen.deceased_at).toLocaleString("fr-CD")
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : null}

            {tab === "filiation" ? (
              <dl className="act-print-fields">
                <div>
                  <dt>Père</dt>
                  <dd>
                    {local?.father_id
                      ? (() => {
                          const f = getPerson(local.father_id);
                          return f ? displayName(f) : local.father_id;
                        })()
                      : "— (relations structurées côté API à enrichir)"}
                  </dd>
                </div>
                <div>
                  <dt>Mère</dt>
                  <dd>
                    {local?.mother_id
                      ? (() => {
                          const m = getPerson(local.mother_id);
                          return m ? displayName(m) : local.mother_id;
                        })()
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : null}

            {tab === "actes" || tab === "historique" ? (
              <div>
                <h3 className="panel-title">Actes d&apos;état civil</h3>
                {events.length === 0 && localActs.length === 0 ? (
                  <p className="muted">Aucun acte lié pour le moment.</p>
                ) : (
                  <ul className="timeline-list">
                    {events.map((e) => (
                      <li key={e.act_id}>
                        <strong>{e.act_type}</strong> · {e.act_number} · {e.status}
                        {e.at ? ` · ${new Date(e.at).toLocaleDateString("fr-CD")}` : ""}
                      </li>
                    ))}
                    {localActs.map((a) => (
                      <li key={a.id}>
                        <strong>{a.type}</strong> · {a.act_number} (local)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "mariage" ? (
              <p className="muted">
                {events.filter((e) => e.act_type === "MARRIAGE").length
                  ? events
                      .filter((e) => e.act_type === "MARRIAGE")
                      .map((e) => `${e.act_number} (${e.status})`)
                      .join(" · ")
                  : "Aucun mariage enregistré sur cette fiche."}
              </p>
            ) : null}

            {tab === "divorce" ? (
              <p className="muted">
                {events.filter((e) => e.act_type === "DIVORCE").length
                  ? events
                      .filter((e) => e.act_type === "DIVORCE")
                      .map((e) => `${e.act_number} (${e.status})`)
                      .join(" · ")
                  : "Aucun divorce enregistré. Un divorce ne supprime jamais le mariage."}
              </p>
            ) : null}

            {tab === "deces" ? (
              <p className="muted">
                {deceased
                  ? `Décès enregistré le ${new Date(citizen!.deceased_at!).toLocaleString("fr-CD")}. La personne n’est pas supprimée.`
                  : "Aucun décès enregistré."}
              </p>
            ) : null}

            {tab === "mentions" ? (
              <p className="muted">Mentions marginales : disponibles via l’extrait d’acte (phase ultérieure).</p>
            ) : null}

            {tab === "documents" ? (
              <div>
                {(citizen?.addresses ?? []).length === 0 ? (
                  <p className="muted">Aucune adresse / document lié en base pour cette fiche.</p>
                ) : (
                  <ul>
                    {citizen!.addresses.map((a) => (
                      <li key={a.id}>
                        {a.address_type} — {a.line1}, {a.city}
                        {a.commune_code ? ` (${a.commune_code})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "biometrie" ? (
              <div>
                <p>
                  Empreintes enregistrées : <strong>{prints.length} / 3</strong>
                </p>
                <div className="action-row" style={{ marginBottom: "0.75rem" }}>
                  <Link className="btn-primary btn-sm" to={`/biometrie/enrolement?citizen=${id}`}>
                    Enrôler / compléter
                  </Link>
                  <Link className="btn-secondary btn-sm" to="/biometrie/identification">
                    Identification 1:N
                  </Link>
                </div>
                {prints.length === 0 ? (
                  <p className="muted">Aucune empreinte active (gabarits jamais affichés ici).</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Doigt</th>
                        <th>Qualité</th>
                        <th>Statut</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prints.map((p) => (
                        <tr key={p.id}>
                          <td>{p.finger_label}</td>
                          <td>{p.quality_score != null ? `${p.quality_score} %` : "—"}</td>
                          <td>
                            <span className="status-badge">{p.status}</span>
                          </td>
                          <td>{new Date(p.created_at).toLocaleDateString("fr-CD")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
