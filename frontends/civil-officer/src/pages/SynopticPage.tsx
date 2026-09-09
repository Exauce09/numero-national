/** Tableau synoptique — lisible, exportable, limité à la commune du compte. */

import type { ReactNode } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { getOfficerCommune } from "../commune";
import {
  synopticBirths,
  synopticDeaths,
  synopticDocuments,
  synopticMarriagesDivorces,
  type Gft,
} from "../synoptic";

const TABS = [
  { slug: "naissances", label: "Naissances / Nouveaux-nés" },
  { slug: "matrimonial", label: "État matrimonial" },
  { slug: "deces", label: "Décès" },
  { slug: "documents", label: "Documents" },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

function gftRow(prefix: string, v: Gft): Record<string, number> {
  return {
    [`${prefix}_garcons`]: v.g,
    [`${prefix}_filles`]: v.f,
    [`${prefix}_total`]: v.t,
  };
}

function MiniGft({ label, v }: { label: string; v: Gft }) {
  return (
    <div className="syn-mini">
      <div className="syn-mini-label">{label}</div>
      <div className="syn-mini-grid">
        <div>
          <span>Garçons (G)</span>
          <strong>{v.g}</strong>
        </div>
        <div>
          <span>Filles (F)</span>
          <strong>{v.f}</strong>
        </div>
        <div>
          <span>Total (T)</span>
          <strong>{v.t}</strong>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "cong" | "etr" | "total";
}) {
  return (
    <section className={`syn-block syn-block-${tone}`}>
      <h3 className="syn-block-title">{title}</h3>
      {children}
    </section>
  );
}

function BirthsView() {
  const d = synopticBirths();
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      ville: d.commune.ville,
      province: d.commune.province,
      ...gftRow("cong_sans_procuration", d.cong.sans),
      ...gftRow("cong_avec_procuration", d.cong.avec),
      ...gftRow("cong_jugement", d.cong.jugement),
      ...gftRow("etr_sans_procuration", d.etr.sans),
      ...gftRow("etr_avec_procuration", d.etr.avec),
      ...gftRow("etr_jugement", d.etr.jugement),
      ...gftRow("total_sans_procuration", d.totSans),
      ...gftRow("total_avec_procuration", d.totAvec),
      ...gftRow("total_dans_delai", d.dansDelai),
      ...gftRow("total_jugement", d.totJug),
      ...gftRow("total_naissances", d.totalNaissances),
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_naissances_${d.commune.code}`} rows={rows} />
      </div>

      <header className="syn-header">
        <p className="syn-kicker">Tableau synoptique · Naissances</p>
        <h2 className="syn-title">
          Commune de {d.commune.name}
          <span>
            {d.commune.ville} · {d.commune.province} · {d.commune.code}
          </span>
        </h2>
        <p className="syn-interpret">
          Lecture : chaque bloc sépare <strong>garçons (G)</strong>, <strong>filles (F)</strong> et{" "}
          <strong>total (T)</strong>. Les naissances congolaise et étrangère sont isolées, puis totalisées.
        </p>
      </header>

      <div className="syn-grid-2">
        <Section title="I — Population congolaise" tone="cong">
          <MiniGft label="Sans procuration (1)" v={d.cong.sans} />
          <MiniGft label="Avec procuration (2)" v={d.cong.avec} />
          <MiniGft label="Jugement supplétif (3)" v={d.cong.jugement} />
        </Section>
        <Section title="II — Population étrangère" tone="etr">
          <MiniGft label="Sans procuration (4)" v={d.etr.sans} />
          <MiniGft label="Avec procuration (5)" v={d.etr.avec} />
          <MiniGft label="Jugement supplétif (6)" v={d.etr.jugement} />
        </Section>
      </div>

      <Section title="Totaux (I + II)" tone="total">
        <div className="syn-grid-3">
          <MiniGft label="Sans procuration (1+4)" v={d.totSans} />
          <MiniGft label="Avec procuration (2+5)" v={d.totAvec} />
          <MiniGft label="Dans le délai A = (7+8)" v={d.dansDelai} />
          <MiniGft label="Jugement B = (3+6)" v={d.totJug} />
          <MiniGft label="TOTAL NAISSANCES (A+B)" v={d.totalNaissances} />
        </div>
      </Section>

      <p className="muted small syn-foot">
        {d.count} naissance(s) source — uniquement la commune attribuée au compte officier.
      </p>
    </>
  );
}

function MatrimonialView() {
  const d = synopticMarriagesDivorces();
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      ville: d.commune.ville,
      province: d.commune.province,
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
      <header className="syn-header">
        <p className="syn-kicker">Tableau synoptique · État matrimonial</p>
        <h2 className="syn-title">
          Commune de {d.commune.name}
          <span>
            {d.commune.ville} · {d.commune.province} · {d.commune.code}
          </span>
        </h2>
        <p className="syn-interpret">
          <strong>Nationaux</strong> = deux conjoints congolais · <strong>Étrangers</strong> = deux étrangers ·{" "}
          <strong>Mixtes</strong> = une nationalité de chaque.
        </p>
      </header>

      <div className="syn-grid-2">
        <Section title="Mariages" tone="cong">
          <table className="syn-table syn-table-simple">
            <thead>
              <tr>
                <th>Nationaux</th>
                <th>Étrangers</th>
                <th>Mixtes</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{d.mariage.nationaux}</td>
                <td>{d.mariage.etrangers}</td>
                <td>{d.mariage.mixtes}</td>
                <td>
                  <strong>{d.mariage.total}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section title="Divorces" tone="etr">
          <table className="syn-table syn-table-simple">
            <thead>
              <tr>
                <th>Nationaux</th>
                <th>Étrangers</th>
                <th>Mixtes</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{d.divorce.nationaux}</td>
                <td>{d.divorce.etrangers}</td>
                <td>{d.divorce.mixtes}</td>
                <td>
                  <strong>{d.divorce.total}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}

function DeathsView() {
  const d = synopticDeaths();
  const rows = [
    {
      commune: d.commune.name,
      code: d.commune.code,
      ville: d.commune.ville,
      province: d.commune.province,
      deces_hommes: d.hommes,
      deces_femmes: d.femmes,
      deces_garcons: d.garcons,
      deces_filles: d.filles,
      total_deces_a: d.totalA,
      morts_nes_garcons: d.mortsNesG,
      morts_nes_filles: d.mortsNesF,
      total_morts_nes_b: d.totalB,
      total_a_plus_b: d.totalAB,
    },
  ];

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_deces_${d.commune.code}`} rows={rows} />
      </div>
      <header className="syn-header">
        <p className="syn-kicker">Tableau synoptique · Décès</p>
        <h2 className="syn-title">
          Commune de {d.commune.name}
          <span>
            {d.commune.ville} · {d.commune.province} · {d.commune.code}
          </span>
        </h2>
        <p className="syn-interpret">
          Hommes / femmes = majeurs (≥ 18 ans). Garçons / filles = mineurs. Les morts-nés sont comptés à part (b), puis
          additionnés au total (a+b).
        </p>
      </header>

      <div className="syn-grid-2">
        <Section title="Décès (a)" tone="cong">
          <table className="syn-table syn-table-simple">
            <thead>
              <tr>
                <th>Hommes</th>
                <th>Femmes</th>
                <th>Garçons</th>
                <th>Filles</th>
                <th>Total (a)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{d.hommes}</td>
                <td>{d.femmes}</td>
                <td>{d.garcons}</td>
                <td>{d.filles}</td>
                <td>
                  <strong>{d.totalA}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section title="Morts-nés (b)" tone="etr">
          <table className="syn-table syn-table-simple">
            <thead>
              <tr>
                <th>Garçons</th>
                <th>Filles</th>
                <th>Total (b)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{d.mortsNesG}</td>
                <td>{d.mortsNesF}</td>
                <td>
                  <strong>{d.totalB}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="Total général" tone="total">
        <div className="syn-big-total">
          <span>TOTAUX (a + b)</span>
          <strong>{d.totalAB}</strong>
        </div>
      </Section>
      <p className="muted small syn-foot">{d.count} décès source pour cette commune.</p>
    </>
  );
}

function DocumentsView() {
  const d = synopticDocuments();
  const rows =
    d.byType.length === 0
      ? [
          {
            commune: d.commune.name,
            code: d.commune.code,
            type_document: "—",
            nombre: 0,
          },
        ]
      : d.byType.map((r) => ({
          commune: d.commune.name,
          code: d.commune.code,
          ville: d.commune.ville,
          province: d.commune.province,
          type_document: r.type,
          nombre: r.count,
        }));

  return (
    <>
      <div className="syn-toolbar no-print">
        <DataToolbar filename={`synoptique_documents_${d.commune.code}`} rows={rows} />
      </div>
      <header className="syn-header">
        <p className="syn-kicker">Tableau synoptique · Documents</p>
        <h2 className="syn-title">
          Commune de {d.commune.name}
          <span>
            {d.commune.ville} · {d.commune.province} · {d.commune.code}
          </span>
        </h2>
        <p className="syn-interpret">Documents délivrés par type pour la seule commune du compte officier.</p>
      </header>

      <Section title="Répartition par type" tone="default">
        <table className="syn-table syn-table-simple">
          <thead>
            <tr>
              <th>Type de document</th>
              <th>Nombre</th>
            </tr>
          </thead>
          <tbody>
            {d.byType.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted">
                  Aucun document.
                </td>
              </tr>
            ) : (
              d.byType.map((r) => (
                <tr key={r.type}>
                  <td className="syn-left">{r.type}</td>
                  <td>{r.count}</td>
                </tr>
              ))
            )}
            <tr>
              <td className="syn-left">
                <strong>TOTAL</strong>
              </td>
              <td>
                <strong>{d.total}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </>
  );
}

export default function SynopticPage() {
  const { section } = useParams<{ section?: string }>();
  if (!section) return <Navigate to="/synoptique/naissances" replace />;
  const tab = (TABS.some((t) => t.slug === section) ? section : "naissances") as TabSlug;
  const commune = getOfficerCommune();

  return (
    <div className="syn-page">
      <div className="eg-page-head no-print">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Tableau synoptique
          </p>
          <h2 className="page-title">Tableau synoptique</h2>
          <p className="page-lead">
            Commune du compte : <strong>{commune.name}</strong> ({commune.code}) — {commune.ville},{" "}
            {commune.province}. Attribuée automatiquement à la création du compte officier.
          </p>
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

      <div className="syn-panel">
        {tab === "naissances" ? <BirthsView /> : null}
        {tab === "matrimonial" ? <MatrimonialView /> : null}
        {tab === "deces" ? <DeathsView /> : null}
        {tab === "documents" ? <DocumentsView /> : null}
      </div>
    </div>
  );
}
