import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ActPrintActions from "../components/ActPrintActions";
import ActPrintCard from "../components/ActPrintCard";
import ActFormShell from "../components/ActFormShell";
import { getActFormSchema } from "../ecActForms";
import { getSession } from "../auth";
import DataToolbar from "../components/DataToolbar";
import GeoCascade, {
  ADDRESS_FIELD_LABELS,
  GEO_PRESETS,
  ORIGIN_FIELD_LABELS,
  type GeoSelection,
} from "../components/GeoCascade";
import GpsLocatePanel from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  addPerson,
  delaiEnregistrementLabel,
  displayName,
  findDuplicateBirthAct,
  findDuplicatePerson,
  generateBirthDossierId,
  getAct,
  inheritParentOrigin,
  listActs,
  NEWBORN_DELAI_JOURS,
  personNationalite,
  personOrigin,
  suggestDelaiEnregistrement,
  updateAct,
  updatePerson,
  type Act,
  type DelaiEnregistrement,
  type Person,
  type Sexe,
} from "../registry";
import { getOfficerCommune } from "../commune";
import { ISSUE_NAISSANCE_OPTIONS, type IssueNaissance } from "../deathType";
import { listFacilityAccounts } from "../healthAuth";
import { HOPITAUX_KEY, loadNamedList, rememberNamed } from "../namedLists";

const MODES_ENREGISTREMENT = [
  { value: "sans_procuration", label: "Sans procuration" },
  { value: "avec_procuration", label: "Avec procuration" },
  { value: "jugement_suppletif", label: "Par jugement supplétif" },
] as const;

/** Lieu de naissance : jusqu'au quartier (Gombe → Batetela, etc.). */
const BIRTH_FORM_STEPS = [
  { id: 1, title: "Enfant" },
  { id: 2, title: "Lieu" },
  { id: 3, title: "Filiation" },
  { id: 4, title: "Origine" },
] as const;

function geoBirthLabel(geo: GeoSelection, manual: string): string {
  const parts = [
    geo.quartier_name,
    geo.localite_name,
    geo.commune_name,
    geo.ville_name,
    geo.district_name,
    geo.province_name,
  ].filter(Boolean);
  return manual.trim() || geo.label || parts.join(", ") || "";
}

export default function BirthsPage() {
  const officer = getOfficerCommune();
  const [formStep, setFormStep] = useState(1);
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [heureNaissance, setHeureNaissance] = useState("");
  const [naissanceMultiple, setNaissanceMultiple] = useState(false);
  const [issueNaissance, setIssueNaissance] = useState<IssueNaissance>("NE_VIVANT");
  const [typeAccouchement, setTypeAccouchement] = useState("");
  const [etatMorphologique, setEtatMorphologique] = useState("");
  const [anneeRegistre, setAnneeRegistre] = useState(String(new Date().getFullYear()));
  const [numeroRegistre, setNumeroRegistre] = useState("");
  const [declarant, setDeclarant] = useState<Person | null>(null);
  const [qualiteDeclarant, setQualiteDeclarant] = useState("MERE");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [geoNaissance, setGeoNaissance] = useState<GeoSelection>({
    commune_code: officer.code,
    commune_name: officer.name,
    ville_name: officer.ville,
    province_name: officer.province,
  });
  const [modeEnregistrement, setModeEnregistrement] = useState<
    (typeof MODES_ENREGISTREMENT)[number]["value"]
  >("sans_procuration");
  const [delaiEnregistrement, setDelaiEnregistrement] =
    useState<DelaiEnregistrement>("DANS_DELAI");
  const [mandataireNom, setMandataireNom] = useState("");
  const [mandataireQualite, setMandataireQualite] = useState("");
  const [mandatairePiece, setMandatairePiece] = useState("");
  const [refJugement, setRefJugement] = useState("");
  const [hopitalNaissance, setHopitalNaissance] = useState("");
  const [hopitalAutre, setHopitalAutre] = useState("");
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [adresseMere, setAdresseMere] = useState("");
  const [geoAdresseMere, setGeoAdresseMere] = useState<GeoSelection>({});
  const [geoOrigineMere, setGeoOrigineMere] = useState<GeoSelection>({});
  const [geoOrigine, setGeoOrigine] = useState<GeoSelection>({});
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, bump] = useState(0);

  const acts = listActs("BIRTH");
  const hospitals = useMemo(() => {
    const facilities = listFacilityAccounts().filter((a) => a.active);
    const extra = loadNamedList(HOPITAUX_KEY);
    return [
      ...facilities.map((h) => h.facilityName),
      ...extra.filter((n) => !facilities.some((f) => f.facilityName === n)),
    ];
    // bump force le rechargement après mémorisation d'un hôpital
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  const hopitalResolved =
    hopitalNaissance === "__autre__" ? hopitalAutre.trim() : hopitalNaissance.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setWarning(null);
    if (!mother) {
      setError("La mère est obligatoire — recherchez ou ajoutez une personne déjà enregistrée.");
      return;
    }
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
      return;
    }
    if (!typeAccouchement) {
      setError("Le type d'accouchement est obligatoire.");
      return;
    }
    if (!etatMorphologique) {
      setError("L'état morphologique est obligatoire.");
      return;
    }
    if (
      !geoNaissance.commune_name &&
      !geoNaissance.district_name &&
      !geoNaissance.localite_name &&
      !lieuNaissance.trim()
    ) {
      setError("Indiquez le lieu de naissance (commune / secteur) ou une saisie manuelle.");
      return;
    }
    if (
      geoNaissance.ville_name &&
      geoNaissance.commune_name &&
      !geoNaissance.quartier_name &&
      !lieuNaissance.trim()
    ) {
      setError(
        "Choisissez le quartier de naissance (ex. Batetela, Golf…) ou précisez le lieu manuellement.",
      );
      return;
    }
    if (modeEnregistrement === "avec_procuration" && !mandataireNom.trim()) {
      setError("Avec procuration : indiquez le nom du mandataire.");
      return;
    }
    const isMortNeIssue = issueNaissance === "MORT_NE";
    const needsJuge =
      !isMortNeIssue &&
      (delaiEnregistrement === "HORS_DELAI" || modeEnregistrement === "jugement_suppletif");
    if (needsJuge && !refJugement.trim()) {
      setError(
        "Hors délai ou jugement supplétif : indiquez la référence du jugement (le juge intervient avant l'inscription).",
      );
      return;
    }
    if (qualiteDeclarant !== "MERE" && !declarant) {
      setError("Indiquez le déclarant (ou choisissez la qualité « Mère »).");
      return;
    }

    setSubmitting(true);
    try {
      if (geoOrigineMere.province_name || geoOrigineMere.district_name || geoOrigineMere.commune_name) {
        updatePerson(mother.id, {
          province: geoOrigineMere.province_name || mother.province,
          territoire: geoOrigineMere.district_name || mother.territoire,
          secteur: [geoOrigineMere.commune_name, geoOrigineMere.localite_name]
            .filter(Boolean)
            .join(" · ") || mother.secteur,
          ville: geoOrigineMere.ville_name || mother.ville,
        });
      }
      const effectiveDeclarant = qualiteDeclarant === "MERE" ? mother : declarant;
      if (!effectiveDeclarant) {
        setError("Le déclarant est obligatoire.");
        setSubmitting(false);
        return;
      }

      const identity = {
        nom: nom.trim(),
        postnom: postnom.trim() || mother.postnom || father?.postnom || "",
        prenom: prenom.trim(),
        date_naissance: dateNaissance,
        sexe,
        mother_id: mother.id,
      };

      if (!isMortNeIssue) {
        const existingAct = findDuplicateBirthAct({
          nom: identity.nom,
          prenom: identity.prenom,
          postnom: identity.postnom,
          date_naissance: identity.date_naissance,
          mother_id: mother.id,
        });
        if (existingAct) {
          setError(
            `Nouveau-né déjà enregistré — acte ${existingAct.act_number}. Doublon refusé.`,
          );
          setViewAct(existingAct);
          setCreated(existingAct);
          setSubmitting(false);
          return;
        }
      }

      const existingPerson = findDuplicatePerson(identity);
      if (existingPerson) {
        setError(
          `Enfant déjà au registre : ${existingPerson.nom} ${existingPerson.prenom}. Doublon refusé.`,
        );
        setSubmitting(false);
        return;
      }

      const lieu = geoBirthLabel(geoNaissance, lieuNaissance);
      const geoPayload: GeoSelection = {
        ...geoNaissance,
        label: lieu,
      };
      const link = inheritParentOrigin(father, mother);
      if (hopitalResolved) rememberNamed(HOPITAUX_KEY, hopitalResolved);
      const effectiveOrigine: GeoSelection =
        geoOrigine.province_name || geoOrigine.district_name || geoOrigine.commune_name
          ? geoOrigine
          : !father
            ? geoOrigineMere
            : geoOrigine;
      const origineFromCascade = [
        effectiveOrigine.localite_name,
        effectiveOrigine.commune_name,
        effectiveOrigine.district_name,
        effectiveOrigine.province_name,
      ]
        .filter(Boolean)
        .join(", ");
      const origineFromParent = [link.geo.village, link.geo.secteur, link.geo.territoire, link.geo.province]
        .filter(Boolean)
        .join(", ");
      const origineLabel =
        effectiveOrigine.label || origineFromCascade || origineFromParent || "";

      const child = addPerson({
        nom: identity.nom,
        postnom: identity.postnom,
        prenom: identity.prenom,
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieu,
        etat_civil: "CELIBATAIRE",
        mother_id: mother.id,
        father_id: father?.id,
        nationalite: personNationalite(father ?? mother),
        nic: generateBirthDossierId(dateNaissance, {
          provinceName: geoNaissance.province_name || getOfficerCommune().province,
        }),
        province: effectiveOrigine.province_name || link.geo.province || undefined,
        territoire: effectiveOrigine.district_name || link.geo.territoire || undefined,
        secteur:
          [effectiveOrigine.commune_name, effectiveOrigine.localite_name].filter(Boolean).join(" · ") ||
          link.geo.secteur ||
          undefined,
      });
      const commune = getOfficerCommune();
      const session = getSession();
      const officerDisplay = session?.displayName?.trim() || "Officier de l'État civil";
      const modeLabel =
        MODES_ENREGISTREMENT.find((m) => m.value === modeEnregistrement)?.label ??
        modeEnregistrement;
      const motherFull = [mother.nom, mother.postnom, mother.prenom].filter(Boolean).join(" ");
      const fatherFull = father ? [father.nom, father.postnom, father.prenom].filter(Boolean).join(" ") : null;
      const adresseMereLabel =
        adresseMere.trim() ||
        geoAdresseMere.label ||
        [
          geoAdresseMere.numero ? `n° ${geoAdresseMere.numero}` : "",
          geoAdresseMere.avenue_name,
          geoAdresseMere.quartier_name,
          geoAdresseMere.commune_name,
          geoAdresseMere.ville_name,
          geoAdresseMere.district_name,
          geoAdresseMere.province_name,
        ]
          .filter(Boolean)
          .join(", ");

      if (isMortNeIssue) {
        const deathPayload = {
          deceased_id: child.id,
          citizen_id: child.id,
          deceased_name: displayName(child),
          sexe: child.sexe,
          date_naissance: child.date_naissance,
          type_deces: "MORT_NE" as const,
          type_deces_label: "Mort-né",
          mort_ne: true,
          issue_naissance: "MORT_NE",
          cause_deces: "Mort-né à la naissance",
          date_deces: dateNaissance,
          heure_deces: heureNaissance || null,
          lieu_deces: lieu,
          geo_deces: geoPayload,
          province_deces: geoNaissance.province_name || null,
          ville_deces: geoNaissance.ville_name || null,
          commune_deces: geoNaissance.commune_name || null,
          commune_code: geoNaissance.commune_code || commune.code,
          type_accouchement: typeAccouchement || null,
          etat_morphologique: etatMorphologique || null,
          naissance_multiple: naissanceMultiple,
          hopital_naissance: hopitalResolved || null,
          mother_id: mother.id,
          mother_name: motherFull,
          father_id: father?.id ?? null,
          father_name: fatherFull,
          declarant_id: effectiveDeclarant.id,
          declarant_name: displayName(effectiveDeclarant),
          declarant_qualite: qualiteDeclarant,
          from_naissance_form: true,
          note: "Mort-né déclaré via formulaire d'enregistrement de nouveau-né",
          latitude: gpsLat,
          longitude: gpsLng,
          gps_captured_at: gpsLat != null ? new Date().toISOString() : null,
          officer_name: officerDisplay,
        };
        const act = await addAct("DEATH", deathPayload, child.id);
        const syncWarn = act.payload.sync_warning ? String(act.payload.sync_warning) : null;
        if (syncWarn) setWarning(syncWarn);
        setCreated(act);
      } else {
      const payload = {
        child_id: child.id,
        nom: child.nom,
        postnom: child.postnom,
        prenom: child.prenom,
        sexe: child.sexe,
        date_naissance: child.date_naissance,
        heure_naissance: heureNaissance || null,
        naissance_multiple: naissanceMultiple,
        issue_naissance: "NE_VIVANT",
        type_accouchement: typeAccouchement || null,
        etat_morphologique: etatMorphologique || null,
        annee_registre: anneeRegistre.trim() || null,
        numero_registre: numeroRegistre.trim() || null,
        lieu_naissance: child.lieu_naissance,
        id_naissance: child.nic,
        code_dossier: child.nic,
        mode_enregistrement: modeEnregistrement,
        mode_naissance: modeEnregistrement,
        mode: modeLabel,
        type_naissance: modeLabel,
        delai_enregistrement: delaiEnregistrement,
        delai_enregistrement_label: delaiEnregistrementLabel(delaiEnregistrement),
        avec_procuration: modeEnregistrement === "avec_procuration",
        mandataire_nom:
          modeEnregistrement === "avec_procuration" ? mandataireNom.trim() || null : null,
        mandataire_qualite:
          modeEnregistrement === "avec_procuration" ? mandataireQualite.trim() || null : null,
        mandataire_piece:
          modeEnregistrement === "avec_procuration" ? mandatairePiece.trim() || null : null,
        ref_jugement_suppletif: needsJuge ? refJugement.trim() : null,
        juge_requis: needsJuge,
        hopital_naissance: hopitalResolved || null,
        geo_naissance: geoPayload,
        quartier_naissance: geoNaissance.quartier_name || null,
        commune_naissance: geoNaissance.commune_name || null,
        ville_naissance: geoNaissance.ville_name || null,
        province_naissance: geoNaissance.province_name || null,
        commune_code: geoNaissance.commune_code || commune.code,
        mother_id: mother.id,
        mother_name: motherFull,
        mere_nom: motherFull,
        declarant: displayName(effectiveDeclarant),
        declarant_id: effectiveDeclarant.id,
        declarant_qualite: qualiteDeclarant,
        mother_dossier: mother.nic,
        mother_snapshot: link.mother_snapshot,
        adresse_mere: adresseMereLabel || null,
        geo_adresse_mere: geoAdresseMere,
        father_id: father?.id ?? null,
        father_name: fatherFull,
        pere_nom: fatherFull,
        province: geoNaissance.province_name || commune.province,
        ville: geoNaissance.ville_name || commune.ville,
        commune: geoNaissance.commune_name || commune.name,
        district: geoNaissance.district_name || null,
        bureau: `Commune de ${geoNaissance.commune_name || commune.name}`,
        officer_name: officerDisplay,
        father_dossier: father?.nic ?? null,
        father_snapshot: link.father_snapshot,
        inherited_from: link.source,
        inherited_geo: link.geo,
        geo_origine: effectiveOrigine,
        originaire: origineLabel || null,
        province_origine: effectiveOrigine.province_name || link.geo.province || null,
        territoire_origine: effectiveOrigine.district_name || link.geo.territoire || null,
        secteur_chefferie_commune: effectiveOrigine.commune_name || link.geo.secteur || null,
        village_origine: effectiveOrigine.localite_name || link.geo.village || null,
        origine_source: father ? "father_or_manual" : "mother_or_manual",
        geo_origine_mere: geoOrigineMere,
        note: `Nouveau-né — ${modeLabel}`,
        latitude: gpsLat,
        longitude: gpsLng,
        gps_captured_at: gpsLat != null ? new Date().toISOString() : null,
      };
      const act = await addAct("BIRTH", payload, child.nic);
      const syncWarn = act.payload.sync_warning ? String(act.payload.sync_warning) : null;
      if (syncWarn) setWarning(syncWarn);
      setCreated(act);
      }

      setNom("");
      setPostnom("");
      setPrenom("");
      setDateNaissance("");
      setHeureNaissance("");
      setNaissanceMultiple(false);
      setIssueNaissance("NE_VIVANT");
      setTypeAccouchement("");
      setEtatMorphologique("");
      setAnneeRegistre(String(new Date().getFullYear()));
      setNumeroRegistre("");
      setDeclarant(null);
      setQualiteDeclarant("MERE");
      setLieuNaissance("");
      setGeoNaissance({
        commune_code: officer.code,
        commune_name: officer.name,
        ville_name: officer.ville,
        province_name: officer.province,
      });
      setModeEnregistrement("sans_procuration");
      setDelaiEnregistrement("DANS_DELAI");
      setMandataireNom("");
      setMandataireQualite("");
      setMandatairePiece("");
      setRefJugement("");
      setHopitalNaissance("");
      setHopitalAutre("");
      setMother(null);
      setFather(null);
      setAdresseMere("");
      setGeoAdresseMere({});
      setGeoOrigineMere({});
      setGeoOrigine({});
      setGeoAdresseMere({});
      setGeoOrigine({});
      setGpsLat(null);
      setGpsLng(null);
      bump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  function saveEdit() {
    if (!editAct) return;
    try {
      const payload = JSON.parse(editJson) as Record<string, unknown>;
      updateAct(editAct.id, { payload });
      setEditAct(null);
      bump((n) => n + 1);
    } catch {
      setError("JSON invalide.");
    }
  }

  const rows = acts.map((a) => ({
    act_number: a.act_number,
    nom: String(a.payload.nom ?? ""),
    sexe: String(a.payload.sexe ?? ""),
    date_naissance: String(a.payload.date_naissance ?? ""),
    quartier: String(
      a.payload.quartier_naissance ??
        (a.payload.geo_naissance as { quartier_name?: string } | undefined)?.quartier_name ??
        "",
    ),
    mode: String(
      a.payload.mode ?? a.payload.mode_enregistrement ?? a.payload.mode_naissance ?? "",
    ),
  }));

  return (
    <ActFormShell
      schema={getActFormSchema("naissance")!}
      extraLead={
        <p className="page-lead" style={{ marginTop: 0 }}>
          <Link to="/procedure">Procédure</Link> · <Link to="/juge">Juge</Link> ·{" "}
          <Link to="/declarations">Déclarations santé</Link> · <Link to="/matrice">Matrice</Link>
        </p>
      }
    >
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          <strong>Dans le délai (≤ {NEWBORN_DELAI_JOURS} j.)</strong> : enregistrement classique.{" "}
          <strong>Hors délai</strong> : jugement supplétif + référence du jugement obligatoire.
          Maternité : notification via <Link to="/sante/login">/sante</Link> puis validation officier.
        </p>
      </div>
      <GpsLocatePanel
        title="Localisation GPS du lieu de naissance"
        onResolved={(g) => {
          setGpsLat(g.latitude);
          setGpsLng(g.longitude);
          setGeoNaissance((prev) => ({
            ...prev,
            province_name: g.province || prev.province_name,
            ville_name: g.ville || prev.ville_name,
            commune_name: g.commune || prev.commune_name,
            quartier_name: g.quartier || prev.quartier_name,
            avenue_name: g.avenue || prev.avenue_name,
            label:
              g.display_name ||
              [g.quartier, g.commune, g.ville, g.province].filter(Boolean).join(", ") ||
              prev.label,
          }));
          if (!lieuNaissance.trim() && g.display_name) {
            setLieuNaissance(g.display_name);
          }
        }}
      />

      <div className="panel">
        <form
          className="form-grid"
          onSubmit={(e) => {
            if (formStep < 4) {
              e.preventDefault();
              setFormStep((s) => Math.min(4, s + 1));
              return;
            }
            void onSubmit(e);
          }}
          noValidate={formStep < 4}
        >
          <div className="full">
            <div className="birth-form-steps" role="tablist" aria-label="Étapes d'enregistrement">
              {BIRTH_FORM_STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={formStep === s.id}
                  className={`birth-form-step${formStep === s.id ? " is-active" : ""}${
                    formStep > s.id ? " is-done" : ""
                  }`}
                  onClick={() => setFormStep(s.id)}
                >
                  <span className="birth-form-step-num">{s.id}</span>
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          </div>
          {error ? <div className="login-error full">{error}</div> : null}
          {warning ? (
            <div className="full muted small" style={{ color: "#b45309" }}>
              {warning}
            </div>
          ) : null}
          {formStep === 1 ? (
            <>
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Enfant
            </h3>
          </div>
          <div>
            <label className="form-label">Nom *</label>
            <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Postnom</label>
            <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Prénom(s) *</label>
            <input className="form-control" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Sexe *</label>
            <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as Sexe)}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de naissance *</label>
            <input
              className="form-control"
              type="date"
              value={dateNaissance}
              onChange={(e) => {
                const v = e.target.value;
                setDateNaissance(v);
                setDelaiEnregistrement(suggestDelaiEnregistrement(v));
              }}
              required
            />
          </div>
          <div>
            <label className="form-label">Heure de naissance</label>
            <input
              className="form-control"
              type="time"
              value={heureNaissance}
              onChange={(e) => setHeureNaissance(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Issue à la naissance *</label>
            <select
              className="form-control"
              value={issueNaissance}
              onChange={(e) => setIssueNaissance(e.target.value as IssueNaissance)}
              required
            >
              {ISSUE_NAISSANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Mort-né → enregistré au registre des décès (morts-nés), pas comme naissance vivante.
            </p>
          </div>
          <div>
            <label className="form-label">Naissance multiple</label>
            <select
              className="form-control"
              value={naissanceMultiple ? "oui" : "non"}
              onChange={(e) => setNaissanceMultiple(e.target.value === "oui")}
            >
              <option value="non">Non</option>
              <option value="oui">Oui (jumeaux…)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Type d&apos;accouchement *</label>
            <select
              className="form-control"
              value={typeAccouchement}
              onChange={(e) => setTypeAccouchement(e.target.value)}
              required
            >
              <option value="">— Sélectionner —</option>
              <option value="VOIE_BASSE">Voie basse</option>
              <option value="CESARIENNE">Césarienne</option>
              <option value="INSTRUMENTAL">Instrumental (ventouse / forceps)</option>
            </select>
          </div>
          <div>
            <label className="form-label">État morphologique *</label>
            <select
              className="form-control"
              value={etatMorphologique}
              onChange={(e) => setEtatMorphologique(e.target.value)}
              required
            >
              <option value="">— Selon le médecin —</option>
              <option value="BIEN_FORME">Bien formé</option>
              <option value="MALFORME">Malformé</option>
            </select>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Terme médical : état morphologique du nouveau-né.
            </p>
          </div>
          <div>
            <label className="form-label">Année du registre</label>
            <input
              className="form-control"
              value={anneeRegistre}
              onChange={(e) => setAnneeRegistre(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">N° d&apos;ordre au registre</label>
            <input
              className="form-control"
              value={numeroRegistre}
              onChange={(e) => setNumeroRegistre(e.target.value)}
              placeholder="Attribué à la validation si vide"
            />
          </div>
          <div>
            <label className="form-label">Type d&apos;enregistrement *</label>
            <select
              className="form-control"
              value={delaiEnregistrement}
              onChange={(e) => setDelaiEnregistrement(e.target.value as DelaiEnregistrement)}
            >
              <option value="DANS_DELAI">Dans le délai (≤ {NEWBORN_DELAI_JOURS} jours)</option>
              <option value="HORS_DELAI">Hors délai (&gt; {NEWBORN_DELAI_JOURS} jours)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Mode d&apos;enregistrement</label>
            <select
              className="form-control"
              value={modeEnregistrement}
              onChange={(e) =>
                setModeEnregistrement(
                  e.target.value as (typeof MODES_ENREGISTREMENT)[number]["value"],
                )
              }
            >
              {MODES_ENREGISTREMENT.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {modeEnregistrement === "avec_procuration" ? (
            <>
              <div>
                <label className="form-label">Nom du mandataire *</label>
                <input
                  className="form-control"
                  value={mandataireNom}
                  onChange={(e) => setMandataireNom(e.target.value)}
                  placeholder="Personne munie de la procuration"
                  required
                />
              </div>
              <div>
                <label className="form-label">Qualité du mandataire</label>
                <input
                  className="form-control"
                  value={mandataireQualite}
                  onChange={(e) => setMandataireQualite(e.target.value)}
                  placeholder="Ex. oncle, tuteur, avocat…"
                />
              </div>
              <div>
                <label className="form-label">Réf. / pièce de la procuration</label>
                <input
                  className="form-control"
                  value={mandatairePiece}
                  onChange={(e) => setMandatairePiece(e.target.value)}
                  placeholder="N° acte notarié, date…"
                />
              </div>
            </>
          ) : null}
          {delaiEnregistrement === "HORS_DELAI" || modeEnregistrement === "jugement_suppletif" ? (
            <div className="full">
              <label className="form-label">Référence du jugement supplétif *</label>
              <input
                className="form-control"
                value={refJugement}
                onChange={(e) => setRefJugement(e.target.value)}
                placeholder="Ex. Jugement n° … / Tribunal de … / date …"
                required
              />
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                Le juge autorise l&apos;inscription ; l&apos;officier enregistre ensuite.{" "}
                <Link to="/juge">Voir les cas juge</Link>
              </p>
            </div>
          ) : null}
          <div className="full birth-form-nav">
            <button type="button" className="btn-add" onClick={() => setFormStep(2)}>
              Suivant — Lieu
            </button>
          </div>
            </>
          ) : null}
          {formStep === 2 ? (
            <>
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Lieu de naissance
            </h3>
          </div>
          <div className="full">
            <GeoCascade
              embedded
              zoneChoice
              allowAdd
              label="Lieu de naissance"
              fieldLabels={{
                ...ADDRESS_FIELD_LABELS,
                commune: "Commune / Secteur",
                quartier: "Quartier",
                localite: "Village",
              }}
              value={geoNaissance}
              onChange={(g) => {
                setGeoNaissance(g);
                if (g.quartier_name || g.commune_name || g.localite_name) {
                  setLieuNaissance(geoBirthLabel(g, ""));
                }
              }}
            />
            <p className="muted small" style={{ marginTop: "0.35rem" }}>
              Choisissez <strong>Ville</strong> (Commune → Quartier) ou <strong>Territoire</strong>{" "}
              (Secteur → Village). Utilisez <strong>+ Ajouter</strong> si un lieu manque.
            </p>
          </div>
          <div className="full">
            <label className="form-label">Lieu (complément / saisie libre)</label>
            <input
              className="form-control"
              value={lieuNaissance}
              onChange={(e) => setLieuNaissance(e.target.value)}
              placeholder="Optionnel si le quartier est déjà choisi — sinon hôpital, clinique…"
            />
          </div>
          <div className="full">
            <label className="form-label">Hôpital / structure</label>
            <select
              className="form-control"
              value={
                hopitalNaissance &&
                hopitalNaissance !== "__autre__" &&
                !hospitals.includes(hopitalNaissance)
                  ? "__autre__"
                  : hopitalNaissance
              }
              onChange={(e) => {
                const v = e.target.value;
                setHopitalNaissance(v);
                if (v !== "__autre__") setHopitalAutre("");
              }}
            >
              <option value="">— Optionnel —</option>
              {hospitals.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__autre__">Autre (saisir)…</option>
            </select>
            {hopitalNaissance === "__autre__" ||
            (hopitalNaissance &&
              hopitalNaissance !== "__autre__" &&
              !hospitals.includes(hopitalNaissance)) ? (
              <input
                className="form-control"
                style={{ marginTop: 8 }}
                value={hopitalNaissance === "__autre__" ? hopitalAutre : hopitalNaissance}
                onChange={(e) => {
                  setHopitalNaissance("__autre__");
                  setHopitalAutre(e.target.value);
                }}
                placeholder="Nom de l'hôpital / maternité — sera proposé aux autres"
              />
            ) : null}
            <div className="muted small" style={{ marginTop: 4 }}>
              Une fois saisi, l&apos;hôpital est mémorisé pour sélection ultérieure.
            </div>
          </div>
          <div className="full birth-form-nav">
            <button type="button" className="btn-secondary" onClick={() => setFormStep(1)}>
              Précédent
            </button>
            <button type="button" className="btn-add" onClick={() => setFormStep(3)}>
              Suivant — Filiation
            </button>
          </div>
            </>
          ) : null}
          {formStep === 3 ? (
            <>
          <div className="full">
            <h3 className="panel-title">Filiation & déclaration</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              <strong>Mère</strong> = filiation de l&apos;enfant (identité parentale).{" "}
              <strong>Déclarant</strong> = personne qui se présente au bureau pour déclarer la
              naissance (souvent la mère, sinon le père ou un mandataire).
            </p>
          </div>
          <div className="full">
            <PersonPicker
              label="Mère *"
              value={mother}
              onChange={(p) => {
                setMother(p);
                if (!p) {
                  setGeoOrigineMere({});
                  return;
                }
                const o = personOrigin(p);
                if (o.province || o.territoire || o.secteur) {
                  setGeoOrigineMere({
                    province_name: o.province || undefined,
                    district_name: o.territoire || undefined,
                    commune_name: o.secteur || undefined,
                    ville_name: o.ville || undefined,
                    label: o.label || undefined,
                  });
                  if (!father) {
                    setGeoOrigine({
                      province_name: o.province || undefined,
                      district_name: o.territoire || undefined,
                      commune_name: o.secteur || undefined,
                      ville_name: o.ville || undefined,
                      label: o.label || undefined,
                    });
                  }
                }
              }}
              sexFilter="F"
              originGeoFilter
              addButtonLabel="Saisir / Ajouter la mère"
            />
            <p className="muted small" style={{ marginTop: 6 }}>
              Recherchez une personne déjà enregistrée, ou ajoutez-la. Si le père n&apos;est pas
              reconnu, l&apos;origine de la mère sera reprise pour l&apos;enfant.
            </p>
          </div>
          <div className="full">
            <label className="form-label">Origine de la mère</label>
            <GeoCascade
              embedded
              allowAdd
              levels={[...GEO_PRESETS.originRural]}
              fieldLabels={ORIGIN_FIELD_LABELS}
              value={geoOrigineMere}
              onChange={(g) => {
                setGeoOrigineMere(g);
                if (!father) setGeoOrigine(g);
              }}
              label="Origine de la mère"
            />
          </div>
          <div>
            <label className="form-label">Qualité du déclarant *</label>
            <select
              className="form-control"
              value={qualiteDeclarant}
              onChange={(e) => setQualiteDeclarant(e.target.value)}
            >
              <option value="MERE">Mère (elle-même déclare)</option>
              <option value="PERE">Père</option>
              <option value="MANDATAIRE">Mandataire</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          {qualiteDeclarant !== "MERE" ? (
            <div className="full">
              <PersonPicker
                label="Déclarant *"
                value={declarant}
                onChange={(p) => {
                  setDeclarant(p);
                  if (p && father && p.id === father.id) setQualiteDeclarant("PERE");
                }}
                addButtonLabel="Saisir / Ajouter"
              />
            </div>
          ) : (
            <div className="full muted small">
              Qualité « Mère » : la mère sélectionnée ci-dessus est automatiquement le déclarant.
            </div>
          )}
          <div className="full">
            <label className="form-label">Adresse de la mère *</label>
            <GeoCascade
              embedded
              zoneChoice
              allowAdd
              levels={GEO_PRESETS.address}
              fieldLabels={{
                ...ADDRESS_FIELD_LABELS,
                commune: "Commune / Secteur",
                localite: "Village",
              }}
              value={geoAdresseMere}
              onChange={setGeoAdresseMere}
              label="Adresse de la mère"
            />
            <input
              className="form-control"
              style={{ marginTop: 8 }}
              value={adresseMere}
              onChange={(e) => setAdresseMere(e.target.value)}
              placeholder="Complément d'adresse (n°, parcelle, référence…)"
            />
          </div>
          <div className="full">
            <PersonPicker
              label="Père (optionnel)"
              value={father}
              onChange={setFather}
              originGeoFilter
              sexFilter="M"
            />
          </div>
          <div className="full birth-form-nav">
            <button type="button" className="btn-secondary" onClick={() => setFormStep(2)}>
              Précédent
            </button>
            <button type="button" className="btn-add" onClick={() => setFormStep(4)}>
              Suivant — Origine
            </button>
          </div>
            </>
          ) : null}
          {formStep === 4 ? (
            <>
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Originaire
            </h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Lieu d&apos;origine de l&apos;enfant. Sans père reconnu, l&apos;origine de la mère est
              reprise automatiquement (modifiable ci-dessous).
            </p>
          </div>
          <div className="full">
            <GeoCascade
              embedded
              allowAdd
              levels={[...GEO_PRESETS.originRural]}
              fieldLabels={ORIGIN_FIELD_LABELS}
              value={geoOrigine}
              onChange={setGeoOrigine}
              label="Originaire"
            />
            <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
              Si un territoire, secteur ou village manque, utilisez <strong>+ Ajouter</strong>.
            </p>
          </div>
          {father ? (
            <div className="full success-banner" style={{ margin: 0 }}>
              Père renseigné : <strong>{displayName(father)}</strong> — l&apos;origine peut être
              liée au père via le bloc Originaire ci-dessus.
            </div>
          ) : null}
          <div className="full birth-form-nav">
            <button type="button" className="btn-secondary" onClick={() => setFormStep(3)}>
              Précédent
            </button>
            <button
              className="btn-primary"
              style={{ width: "auto", minWidth: 200 }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Enregistrement…" : "Enregistrer le nouveau-né"}
            </button>
          </div>
            </>
          ) : null}
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner no-print">
            {created.type === "DEATH"
              ? "Mort-né enregistré (registre des décès)"
              : "Enregistrement de nouveau-né créé"}{" "}
            — n° {created.act_number}
          </div>
          <ActPrintCard act={created} />
          <ActPrintActions label="Imprimer l'acte de naissance" />
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">Enregistrement de nouveau-né</h3>
          <DataToolbar filename="naissances" rows={rows} />
        </div>
        <div className="eg-acts-table-wrap">
          <div className="eg-acts-table-caption">
            <span className="muted small">{acts.length} enregistrement(s)</span>
          </div>
          <div className="table-scroll eg-acts-table-scroll">
            <table className="data-table eg-table eg-acts-table">
              <thead>
                <tr>
                  <th>N° d&apos;acte</th>
                  <th>Nom</th>
                  <th>Sexe</th>
                  <th>Date</th>
                  <th>Quartier</th>
                  <th>Enregistrement</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {acts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Aucun enregistrement pour le moment.
                    </td>
                  </tr>
                ) : (
                  acts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.act_number}</td>
                      <td>
                        {String(a.payload.nom ?? "")} {String(a.payload.prenom ?? "")}
                      </td>
                      <td>{String(a.payload.sexe ?? "")}</td>
                      <td>{String(a.payload.date_naissance ?? "")}</td>
                      <td>
                        {String(
                          a.payload.quartier_naissance ??
                            (a.payload.geo_naissance as { quartier_name?: string } | undefined)
                              ?.quartier_name ??
                            "—",
                        )}
                      </td>
                      <td>{String(a.payload.mode ?? a.payload.mode_naissance ?? "—")}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setViewAct(getAct(a.id) ?? a)}
                        >
                          Voir
                        </button>{" "}
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setEditAct(a);
                            setEditJson(JSON.stringify(a.payload, null, 2));
                          }}
                        >
                          Éditer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel modal-panel-act">
            <h3 className="no-print">Acte {viewAct.act_number}</h3>
            <ActPrintCard act={viewAct} />
            <div className="modal-actions">
              <ActPrintActions label="Imprimer" />
              <button type="button" className="btn-secondary" onClick={() => setViewAct(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editAct ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 640 }}>
            <h3>Éditer {editAct.act_number}</h3>
            <textarea
              className="form-control"
              rows={12}
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditAct(null)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveEdit}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ActFormShell>
  );
}
