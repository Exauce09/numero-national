/** Tableau synoptique — statistiques de la commune de l'officier uniquement. */

import type { ReactNode } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import { getOfficerCommune } from "../commune";
import {
  synopticBirths,
  synopticDeaths,
  synopticDocuments,
  synopticMarriagesDivorces,
  type Gft,
} from "../synoptic";

const TABS = [
  { slug: "naissances", label: "Liste des Nouveaux-nés" },
  { slug: "matrimonial", label: "Liste des État-matrimoniaux" },
  { slug: "deces", label: "Liste des Décès" },
  { slug: "documents", label: "Liste des Documents" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

function Cell({ children }: { children: ReactNode }) {
  return <td className="syn-cell">{children}</td>;
}

function GftCells({ v }: { v: Gft }) {
  return (
    <>
      <Cell>{v.g}</Cell>
      <Cell>{v.f}</Cell>
      <Cell>{v.t}</Cell>
    </>
  );
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

function BirthsTable() {
  const d = synopticBirths();
  return (
    <>
      <h2 className="syn-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DES NAISSANCES
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()}
      </h2>
      <div className="table-scroll">
        <table className="syn-table">
          <thead>
            <tr>
              <th rowSpan={3}>COMMUNE</th>
              <th colSpan={9}>POPULATION CONGOLAISE (I)</th>
              <th colSpan={9}>POPULATION ÉTRANGÈRE (II)</th>
              <th colSpan={15}>TOTAUX (I + II)</th>
            </tr>
            <tr>
              <th colSpan={3}>Sans procuration (1)</th>
              <th colSpan={3}>Avec procuration (2)</th>
              <th colSpan={3}>Jugement supplétif (3)</th>
              <th colSpan={3}>Sans procuration (4)</th>
              <th colSpan={3}>Avec procuration (5)</th>
              <th colSpan={3}>Jugement supplétif (6)</th>
              <th colSpan={3}>(1+4)=(7)</th>
              <th colSpan={3}>(2+5)=(8)</th>
              <th colSpan={3}>Dans délai (A)</th>
              <th colSpan={3}>Jugement (B)</th>
              <th colSpan={3}>TOTAL (A+B)</th>
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
              <td className="syn-commune">{d.commune.name}</td>
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
      <p className="muted small syn-foot">{d.count} naissance(s) enregistrée(s) pour cette commune.</p>
    </>
  );
}

function MatrimonialTable() {
  const d = synopticMarriagesDivorces();
  return (
    <>
      <h2 className="syn-title">
        TABLEAU SYNOPTIQUE RÉCAPITULATIF DES STATISTIQUES DE L&apos;ÉTAT CIVIL
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()}
      </h2>
      <div className="table-scroll">
        <table className="syn-table">
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
              <td className="syn-commune">{d.commune.name}</td>
              <Cell>{d.mariage.nationaux}</Cell>
              <Cell>{d.mariage.etrangers}</Cell>
              <Cell>{d.mariage.mixtes}</Cell>
              <Cell>{d.mariage.total}</Cell>
              <Cell>{d.divorce.nationaux}</Cell>
              <Cell>{d.divorce.etrangers}</Cell>
              <Cell>{d.divorce.mixtes}</Cell>
              <Cell>{d.divorce.total}</Cell>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function DeathsTable() {
  const d = synopticDeaths();
  return (
    <>
      <h2 className="syn-title">
        TABLEAU RÉCAPITULATIF DES STATISTIQUES DES DÉCÈS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()}
      </h2>
      <div className="table-scroll">
        <table className="syn-table">
          <thead>
            <tr>
              <th rowSpan={2}>COMMUNE</th>
              <th colSpan={4}>DÉCÈS</th>
              <th rowSpan={2}>TOTAL (a)</th>
              <th colSpan={2}>MORTS NÉS</th>
              <th rowSpan={2}>TOTAL (b)</th>
              <th rowSpan={2}>TOTAUX (a+b)</th>
            </tr>
            <tr>
              <th>HOMMES</th>
              <th>FEMMES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
              <th>GARÇONS</th>
              <th>FILLES</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="syn-commune">{d.commune.name}</td>
              <Cell>{d.hommes}</Cell>
              <Cell>{d.femmes}</Cell>
              <Cell>{d.garcons}</Cell>
              <Cell>{d.filles}</Cell>
              <Cell>{d.totalA}</Cell>
              <Cell>{d.mortsNesG}</Cell>
              <Cell>{d.mortsNesF}</Cell>
              <Cell>{d.totalB}</Cell>
              <Cell>{d.totalAB}</Cell>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small syn-foot">{d.count} décès enregistré(s) pour cette commune.</p>
    </>
  );
}

function DocumentsTable() {
  const d = synopticDocuments();
  return (
    <>
      <h2 className="syn-title">
        TABLEAU SYNOPTIQUE DES DOCUMENTS DÉLIVRÉS
        <br />
        COMMUNE DE {d.commune.name.toUpperCase()} — {d.commune.ville.toUpperCase()}
      </h2>
      <div className="table-scroll">
        <table className="syn-table">
          <thead>
            <tr>
              <th>COMMUNE</th>
              <th>TYPE DE DOCUMENT</th>
              <th>NOMBRE</th>
            </tr>
          </thead>
          <tbody>
            {d.byType.length === 0 ? (
              <tr>
                <td className="syn-commune">{d.commune.name}</td>
                <td colSpan={2} className="muted">
                  Aucun document pour cette commune.
                </td>
              </tr>
            ) : (
              d.byType.map((row) => (
                <tr key={row.type}>
                  <td className="syn-commune">{d.commune.name}</td>
                  <Cell>{row.type}</Cell>
                  <Cell>{row.count}</Cell>
                </tr>
              ))
            )}
            <tr>
              <td className="syn-commune" colSpan={2}>
                <strong>TOTAL</strong>
              </td>
              <Cell>
                <strong>{d.total}</strong>
              </Cell>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  if (!section) return <Navigate to="/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;
  const commune = getOfficerCommune();

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Statistiques d&apos;état civil limitées à votre commune :{" "}
            <strong>{commune.name}</strong> ({commune.code}) — {commune.ville}, {commune.province}. Aucune autre
            commune, ville ou province n&apos;est affichée.
          </p>
        </div>
      </div>

      <div className="syn-tabs">
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

      <div className="syn-panel">
        {tab === "naissances" ? <BirthsTable /> : null}
        {tab === "matrimonial" ? <MatrimonialTable /> : null}
        {tab === "deces" ? <DeathsTable /> : null}
        {tab === "documents" ? <DocumentsTable /> : null}
      </div>
    </div>
  );
}
