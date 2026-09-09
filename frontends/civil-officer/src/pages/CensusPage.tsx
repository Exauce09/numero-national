import { FormEvent, useEffect, useRef, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import PersonPicker from "../components/PersonPicker";
import {
  ETAT_CIVIL_OPTIONS,
  HANDICAP_OPTIONS,
  addAct,
  addPerson,
  type Act,
  type EtatCivil,
  type HandicapType,
  type Person,
  type Sexe,
} from "../registry";
import { getOfficerCommune } from "../commune";

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

export default function CensusPage() {
  const [step, setStep] = useState<StepId>(1);
  const [handicap, setHandicap] = useState<HandicapType>("NORMAL");
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [taille, setTaille] = useState("");
  const [poids, setPoids] = useState("");
  const [provinceOrigine, setProvinceOrigine] = useState("");
  const [territoireOrigine, setTerritoireOrigine] = useState("");
  const [ethnie, setEthnie] = useState("");
  const [nationalite, setNationalite] = useState("Congolaise");
  const [etatCivil, setEtatCivil] = useState<EtatCivil>("CELIBATAIRE");
  const [adresseActuelle, setAdresseActuelle] = useState("");
  const [professionActuelle, setProfessionActuelle] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [empreinte, setEmpreinte] = useState("");
  const [iris, setIris] = useState("");
  const [scolaire, setScolaire] = useState("");
  const [universitaire, setUniversitaire] = useState("");
  const [professionnel, setProfessionnel] = useState("");
  const [situation, setSituation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  function validateStep(target: StepId): boolean {
    setError(null);
    if (target > 1 && (!nom.trim() || !prenom.trim() || !dateNaissance)) {
      setError("Étape 1 : nom, prénom et date de naissance sont requis.");
      setStep(1);
      return false;
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateStep(7)) return;
    try {
      const commune = getOfficerCommune();
      const person = addPerson({
        nom: nom.trim(),
        postnom: postnom.trim(),
        prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieuNaissance.trim(),
        etat_civil: etatCivil,
        taille: taille ? Number(taille) : undefined,
        poids: poids ? Number(poids) : undefined,
        handicap_type: handicap,
        mother_id: mother?.id,
        father_id: father?.id,
        photo_data_url: photo,
        fingerprint_note: empreinte.trim() || undefined,
        iris_note: iris.trim() || undefined,
        parcours_scolaire: scolaire.trim() || undefined,
        parcours_universitaire: universitaire.trim() || undefined,
        parcours_professionnel: [professionnel.trim(), professionActuelle.trim()]
          .filter(Boolean)
          .join(" | ") || undefined,
        situation_familiale: situation.trim() || undefined,
      });
      const payload = {
        person_id: person.id,
        nom: person.nom,
        postnom: person.postnom,
        prenom: person.prenom,
        sexe: person.sexe,
        date_naissance: person.date_naissance,
        lieu_naissance: person.lieu_naissance,
        commune_code: commune.code,
        etat_civil: person.etat_civil,
        taille: person.taille ?? null,
        poids: person.poids ?? null,
        handicap_type: person.handicap_type,
        mother_id: mother?.id ?? null,
        father_id: father?.id ?? null,
        has_photo: Boolean(photo),
        fingerprint_note: person.fingerprint_note ?? null,
        iris_note: person.iris_note ?? null,
        parcours_scolaire: person.parcours_scolaire ?? null,
        parcours_universitaire: person.parcours_universitaire ?? null,
        parcours_professionnel: person.parcours_professionnel ?? null,
        situation_familiale: person.situation_familiale ?? null,
        adresse_actuelle: adresseActuelle.trim() || null,
        profession_actuelle: professionActuelle.trim() || null,
        province_origine: provinceOrigine.trim() || null,
        territoire_origine: territoireOrigine.trim() || null,
        ethnie: ethnie.trim() || null,
        nationalite: nationalite.trim() || null,
      };
      const act = addAct("CENSUS", payload, person.nic);
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
        Wizard en 7 étapes — identité, origine, biométrie, études, expérience, identité administrative, situation
        familiale.
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

      <div className="panel">
        {step === 1 ? (
          <div className="form-grid">
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
            <div className="full">
              <PersonPicker label="Mère" value={mother} onChange={setMother} />
            </div>
            <div className="full">
              <PersonPicker label="Père" value={father} onChange={setFather} />
            </div>
            <div>
              <label className="form-label">Nom</label>
              <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Postnom</label>
              <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Prénom</label>
              <input className="form-control" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sexe</label>
              <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as Sexe)}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className="form-label">Date de naissance</label>
              <input
                className="form-control"
                type="date"
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Lieu de naissance</label>
              <input
                className="form-control"
                value={lieuNaissance}
                onChange={(e) => setLieuNaissance(e.target.value)}
                placeholder="Ville, commune, pays…"
              />
            </div>
            <div>
              <label className="form-label">Taille (cm)</label>
              <input className="form-control" type="number" value={taille} onChange={(e) => setTaille(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Poids (kg)</label>
              <input className="form-control" type="number" value={poids} onChange={(e) => setPoids(e.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form-grid">
            <div>
              <label className="form-label">Province d&apos;origine</label>
              <input
                className="form-control"
                value={provinceOrigine}
                onChange={(e) => setProvinceOrigine(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Territoire / ville d&apos;origine</label>
              <input
                className="form-control"
                value={territoireOrigine}
                onChange={(e) => setTerritoireOrigine(e.target.value)}
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
              <label className="form-label">Ethnie / tribu</label>
              <input className="form-control" value={ethnie} onChange={(e) => setEthnie(e.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="form-grid">
            <div className="full webcam-box">
              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className="webcam-actions">
                <button type="button" className="btn-secondary" onClick={takePhoto}>
                  Prendre photo
                </button>
                {camError ? <span className="muted">{camError}</span> : null}
              </div>
              {photo ? <img className="webcam-preview" src={photo} alt="Capture" /> : null}
            </div>
            <div>
              <label className="form-label">Empreinte</label>
              <input className="form-control" value={empreinte} onChange={(e) => setEmpreinte(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Iris</label>
              <input className="form-control" value={iris} onChange={(e) => setIris(e.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="form-grid">
            <div className="full">
              <label className="form-label">Parcours scolaire</label>
              <textarea
                className="form-control"
                rows={4}
                value={scolaire}
                onChange={(e) => setScolaire(e.target.value)}
                placeholder="Écoles, niveaux, diplômes…"
              />
            </div>
            <div className="full">
              <label className="form-label">Parcours universitaire</label>
              <textarea
                className="form-control"
                rows={4}
                value={universitaire}
                onChange={(e) => setUniversitaire(e.target.value)}
                placeholder="Facultés, filières, diplômes…"
              />
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="form-grid">
            <div className="full">
              <label className="form-label">Expérience professionnelle</label>
              <textarea
                className="form-control"
                rows={6}
                value={professionnel}
                onChange={(e) => setProfessionnel(e.target.value)}
                placeholder="Emplois, entreprises, périodes, responsabilités…"
              />
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="form-grid">
            <div>
              <label className="form-label">État civil actuel</label>
              <select
                className="form-control"
                value={etatCivil}
                onChange={(e) => setEtatCivil(e.target.value as EtatCivil)}
              >
                {ETAT_CIVIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Profession actuelle</label>
              <input
                className="form-control"
                value={professionActuelle}
                onChange={(e) => setProfessionActuelle(e.target.value)}
              />
            </div>
            <div className="full">
              <label className="form-label">Adresse administrative actuelle</label>
              <input
                className="form-control"
                value={adresseActuelle}
                onChange={(e) => setAdresseActuelle(e.target.value)}
                placeholder="Avenue, n°, quartier, commune…"
              />
            </div>
          </div>
        ) : null}

        {step === 7 ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="full">
              <label className="form-label">Situation familiale</label>
              <textarea
                className="form-control"
                rows={6}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="Conjoint(e), enfants, personnes à charge…"
              />
            </div>
            <div className="full census-nav">
              <button type="button" className="btn-secondary" onClick={goPrev}>
                Retour
              </button>
              <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 180 }}>
                Enregistrer
              </button>
            </div>
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
            <button type="button" className="btn-next" style={{ width: "auto", minWidth: 160 }} onClick={goNext}>
              Suivant
            </button>
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
