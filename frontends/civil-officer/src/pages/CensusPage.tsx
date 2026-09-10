import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, {
  ADDRESS_FIELD_LABELS,
  GEO_PRESETS,
  ORIGIN_FIELD_LABELS,
  type GeoSelection,
} from "../components/GeoCascade";
import PersonPicker from "../components/PersonPicker";
import SituationFamilialeForm from "../components/SituationFamilialeForm";
import EtudesFaitesForm from "../components/EtudesFaitesForm";
import ExperienceProfessionnelleForm from "../components/ExperienceProfessionnelleForm";
import IdentiteAdministrativeForm from "../components/IdentiteAdministrativeForm";
import {
  ETAT_CIVIL_OPTIONS,
  HANDICAP_OPTIONS,
  addAct,
  addPerson,
  displayName,
  getPerson,
  type Act,
  type EtatCivil,
  type HandicapType,
  type Person,
  type Sexe,
} from "../registry";
import { api } from "../api";
import { getOfficerCommune } from "../commune";
import { RDC_TRIBUS, RDC_TRIBUS_NOTE } from "../data/tribusRdc";
import GpsLocatePanel from "../components/GpsLocatePanel";
import { captureGpsOnSave, captureGpsWithAddress, type ReverseGeo } from "../gpsCapture";
import {
  emptySituationFamiliale,
  formatSituationFamiliale,
  parseSituationFamiliale,
  type SituationFamilialeData,
} from "../situationFamiliale";
import {
  emptyEtudes,
  formatParcoursScolaire,
  formatParcoursUniversitaire,
  parseEtudes,
  type EtudesData,
} from "../etudesFaites";
import {
  emptyIdentiteAdmin,
  formatIdentiteAdmin,
  parseIdentiteAdmin,
  type IdentiteAdminData,
} from "../identiteAdministrative";
import {
  emptyExperience,
  formatExperience,
  parseExperience,
  type ExperienceData,
} from "../experienceProfessionnelle";

const STEPS = [
  { id: 1, label: "1. Identité" },
  { id: 2, label: "2. Origine" },
  { id: 3, label: "3. Biométrie" },
  { id: 4, label: "4. Études faites" },
  { id: 5, label: "5. Expérience professionnelle" },
  { id: 6, label: "6. Identité administrative actuelle" },
  { id: 7, label: "7. Situation familiale" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type FicheKind = "personne" | "bebe" | "decede" | "marie";

const FICHE_KIND_OPTIONS: { value: FicheKind; label: string }[] = [
  { value: "personne", label: "Personne vivante" },
  { value: "bebe", label: "Bébé (nouveau-né)" },
  { value: "decede", label: "Personne décédée" },
  { value: "marie", label: "Marié(e)" },
];

const CENSUS_DRAFT_KEY = "civil-officer:census-draft";

type CensusDraft = {
  step: StepId;
  ficheKind?: FicheKind;
  dateDeces?: string;
  handicap: HandicapType;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: Sexe;
  etatCivil: EtatCivil;
  profession: string;
  geoNaissance: GeoSelection;
  dateNaissance: string;
  hopitalNaissance: string;
  languesParlees: string;
  pereId: string | null;
  mereId: string | null;
  nationalite: string;
  paysResidence: string;
  geoActuelle: GeoSelection;
  numeroAvenue: string;
  telephone: string;
  email: string;
  boitePostale: string;
  geoOrigine: GeoSelection;
  tribu: string;
  photo?: string;
  empreinteGauche: string;
  empreinteDroite: string;
  iris: string;
  etudes: EtudesData;
  experience: ExperienceData;
  situationFamiliale: SituationFamilialeData;
  identiteAdmin: IdentiteAdminData;
  /** Anciens brouillons */
  scolaire?: string;
  universitaire?: string;
  professionnel?: string;
  numeroAdmin?: string;
  savedAt: string;
};

export default function CensusPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<StepId>(1);
  const [ficheKind, setFicheKind] = useState<FicheKind>("personne");
  const [dateDeces, setDateDeces] = useState("");
  const [handicap, setHandicap] = useState<HandicapType>("NORMAL");
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [etatCivil, setEtatCivil] = useState<EtatCivil>("CELIBATAIRE");
  const [profession, setProfession] = useState("");
  const [geoNaissance, setGeoNaissance] = useState<GeoSelection>({});
  const [dateNaissance, setDateNaissance] = useState("");
  const [hopitalNaissance, setHopitalNaissance] = useState("");
  const [languesParlees, setLanguesParlees] = useState("");
  const [pere, setPere] = useState<Person | null>(null);
  const [mere, setMere] = useState<Person | null>(null);
  const [nationalite, setNationalite] = useState("Congolaise");
  const [paysResidence, setPaysResidence] = useState("RDC");
  const [geoActuelle, setGeoActuelle] = useState<GeoSelection>({});
  const [numeroAvenue, setNumeroAvenue] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [boitePostale, setBoitePostale] = useState("");
  const [geoOrigine, setGeoOrigine] = useState<GeoSelection>({});
  const [tribu, setTribu] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [empreinteGauche, setEmpreinteGauche] = useState("");
  const [empreinteDroite, setEmpreinteDroite] = useState("");
  const [iris, setIris] = useState("");
  const [etudes, setEtudes] = useState<EtudesData>(emptyEtudes);
  const [experience, setExperience] = useState<ExperienceData>(emptyExperience);
  const [situationFamiliale, setSituationFamiliale] = useState<SituationFamilialeData>(
    emptySituationFamiliale
  );
  const [identiteAdmin, setIdentiteAdmin] = useState<IdentiteAdminData>(emptyIdentiteAdmin);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [gpsInfo, setGpsInfo] = useState<ReverseGeo | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CENSUS_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as CensusDraft;
      setStep(d.step ?? 1);
      setFicheKind(d.ficheKind ?? "personne");
      setDateDeces(d.dateDeces ?? "");
      setHandicap(d.handicap ?? "NORMAL");
      setNom(d.nom ?? "");
      setPostnom(d.postnom ?? "");
      setPrenom(d.prenom ?? "");
      setSexe(d.sexe ?? "M");
      setEtatCivil(d.etatCivil ?? "CELIBATAIRE");
      setProfession(d.profession ?? "");
      setGeoNaissance(d.geoNaissance ?? {});
      setDateNaissance(d.dateNaissance ?? "");
      setHopitalNaissance(d.hopitalNaissance ?? "");
      setLanguesParlees(d.languesParlees ?? "");
      setPere(d.pereId ? getPerson(d.pereId) ?? null : null);
      setMere(d.mereId ? getPerson(d.mereId) ?? null : null);
      setNationalite(d.nationalite ?? "Congolaise");
      setPaysResidence(d.paysResidence ?? "RDC");
      setGeoActuelle(d.geoActuelle ?? {});
      setNumeroAvenue(d.numeroAvenue ?? "");
      setTelephone(d.telephone ?? "");
      setEmail(d.email ?? "");
      setBoitePostale(d.boitePostale ?? "");
      setGeoOrigine(d.geoOrigine ?? {});
      setTribu(d.tribu ?? "");
      setPhoto(d.photo);
      setEmpreinteGauche(d.empreinteGauche ?? "");
      setEmpreinteDroite(d.empreinteDroite ?? "");
      setIris(d.iris ?? "");
      setEtudes(
        d.etudes
          ? parseEtudes(d.etudes)
          : parseEtudes({
              remarques: [d.scolaire, d.universitaire].filter(Boolean).join("\n"),
            })
      );
      setExperience(
        d.experience ? parseExperience(d.experience) : parseExperience(d.professionnel)
      );
      setSituationFamiliale(
        d.situationFamiliale
          ? parseSituationFamiliale(d.situationFamiliale)
          : emptySituationFamiliale()
      );
      setIdentiteAdmin(
        d.identiteAdmin
          ? parseIdentiteAdmin(d.identiteAdmin)
          : parseIdentiteAdmin(d.numeroAdmin)
      );
      setDraftNotice("Brouillon restauré — vous pouvez continuer la saisie.");
    } catch {
      localStorage.removeItem(CENSUS_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const state = location.state as {
      couponPrefill?: {
        nom?: string;
        prenom?: string;
        sexe?: Sexe;
        dateNaissance?: string;
        localId?: string;
      };
    } | null;
    const pre = state?.couponPrefill;
    if (!pre) return;
    if (pre.nom) setNom(pre.nom);
    if (pre.prenom) setPrenom(pre.prenom);
    if (pre.sexe) setSexe(pre.sexe);
    if (pre.dateNaissance) setDateNaissance(pre.dateNaissance);
    if (pre.localId) localStorage.setItem(`${CENSUS_DRAFT_KEY}:id`, pre.localId);
    setStep(1);
    setDraftNotice("Prérempli depuis le coupon APK — complétez puis enregistrez.");
  }, [location.state]);

  useEffect(() => {
    const draftId = searchParams.get("draft");
    if (!draftId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await api.listFormDrafts(
          new URLSearchParams({ status: "DRAFT", limit: "100" }),
        );
        const remote = rows.find((r) => r.id === draftId);
        if (!remote || cancelled) return;
        const payload = remote.payload as Partial<CensusDraft>;
        if (payload.nom) setNom(String(payload.nom));
        if (payload.postnom) setPostnom(String(payload.postnom));
        if (payload.prenom) setPrenom(String(payload.prenom));
        if (payload.sexe) setSexe(payload.sexe as Sexe);
        if (payload.dateNaissance) setDateNaissance(String(payload.dateNaissance));
        if (remote.local_id) localStorage.setItem(`${CENSUS_DRAFT_KEY}:id`, remote.local_id);
        setDraftNotice(`Brouillon serveur ouvert — ${remote.title || remote.local_id || remote.id}`);
        setStep(1);
        await api.claimFormDraft(remote.id).catch(() => undefined);
      } catch {
        if (!cancelled) setError("Impossible de charger le brouillon serveur.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (etatCivil === "MARIE" && !situationFamiliale.a_conjoint) {
      setSituationFamiliale((prev) => ({ ...prev, a_conjoint: true }));
    }
  }, [etatCivil, situationFamiliale.a_conjoint]);

  useEffect(() => {
    if (step !== 3) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCamError("Caméra indisponible — vous pouvez continuer sans photo.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  function validateIdentity(): boolean {
    setError(null);
    if (!nom.trim()) {
      setError("Identité : le nom est requis.");
      return false;
    }
    if (!dateNaissance) {
      setError("Identité : la date de naissance est requise.");
      return false;
    }
    if (ficheKind === "personne" || ficheKind === "decede" || ficheKind === "marie") {
      if (!prenom.trim()) {
        setError("Identité : le prénom est requis.");
        return false;
      }
    }
    if (ficheKind === "bebe") {
      if (!mere && !pere) {
        setError("Identité bébé : nommez la mère ou le père (recherche personne).");
        return false;
      }
    }
    if (ficheKind === "decede") {
      if (!dateDeces) {
        setError("Identité décédé : la date de décès est requise.");
        return false;
      }
      if (dateDeces < dateNaissance) {
        setError("La date de décès ne peut pas être antérieure à la naissance.");
        return false;
      }
    }
    if (ficheKind === "marie") {
      const c = situationFamiliale.conjoint;
      if (!c.person_id && (!c.nom.trim() || !c.prenom.trim())) {
        setError("Identité marié(e) : nom et prénom du conjoint(e) requis (ou liez une fiche).");
        return false;
      }
    }
    return true;
  }

  function validateStep(target: StepId): boolean {
    setError(null);
    if (target > 1 && !validateIdentity()) {
      setStep(1);
      return false;
    }
    return true;
  }

  function validateFamille(): boolean {
    const needConjoint =
      situationFamiliale.a_conjoint || etatCivil === "MARIE" || ficheKind === "marie";
    if (needConjoint) {
      const c = situationFamiliale.conjoint;
      if (!c.person_id && (!c.nom.trim() || !c.prenom.trim())) {
        setError("Conjoint(e) : liez une personne ou saisissez nom et prénom.");
        setStep(7);
        return false;
      }
    }
    return true;
  }

  function goTo(next: StepId) {
    if (!validateStep(next)) return;
    setStep(next);
  }

  function goNext() {
    if (step < 7) goTo((step + 1) as StepId);
  }

  function goPrev() {
    if (step > 1) setStep((step - 1) as StepId);
  }

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
  }

  function buildAdresse(): string {
    const parts = [
      geoActuelle.avenue_name &&
        `Av. ${geoActuelle.avenue_name}${numeroAvenue.trim() ? ` N° ${numeroAvenue.trim()}` : ""}`,
      geoActuelle.quartier_name,
      geoActuelle.localite_name,
      geoActuelle.commune_name,
      geoActuelle.ville_name,
      geoActuelle.province_name,
    ].filter(Boolean);
    return parts.join(", ") || geoActuelle.label || "";
  }

  function saveDraft() {
    if (!validateIdentity()) {
      setStep(1);
      return;
    }
    setError(null);
    const draft: CensusDraft = {
      step,
      ficheKind,
      dateDeces,
      handicap,
      nom,
      postnom,
      prenom,
      sexe,
      etatCivil,
      profession,
      geoNaissance,
      dateNaissance,
      hopitalNaissance,
      languesParlees,
      pereId: pere?.id ?? null,
      mereId: mere?.id ?? null,
      nationalite,
      paysResidence,
      geoActuelle,
      numeroAvenue,
      telephone,
      email,
      boitePostale,
      geoOrigine,
      tribu,
      photo,
      empreinteGauche,
      empreinteDroite,
      iris,
      etudes,
      experience,
      situationFamiliale,
      identiteAdmin,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CENSUS_DRAFT_KEY, JSON.stringify(draft));
    const localId =
      localStorage.getItem(`${CENSUS_DRAFT_KEY}:id`) ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `draft-${Date.now()}`);
    localStorage.setItem(`${CENSUS_DRAFT_KEY}:id`, localId);
    const title = [nom, postnom, prenom].filter(Boolean).join(" ").trim() || "Brouillon recensement";
    void api
      .upsertFormDraft({
        system: "civil_officer",
        form_type: "census_person",
        title,
        local_id: localId,
        payload: draft as unknown as Record<string, unknown>,
        province_id: geoActuelle.province_id || geoNaissance.province_id || null,
        ville_id: geoActuelle.ville_id || geoNaissance.ville_id || null,
      })
      .then(() => {
        setDraftNotice(
          "Brouillon synchronisé — un autre agent / système peut le reprendre et le terminer.",
        );
      })
      .catch(() => {
        setDraftNotice(
          "Sauvegarde locale OK — sync serveur indisponible (reconnectez-vous pour partager le brouillon).",
        );
      });
  }

  function clearDraft() {
    localStorage.removeItem(CENSUS_DRAFT_KEY);
    const localId = localStorage.getItem(`${CENSUS_DRAFT_KEY}:id`);
    localStorage.removeItem(`${CENSUS_DRAFT_KEY}:id`);
    if (localId) {
      void api
        .listFormDrafts(
          new URLSearchParams({
            system: "civil_officer",
            form_type: "census_person",
            status: "DRAFT",
          }),
        )
        .then((rows) => {
          const mine = rows.find((r) => r.local_id === localId);
          if (mine) return api.finalizeFormDraft(mine.id);
        })
        .catch(() => undefined);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDraftNotice(null);
    if (!validateIdentity()) {
      setStep(1);
      return;
    }
    if (!validateStep(7)) return;
    if (!validateFamille()) return;
    try {
      const gps = (await captureGpsWithAddress()) ?? (await captureGpsOnSave());
      if (gps && "latitude" in gps) setGpsInfo(gps as ReverseGeo);
      const commune = getOfficerCommune();
      const adresse = buildAdresse();
      const lieuNaissance = geoNaissance.label || "";
      const situationSummary = formatSituationFamiliale(situationFamiliale);
      const scolaireSummary = formatParcoursScolaire(etudes);
      const univSummary = formatParcoursUniversitaire(etudes);
      const experienceSummary = formatExperience(experience);
      const person = addPerson({
        nom: nom.trim(),
        postnom: postnom.trim(),
        prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieuNaissance,
        etat_civil: ficheKind === "marie" ? "MARIE" : etatCivil,
        handicap_type: handicap,
        mother_id: mere?.id,
        father_id: pere?.id,
        photo_data_url: photo,
        fingerprint_note: [empreinteGauche && `Gauche: ${empreinteGauche}`, empreinteDroite && `Droite: ${empreinteDroite}`]
          .filter(Boolean)
          .join(" | ") || undefined,
        iris_note: iris.trim() || undefined,
        parcours_scolaire: scolaireSummary || undefined,
        parcours_universitaire: univSummary || undefined,
        parcours_professionnel:
          [experienceSummary, profession.trim()].filter(Boolean).join("\n") || undefined,
        situation_familiale: situationSummary || undefined,
        nationalite: nationalite.trim() === "Étrangère" || nationalite.toLowerCase().includes("etrang")
          ? "ETRANGER"
          : "CONGOLAIS",
      });
      const payload = {
        person_id: person.id,
        formulaire: "IDENTIFICATION_PERSONNE",
        fiche_kind: ficheKind,
        date_deces: ficheKind === "decede" ? dateDeces || null : null,
        nom: person.nom,
        postnom: person.postnom,
        prenom: person.prenom,
        sexe: person.sexe,
        etat_civil: ficheKind === "marie" ? "MARIE" : person.etat_civil,
        profession: profession.trim() || null,
        lieu_naissance: person.lieu_naissance,
        date_naissance: person.date_naissance,
        hopital_naissance: hopitalNaissance.trim() || null,
        langues_parlees: languesParlees.trim() || null,
        nom_pere: pere ? displayName(pere) : null,
        nom_mere: mere ? displayName(mere) : null,
        pere_id: pere?.id ?? null,
        mere_id: mere?.id ?? null,
        nationalite: nationalite.trim() || null,
        pays_residence: paysResidence.trim() || null,
        province_actuelle: geoActuelle.province_name || null,
        ville_actuelle: geoActuelle.ville_name || null,
        commune_actuelle: geoActuelle.commune_name || null,
        village_actuel: geoActuelle.localite_name || null,
        quartier_actuel: geoActuelle.quartier_name || null,
        avenue_actuelle: geoActuelle.avenue_name || null,
        numero_avenue: numeroAvenue.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        boite_postale: boitePostale.trim() || null,
        adresse_actuelle: adresse || null,
        geo_actuelle: geoActuelle,
        commune_code: geoActuelle.commune_code || commune.code,
        handicap_type: person.handicap_type,
        has_photo: Boolean(photo),
        fingerprint_note: person.fingerprint_note ?? null,
        iris_note: person.iris_note ?? null,
        parcours_scolaire: person.parcours_scolaire ?? null,
        parcours_universitaire: person.parcours_universitaire ?? null,
        parcours_professionnel: person.parcours_professionnel ?? null,
        experience_detail: experience,
        etudes_detail: etudes,
        situation_familiale: person.situation_familiale ?? null,
        situation_familiale_detail: situationFamiliale,
        province_origine: geoOrigine.province_name || null,
        ville_origine: geoOrigine.ville_name || null,
        territoire_origine: geoOrigine.district_name || null,
        secteur_chefferie_commune: geoOrigine.commune_name || null,
        village_origine: geoOrigine.localite_name || null,
        geo_origine: geoOrigine,
        geo_naissance: geoNaissance,
        tribu: tribu.trim() || null,
        numero_admin: formatIdentiteAdmin(identiteAdmin) || null,
        identite_administrative_detail: identiteAdmin,
        latitude: gps && "latitude" in gps ? gps.latitude : null,
        longitude: gps && "longitude" in gps ? gps.longitude : null,
        gps_captured_at: gps && "latitude" in gps ? new Date().toISOString() : null,
        gps_address: gps && "display_name" in gps ? (gps as ReverseGeo).display_name ?? null : null,
      };
      const act = addAct("CENSUS", payload, person.nic);
      clearDraft();
      setSituationFamiliale(emptySituationFamiliale());
      setEtudes(emptyEtudes());
      setExperience(emptyExperience());
      setIdentiteAdmin(emptyIdentiteAdmin());
      setCreated(act);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recensement impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Recensement</h2>
      <p className="page-lead">
        Identité obligatoire (personne, bébé, décédé ou marié) avant le reste — le complément peut être saisi plus
        tard.{" "}
        <Link to="/census/scan-coupon">Scanner un coupon APK</Link>
      </p>

      <div className="wizard-steps census-wizard-steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`wizard-step-btn${step === s.id ? " active" : ""}`}
            onClick={() => goTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {draftNotice ? <div className="success-banner">{draftNotice}</div> : null}

      <div className="panel">
        {step === 1 ? (
          <div className="id-form">
            <h3 className="id-form-title">Formulaire d&apos;identification</h3>
            <p className="muted small" style={{ marginBottom: "0.75rem" }}>
              Identité obligatoire — le reste peut être complété plus tard.
            </p>

            <fieldset className="id-fieldset">
              <legend>Type de fiche *</legend>
              <div className="form-grid">
                <div className="full" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {FICHE_KIND_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`btn-secondary${ficheKind === o.value ? " active" : ""}`}
                      style={
                        ficheKind === o.value
                          ? { borderColor: "var(--rdc-blue, #007fff)", fontWeight: 700 }
                          : undefined
                      }
                      onClick={() => {
                        setFicheKind(o.value);
                        if (o.value === "marie") {
                          setEtatCivil("MARIE");
                          setSituationFamiliale((prev) => ({ ...prev, a_conjoint: true }));
                        }
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="id-fieldset">
              <legend>Identité de la personne</legend>
              <div className="form-grid">
                <div className="full">
                  <label className="form-label">
                    {ficheKind === "bebe" ? "Nom du bébé * (ou « Enfant de … »)" : "Nom de la personne *"}
                  </label>
                  <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} />
                </div>
                <div className="full">
                  <label className="form-label">Post-nom de la personne</label>
                  <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
                </div>
                <div className="full">
                  <label className="form-label">{ficheKind === "bebe" ? "Prénom" : "Prénom *"}</label>
                  <input className="form-control" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Sexe *</label>
                  <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as Sexe)}>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
                {ficheKind !== "bebe" ? (
                  <div>
                    <label className="form-label">État-civil</label>
                    <select
                      className="form-control"
                      value={ficheKind === "marie" ? "MARIE" : etatCivil}
                      disabled={ficheKind === "marie"}
                      onChange={(e) => setEtatCivil(e.target.value as EtatCivil)}
                    >
                      {ETAT_CIVIL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {ficheKind !== "bebe" ? (
                  <div className="full">
                    <label className="form-label">Profession</label>
                    <input className="form-control" value={profession} onChange={(e) => setProfession(e.target.value)} />
                  </div>
                ) : null}
                <div className="full">
                  <label className="form-label">Lieu de naissance</label>
                  <GeoCascade
                    embedded
                    label="Lieu de naissance"
                    levels={GEO_PRESETS.place}
                    value={geoNaissance}
                    onChange={setGeoNaissance}
                  />
                </div>
                <div>
                  <label className="form-label">Date de naissance *</label>
                  <input
                    className="form-control"
                    type="date"
                    value={dateNaissance}
                    onChange={(e) => setDateNaissance(e.target.value)}
                  />
                </div>
                {ficheKind === "decede" ? (
                  <div>
                    <label className="form-label">Date de décès *</label>
                    <input
                      className="form-control"
                      type="date"
                      value={dateDeces}
                      onChange={(e) => setDateDeces(e.target.value)}
                    />
                  </div>
                ) : null}
                <div>
                  <label className="form-label">Hôpital de naissance</label>
                  <input
                    className="form-control"
                    value={hopitalNaissance}
                    onChange={(e) => setHopitalNaissance(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Langues parlées</label>
                  <input
                    className="form-control"
                    value={languesParlees}
                    onChange={(e) => setLanguesParlees(e.target.value)}
                    placeholder="Français, Lingala…"
                  />
                </div>
                <div className="full">
                  <PersonPicker
                    label={ficheKind === "bebe" ? "Nom du père * (si pas de mère)" : "Nom du père"}
                    value={pere}
                    onChange={setPere}
                  />
                </div>
                <div className="full">
                  <PersonPicker
                    label={ficheKind === "bebe" ? "Nom de la mère * (si pas de père)" : "Nom de la mère"}
                    value={mere}
                    onChange={setMere}
                  />
                </div>
                <div>
                  <label className="form-label">Nationalité</label>
                  <input
                    className="form-control"
                    value={nationalite}
                    onChange={(e) => setNationalite(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Pays de résidence</label>
                  <input
                    className="form-control"
                    value={paysResidence}
                    onChange={(e) => setPaysResidence(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Type de handicap</label>
                  <select
                    className="form-control"
                    value={handicap}
                    onChange={(e) => setHandicap(e.target.value as HandicapType)}
                  >
                    {HANDICAP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {ficheKind === "marie" ? (
              <fieldset className="id-fieldset">
                <legend>Conjoint(e) *</legend>
                <div className="form-grid">
                  <div className="full">
                    <PersonPicker
                      label="Lier un conjoint enregistré (optionnel)"
                      value={
                        situationFamiliale.conjoint.person_id
                          ? getPerson(situationFamiliale.conjoint.person_id) ?? null
                          : null
                      }
                      onChange={(p) =>
                        setSituationFamiliale((prev) => ({
                          ...prev,
                          a_conjoint: true,
                          conjoint: {
                            ...prev.conjoint,
                            person_id: p?.id ?? null,
                            nom: p?.nom ?? prev.conjoint.nom,
                            postnom: p?.postnom ?? prev.conjoint.postnom,
                            prenom: p?.prenom ?? prev.conjoint.prenom,
                            sexe: (p?.sexe as Sexe | "") || prev.conjoint.sexe,
                            date_naissance: p?.date_naissance ?? prev.conjoint.date_naissance,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Nom conjoint(e) *</label>
                    <input
                      className="form-control"
                      value={situationFamiliale.conjoint.nom}
                      onChange={(e) =>
                        setSituationFamiliale((prev) => ({
                          ...prev,
                          a_conjoint: true,
                          conjoint: { ...prev.conjoint, nom: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Prénom conjoint(e) *</label>
                    <input
                      className="form-control"
                      value={situationFamiliale.conjoint.prenom}
                      onChange={(e) =>
                        setSituationFamiliale((prev) => ({
                          ...prev,
                          a_conjoint: true,
                          conjoint: { ...prev.conjoint, prenom: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="id-fieldset">
              <legend>Adresse actuelle</legend>
              <GpsLocatePanel
                title="Localisation GPS de l’adresse"
                onResolved={(g) => {
                  setGpsInfo(g);
                  setGeoActuelle((prev) => ({
                    ...prev,
                    province_name: g.province || prev.province_name,
                    ville_name: g.ville || prev.ville_name,
                    commune_name: g.commune || prev.commune_name,
                    quartier_name: g.quartier || prev.quartier_name,
                    avenue_name: g.avenue || prev.avenue_name,
                    label:
                      g.display_name ||
                      [g.province, g.ville, g.commune, g.quartier, g.avenue].filter(Boolean).join(" · ") ||
                      prev.label,
                  }));
                }}
              />
              <GeoCascade
                embedded
                label="Adresse actuelle (saisie manuelle ou après GPS)"
                levels={GEO_PRESETS.address}
                fieldLabels={ADDRESS_FIELD_LABELS}
                value={geoActuelle}
                onChange={setGeoActuelle}
              />
              <div className="form-grid" style={{ marginTop: "0.75rem" }}>
                <div>
                  <label className="form-label">N°</label>
                  <input
                    className="form-control"
                    value={numeroAvenue}
                    onChange={(e) => setNumeroAvenue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Numéro de téléphone</label>
                  <input className="form-control" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Adresse e-mail</label>
                  <input
                    className="form-control"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Boîte postale</label>
                  <input
                    className="form-control"
                    value={boitePostale}
                    onChange={(e) => setBoitePostale(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="id-form">
            <h3 className="id-form-title" style={{ color: "var(--egouv-primary)" }}>
              3. Originaire
            </h3>
            <GeoCascade
              embedded
              label="Origine"
              levels={GEO_PRESETS.origin}
              fieldLabels={ORIGIN_FIELD_LABELS}
              value={geoOrigine}
              onChange={setGeoOrigine}
            />
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <div>
                <label className="form-label">Tribu :</label>
                <input
                  className="form-control"
                  list="tribus-rdc"
                  value={tribu}
                  onChange={(e) => setTribu(e.target.value)}
                  placeholder="Rechercher une tribu…"
                />
                <datalist id="tribus-rdc">
                  {RDC_TRIBUS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
                  {RDC_TRIBUS.length} entrées de référence — {RDC_TRIBUS_NOTE}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="bio-form">
            <h3 className="id-form-title">Système biométrique</h3>
            <div className="bio-grid">
              <div className="bio-card">
                <div className="bio-card-head">Face sélectionnée / reconnaissance faciale</div>
                <div className="webcam-box">
                  <video ref={videoRef} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <div className="webcam-actions">
                    <button type="button" className="btn-add btn-sm" onClick={takePhoto}>
                      Capturer
                    </button>
                    {camError ? <span className="muted">{camError}</span> : null}
                  </div>
                  {photo ? <img className="webcam-preview" src={photo} alt="Capture" /> : null}
                </div>
              </div>
              <div className="bio-card">
                <div className="bio-card-head">Empreintes sélectionnées / empreinte digitale</div>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Gauche</label>
                    <input
                      className="form-control"
                      value={empreinteGauche}
                      onChange={(e) => setEmpreinteGauche(e.target.value)}
                      placeholder="Réf. capture gauche"
                    />
                    <button
                      type="button"
                      className="btn-add btn-sm"
                      style={{ marginTop: "0.45rem" }}
                      onClick={() => setEmpreinteGauche(`CAP-G-${Date.now().toString(36).toUpperCase()}`)}
                    >
                      Capturer
                    </button>
                  </div>
                  <div>
                    <label className="form-label">Droite</label>
                    <input
                      className="form-control"
                      value={empreinteDroite}
                      onChange={(e) => setEmpreinteDroite(e.target.value)}
                      placeholder="Réf. capture droite"
                    />
                    <button
                      type="button"
                      className="btn-add btn-sm"
                      style={{ marginTop: "0.45rem" }}
                      onClick={() => setEmpreinteDroite(`CAP-D-${Date.now().toString(36).toUpperCase()}`)}
                    >
                      Capturer
                    </button>
                  </div>
                  <div className="full">
                    <label className="form-label">Iris</label>
                    <input className="form-control" value={iris} onChange={(e) => setIris(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="full">
            <EtudesFaitesForm value={etudes} onChange={setEtudes} />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="full">
            <ExperienceProfessionnelleForm value={experience} onChange={setExperience} />
          </div>
        ) : null}

        {step === 6 ? (
          <div className="full">
            <IdentiteAdministrativeForm value={identiteAdmin} onChange={setIdentiteAdmin} />
          </div>
        ) : null}

        {step === 7 ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="full">
              <SituationFamilialeForm
                value={situationFamiliale}
                onChange={setSituationFamiliale}
                etatCivil={etatCivil}
              />
            </div>
            <div className="full census-nav">
              <button type="button" className="btn-secondary" onClick={goPrev}>
                Retour
              </button>
              <div className="census-nav-actions">
                <button type="button" className="btn-secondary" onClick={saveDraft}>
                  Sauvegarder temporairement
                </button>
                <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 180 }}>
                  Finaliser et enregistrer
                </button>
              </div>
            </div>
            <div className="full" style={{ marginBottom: "0.75rem" }}>
              <GpsLocatePanel
                title="GPS à la finalisation"
                onResolved={(g) => setGpsInfo(g)}
              />
              {gpsInfo ? (
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  Position prête pour la cartographie.
                </p>
              ) : null}
            </div>
            <p className="muted small full" style={{ marginTop: "0.35rem" }}>
              Temporaire = brouillon local. Finaliser = fiche + GPS pour la cartographie.
            </p>
          </form>
        ) : null}

        {step !== 7 ? (
          <div className="census-nav">
            {step > 1 ? (
              <button type="button" className="btn-secondary" onClick={goPrev}>
                Retour
              </button>
            ) : (
              <span />
            )}
            <div className="census-nav-actions">
              <button type="button" className="btn-secondary" onClick={saveDraft}>
                Sauvegarder temporairement
              </button>
              <button type="button" className="btn-next" style={{ width: "auto", minWidth: 160 }} onClick={goNext}>
                Suivant
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Fiche de recensement créée — NIC {created.national_id}</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
