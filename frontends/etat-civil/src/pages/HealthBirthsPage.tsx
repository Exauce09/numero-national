import { FormEvent, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ActFormShell from "../components/ActFormShell";
import { getActFormSchema } from "../ecActForms";
import { addPerson, displayName, findDuplicatePerson, generateBirthDossierId, listPersons } from "../registry";
import { getHealthSession, findFacilityByUsername } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";
import { pushHealthNotification } from "../healthPrefs";

type BirthCoupon = {
  id_naissance: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "M" | "F";
  date_naissance: string;
  mother_name: string;
  facility_name: string;
  declaration_id: string;
};

const emptyParent = { nom: "", postnom: "", prenom: "", date_naissance: "" };

export default function HealthBirthsPage() {
  const session = getHealthSession()!;
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [heureNaissance, setHeureNaissance] = useState("");
  const [naissanceMultiple, setNaissanceMultiple] = useState(false);
  const [typeAccouchement, setTypeAccouchement] = useState("");
  const [etatMorphologique, setEtatMorphologique] = useState("");
  const [adresseMere, setAdresseMere] = useState("");
  const [mother, setMother] = useState(emptyParent);
  const [father, setFather] = useState(emptyParent);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<BirthCoupon | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "BIRTH");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCoupon(null);
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
    if (!mother.nom.trim() || !mother.prenom.trim()) {
      setError("Nom et prénom de la mère sont obligatoires.");
      return;
    }
    try {
      const resolveParent = (
        data: typeof mother,
        sex: "M" | "F",
      ) => {
        const nomP = data.nom.trim();
        const postnomP = data.postnom.trim();
        const prenomP = data.prenom.trim();
        const dob = data.date_naissance.trim();
        if (dob) {
          const dup = findDuplicatePerson({
            nom: nomP,
            postnom: postnomP,
            prenom: prenomP,
            date_naissance: dob,
            sexe: sex,
          });
          if (dup) return dup;
          return addPerson({
            nom: nomP,
            postnom: postnomP,
            prenom: prenomP,
            sexe: sex,
            date_naissance: dob,
            lieu_naissance: session.facilityName,
            etat_civil: "MARIE",
          });
        }
        const existing = listPersons().find(
          (p) =>
            p.sexe === sex &&
            p.nom.trim().toLowerCase() === nomP.toLowerCase() &&
            p.postnom.trim().toLowerCase() === postnomP.toLowerCase() &&
            p.prenom.trim().toLowerCase() === prenomP.toLowerCase(),
        );
        if (existing) return existing;
        return addPerson({
          nom: nomP,
          postnom: postnomP,
          prenom: prenomP,
          sexe: sex,
          date_naissance: "1900-01-01",
          lieu_naissance: session.facilityName,
          etat_civil: "MARIE",
        });
      };

      const motherPerson = resolveParent(mother, "F");
      const fatherPerson =
        father.nom.trim() && father.prenom.trim() ? resolveParent(father, "M") : null;

      const facility = findFacilityByUsername(session.username);
      const idNaissance = generateBirthDossierId(dateNaissance, {
        provinceName: facility?.province,
      });
      const childNom = nom.trim();
      const childPostnom = postnom.trim() || motherPerson.postnom || fatherPerson?.postnom || "";
      const childPrenom = prenom.trim();
      const decl = await notifyEtatCivil({
        type: "BIRTH",
        facilityName: session.facilityName,
        payload: {
          facility_id: session.facilityId,
          facility_name: session.facilityName,
          commune_code: session.commune_code,
          commune_name: session.commune_name,
          notification_type: "NAISSANCE",
          id_naissance: idNaissance,
          child_nom: childNom,
          child_postnom: childPostnom,
          child_prenom: childPrenom,
          sexe,
          date_naissance: dateNaissance,
          heure_naissance: heureNaissance || null,
          naissance_multiple: naissanceMultiple,
          type_accouchement: typeAccouchement || null,
          etat_morphologique: etatMorphologique || null,
          mother_id: motherPerson.id,
          mother_name: displayName(motherPerson),
          adresse_mere: adresseMere.trim() || null,
          father_id: fatherPerson?.id ?? null,
          father_name: fatherPerson ? displayName(fatherPerson) : null,
          lieu_naissance: session.facilityName,
          declarant_qualite: "MERE",
          declarant_name: displayName(motherPerson),
        },
      });
      const birthCoupon: BirthCoupon = {
        id_naissance: idNaissance,
        nom: childNom,
        postnom: childPostnom,
        prenom: childPrenom,
        sexe,
        date_naissance: dateNaissance,
        mother_name: displayName(motherPerson),
        facility_name: session.facilityName,
        declaration_id: decl.id,
      };
      setCoupon(birthCoupon);
      pushHealthNotification({
        title: "Notification de naissance transmise",
        body: `${childPrenom} ${childNom} — ID naissance ${idNaissance} (réf. ${decl.id.slice(0, 8)}).`,
        href: "/sante/births",
      });
      setMessage(
        `Notification transmise à l'état civil — ID naissance provisoire ${idNaissance} (réf. ${decl.id.slice(0, 8)}). L'officier établira l'acte officiel.`,
      );
      setNom("");
      setPostnom("");
      setPrenom("");
      setDateNaissance("");
      setHeureNaissance("");
      setNaissanceMultiple(false);
      setTypeAccouchement("");
      setEtatMorphologique("");
      setAdresseMere("");
      setMother(emptyParent);
      setFather(emptyParent);
      bump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  const qrValue = coupon
    ? JSON.stringify({
        type: "nn_birth_notification",
        v: 2,
        id_naissance: coupon.id_naissance,
        family_name: coupon.nom,
        given_names: coupon.prenom,
        sex: coupon.sexe,
        dob: coupon.date_naissance,
        declaration_id: coupon.declaration_id,
        facility: coupon.facility_name,
      })
    : "";

  return (
    <ActFormShell schema={getActFormSchema("notif_naissance")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          {message ? <div className="success-banner full">{message}</div> : null}

          <div className="full">
            <div className="success-banner" style={{ marginBottom: "0.75rem" }}>
              Même structure que l&apos;acte EC (enfant + filiation). Ici ={" "}
              <strong>notification</strong> vers le bureau ; l&apos;officier établit l&apos;acte
              officiel.
            </div>
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
            <input
              className="form-control"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Sexe *</label>
            <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as "M" | "F")}>
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
              onChange={(e) => setDateNaissance(e.target.value)}
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
          <div className="full">
            <label className="form-label">Lieu de naissance</label>
            <input className="form-control" value={session.facilityName} disabled readOnly />
          </div>

          <div className="full">
            <h3 className="panel-title">Mère *</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Saisissez directement l&apos;identité de la mère (pas besoin de la chercher dans le
              registre).
            </p>
          </div>
          <div>
            <label className="form-label">Nom *</label>
            <input
              className="form-control"
              value={mother.nom}
              onChange={(e) => setMother({ ...mother, nom: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">Postnom</label>
            <input
              className="form-control"
              value={mother.postnom}
              onChange={(e) => setMother({ ...mother, postnom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Prénom(s) *</label>
            <input
              className="form-control"
              value={mother.prenom}
              onChange={(e) => setMother({ ...mother, prenom: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">Date de naissance (si connue)</label>
            <input
              className="form-control"
              type="date"
              value={mother.date_naissance}
              onChange={(e) => setMother({ ...mother, date_naissance: e.target.value })}
            />
          </div>
          <div className="full">
            <label className="form-label">Adresse de la mère</label>
            <input
              className="form-control"
              value={adresseMere}
              onChange={(e) => setAdresseMere(e.target.value)}
              placeholder="Commune, quartier, avenue…"
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Père (le cas échéant)</h3>
          </div>
          <div>
            <label className="form-label">Nom</label>
            <input
              className="form-control"
              value={father.nom}
              onChange={(e) => setFather({ ...father, nom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Postnom</label>
            <input
              className="form-control"
              value={father.postnom}
              onChange={(e) => setFather({ ...father, postnom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Prénom(s)</label>
            <input
              className="form-control"
              value={father.prenom}
              onChange={(e) => setFather({ ...father, prenom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Date de naissance</label>
            <input
              className="form-control"
              type="date"
              value={father.date_naissance}
              onChange={(e) => setFather({ ...father, date_naissance: e.target.value })}
            />
          </div>

          <div className="full">
            <button className="btn-primary" type="submit" style={{ width: "auto", minWidth: 280 }}>
              Transmettre la notification à l&apos;état civil
            </button>
          </div>
        </form>
      </div>

      {coupon ? (
        <div className="panel print-area" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Accusé de notification — ID naissance {coupon.id_naissance}</div>
          <div className="act-print-card" style={{ marginTop: "0.75rem" }}>
            <div className="act-print-header">
              <img src="/logo-rdc.jpg" alt="RDC" />
              <div>
                <strong>République Démocratique du Congo</strong>
                <div>État civil · Structure sanitaire</div>
                <div>Notification de naissance (pas un acte officiel)</div>
              </div>
            </div>
            <div className="act-print-body">
              <div className="act-print-meta">
                <div>
                  <span className="muted">ID naissance</span>
                  <strong>{coupon.id_naissance}</strong>
                </div>
                <div>
                  <span className="muted">Enfant</span>
                  <strong>
                    {coupon.prenom} {coupon.postnom} {coupon.nom}
                  </strong>
                </div>
                <div>
                  <span className="muted">Date</span>
                  <strong>{coupon.date_naissance}</strong>
                </div>
                <div>
                  <span className="muted">Mère</span>
                  <strong>{coupon.mother_name}</strong>
                </div>
                <div>
                  <span className="muted">Structure</span>
                  <strong>{coupon.facility_name}</strong>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
                <QRCodeSVG value={qrValue} size={128} />
              </div>
            </div>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
            Imprimer l&apos;accusé
          </button>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Notifications envoyées ({rows.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Enfant</th>
              <th>Date</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Aucune notification pour le moment.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    {String(d.payload.child_prenom ?? "")} {String(d.payload.child_nom ?? "")}
                  </td>
                  <td>{String(d.payload.date_naissance ?? "—")}</td>
                  <td>{d.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ActFormShell>
  );
}
