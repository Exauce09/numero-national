/** Fiche d'identification type Justicia / état civil — sans District (config RDC actuelle). */

import type { CSSProperties } from "react";

export type FichePersonBlock = {
  nom: string;
  postnom: string;
  prenom: string;
  sexe: string;
  etat_civil: string;
  lieu_date_naissance: string;
  nationalite: string;
  profession: string;
  secteur: string;
  territoire: string;
  ville: string;
  province: string;
  adresse: string;
};

export type FicheIdentificationData = {
  communeName: string;
  villeProvince: string;
  serie: string;
  interesse: FichePersonBlock;
  conjoint: {
    nom: string;
    lieu_date_naissance: string;
    profession: string;
    adresse: string;
  };
  pere: FichePersonBlock;
  mere: FichePersonBlock;
  dateLieu: string;
};

export const emptyFichePerson = (): FichePersonBlock => ({
  nom: "",
  postnom: "",
  prenom: "",
  sexe: "",
  etat_civil: "",
  lieu_date_naissance: "",
  nationalite: "Congolaise",
  profession: "",
  secteur: "",
  territoire: "",
  ville: "",
  province: "",
  adresse: "",
});

const ink: CSSProperties = { color: "#1e88e5" };

const dotted: CSSProperties = {
  borderBottom: "1px dotted #1e88e5",
  minHeight: "1.15em",
  flex: 1,
  marginLeft: "0.35rem",
};

function Line({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: "0.28rem", ...ink }}>
      <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{label}</span>
      <span style={dotted}>{value || "\u00a0"}</span>
    </div>
  );
}

function PersonColumn({ title, data }: { title?: string; data: FichePersonBlock }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {title ? (
        <div
          style={{
            textAlign: "center",
            fontWeight: 800,
            marginBottom: "0.45rem",
            textDecoration: "underline",
            ...ink,
          }}
        >
          {title}
        </div>
      ) : null}
      <Line label="Nom de l'intéressé" value={data.nom} />
      <Line label="Post-nom" value={data.postnom} />
      <Line label="Prénom" value={data.prenom} />
      <Line label="Sexe" value={data.sexe} />
      <Line label="Etat-Civil" value={data.etat_civil} />
      <Line label="Lieu et date de naissance" value={data.lieu_date_naissance} />
      <Line label="Nationalité" value={data.nationalite} />
      <Line label="Profession" value={data.profession} />
      <Line label="Secteur" value={data.secteur} />
      <Line label="Territoire" value={data.territoire} />
      <Line label="District" value={data.ville} />
      <Line label="Province" value={data.province} />
      <Line label="Adresse" value={data.adresse} />
    </div>
  );
}

type Props = {
  data: FicheIdentificationData;
};

/** Document imprimable — calqué sur la fiche Justicia (District → Ville). */
export default function FicheIdentificationForm({ data }: Props) {
  return (
    <article className="fiche-ident-print" style={{ background: "#fff", color: "#1e88e5", padding: "1.25rem" }}>
      <header style={{ textAlign: "center", marginBottom: "0.75rem", position: "relative" }}>
        <div style={{ fontWeight: 700, lineHeight: 1.35 }}>
          Republique Democratique du Congo
          <br />
          Ville - Province de {data.villeProvince || "Kinshasa"}
        </div>
        <div style={{ margin: "0.45rem auto" }}>
          <img src="/logo-rdc.jpg" alt="Armoiries RDC" style={{ width: 64, height: 64, objectFit: "contain" }} />
        </div>
        <div style={{ fontWeight: 700 }}>Commune de {data.communeName || "—"}</div>
        <div style={{ fontWeight: 700, letterSpacing: "0.02em" }}>SERVIR DE L&apos;ETAT-CIVIL</div>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            fontSize: "0.78rem",
            fontWeight: 600,
            textAlign: "right",
          }}
        >
          Série {data.serie || "15/INF001-TSL/………"}
        </div>
      </header>

      <h1
        style={{
          textAlign: "center",
          margin: "0.6rem 0 0.2rem",
          fontSize: "1.55rem",
          fontWeight: 900,
          letterSpacing: "0.04em",
          ...ink,
        }}
      >
        FICHE D&apos;IDENTIFICATION
      </h1>
      <p style={{ textAlign: "center", margin: "0 0 1rem", fontSize: "0.82rem", fontWeight: 600, ...ink }}>
        Attestation de naissance, Célibataire, Résidence, Bonne vie et moeurs, Nom Fonctionnaire, Veuvage
      </p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 58%" }}>
          <PersonColumn data={data.interesse} />
        </div>
        <div
          style={{
            flex: "1 1 38%",
            border: "1.5px dashed #1e88e5",
            borderRadius: 4,
            padding: "0.65rem 0.75rem",
          }}
        >
          <Line label="Nom du Conjoint (e) :" value={data.conjoint.nom} />
          <Line label="Lieu de et date de naissance :" value={data.conjoint.lieu_date_naissance} />
          <Line label="Profession :" value={data.conjoint.profession} />
          <Line label="Adresse :" value={data.conjoint.adresse} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          border: "1.5px solid #1e88e5",
          borderRadius: 2,
          marginBottom: "1.25rem",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, padding: "0.65rem 0.75rem" }}>
          <PersonColumn title="PERE" data={data.pere} />
        </div>
        <div style={{ width: 1.5, background: "#1e88e5" }} />
        <div style={{ flex: 1, padding: "0.65rem 0.75rem" }}>
          <PersonColumn title="MERE" data={data.mere} />
        </div>
      </div>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
          <div
            style={{
              border: "1px solid #1e88e5",
              background: "#e3f2fd",
              padding: "0.45rem 1.1rem",
              fontWeight: 700,
              minWidth: 200,
              textAlign: "center",
            }}
          >
            Signature du requérant
          </div>
          <div style={{ ...ink, fontSize: "1.1rem" }}>↓</div>
          <div
            style={{
              border: "1px solid #1e88e5",
              background: "#e3f2fd",
              padding: "0.45rem 1.1rem",
              fontWeight: 700,
              minWidth: 200,
              textAlign: "center",
            }}
          >
            Signature de l&apos;Agent et Visa
          </div>
        </div>
        <div style={{ fontWeight: 700, ...ink }}>
          {data.dateLieu || "Kinshasa, le……… / ……… / ……………"}
        </div>
      </footer>
    </article>
  );
}
