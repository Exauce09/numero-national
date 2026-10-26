import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fgpApi,
  registryApi,
  type CitizenDetail,
  type CitizenHistoryItem,
  type CitizenHit,
  type DuplicateCandidate,
  type FgpHealth,
  type FgpRelation,
} from "../api";
import { getSession } from "../auth";

type Tab = "identite" | "adresse" | "filiation" | "controles" | "historique" | "rectification";
type Mode = "liste" | "creer" | "detail";

const STATUS_OPTIONS = [
  "",
  "DRAFT",
  "PENDING_VALIDATION",
  "ACTIVE",
  "SUSPENDED",
  "DECEASED",
  "MERGED",
];

/** Module 5 FGP (+ Module 2 dossiers) — référentiel central, sans NIN inventé. */
export default function PopulationFgpPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [mode, setMode] = useState<Mode>("liste");
  const [tab, setTab] = useState<Tab>("identite");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [province, setProvince] = useState("");
  const [commune, setCommune] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<FgpHealth | null>(null);

  const [selected, setSelected] = useState<CitizenDetail | null>(null);
  const [history, setHistory] = useState<CitizenHistoryItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [relations, setRelations] = useState<FgpRelation[]>([]);

  const [familyName, setFamilyName] = useState("");
  const [postName, setPostName] = useState("");
  const [givenNames, setGivenNames] = useState("");
  const [otherNames, setOtherNames] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("UNKNOWN");
  const [pob, setPob] = useState("");
  const [birthActNo, setBirthActNo] = useState("");
  const [nationality, setNationality] = useState("COD");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [occupation, setOccupation] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [originProvince, setOriginProvince] = useState("");
  const [originTerritory, setOriginTerritory] = useState("");
  const [originSecteur, setOriginSecteur] = useState("");
  const [originGroupement, setOriginGroupement] = useState("");
  const [originLocalite, setOriginLocalite] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherOcc, setFatherOcc] = useState("");
  const [fatherNat, setFatherNat] = useState("COD");
  const [motherName, setMotherName] = useState("");
  const [motherOcc, setMotherOcc] = useState("");
  const [motherNat, setMotherNat] = useState("COD");
  const [addrLine, setAddrLine] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProv, setAddrProv] = useState("");
  const [addrCommune, setAddrCommune] = useState("");
  const [similar, setSimilar] = useState<CitizenHit[]>([]);
  const [statusReason, setStatusReason] = useState("");
  const [dupJustification, setDupJustification] = useState("");
  const [corrField, setCorrField] = useState("family_name");
  const [corrValue, setCorrValue] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [relRelatedId, setRelRelatedId] = useState("");
  const [relType, setRelType] = useState("PARENT");
  const [mergeTargetId, setMergeTargetId] = useState("");

  const load = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fgpApi.searchPersons({
        q: q.trim() || undefined,
        status: status || undefined,
        province_code: province.trim() || undefined,
        commune_code: commune.trim() || undefined,
        place_of_birth: placeOfBirth.trim() || undefined,
        page: 1,
        page_size: 50,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Recherche impossible");
    } finally {
      setLoading(false);
    }
  }, [hasToken, q, status, province, commune, placeOfBirth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hasToken) return;
    void fgpApi
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [hasToken]);

  async function openDetail(id: string) {
    setError(null);
    setInfo(null);
    setTab("identite");
    try {
      const [c, hist, dups, rels] = await Promise.all([
        fgpApi.getPerson(id),
        fgpApi.getHistory(id),
        registryApi.getDuplicates(id, false),
        fgpApi.listRelations(id),
      ]);
      setSelected(c);
      setHistory(hist.items);
      setDuplicates(dups);
      setRelations(rels);
      setMode("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dossier inaccessible");
    }
  }

  async function checkSimilar() {
    setError(null);
    if (!familyName.trim() || !givenNames.trim() || !dob) {
      setError("Nom, prénom et date de naissance requis pour la recherche de similarité.");
      return;
    }
    try {
      const res = await registryApi.findSimilar({
        family_name: familyName.trim(),
        given_names: givenNames.trim(),
        date_of_birth: dob,
        sex,
        province_code: addrProv.trim() || undefined,
        commune_code: addrCommune.trim() || undefined,
      });
      setSimilar(res.items);
      setInfo(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche similaires impossible");
    }
  }

  function resetCreateForm() {
    setFamilyName("");
    setPostName("");
    setGivenNames("");
    setOtherNames("");
    setDob("");
    setSex("UNKNOWN");
    setPob("");
    setBirthActNo("");
    setNationality("COD");
    setMaritalStatus("");
    setOccupation("");
    setHeightCm("");
    setEyeColor("");
    setPhone("");
    setEmail("");
    setOriginProvince("");
    setOriginTerritory("");
    setOriginSecteur("");
    setOriginGroupement("");
    setOriginLocalite("");
    setFatherName("");
    setFatherOcc("");
    setFatherNat("COD");
    setMotherName("");
    setMotherOcc("");
    setMotherNat("COD");
    setAddrLine("");
    setAddrLine2("");
    setAddrCity("");
    setAddrProv("");
    setAddrCommune("");
    setSimilar([]);
  }

  async function createDraft(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!postName.trim()) {
      setError("Le postnom est obligatoire (décret FGP / identification RDC).");
      return;
    }
    try {
      const height = heightCm.trim() ? Number(heightCm.replace(",", ".")) : undefined;
      const body = {
        family_name: familyName.trim(),
        post_name: postName.trim(),
        given_names: givenNames.trim(),
        other_names: otherNames.trim() || undefined,
        date_of_birth: dob,
        sex,
        place_of_birth: pob.trim() || undefined,
        birth_certificate_number: birthActNo.trim() || undefined,
        nationality: (nationality.trim() || "COD").toUpperCase(),
        marital_status: maritalStatus || undefined,
        occupation: occupation.trim() || undefined,
        height_cm: Number.isFinite(height) ? height : undefined,
        eye_color: eyeColor.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        origin_province: originProvince.trim() || undefined,
        origin_territory: originTerritory.trim() || undefined,
        origin_secteur: originSecteur.trim() || undefined,
        origin_groupement: originGroupement.trim() || undefined,
        origin_localite: originLocalite.trim() || undefined,
        father_full_name: fatherName.trim() || undefined,
        father_occupation: fatherOcc.trim() || undefined,
        father_nationality: fatherNat.trim() || undefined,
        mother_full_name: motherName.trim() || undefined,
        mother_occupation: motherOcc.trim() || undefined,
        mother_nationality: motherNat.trim() || undefined,
        addresses:
          addrLine.trim() && addrCity.trim()
            ? [
                {
                  address_type: "RESIDENTIAL",
                  line1: addrLine.trim(),
                  line2: addrLine2.trim() || undefined,
                  city: addrCity.trim(),
                  province_code: addrProv.trim() || undefined,
                  commune_code: addrCommune.trim() || undefined,
                  country_code: "COD",
                  is_primary: true,
                },
              ]
            : [],
      };
      const created = await registryApi.createCitizen(body);
      setInfo(
        `Brouillon créé — identifiant interne ${created.id}. Aucun NIN attribué (RB-02).`,
      );
      resetCreateForm();
      await openDetail(created.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  async function submitSelected() {
    if (!selected) return;
    setError(null);
    try {
      const c = await registryApi.submitCitizen(selected.id);
      setSelected(c);
      setInfo("Dossier soumis pour contrôle (PENDING_VALIDATION). Pas de NIN.");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Soumission impossible");
    }
  }

  async function rejectSelected() {
    if (!selected || statusReason.trim().length < 5) {
      setError("Motif requis (min. 5 caractères) pour un rejet / suspension.");
      return;
    }
    try {
      const c = await registryApi.changeStatus(selected.id, "SUSPENDED", statusReason.trim());
      setSelected(c);
      setInfo("Statut → SUSPENDED.");
      setStatusReason("");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changement de statut impossible");
    }
  }

  async function requestComplement() {
    if (!selected || statusReason.trim().length < 5) {
      setError("Motif requis pour demander un complément.");
      return;
    }
    try {
      const c = await registryApi.changeStatus(selected.id, "DRAFT", statusReason.trim());
      setSelected(c);
      setInfo("Retour en brouillon (à compléter).");
      setStatusReason("");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    }
  }

  async function resolveDup(id: string, decision: "FALSE_POSITIVE" | "CONFIRMED_DUPLICATE") {
    if (dupJustification.trim().length < 10) {
      setError("Justification min. 10 caractères pour résoudre un doublon.");
      return;
    }
    try {
      await registryApi.resolveDuplicate(id, decision, dupJustification.trim());
      setInfo(
        decision === "FALSE_POSITIVE"
          ? "Marqué comme faux positif — pas de fusion."
          : "Doublon confirmé — fusion uniquement via procédure merge (permission dédiée).",
      );
      setDupJustification("");
      if (selected) {
        const dups = await registryApi.getDuplicates(selected.id, false);
        setDuplicates(dups);
        const hist = await registryApi.getHistory(selected.id);
        setHistory(hist.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Résolution impossible");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Population / FGP</h1>
        <p>
          Module 5 — référentiel central (identifiant interne ≠ NIN). Dossiers Module 2 + santé /
          filiation / rectification / événements. Attribution NIN :{" "}
          <Link to="/conformite">conformité</Link> · <Link to="/nic">NIN</Link>.
        </p>
      </div>

      {health ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div className="stat-chip">
            <div className="muted">Dossiers</div>
            <strong>{health.citizens_total}</strong>
          </div>
          <div className="stat-chip">
            <div className="muted">Avec NIC</div>
            <strong>{health.with_nic}</strong>
          </div>
          <div className="stat-chip">
            <div className="muted">Sans NIC</div>
            <strong>{health.without_nic}</strong>
          </div>
          <div className="stat-chip">
            <div className="muted">Doublons OPEN</div>
            <strong>{health.open_duplicates}</strong>
          </div>
          <div className="stat-chip">
            <div className="muted">NIN officiel</div>
            <strong>{health.official_nin_format_confirmed ? "oui" : "non confirmé"}</strong>
          </div>
        </div>
      ) : null}

      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          <div className="tab-row">
            <button
              type="button"
              className={mode === "liste" ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setMode("liste");
                setSelected(null);
              }}
            >
              Liste / recherche
            </button>
            <button
              type="button"
              className={mode === "creer" ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setMode("creer");
                setSelected(null);
                setError(null);
                setInfo(null);
              }}
            >
              Nouveau dossier
            </button>
            {selected && mode === "detail" ? (
              <button type="button" className="btn-primary" disabled>
                Fiche ouverte
              </button>
            ) : null}
          </div>

          {error ? <div className="login-error">{error}</div> : null}
          {info ? <div className="success-banner">{info}</div> : null}

          {mode === "liste" ? (
            <>
              <form
                className="panel"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void load();
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ flex: "1 1 220px" }}>
                    Recherche
                    <input
                      className="form-control"
                      placeholder="Nom, prénom, NIC…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </label>
                  <label style={{ flex: "0 1 160px" }}>
                    Statut
                    <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s || "all"} value={s}>
                          {s || "Tous"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? "…" : "Rechercher"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    {showAdvanced ? "Masquer filtres" : "Recherche avancée"}
                  </button>
                </div>
                {showAdvanced ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <label style={{ flex: "1 1 120px" }}>
                      Province
                      <input className="form-control" value={province} onChange={(e) => setProvince(e.target.value)} />
                    </label>
                    <label style={{ flex: "1 1 120px" }}>
                      Commune
                      <input className="form-control" value={commune} onChange={(e) => setCommune(e.target.value)} />
                    </label>
                    <label style={{ flex: "1 1 160px" }}>
                      Lieu de naissance
                      <input
                        className="form-control"
                        value={placeOfBirth}
                        onChange={(e) => setPlaceOfBirth(e.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </form>

              <div className="panel">
                <p className="muted small">{total} dossier(s)</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Sexe</th>
                      <th>Naissance</th>
                      <th>Statut</th>
                      <th>Province</th>
                      <th>NIC</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          Aucun résultat.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id}>
                          <td>{[r.family_name, r.given_names].filter(Boolean).join(" ")}</td>
                          <td>{r.sex || "—"}</td>
                          <td>{r.date_of_birth || "—"}</td>
                          <td>
                            <span className="status-pill">{r.status || "—"}</span>
                          </td>
                          <td>{r.province_code || "—"}</td>
                          <td>
                            <code>{r.nic || "—"}</code>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => void openDetail(r.id)}
                            >
                              Ouvrir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mode === "creer" ? (
            <form className="panel" onSubmit={(e) => void createDraft(e)}>
              <h2 className="panel-title">Fiche d&apos;identification FGP (brouillon)</h2>
              <p className="muted small">
                Champs alignés sur le décret n° 22/07 du 2 mars 2022 (art. 8) et la pratique
                d&apos;identification RDC (nom / postnom / prénom). Aucun NIN n&apos;est attribué ici.
                Photo, empreintes et signature = modules biométrie / production CIN.
              </p>

              <h3>1. Identité</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <label>
                  Nom *
                  <input className="form-control" required value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
                </label>
                <label>
                  Postnom *
                  <input className="form-control" required value={postName} onChange={(e) => setPostName(e.target.value)} />
                </label>
                <label>
                  Prénom(s) *
                  <input className="form-control" required value={givenNames} onChange={(e) => setGivenNames(e.target.value)} />
                </label>
                <label>
                  Autres noms
                  <input className="form-control" value={otherNames} onChange={(e) => setOtherNames(e.target.value)} />
                </label>
                <label>
                  Sexe *
                  <select className="form-control" required value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="UNKNOWN">Inconnu</option>
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Féminin</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </label>
                <label>
                  Date de naissance *
                  <input className="form-control" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
                </label>
                <label>
                  Lieu de naissance
                  <input
                    className="form-control"
                    placeholder="Ville / commune de naissance"
                    value={pob}
                    onChange={(e) => setPob(e.target.value)}
                  />
                </label>
                <label>
                  N° acte de naissance
                  <input className="form-control" value={birthActNo} onChange={(e) => setBirthActNo(e.target.value)} />
                </label>
                <label>
                  Nationalité *
                  <input className="form-control" required maxLength={3} value={nationality} onChange={(e) => setNationality(e.target.value.toUpperCase())} />
                </label>
                <label>
                  État civil
                  <select className="form-control" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                    <option value="">—</option>
                    <option value="SINGLE">Célibataire</option>
                    <option value="MARRIED">Marié(e)</option>
                    <option value="DIVORCED">Divorcé(e)</option>
                    <option value="WIDOWED">Veuf / veuve</option>
                  </select>
                </label>
                <label>
                  Profession
                  <input className="form-control" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                </label>
                <label>
                  Taille (cm)
                  <input className="form-control" inputMode="decimal" placeholder="ex. 170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                </label>
                <label>
                  Couleur des yeux
                  <input className="form-control" value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} />
                </label>
              </div>

              <h3>2. Contacts</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <label>
                  Téléphone
                  <input className="form-control" placeholder="+243…" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label>
                  Messagerie électronique
                  <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
              </div>

              <h3>3. Province d&apos;origine (art. 8)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
                <label>
                  Province d&apos;origine
                  <input className="form-control" value={originProvince} onChange={(e) => setOriginProvince(e.target.value)} />
                </label>
                <label>
                  Territoire
                  <input className="form-control" value={originTerritory} onChange={(e) => setOriginTerritory(e.target.value)} />
                </label>
                <label>
                  Secteur / chefferie
                  <input className="form-control" value={originSecteur} onChange={(e) => setOriginSecteur(e.target.value)} />
                </label>
                <label>
                  Groupement
                  <input className="form-control" value={originGroupement} onChange={(e) => setOriginGroupement(e.target.value)} />
                </label>
                <label>
                  Localité
                  <input className="form-control" value={originLocalite} onChange={(e) => setOriginLocalite(e.target.value)} />
                </label>
              </div>

              <h3>4. Filiation</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <label>
                  Nom complet du père
                  <input className="form-control" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
                </label>
                <label>
                  Profession du père
                  <input className="form-control" value={fatherOcc} onChange={(e) => setFatherOcc(e.target.value)} />
                </label>
                <label>
                  Nationalité du père
                  <input className="form-control" maxLength={3} value={fatherNat} onChange={(e) => setFatherNat(e.target.value.toUpperCase())} />
                </label>
                <label>
                  Nom complet de la mère
                  <input className="form-control" value={motherName} onChange={(e) => setMotherName(e.target.value)} />
                </label>
                <label>
                  Profession de la mère
                  <input className="form-control" value={motherOcc} onChange={(e) => setMotherOcc(e.target.value)} />
                </label>
                <label>
                  Nationalité de la mère
                  <input className="form-control" maxLength={3} value={motherNat} onChange={(e) => setMotherNat(e.target.value.toUpperCase())} />
                </label>
              </div>

              <h3>5. Adresse de domicile / résidence</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
                <label>
                  Avenue / avenue n° *
                  <input
                    className="form-control"
                    placeholder="Avenue + numéro"
                    value={addrLine}
                    onChange={(e) => setAddrLine(e.target.value)}
                  />
                </label>
                <label>
                  Quartier / référence
                  <input className="form-control" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} />
                </label>
                <label>
                  Ville / cité *
                  <input className="form-control" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                </label>
                <label>
                  Commune
                  <input className="form-control" value={addrCommune} onChange={(e) => setAddrCommune(e.target.value)} />
                </label>
                <label>
                  Province (résidence)
                  <input className="form-control" value={addrProv} onChange={(e) => setAddrProv(e.target.value)} />
                </label>
              </div>
              <p className="muted small">Adresse enregistrée si avenue et ville sont renseignées.</p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => void checkSimilar()}>
                  Chercher dossiers similaires
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer brouillon FGP
                </button>
              </div>
              {similar.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <p className="muted">
                    {similar.length} candidat(s) — revue humaine requise, pas de fusion automatique (RB-05).
                  </p>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Naissance</th>
                        <th>Statut</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {similar.map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.family_name} {s.post_name ? `${s.post_name} ` : ""}
                            {s.given_names}
                          </td>
                          <td>{s.date_of_birth}</td>
                          <td>{s.status}</td>
                          <td>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => void openDetail(s.id)}>
                              Ouvrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </form>
          ) : null}

          {mode === "detail" && selected ? (
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 className="panel-title" style={{ marginBottom: 4 }}>
                    {[selected.family_name, selected.post_name, selected.given_names]
                      .filter(Boolean)
                      .join(" ")}
                  </h2>
                  <p className="muted small">
                    Statut <span className="status-pill">{selected.status}</span>
                    {" · "}
                    NIC {selected.nic ? <code>{selected.nic}</code> : <em>non attribué</em>}
                    {" · "}
                    MAJ {selected.updated_at ? new Date(selected.updated_at).toLocaleString() : "—"}
                  </p>
                  <p className="muted small">
                    ID interne (technique) : <code>{selected.id}</code> — distinct du NIN
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {selected.status === "DRAFT" ? (
                    <button type="button" className="btn-primary" onClick={() => void submitSelected()}>
                      Soumettre
                    </button>
                  ) : null}
                  {selected.status === "PENDING_VALIDATION" ? (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void requestComplement()}>
                        À compléter
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void rejectSelected()}>
                        Rejeter
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setMode("liste");
                      setSelected(null);
                    }}
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {(selected.status === "PENDING_VALIDATION" || selected.status === "DRAFT") && (
                <label style={{ display: "block", maxWidth: 480, marginTop: 8 }}>
                  Motif (rejet / complément)
                  <input
                    className="form-control"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Motif obligatoire pour rejet ou complément"
                  />
                </label>
              )}

              <div className="tab-row" style={{ marginTop: 16 }}>
                {(
                  [
                    ["identite", "Identité"],
                    ["adresse", "Adresse"],
                    ["filiation", "Filiation"],
                    ["controles", "Contrôles / doublons"],
                    ["rectification", "Rectification"],
                    ["historique", "Historique"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={tab === k ? "btn-primary" : "btn-secondary"}
                    onClick={() => setTab(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "identite" ? (
                <ul className="muted">
                  <li>Nom : {selected.family_name}</li>
                  <li>Postnom : {selected.post_name || "—"}</li>
                  <li>Prénom(s) : {selected.given_names}</li>
                  <li>Autres noms : {selected.other_names || "—"}</li>
                  <li>Sexe : {selected.sex}</li>
                  <li>Naissance : {selected.date_of_birth}</li>
                  <li>Lieu : {selected.place_of_birth || "—"}</li>
                  <li>N° acte de naissance : {selected.birth_certificate_number || "—"}</li>
                  <li>Nationalité : {selected.nationality || "—"}</li>
                  <li>État civil : {selected.marital_status || "—"}</li>
                  <li>Profession : {selected.occupation || "—"}</li>
                  <li>Taille : {selected.height_cm != null ? `${selected.height_cm} cm` : "—"}</li>
                  <li>Yeux : {selected.eye_color || "—"}</li>
                  <li>Téléphone : {selected.phone || "—"}</li>
                  <li>E-mail : {selected.email || "—"}</li>
                  <li>
                    Origine :{" "}
                    {[
                      selected.origin_province,
                      selected.origin_territory,
                      selected.origin_secteur,
                      selected.origin_groupement,
                      selected.origin_localite,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </li>
                  <li>
                    NIN / NIC :{" "}
                    {selected.nic || (
                      <>
                        non attribué — voir <Link to="/nic">module NIN</Link>
                      </>
                    )}
                  </li>
                </ul>
              ) : null}

              {tab === "adresse" ? (
                selected.addresses && selected.addresses.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Adresse</th>
                        <th>Ville</th>
                        <th>Province</th>
                        <th>Commune</th>
                        <th>Primaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.addresses.map((a, i) => (
                        <tr key={a.id || i}>
                          <td>{a.address_type}</td>
                          <td>
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ""}
                          </td>
                          <td>{a.city}</td>
                          <td>{a.province_code || "—"}</td>
                          <td>{a.commune_code || "—"}</td>
                          <td>{a.is_primary ? "oui" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">Aucune adresse enregistrée.</p>
                )
              ) : null}

              {tab === "filiation" ? (
                <div>
                  <p className="muted small">
                    Filiation déclarative (fiche FGP) — distincte d&apos;une preuve juridique d&apos;acte.
                  </p>
                  <ul className="muted">
                    <li>
                      Père : {selected.father_full_name || "—"}
                      {selected.father_occupation ? ` · ${selected.father_occupation}` : ""}
                      {selected.father_nationality ? ` · ${selected.father_nationality}` : ""}
                    </li>
                    <li>
                      Mère : {selected.mother_full_name || "—"}
                      {selected.mother_occupation ? ` · ${selected.mother_occupation}` : ""}
                      {selected.mother_nationality ? ` · ${selected.mother_nationality}` : ""}
                    </li>
                  </ul>
                  <h3>Relations liées (dossiers FGP)</h3>
                  {relations.length === 0 ? (
                    <p className="muted">Aucune relation dossier↔dossier.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dossier lié</th>
                          <th>Base</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relations.map((r) => (
                          <tr key={r.id}>
                            <td>{r.relation_type}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() =>
                                  void openDetail(
                                    r.citizen_id === selected.id
                                      ? r.related_citizen_id
                                      : r.citizen_id,
                                  )
                                }
                              >
                                {(r.citizen_id === selected.id
                                  ? r.related_citizen_id
                                  : r.citizen_id
                                ).slice(0, 8)}
                                …
                              </button>
                            </td>
                            <td className="muted small">{r.legal_basis || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, maxWidth: 560 }}>
                    <input
                      className="form-control"
                      placeholder="UUID dossier lié"
                      value={relRelatedId}
                      onChange={(e) => setRelRelatedId(e.target.value)}
                    />
                    <select className="form-control" value={relType} onChange={(e) => setRelType(e.target.value)}>
                      <option value="PARENT">PARENT</option>
                      <option value="CHILD">CHILD</option>
                      <option value="SPOUSE">SPOUSE</option>
                      <option value="GUARDIAN">GUARDIAN</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        void (async () => {
                          if (!selected || !relRelatedId.trim()) return;
                          try {
                            await fgpApi.addRelation(selected.id, {
                              related_citizen_id: relRelatedId.trim(),
                              relation_type: relType,
                            });
                            setInfo("Relation ajoutée.");
                            setRelRelatedId("");
                            setRelations(await fgpApi.listRelations(selected.id));
                            setHistory((await fgpApi.getHistory(selected.id)).items);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Relation impossible");
                          }
                        })();
                      }}
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === "controles" ? (
                <div>
                  <p className="muted small">
                    Les correspondances sont des candidats à examiner. Aucune fusion automatique.
                    Fusion contrôlée = permission merge + justification.
                  </p>
                  <label style={{ display: "block", maxWidth: 480 }}>
                    Justification résolution / fusion
                    <input
                      className="form-control"
                      value={dupJustification}
                      onChange={(e) => setDupJustification(e.target.value)}
                      placeholder="Min. 10 caractères"
                    />
                  </label>
                  <label style={{ display: "block", maxWidth: 480 }}>
                    Cible fusion (UUID survivant)
                    <input
                      className="form-control"
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      placeholder="UUID dossier à conserver"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{ marginBottom: 12 }}
                    onClick={() => {
                      void (async () => {
                        if (!selected || !mergeTargetId.trim() || dupJustification.trim().length < 10) {
                          setError("Cible UUID + justification (≥10) requis pour fusion.");
                          return;
                        }
                        try {
                          const target = mergeTargetId.trim();
                          await registryApi.mergeCitizens(
                            selected.id,
                            target,
                            dupJustification.trim(),
                          );
                          setInfo("Fusion contrôlée effectuée (source → MERGED).");
                          setMergeTargetId("");
                          await openDetail(target);
                          void load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Fusion impossible");
                        }
                      })();
                    }}
                  >
                    Fusionner ce dossier → cible
                  </button>
                  {duplicates.length === 0 ? (
                    <p className="muted">Aucun doublon enregistré.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Autre dossier</th>
                          <th>Naissance</th>
                          <th>Score</th>
                          <th>Statut</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {[d.other_family_name, d.other_given_names].filter(Boolean).join(" ") ||
                                d.other_citizen_id}
                            </td>
                            <td>{d.other_date_of_birth || "—"}</td>
                            <td>{d.score}</td>
                            <td>{d.status}</td>
                            <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {d.other_citizen_id ? (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => void openDetail(d.other_citizen_id!)}
                                >
                                  Ouvrir
                                </button>
                              ) : null}
                              {d.status === "OPEN" ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => void resolveDup(d.id, "FALSE_POSITIVE")}
                                  >
                                    Faux positif
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => void resolveDup(d.id, "CONFIRMED_DUPLICATE")}
                                  >
                                    Confirmer doublon
                                  </button>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}

              {tab === "rectification" ? (
                <div style={{ maxWidth: 480 }}>
                  <p className="muted small">
                    Demande historisée — non appliquée automatiquement (cahier §9.2). Aucun NIN modifié ici.
                  </p>
                  <label>
                    Champ
                    <select className="form-control" value={corrField} onChange={(e) => setCorrField(e.target.value)}>
                      <option value="family_name">family_name</option>
                      <option value="given_names">given_names</option>
                      <option value="place_of_birth">place_of_birth</option>
                      <option value="date_of_birth">date_of_birth</option>
                      <option value="sex">sex</option>
                    </select>
                  </label>
                  <label>
                    Valeur proposée
                    <input className="form-control" value={corrValue} onChange={(e) => setCorrValue(e.target.value)} />
                  </label>
                  <label>
                    Motif (≥10)
                    <input className="form-control" value={corrReason} onChange={(e) => setCorrReason(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      void (async () => {
                        if (!selected || corrValue.trim().length < 1 || corrReason.trim().length < 10) {
                          setError("Valeur et motif (min. 10) requis.");
                          return;
                        }
                        try {
                          const r = await fgpApi.requestCorrection({
                            citizen_id: selected.id,
                            field_name: corrField,
                            proposed_value: corrValue.trim(),
                            reason: corrReason.trim(),
                          });
                          setInfo(r.message);
                          setCorrValue("");
                          setCorrReason("");
                          setHistory((await fgpApi.getHistory(selected.id)).items);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Demande impossible");
                        }
                      })();
                    }}
                  >
                    Soumettre demande
                  </button>
                </div>
              ) : null}

              {tab === "historique" ? (
                history.length === 0 ? (
                  <p className="muted">Aucun événement.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Événement</th>
                        <th>Détail</th>
                        <th>Acteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.created_at).toLocaleString()}</td>
                          <td>{h.event_type}</td>
                          <td>
                            <code style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>
                              {JSON.stringify(h.payload)}
                            </code>
                          </td>
                          <td className="muted small">{h.actor_id || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
