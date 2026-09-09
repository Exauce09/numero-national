import { FormEvent, useEffect, useRef, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import PersonPicker from "../components/PersonPicker";
import {
  ETAT_CIVIL_OPTIONS,
  HANDICAP_OPTIONS,
  addAct,
  addPerson,
  displayName,
  type Act,
  type EtatCivil,
  type HandicapType,
  type Person,
  type Sexe,
} from "../registry";
import { getOfficerCommune } from "../commune";

/** Provinces RDC — formulaire Originaire. */
const RDC_PROVINCES = [
  "Bas-Uélé",
  "Équateur",
  "Haut-Katanga",
  "Haut-Lomami",
  "Haut-Uélé",
  "Ituri",
  "Kasaï",
  "Kasaï Central",
  "Kasaï Oriental",
  "Kinshasa",
  "Kongo Central",
  "Kwango",
  "Kwilu",
  "Lomami",
  "Lualaba",
  "Mai-Ndombe",
  "Maniema",
  "Mongala",
  "Nord-Kivu",
  "Nord-Ubangi",
  "Sankuru",
  "Sud-Kivu",
  "Sud-Ubangi",
  "Tanganyika",
  "Tshopo",
  "Tshuapa",
] as const;

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
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [etatCivil, setEtatCivil] = useState<EtatCivil>("CELIBATAIRE");
  const [profession, setProfession] = useState("");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [hopitalNaissance, setHopitalNaissance] = useState("");
  const [languesParlees, setLanguesParlees] = useState("");
  const [pere, setPere] = useState<Person | null>(null);
  const [mere, setMere] = useState<Person | null>(null);
  const [nationalite, setNationalite] = useState("Congolaise");
  const [paysResidence, setPaysResidence] = useState("RDC");
  const [provinceActuelle, setProvinceActuelle] = useState("");
  const [villeActuelle, setVilleActuelle] = useState("");
  const [communeActuelle, setCommuneActuelle] = useState("");
  const [quartierActuel, setQuartierActuel] = useState("");
  const [avenueActuelle, setAvenueActuelle] = useState("");
  const [numeroAvenue, setNumeroAvenue] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [boitePostale, setBoitePostale] = useState("");
  const [provinceOrigine, setProvinceOrigine] = useState("");
  const [villeOrigine, setVilleOrigine] = useState("");
  const [territoireOrigine, setTerritoireOrigine] = useState("");
  const [secteurOrigine, setSecteurOrigine] = useState("");
  const [villageOrigine, setVillageOrigine] = useState("");
  const [tribu, setTribu] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [empreinteGauche, setEmpreinteGauche] = useState("");
  const [empreinteDroite, setEmpreinteDroite] = useState("");
  const [iris, setIris] = useState("");
  const [scolaire, setScolaire] = useState("");
  const [universitaire, setUniversitaire] = useState("");
  const [professionnel, setProfessionnel] = useState("");
  const [situation, setSituation] = useState("");
  const [numeroAdmin, setNumeroAdmin] = useState("");
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
      setError("Étape Identité : nom, prénom et date de naissance sont requis.");
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

  function buildAdresse(): string {
    return [
      avenueActuelle.trim() && `Av. ${avenueActuelle.trim()}${numeroAvenue.trim() ? ` N° ${numeroAvenue.trim()}` : ""}`,
      quartierActuel.trim(),
      communeActuelle.trim(),
      villeActuelle.trim(),
      provinceActuelle.trim(),
    ]
      .filter(Boolean)
      .join(", ");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateStep(7)) return;
    try {
      const commune = getOfficerCommune();
      const adresse = buildAdresse();
      const person = addPerson({
        nom: nom.trim(),
        postnom: postnom.trim(),
        prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieuNaissance.trim(),
        etat_civil: etatCivil,
        handicap_type: handicap,
        mother_id: mere?.id,
        father_id: pere?.id,
        photo_data_url: photo,
        fingerprint_note: [empreinteGauche && `Gauche: ${empreinteGauche}`, empreinteDroite && `Droite: ${empreinteDroite}`]
          .filter(Boolean)
          .join(" | ") || undefined,
        iris_note: iris.trim() || undefined,
        parcours_scolaire: scolaire.trim() || undefined,
        parcours_universitaire: universitaire.trim() || undefined,
        parcours_professionnel: [professionnel.trim(), profession.trim()].filter(Boolean).join(" | ") || undefined,
        situation_familiale: situation.trim() || undefined,
        nationalite: nationalite.trim() === "Étrangère" || nationalite.toLowerCase().includes("etrang")
          ? "ETRANGER"
          : "CONGOLAIS",
      });
      const payload = {
        person_id: person.id,
        formulaire: "IDENTIFICATION_PERSONNE",
        nom: person.nom,
        postnom: person.postnom,
        prenom: person.prenom,
        sexe: person.sexe,
        etat_civil: person.etat_civil,
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
        province_actuelle: provinceActuelle.trim() || null,
        ville_actuelle: villeActuelle.trim() || null,
        commune_actuelle: communeActuelle.trim() || null,
        quartier_actuel: quartierActuel.trim() || null,
        avenue_actuelle: avenueActuelle.trim() || null,
        numero_avenue: numeroAvenue.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        boite_postale: boitePostale.trim() || null,
        adresse_actuelle: adresse || null,
        commune_code: commune.code,
        handicap_type: person.handicap_type,
        has_photo: Boolean(photo),
        fingerprint_note: person.fingerprint_note ?? null,
        iris_note: person.iris_note ?? null,
        parcours_scolaire: person.parcours_scolaire ?? null,
        parcours_universitaire: person.parcours_universitaire ?? null,
        parcours_professionnel: person.parcours_professionnel ?? null,
        situation_familiale: person.situation_familiale ?? null,
        province_origine: provinceOrigine.trim() || null,
        ville_origine: villeOrigine.trim() || null,
        territoire_origine: territoireOrigine.trim() || null,
        secteur_chefferie_commune: secteurOrigine.trim() || null,
        village_origine: villageOrigine.trim() || null,
        tribu: tribu.trim() || null,
        numero_admin: numeroAdmin.trim() || null,
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
        Formulaire d&apos;identification de la personne — identité selon le modèle officiel ; photos et empreintes à
        l&apos;étape Biométrie.
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
          <div className="id-form">
            <h3 className="id-form-title">Formulaire d&apos;identification de la personne</h3>

            <fieldset className="id-fieldset">
              <legend>Identité de la personne</legend>
              <div className="form-grid">
                <div className="full">
                  <label className="form-label">Nom de la personne</label>
                  <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} />
                </div>
                <div className="full">
                  <label className="form-label">Post-nom de la personne</label>
                  <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
                </div>
                <div className="full">
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
                  <label className="form-label">État-civil</label>
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
                <div className="full">
                  <label className="form-label">Profession</label>
                  <input className="form-control" value={profession} onChange={(e) => setProfession(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Lieu de naissance</label>
                  <input
                    className="form-control"
                    value={lieuNaissance}
                    onChange={(e) => setLieuNaissance(e.target.value)}
                  />
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
                  <PersonPicker label="Nom du père" value={pere} onChange={setPere} />
                </div>
                <div className="full">
                  <PersonPicker label="Nom de la mère" value={mere} onChange={setMere} />
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

            <fieldset className="id-fieldset">
              <legend>Adresse actuelle</legend>
              <div className="form-grid">
                <div>
                  <label className="form-label">Province actuelle</label>
                  <input
                    className="form-control"
                    value={provinceActuelle}
                    onChange={(e) => setProvinceActuelle(e.target.value)}
                    placeholder="— Choisissez / saisissez —"
                  />
                </div>
                <div>
                  <label className="form-label">Ville actuelle</label>
                  <input
                    className="form-control"
                    value={villeActuelle}
                    onChange={(e) => setVilleActuelle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Commune</label>
                  <input
                    className="form-control"
                    value={communeActuelle}
                    onChange={(e) => setCommuneActuelle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Quartier</label>
                  <input
                    className="form-control"
                    value={quartierActuel}
                    onChange={(e) => setQuartierActuel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Avenue</label>
                  <input
                    className="form-control"
                    value={avenueActuelle}
                    onChange={(e) => setAvenueActuelle(e.target.value)}
                  />
                </div>
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
            <div className="form-grid">
              <div>
                <label className="form-label">Province d&apos;origine :</label>
                <select
                  className="form-control"
                  value={provinceOrigine}
                  onChange={(e) => setProvinceOrigine(e.target.value)}
                >
                  <option value="">-- choisissez --</option>
                  {RDC_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Ville d&apos;origine :</label>
                <input
                  className="form-control"
                  list="villes-origine"
                  value={villeOrigine}
                  onChange={(e) => setVilleOrigine(e.target.value)}
                  placeholder="-- choisissez --"
                />
                <datalist id="villes-origine">
                  <option value="Kinshasa" />
                  <option value="Lubumbashi" />
                  <option value="Mbuji-Mayi" />
                  <option value="Kananga" />
                  <option value="Kisangani" />
                  <option value="Bukavu" />
                  <option value="Goma" />
                  <option value="Kolwezi" />
                  <option value="Likasi" />
                  <option value="Tshikapa" />
                  <option value="Bunia" />
                  <option value="Matadi" />
                  <option value="Mbandaka" />
                  <option value="Bandundu" />
                </datalist>
              </div>
              <div>
                <label className="form-label">Territoire :</label>
                <input
                  className="form-control"
                  value={territoireOrigine}
                  onChange={(e) => setTerritoireOrigine(e.target.value)}
                  placeholder="-- choisissez --"
                />
              </div>
              <div>
                <label className="form-label">Secteur / Chefferie / Commune :</label>
                <input
                  className="form-control"
                  value={secteurOrigine}
                  onChange={(e) => setSecteurOrigine(e.target.value)}
                  placeholder="-- choisissez --"
                />
              </div>
              <div>
                <label className="form-label">Village :</label>
                <input
                  className="form-control"
                  value={villageOrigine}
                  onChange={(e) => setVillageOrigine(e.target.value)}
                  placeholder="-- choisissez --"
                />
              </div>
              <div>
                <label className="form-label">Tribu :</label>
                <input
                  className="form-control"
                  list="tribus-rdc"
                  value={tribu}
                  onChange={(e) => setTribu(e.target.value)}
                  placeholder="-- choisissez --"
                />
                <datalist id="tribus-rdc">
                  <option value="Luba" />
                  <option value="Kongo" />
                  <option value="Mongo" />
                  <option value="Rwanda" />
                  <option value="Lunda" />
                  <option value="Tetela" />
                  <option value="Yaka" />
                  <option value="Chokwe" />
                  <option value="Nande" />
                  <option value="Hema" />
                  <option value="Lendu" />
                  <option value="Alur" />
                  <option value="Shi" />
                  <option value="Rega" />
                  <option value="Zande" />
                </datalist>
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
          <div className="form-grid">
            <div className="full">
              <label className="form-label">Parcours scolaire</label>
              <textarea
                className="form-control"
                rows={4}
                value={scolaire}
                onChange={(e) => setScolaire(e.target.value)}
              />
            </div>
            <div className="full">
              <label className="form-label">Parcours universitaire</label>
              <textarea
                className="form-control"
                rows={4}
                value={universitaire}
                onChange={(e) => setUniversitaire(e.target.value)}
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
              />
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="form-grid">
            <div className="full">
              <label className="form-label">N° administratif / référence dossier</label>
              <input className="form-control" value={numeroAdmin} onChange={(e) => setNumeroAdmin(e.target.value)} />
            </div>
            <p className="muted small full">
              L&apos;identité, la profession, l&apos;état civil et l&apos;adresse actuelle sont déjà saisis à l&apos;étape
              Identité.
            </p>
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
