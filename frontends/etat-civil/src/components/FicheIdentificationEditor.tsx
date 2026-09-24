/** Formulaire saisie calqué sur la fiche d'identification officielle (layout papier). */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ETAT_CIVIL_OPTIONS, type EtatCivil, type Sexe } from "../registry";
import { listKnownProfessions, PROFESSIONS_KEY, rememberNamed } from "../namedLists";
import GeoCascade, {
  GEO_PRESETS,
  ORIGIN_FIELD_LABELS,
  type GeoSelection,
} from "./GeoCascade";
import { emptyFichePerson, type FichePersonBlock } from "./FicheIdentificationForm";

export type FicheEditorConjoint = {
  nom: string;
  lieu_date_naissance: string;
  profession: string;
  adresse: string;
};

export type FicheEditorState = {
  serie: string;
  communeName: string;
  villeProvince: string;
  interesse: FichePersonBlock & {
    date_naissance: string;
    sexe_code: Sexe;
    etat_civil_code: EtatCivil;
  };
  conjoint: FicheEditorConjoint;
  pere: FichePersonBlock;
  mere: FichePersonBlock;
  dateLieu: string;
};

export function emptyFicheEditorState(opts?: {
  communeName?: string;
  villeProvince?: string;
  serie?: string;
  sexe?: Sexe;
}): FicheEditorState {
  const today = new Date().toLocaleDateString("fr-FR");
  return {
    serie: opts?.serie || "",
    communeName: opts?.communeName || "",
    villeProvince: opts?.villeProvince || "Kinshasa",
    interesse: {
      ...emptyFichePerson(),
      date_naissance: "",
      sexe_code: opts?.sexe ?? "M",
      etat_civil_code: "CELIBATAIRE",
      sexe: opts?.sexe === "F" ? "Féminin" : "Masculin",
      etat_civil: "Célibataire",
      nationalite: "Congolaise",
    },
    conjoint: { nom: "", lieu_date_naissance: "", profession: "", adresse: "" },
    pere: emptyFichePerson(),
    mere: emptyFichePerson(),
    dateLieu: `${opts?.villeProvince || "Kinshasa"}, le ${today}`,
  };
}

const ink: CSSProperties = { color: "#1e88e5" };

const lineRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  marginBottom: "0.32rem",
  gap: "0.35rem",
  ...ink,
};

const dottedInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: "100%",
  border: "none",
  borderBottom: "1px dotted #1e88e5",
  borderRadius: 0,
  background: "transparent",
  color: "#1565c0",
  fontWeight: 600,
  fontSize: "0.92rem",
  padding: "0.1rem 0.2rem",
  outline: "none",
};

const dottedSelect: CSSProperties = {
  ...dottedInput,
  cursor: "pointer",
};

function FieldLine({
  label,
  children,
  stacked,
}: {
  label: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      style={{
        ...lineRow,
        ...(stacked
          ? { flexDirection: "column", alignItems: "stretch", gap: "0.25rem" }
          : null),
      }}
    >
      <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  required,
  autoFocus,
  type = "text",
  placeholder,
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  type?: string;
  placeholder?: string;
  list?: string;
}) {
  return (
    <input
      style={dottedInput}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      autoFocus={autoFocus}
      placeholder={placeholder}
      list={list}
    />
  );
}

function geoFromPerson(value: FichePersonBlock): GeoSelection {
  return {
    province_name: value.province || undefined,
    ville_name: value.ville || undefined,
    district_name: value.territoire || undefined,
    commune_name: value.secteur || undefined,
    label: [value.province, value.ville, value.territoire, value.secteur].filter(Boolean).join(" · ") || undefined,
  };
}

function applyGeoToPerson(
  value: FichePersonBlock & { date_naissance?: string; sexe_code?: Sexe; etat_civil_code?: EtatCivil },
  geo: GeoSelection,
) {
  return {
    ...value,
    province: geo.province_name || "",
    ville: geo.ville_name || "",
    territoire: geo.district_name || geo.ville_name || "",
    secteur: geo.commune_name || geo.localite_name || "",
  };
}

function PersonBlockFields({
  title,
  value,
  onChange,
  sexeLocked,
  showCodes,
}: {
  title?: string;
  value: FichePersonBlock & { date_naissance?: string; sexe_code?: Sexe; etat_civil_code?: EtatCivil };
  onChange: (next: typeof value) => void;
  sexeLocked?: Sexe;
  showCodes?: boolean;
}) {
  const set = <K extends keyof typeof value>(key: K, v: (typeof value)[K]) =>
    onChange({ ...value, [key]: v });

  const professions = useMemo(() => listKnownProfessions([value.profession]), [value.profession]);
  const professionListId = `professions-${title || "interesse"}`;
  const [birthGeo, setBirthGeo] = useState<GeoSelection>(() =>
    value.lieu_date_naissance
      ? { label: value.lieu_date_naissance }
      : {},
  );
  const [originGeo, setOriginGeo] = useState<GeoSelection>(() => geoFromPerson(value));

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
      <FieldLine label="Nom de l'intéressé">
        <TextInput value={value.nom} onChange={(v) => set("nom", v)} required={showCodes} autoFocus={showCodes} />
      </FieldLine>
      <FieldLine label="Post-nom">
        <TextInput value={value.postnom} onChange={(v) => set("postnom", v)} />
      </FieldLine>
      <FieldLine label="Prénom">
        <TextInput value={value.prenom} onChange={(v) => set("prenom", v)} required={showCodes} />
      </FieldLine>
      <FieldLine label="Sexe">
        {showCodes ? (
          sexeLocked ? (
            <input
              style={{ ...dottedInput, cursor: "default", fontWeight: 700 }}
              value={sexeLocked === "F" ? "Féminin" : "Masculin"}
              readOnly
              aria-readonly="true"
              title="Sexe fixé pour ce rôle — seul ce champ est verrouillé"
            />
          ) : (
            <select
              style={dottedSelect}
              value={value.sexe_code ?? "M"}
              onChange={(e) => {
                const code = e.target.value as Sexe;
                onChange({
                  ...value,
                  sexe_code: code,
                  sexe: code === "F" ? "Féminin" : "Masculin",
                });
              }}
            >
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          )
        ) : (
          <TextInput value={value.sexe} onChange={(v) => set("sexe", v)} />
        )}
      </FieldLine>
      <FieldLine label="Etat-Civil">
        {showCodes ? (
          <select
            style={dottedSelect}
            value={value.etat_civil_code ?? "CELIBATAIRE"}
            onChange={(e) => {
              const code = e.target.value as EtatCivil;
              const opt = ETAT_CIVIL_OPTIONS.find((o) => o.value === code);
              onChange({
                ...value,
                etat_civil_code: code,
                etat_civil: opt?.label || code,
              });
            }}
          >
            {ETAT_CIVIL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <TextInput value={value.etat_civil} onChange={(v) => set("etat_civil", v)} />
        )}
      </FieldLine>

      {showCodes ? (
        <>
          <FieldLine label="Lieu de naissance" stacked>
            <GeoCascade
              embedded
              allowAdd={false}
              levels={[...GEO_PRESETS.place]}
              label="Lieu de naissance (province → ville → commune)"
              value={birthGeo}
              onChange={(geo) => {
                setBirthGeo(geo);
                const full =
                  geo.label ||
                  [geo.commune_name, geo.ville_name, geo.province_name].filter(Boolean).join(", ");
                onChange({ ...value, lieu_date_naissance: full });
              }}
            />
            {value.lieu_date_naissance ? (
              <div className="muted small" style={{ marginTop: 2, fontWeight: 600, color: "#1565c0" }}>
                Lieu complet : {value.lieu_date_naissance}
              </div>
            ) : null}
          </FieldLine>
          <FieldLine label="Date de naissance">
            <input
              style={{ ...dottedInput, flex: "1 1 12rem", maxWidth: "14rem" }}
              type="date"
              value={value.date_naissance || ""}
              onChange={(e) => set("date_naissance", e.target.value)}
              required
            />
          </FieldLine>
        </>
      ) : (
        <FieldLine label="Lieu et date de naissance">
          <TextInput
            value={value.lieu_date_naissance}
            onChange={(v) => set("lieu_date_naissance", v)}
            placeholder="Lieu complet (commune, ville, province)"
          />
        </FieldLine>
      )}

      <FieldLine label="Nationalité">
        <TextInput value={value.nationalite} onChange={(v) => set("nationalite", v)} />
      </FieldLine>

      <FieldLine label="Profession">
        {showCodes ? (
          <>
            <input
              style={dottedInput}
              list={professionListId}
              value={value.profession}
              onChange={(e) => {
                const v = e.target.value;
                set("profession", v);
                if (v.trim().length > 2) rememberNamed(PROFESSIONS_KEY, v);
              }}
              placeholder="Choisir ou saisir…"
            />
            <datalist id={professionListId}>
              {professions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </>
        ) : (
          <TextInput value={value.profession} onChange={(v) => set("profession", v)} />
        )}
      </FieldLine>

      {showCodes ? (
        <FieldLine label="Origine (Province → Territoire → Secteur → Ville)" stacked>
          <GeoCascade
            embedded
            allowAdd={false}
            levels={[...GEO_PRESETS.originRural]}
            fieldLabels={ORIGIN_FIELD_LABELS}
            label="Sélection territoriale"
            value={originGeo}
            onChange={(geo) => {
              setOriginGeo(geo);
              onChange(applyGeoToPerson(value, geo));
            }}
          />
          <div
            className="muted small"
            style={{ display: "grid", gap: 2, marginTop: 4, color: "#1565c0", fontWeight: 600 }}
          >
            <span>Province : {value.province || "—"}</span>
            <span>Territoire : {value.territoire || "—"}</span>
            <span>Secteur : {value.secteur || "—"}</span>
            <span>Ville : {value.ville || "—"}</span>
          </div>
        </FieldLine>
      ) : (
        <>
          <FieldLine label="Secteur">
            <TextInput value={value.secteur} onChange={(v) => set("secteur", v)} />
          </FieldLine>
          <FieldLine label="Territoire">
            <TextInput value={value.territoire} onChange={(v) => set("territoire", v)} />
          </FieldLine>
          <FieldLine label="Ville">
            <TextInput value={value.ville} onChange={(v) => set("ville", v)} />
          </FieldLine>
          <FieldLine label="Province">
            <TextInput value={value.province} onChange={(v) => set("province", v)} />
          </FieldLine>
        </>
      )}

      <FieldLine label="Adresse">
        <TextInput value={value.adresse} onChange={(v) => set("adresse", v)} />
      </FieldLine>
    </div>
  );
}

type Props = {
  value: FicheEditorState;
  onChange: (next: FicheEditorState) => void;
  /** Verrouille le sexe de l'intéressé (père / mère). */
  sexeLocked?: Sexe;
  /** Masque conjoint + père/mère (ajout rapide ciblé). */
  compact?: boolean;
};

export default function FicheIdentificationEditor({
  value,
  onChange,
  sexeLocked,
  compact = false,
}: Props) {
  const setInteresse = (
    interesse: FichePersonBlock & {
      date_naissance?: string;
      sexe_code?: Sexe;
      etat_civil_code?: EtatCivil;
    },
  ) => {
    const sexe_code = sexeLocked ?? interesse.sexe_code ?? value.interesse.sexe_code;
    onChange({
      ...value,
      interesse: {
        ...value.interesse,
        ...interesse,
        date_naissance: interesse.date_naissance ?? value.interesse.date_naissance,
        sexe_code,
        sexe: sexe_code === "F" ? "Féminin" : "Masculin",
        etat_civil_code: interesse.etat_civil_code ?? value.interesse.etat_civil_code,
      },
    });
  };

  return (
    <article className="fiche-ident-edit" style={{ background: "#fff", color: "#1e88e5", padding: "1rem 1.1rem" }}>
      <header style={{ textAlign: "center", marginBottom: "0.75rem", position: "relative" }}>
        <div style={{ fontWeight: 700, lineHeight: 1.35 }}>
          Republique Democratique du Congo
          <br />
          Ville - Province de {value.villeProvince || "Kinshasa"}
        </div>
        <div style={{ margin: "0.45rem auto" }}>
          <img src="/logo-rdc.jpg" alt="Armoiries RDC" style={{ width: 56, height: 56, objectFit: "contain" }} />
        </div>
        <div style={{ fontWeight: 700 }}>Commune de {value.communeName || "—"}</div>
        <div style={{ fontWeight: 700, letterSpacing: "0.02em" }}>SERVIR DE L&apos;ETAT-CIVIL</div>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            fontSize: "0.78rem",
            fontWeight: 600,
            textAlign: "right",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <span>Série</span>
          <input
            style={{ ...dottedInput, width: "7.5rem", textAlign: "right" }}
            value={value.serie}
            onChange={(e) => onChange({ ...value, serie: e.target.value })}
            placeholder="………"
          />
        </div>
      </header>

      <h1
        style={{
          textAlign: "center",
          margin: "0.5rem 0 0.2rem",
          fontSize: "1.45rem",
          fontWeight: 900,
          letterSpacing: "0.04em",
          ...ink,
        }}
      >
        FICHE D&apos;IDENTIFICATION
      </h1>
      <p style={{ textAlign: "center", margin: "0 0 0.85rem", fontSize: "0.78rem", fontWeight: 600, ...ink }}>
        Attestation de naissance, Célibataire, Résidence, Bonne vie et moeurs, Nom Fonctionnaire, Veuvage
      </p>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "flex-start",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 58%", minWidth: 240 }}>
          <PersonBlockFields
            value={value.interesse}
            onChange={setInteresse}
            sexeLocked={sexeLocked}
            showCodes
          />
        </div>
        {!compact ? (
          <div
            style={{
              flex: "1 1 34%",
              minWidth: 200,
              border: "1.5px dashed #1e88e5",
              borderRadius: 4,
              padding: "0.65rem 0.75rem",
            }}
          >
            <FieldLine label="Nom du Conjoint (e) :">
              <TextInput
                value={value.conjoint.nom}
                onChange={(v) => onChange({ ...value, conjoint: { ...value.conjoint, nom: v } })}
              />
            </FieldLine>
            <FieldLine label="Lieu de et date de naissance :">
              <TextInput
                value={value.conjoint.lieu_date_naissance}
                onChange={(v) =>
                  onChange({ ...value, conjoint: { ...value.conjoint, lieu_date_naissance: v } })
                }
              />
            </FieldLine>
            <FieldLine label="Profession :">
              <TextInput
                value={value.conjoint.profession}
                onChange={(v) => onChange({ ...value, conjoint: { ...value.conjoint, profession: v } })}
                list="professions-conjoint"
              />
              <datalist id="professions-conjoint">
                {listKnownProfessions().map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </FieldLine>
            <FieldLine label="Adresse :">
              <TextInput
                value={value.conjoint.adresse}
                onChange={(v) => onChange({ ...value, conjoint: { ...value.conjoint, adresse: v } })}
              />
            </FieldLine>
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div
          style={{
            display: "flex",
            gap: 0,
            border: "1.5px solid #1e88e5",
            borderRadius: 2,
            marginBottom: "1rem",
            overflow: "hidden",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 280px", padding: "0.65rem 0.75rem" }}>
            <PersonBlockFields
              title="PERE"
              value={value.pere}
              onChange={(pere) => onChange({ ...value, pere })}
            />
          </div>
          <div style={{ width: 1.5, background: "#1e88e5", alignSelf: "stretch" }} />
          <div style={{ flex: "1 1 280px", padding: "0.65rem 0.75rem" }}>
            <PersonBlockFields
              title="MERE"
              value={value.mere}
              onChange={(mere) => onChange({ ...value, mere })}
            />
          </div>
        </div>
      ) : null}

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          marginTop: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
          <div
            style={{
              border: "1px solid #1e88e5",
              background: "#e3f2fd",
              padding: "0.4rem 1rem",
              fontWeight: 700,
              minWidth: 180,
              textAlign: "center",
            }}
          >
            Signature du requérant
          </div>
          <div style={{ ...ink, fontSize: "1.05rem" }}>↓</div>
          <div
            style={{
              border: "1px solid #1e88e5",
              background: "#e3f2fd",
              padding: "0.4rem 1rem",
              fontWeight: 700,
              minWidth: 180,
              textAlign: "center",
            }}
          >
            Signature de l&apos;Agent et Visa
          </div>
        </div>
        <div style={{ fontWeight: 700, ...ink, minWidth: 200, flex: 1 }}>
          <TextInput
            value={value.dateLieu}
            onChange={(v) => onChange({ ...value, dateLieu: v })}
            placeholder="Kinshasa, le……… / ……… / ……………"
          />
        </div>
      </footer>
    </article>
  );
}
