/** Tableaux synoptiques — forme officielle (Justicia) par commune.
 *  Filtres Province → Ville → Commune, puis détail G/F/T.
 */

import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getSession } from "../auth";
import { getOfficerCommune, type OfficerCommune } from "../commune";
import { isSuperAdminNational } from "../ecUsers";
import type { FlatCommune } from "../geoFallback";
import { isJudicialRole } from "../rbac";
import {
  listSynopticCommunes,
  synopticBirths,
  synopticDeaths,
  synopticDocuments,
  synopticMarriagesDivorces,
  synopticQuartiersForCommune,
  type Gft,
} from "../synoptic";

const TABS = [
  {
    slug: "naissances",
    label: "Liste des Nouveaux-nés",
    createLabel: "Enregistrer une naissance",
    createPath: "/births",
    managePath: "/manage/naissance",
  },
  {
    slug: "matrimonial",
    label: "Liste des État-matrimoniaux",
    createLabel: "Enregistrer un mariage",
    createPath: "/marriages",
    managePath: "/manage/mariage",
  },
  {
    slug: "deces",
    label: "Liste des Décès",
    createLabel: "Enregistrer un décès",
    createPath: "/deaths",
    managePath: "/manage/deces",
  },
  {
    slug: "documents",
    label: "Liste des Documents",
    createLabel: "Délivrer un document",
    createPath: "/documents",
    managePath: "/manage/document",
  },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];
type CommuneSel = OfficerCommune | FlatCommune;

function spreadGft(prefix: string, v: Gft): Record<string, number> {
  return {
    [`${prefix}_G`]: v.g,
    [`${prefix}_F`]: v.f,
    [`${prefix}_T`]: v.t,
  };
}

function GftHeads() {
  return (
    <>
      <th>G</th>
      <th>F</th>
      <th>T</th>
    </>
  );
}

function GftCells({ v }: { v: Gft }) {
  return (
    <>
      <td>{v.g}</td>
      <td>{v.f}</td>
      <td>{v.t}</td>
    </>
  );
}

function QuartiersPanel({ commune }: { commune: CommuneSel }) {
  const q = synopticQuartiersForCommune(commune);
  return (
    <div className="panel" style={{ marginTop: "1rem" }}>
      <h3 className="panel-title">
        Quartiers de {q.commune.name} ({q.rows.length})
      </h3>
      <div className="table-scroll">
        <table className="syn-official data-table">
          <thead>
            <tr>
              <th>Quartier</th>
              <GftHeads />
            </tr>
          </thead>
          <tbody>
            {q.rows.map((r) => (
              <tr key={r.quartier}>
                <td>{r.quartier}</td>
                <td>{r.g}</td>
                <td>{r.f}</td>
                <td>{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Total enregistrés rattachés aux quartiers : {q.total}</p>
    </div>
  );
}

function BirthsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticBirths(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      ...spreadGft("cong_sans", d.cong.sans),
      ...spreadGft("cong_avec", d.cong.avec),
      ...spreadGft("cong_jugement", d.cong.jugement),
      ...spreadGft("etr_sans", d.etr.sans),
      ...spreadGft("etr_avec", d.etr.avec),
      ...spreadGft("etr_jugement", d.etr.jugement),
      ...spreadGft("tot_sans", d.totSans),
      ...spreadGft("tot_avec", d.totAvec),
      ...spreadGft("tot_delai", d.dansDelai),
      ...spreadGft("tot_jugement", d.totJug),
      ...spreadGft("tot_naissances", d.totalNaissances),
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_naissances_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES NAISSANCES
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={3}>COMMUNE</th>
              <th colSpan={9}>POPULATION CONGOLAISE (I)</th>
              <th colSpan={9}>POPULATION ÉTRANGÈRE (II)</th>
              <th colSpan={15}>TOTAUX (I + II)</th>
            </tr>
            <tr>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (1)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (2)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (3)</th>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (4)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (5)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (6)</th>
              <th colSpan={3}>NAISSANCES SANS PROCURATION (1+4)=(7)</th>
              <th colSpan={3}>NAISSANCES AVEC PROCURATION (2+5)=(8)</th>
              <th colSpan={3}>NAISSANCES ENREGISTRÉES DANS LE DÉLAI (7+8)=(A)</th>
              <th colSpan={3}>NAISSANCES PAR JUGEMENT SUPPLÉTIF (3+6)=(B)</th>
              <th colSpan={3}>TOTAL NAISSANCES (A+B)</th>
            </tr>
            <tr>
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
              <GftHeads />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <GftCells v={d.cong.sans} />
              <GftCells v={d.cong.avec} />
              <GftCells v={d.cong.jugement} />
              <GftCells v={d.etr.sans} />
              <GftCells v={d.etr.avec} />
              <GftCells v={d.etr.jugement} />
              <GftCells v={d.totSans} />
              <GftCells v={d.totAvec} />
              <GftCells v={d.dansDelai} />
              <GftCells v={d.totJug} />
              <GftCells v={d.totalNaissances} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="syn-legend muted small">G = Garçons · F = Filles · T = Total</p>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function MatrimonialTable({ commune }: { commune: CommuneSel }) {
  const d = synopticMarriagesDivorces(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      mariage_nationaux: d.mariage.nationaux,
      mariage_etrangers: d.mariage.etrangers,
      mariage_mixtes: d.mariage.mixtes,
      mariage_total: d.mariage.total,
      divorce_nationaux: d.divorce.nationaux,
      divorce_etrangers: d.divorce.etrangers,
      divorce_mixtes: d.divorce.mixtes,
      divorce_total: d.divorce.total,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_matrimonial_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DE L&apos;ÉTAT CIVIL
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th rowSpan={2}>COMMUNE</th>
              <th colSpan={4}>MARIAGE</th>
              <th colSpan={4}>DIVORCE</th>
            </tr>
            <tr>
              <th>NATIONAUX</th>
              <th>ÉTRANGERS</th>
              <th>MIXTES</th>
              <th>TOTAL</th>
              <th>NATIONAUX</th>
              <th>ÉTRANGERS</th>
              <th>MIXTES</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.mariage.nationaux}</td>
              <td>{d.mariage.etrangers}</td>
              <td>{d.mariage.mixtes}</td>
              <td>{d.mariage.total}</td>
              <td>{d.divorce.nationaux}</td>
              <td>{d.divorce.etrangers}</td>
              <td>{d.divorce.mixtes}</td>
              <td>{d.divorce.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function DeathsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticDeaths(commune);
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      hommes: d.hommes,
      femmes: d.femmes,
      garcons: d.garcons,
      filles: d.filles,
      totalA: d.totalA,
      mortsNesG: d.mortsNesG,
      mortsNesF: d.mortsNesF,
      totalB: d.totalB,
      totalAB: d.totalAB,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_deces_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES DÉCÈS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>COMMUNE</th>
              <th>HOMMES</th>
              <th>FEMMES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
              <th>TOTAL (A)</th>
              <th>MORTS-NÉS G</th>
              <th>MORTS-NÉS F</th>
              <th>TOTAL (B)</th>
              <th>TOTAL (A+B)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune-cell">{d.commune.name}</td>
              <td>{d.hommes}</td>
              <td>{d.femmes}</td>
              <td>{d.garcons}</td>
              <td>{d.filles}</td>
              <td>{d.totalA}</td>
              <td>{d.mortsNesG}</td>
              <td>{d.mortsNesF}</td>
              <td>{d.totalB}</td>
              <td>{d.totalAB}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

function DocumentsTable({ commune }: { commune: CommuneSel }) {
  const d = synopticDocuments(commune);
  const rows = d.byType.map((r) => ({
    commune: d.commune.name,
    type: r.type,
    count: r.count,
  }));

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_documents_${d.commune.code}`} rows={rows} />
      </div>
      <h2 className="syn-official-title">
        TABLEAU SYNOPTIQUE — DOCUMENTS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()} ({d.commune.code})
      </h2>
      <div className="table-scroll">
        <table className="syn-official">
          <thead>
            <tr>
              <th>TYPE DE DOCUMENT</th>
              <th>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {d.byType.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted">
                  Aucun document
                </td>
              </tr>
            ) : (
              d.byType.map((r) => (
                <tr key={r.type}>
                  <td>{r.type}</td>
                  <td>{r.count}</td>
                </tr>
              ))
            )}
            <tr>
              <td className="syn-commune-cell">
                <strong>TOTAL</strong>
              </td>
              <td>
                <strong>{d.total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <QuartiersPanel commune={commune} />
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  const session = getSession();
  if (isJudicialRole(session?.roles)) {
    return <Navigate to="/" replace />;
  }
  const isNational = isSuperAdminNational(session?.roles);
  const officer = getOfficerCommune();
  const [filterProvince, setFilterProvince] = useState(() =>
    isNational ? "" : officer.province || "",
  );
  const [filterVille, setFilterVille] = useState(() =>
    isNational ? "" : officer.ville || "",
  );
  const [selected, setSelected] = useState<FlatCommune | null>(() => {
    if (isNational) return null;
    const all = listSynopticCommunes();
    return all.find((c) => c.code === officer.code || c.name === officer.name) ?? null;
  });

  if (!section) return <Navigate to="/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;
  const commune: CommuneSel | null = selected;

  function pickCommuneByCode(code: string) {
    const hit = listSynopticCommunes().find((c) => c.code === code) ?? null;
    setSelected(hit);
    if (hit) {
      setFilterProvince(hit.province);
      setFilterVille(hit.ville);
    }
  }

  function resetFilters() {
    setSelected(null);
    setFilterProvince(isNational ? "" : officer.province || "");
    setFilterVille(isNational ? "" : officer.ville || "");
  }

  const provinces = useMemo(
    () =>
      [
        ...new Set(
          listSynopticCommunes()
            .filter((c) => isNational || !officer.province || c.province === officer.province)
            .map((c) => c.province),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [isNational, officer.province],
  );

  const villes = useMemo(
    () =>
      [
        ...new Set(
          listSynopticCommunes()
            .filter((c) => !filterProvince || c.province === filterProvince)
            .map((c) => c.ville),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [filterProvince],
  );

  const communesOpts = useMemo(
    () =>
      listSynopticCommunes()
        .filter((c) => !filterProvince || c.province === filterProvince)
        .filter((c) => !filterVille || c.ville === filterVille)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [filterProvince, filterVille],
  );

  return (
    <div className="syn-page">
      <div className="eg-page-head no-print">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Choisissez <strong>province → ville → commune</strong>, puis consultez le détail
            officiel (G / F / T).
          </p>
        </div>
      </div>

      <div className="panel no-print" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title" style={{ margin: 0 }}>
            Filtres
          </h3>
          <button type="button" className="btn-secondary btn-sm" onClick={resetFilters}>
            Réinitialiser
          </button>
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">1. Province</label>
            <select
              className="form-control"
              value={filterProvince}
              onChange={(e) => {
                setFilterProvince(e.target.value);
                setFilterVille("");
                setSelected(null);
              }}
            >
              <option value="">— Choisir la province —</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">2. Ville</label>
            <select
              className="form-control"
              value={filterVille}
              onChange={(e) => {
                setFilterVille(e.target.value);
                setSelected(null);
              }}
              disabled={!filterProvince}
            >
              <option value="">— Choisir la ville —</option>
              {villes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">3. Commune</label>
            <select
              className="form-control"
              value={selected?.code ?? ""}
              onChange={(e) => {
                if (!e.target.value) {
                  setSelected(null);
                  return;
                }
                pickCommuneByCode(e.target.value);
              }}
              disabled={!filterProvince}
            >
              <option value="">— Choisir la commune —</option>
              {communesOpts.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="syn-tabs no-print">
        {TABS.map((t) => (
          <NavLink
            key={t.slug}
            to={`/synoptique/${t.slug}`}
            className={({ isActive }) => `syn-tab${isActive || tab === t.slug ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {(() => {
        const active = TABS.find((t) => t.slug === tab) ?? TABS[0];
        return (
          <div
            className="panel no-print"
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <p className="muted small" style={{ margin: 0, flex: "1 1 220px" }}>
              {selected ? (
                <>
                  Commune <strong>{selected.name}</strong> ({selected.ville}) — {active.label}
                </>
              ) : (
                <>Sélectionnez une commune pour afficher le tableau synoptique.</>
              )}
            </p>
            <Link className="btn-primary" style={{ width: "auto" }} to={active.createPath}>
              + {active.createLabel}
            </Link>
            <Link className="btn-secondary" style={{ width: "auto" }} to={active.managePath}>
              Voir la liste gérable
            </Link>
          </div>
        );
      })()}

      <div className="syn-official-wrap">
        {commune ? (
          <>
            {tab === "naissances" ? <BirthsTable commune={commune} /> : null}
            {tab === "matrimonial" ? <MatrimonialTable commune={commune} /> : null}
            {tab === "deces" ? <DeathsTable commune={commune} /> : null}
            {tab === "documents" ? <DocumentsTable commune={commune} /> : null}
          </>
        ) : (
          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>
              Aucun tableau national ici. Utilisez les filtres ci-dessus (province → ville → commune)
              pour afficher le détail.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
