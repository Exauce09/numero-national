import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import ActWorkflowPanel from "../components/ActWorkflowPanel";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GeoPlaceLookup from "../components/GeoPlaceLookup";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import { getOfficerCommune } from "../commune";
import { CIMETIERES_RDC, cimetiereLabel } from "../data/cimetieresRdc";
import { TYPE_DECES_OPTIONS, typeDecesLabel, type TypeDeces } from "../deathType";
import { CAUSE_DECES_OPTIONS, causeByCode, gbdFromCauseCode } from "../eacCauses";
import { getActFormSchema } from "../ecActForms";
import { notifyFromHealthForm, type HealthFormContext } from "../healthFormMode";
import {
  addAct,
  displayName,
  suggestDelaiEnregistrement,
  type Act,
  type DelaiEnregistrement,
  type Person,
} from "../registry";

/** `health` : même formulaire chez l'infirmier titulaire — transmet une notification au bureau. */
export default function DeathsPage({ health }: { health?: HealthFormContext } = {}) {
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [declarant, setDeclarant] = useState<Person | null>(null);
  const [qualiteDeclarant, setQualiteDeclarant] = useState("PROCHE");
  const [typeDeces, setTypeDeces] = useState<TypeDeces>("DECES");
  const [etatMatrimonial, setEtatMatrimonial] = useState("");
  const [cause, setCause] = useState("");
  const [causeCode, setCauseCode] = useState("");
  const [mccodComplet, setMccodComplet] = useState(false);
  const [delaiEnregistrement, setDelaiEnregistrement] = useState<DelaiEnregistrement>("DANS_DELAI");
  const [survenuHorsRdc, setSurvenuHorsRdc] = useState(false);
  const [heureDeces, setHeureDeces] = useState("");
  const [medecin, setMedecin] = useState("");
  const [certificatRef, setCertificatRef] = useState("");
  const [geoDeces, setGeoDeces] = useState<GeoSelection>(
    health
      ? {
          label: health.facilityName,
          province_name: health.province,
          ville_name: health.ville,
          commune_name: health.commune_name,
          commune_code: health.commune_code,
        }
      : {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [geoEnterrement, setGeoEnterrement] = useState<GeoSelection>({});
  const [cimetiere, setCimetiere] = useState("");
  const [cimetiereAutre, setCimetiereAutre] = useState("");
  const [geoEnregistrement, setGeoEnregistrement] = useState<GeoSelection>({});
  const [dateDeces, setDateDeces] = useState("");
  const [dateEnterrement, setDateEnterrement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!deceased) {
      setError("L'identité de la personne est obligatoire.");
      return;
    }
    if (!declarant) {
      setError("Le déclarant est obligatoire.");
      return;
    }
    if (!cause.trim()) {
      setError("La cause du décès est obligatoire.");
      return;
    }
    if (!dateDeces) {
      setError("La date du décès est obligatoire.");
      return;
    }
    if (!causeCode && !cause.trim()) {
      setError("Indiquez la cause du décès (code EAC / texte).");
      return;
    }
    if (!geoDeces.province_name && !geoDeces.label) {
      setError("Indiquez le lieu du décès (ex. Tshilenge, Nsele…).");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const commune = getOfficerCommune();
      const lieuDeces =
        geoDeces.label ||
        [geoDeces.commune_name, geoDeces.ville_name, geoDeces.province_name]
          .filter(Boolean)
          .join(" · ");
      const ageAuDeces = (() => {
        if (!deceased.date_naissance || !dateDeces) return null;
        const birth = new Date(deceased.date_naissance);
        const at = new Date(dateDeces);
        if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null;
        let age = at.getFullYear() - birth.getFullYear();
        const m = at.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age -= 1;
        return age;
      })();
      const payload = {
        deceased_id: deceased.id,
        citizen_id: deceased.id,
        deceased_name: displayName(deceased),
        sexe: deceased.sexe,
        date_naissance: deceased.date_naissance,
        age_au_deces: ageAuDeces,
        type_deces: typeDeces,
        type_deces_label: typeDecesLabel(typeDeces),
        mort_ne: typeDeces === "MORT_NE",
        etat_matrimonial_defunt: etatMatrimonial || deceased.etat_civil || null,
        cause_deces: cause.trim() || causeByCode(causeCode)?.label || "",
        cause_code: causeCode || null,
        cause_gbd: causeCode ? gbdFromCauseCode(causeCode) : null,
        mccod_complet: mccodComplet || Boolean(certificatRef.trim() && medecin.trim() && causeCode),
        delai_enregistrement: delaiEnregistrement || suggestDelaiEnregistrement(dateDeces),
        survenu_hors_rdc: survenuHorsRdc,
        heure_deces: heureDeces || null,
        medecin_constatant: medecin.trim() || null,
        certificat_deces_ref: certificatRef.trim() || null,
        lieu_deces: lieuDeces,
        geo_deces: geoDeces,
        province_deces: geoDeces.province_name || null,
        ville_deces: geoDeces.ville_name || null,
        commune_deces: geoDeces.commune_name || null,
        lieu_enterrement: geoEnterrement.label || "",
        lieu_inhumation: geoEnterrement.label || "",
        geo_enterrement: geoEnterrement,
        cimetiere:
          cimetiere === "__autre__" ? cimetiereAutre.trim() : cimetiere.trim(),
        lieu_enregistrement: geoEnregistrement.label || "",
        geo_enregistrement: geoEnregistrement,
        commune_code: geoEnregistrement.commune_code || geoDeces.commune_code || commune.code,
        date_deces: dateDeces,
        date_enterrement: dateEnterrement,
        declarant_id: declarant.id,
        declarant_name: displayName(declarant),
        declarant_qualite: qualiteDeclarant,
        responsable_id: declarant.id,
        responsable_name: displayName(declarant),
      };
      if (health) {
        const decl = await notifyFromHealthForm(health, "DEATH", {
          ...payload,
          deceased_nic: deceased.nic,
        });
        health.onSubmitted({
          declarationId: decl.id,
          refNotification: String(decl.payload.ref_notification ?? ""),
          type: "DEATH",
          personName: displayName(deceased),
        });
        return;
      }
      // Pas de NIC — identifiant interne de la personne uniquement.
      const act = await addAct("DEATH", payload, deceased.id);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ActFormShell
      schema={getActFormSchema("deces")!}
      extraLead={
        health ? (
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={health.onBack}>
              ← Retour à la liste
            </button>
            <p className="muted small">
              Même formulaire que l&apos;état civil : la saisie est transmise au bureau de{" "}
              {health.commune_name}, l&apos;officier établit l&apos;acte officiel.
            </p>
          </>
        ) : null
      }
    >
      <GpsLocatePanel
        title="GPS — lieu du décès"
        onResolved={(g) => setGeoDeces((prev) => applyGpsToGeo(prev, g))}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}

          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Personne à enregistrer
            </h3>
          </div>
          <div className="full filiation-seq">
            <p className="filiation-seq-title">
              <span className="filiation-seq-num">1</span> Personne décédée
            </p>
            <PersonPicker
              label="Identité de la personne"
              value={deceased}
              onChange={(p) => {
                setDeceased(p);
                if (p?.etat_civil && p.etat_civil !== "UNKNOWN") {
                  setEtatMatrimonial(p.etat_civil);
                }
              }}
              required
              hideNic
              excludeDeceased={false}
              addButtonLabel="Saisir / Ajouter la personne"
            />
          </div>
          <div>
            <label className="form-label">Type de décès *</label>
            <select
              className="form-control"
              value={typeDeces}
              onChange={(e) => setTypeDeces(e.target.value as TypeDeces)}
              required
            >
              {TYPE_DECES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Mort-né = enfant mort à la naissance (stillbirth). Décès = personne déjà née vivante.
            </p>
          </div>
          <div>
            <label className="form-label">État matrimonial</label>
            <select
              className="form-control"
              value={etatMatrimonial}
              onChange={(e) => setEtatMatrimonial(e.target.value)}
            >
              <option value="">— (selon dossier)</option>
              <option value="CELIBATAIRE">Célibataire</option>
              <option value="MARIE">Marié(e)</option>
              <option value="DIVORCE">Divorcé(e)</option>
              <option value="VEUF">Veuf / veuve</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date du décès *</label>
            <input
              className="form-control"
              type="date"
              value={dateDeces}
              onChange={(e) => setDateDeces(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Heure du décès</label>
            <input
              className="form-control"
              type="time"
              value={heureDeces}
              onChange={(e) => setHeureDeces(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Cause (code EAC / GBD) *</label>
            <select
              className="form-control"
              value={causeCode}
              onChange={(e) => {
                setCauseCode(e.target.value);
                const opt = causeByCode(e.target.value);
                if (opt && !cause.trim()) setCause(opt.label);
              }}
              required
            >
              <option value="">— Choisir —</option>
              {CAUSE_DECES_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} — {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Cause (texte / précision)</label>
            <input
              className="form-control"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder="Selon certificat / déclaration"
            />
          </div>
          <div>
            <label className="form-label">Délai d&apos;enregistrement</label>
            <select
              className="form-control"
              value={delaiEnregistrement}
              onChange={(e) => setDelaiEnregistrement(e.target.value as DelaiEnregistrement)}
            >
              <option value="DANS_DELAI">Dans le délai (≤ 30 j)</option>
              <option value="HORS_DELAI">Hors délai</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={mccodComplet}
                onChange={(e) => setMccodComplet(e.target.checked)}
              />
              Cause médicalement certifiée (MCCOD complet — indicateur EAC 3.12)
            </label>
            <label
              className="form-label"
              style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
            >
              <input
                type="checkbox"
                checked={survenuHorsRdc}
                onChange={(e) => setSurvenuHorsRdc(e.target.checked)}
              />
              Décès survenu à l&apos;extérieur du pays (indicateur EAC 2.13)
            </label>
          </div>
          <div className="full">
            <GeoPlaceLookup
              label="Lieu du décès"
              value={geoDeces}
              onChange={setGeoDeces}
              required
              placeholder="Tapez un lieu — ex. Tshilenge, Nsele…"
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Constat médical</h3>
          </div>
          <div>
            <label className="form-label">Médecin constatant</label>
            <input className="form-control" value={medecin} onChange={(e) => setMedecin(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Référence du certificat de décès</label>
            <input
              className="form-control"
              value={certificatRef}
              onChange={(e) => setCertificatRef(e.target.value)}
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Déclaration & inhumation</h3>
          </div>
          <div className="full">
            <PersonPicker
              label="Déclarant"
              value={declarant}
              onChange={setDeclarant}
              required
              hideNic
            />
          </div>
          <div>
            <label className="form-label">Qualité du déclarant *</label>
            <select
              className="form-control"
              value={qualiteDeclarant}
              onChange={(e) => setQualiteDeclarant(e.target.value)}
            >
              <option value="CONJOINT">Conjoint(e)</option>
              <option value="PROCHE">Parent / proche</option>
              <option value="AUTORITE">Autorité / structure</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div className="full">
            <GeoPlaceLookup
              label="Lieu d'inhumation"
              value={geoEnterrement}
              onChange={setGeoEnterrement}
              placeholder="Tapez un lieu — ex. commune, ville…"
            />
          </div>
          <div className="full">
            <label className="form-label">Cimetière</label>
            <select
              className="form-control"
              value={
                cimetiere &&
                cimetiere !== "__autre__" &&
                !CIMETIERES_RDC.some((c) => cimetiereLabel(c) === cimetiere)
                  ? "__autre__"
                  : cimetiere
              }
              onChange={(e) => {
                const v = e.target.value;
                setCimetiere(v);
                if (v !== "__autre__") setCimetiereAutre("");
              }}
            >
              <option value="">— Sélectionner un cimetière —</option>
              {CIMETIERES_RDC.map((c) => {
                const label = cimetiereLabel(c);
                return (
                  <option key={label} value={label}>
                    {label}
                  </option>
                );
              })}
              <option value="__autre__">Autre (saisie manuelle)</option>
            </select>
            {cimetiere === "__autre__" ||
            (cimetiere &&
              cimetiere !== "__autre__" &&
              !CIMETIERES_RDC.some((c) => cimetiereLabel(c) === cimetiere)) ? (
              <input
                className="form-control"
                style={{ marginTop: "0.5rem" }}
                value={cimetiere === "__autre__" ? cimetiereAutre : cimetiere}
                onChange={(e) => {
                  setCimetiere("__autre__");
                  setCimetiereAutre(e.target.value);
                }}
                placeholder="Nom du cimetière"
              />
            ) : null}
          </div>
          <div>
            <label className="form-label">Date d&apos;inhumation</label>
            <input
              className="form-control"
              type="date"
              value={dateEnterrement}
              onChange={(e) => setDateEnterrement(e.target.value)}
            />
          </div>
          <div className="full">
            <label className="form-label">Bureau d&apos;enregistrement</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoEnregistrement}
              onChange={setGeoEnregistrement}
              label="Bureau d'enregistrement"
            />
          </div>

          <div className="full">
            <button
              className="btn-primary"
              style={{ width: "auto", minWidth: 200 }}
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Enregistrement…"
                : health
                  ? "Transmettre à l'état civil"
                  : "Enregistrer le décès"}
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">
            Décès enregistré en brouillon — validez-le ci-dessous ou dans la liste Décès.
          </div>
          <p className="muted small">
            Un acte d&apos;état civil n&apos;apparaît dans les totaux / indicateurs qu&apos;après
            validation.{" "}
            <Link to="/manage/deces?focus=drafts">Voir les décès à valider →</Link>
          </p>
          <ActWorkflowPanel
            act={created}
            onUpdated={(a) => setCreated(a)}
          />
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
