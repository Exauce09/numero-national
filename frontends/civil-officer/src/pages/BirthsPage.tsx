import { FormEvent, useMemo, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import GpsLocatePanel from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  addPerson,
  findDuplicateBirthAct,
  findDuplicatePerson,
  getAct,
  inheritParentOrigin,
  listActs,
  personNationalite,
  updateAct,
  type Act,
  type Person,
  type Sexe,
} from "../registry";
import { getOfficerCommune } from "../commune";
import { listFacilityAccounts } from "../healthAuth";
import { HOPITAUX_KEY, loadNamedList, rememberNamed } from "../namedLists";

const MODES_NAISSANCE = [
  { value: "sans_procuration", label: "Sans procuration" },
  { value: "avec_procuration", label: "Par procuration" },
  { value: "jugement_suppletif", label: "Par jugement supplétif" },
  { value: "declaration_tardive", label: "Déclaration tardive" },
] as const;

export default function BirthsPage() {
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [modeNaissance, setModeNaissance] = useState<(typeof MODES_NAISSANCE)[number]["value"]>(
    "sans_procuration",
  );
  const [hopitalNaissance, setHopitalNaissance] = useState("");
  const [hopitalAutre, setHopitalAutre] = useState("");
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
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
  const inherited = inheritParentOrigin(father, mother);
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
      setError("La mère est obligatoire.");
      return;
    }
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
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

    const existingAct = findDuplicateBirthAct({
      nom: identity.nom,
      prenom: identity.prenom,
      postnom: identity.postnom,
      date_naissance: identity.date_naissance,
      mother_id: mother.id,
    });
    if (existingAct) {
      setError(
        `Naissance déjà enregistrée — acte ${existingAct.act_number} (NIC ${existingAct.national_id}). Doublon refusé.`,
      );
      setViewAct(existingAct);
      setCreated(existingAct);
      return;
    }

    const existingPerson = findDuplicatePerson(identity);
    if (existingPerson) {
      setError(
        `Enfant déjà au registre : ${existingPerson.nom} ${existingPerson.prenom} (NIC ${existingPerson.nic}). Doublon refusé.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const lieu = lieuNaissance.trim();
      const link = inheritParentOrigin(father, mother);
      if (hopitalResolved) rememberNamed(HOPITAUX_KEY, hopitalResolved);
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
      });
      const commune = getOfficerCommune();
      const modeLabel = MODES_NAISSANCE.find((m) => m.value === modeNaissance)?.label ?? modeNaissance;
      const payload = {
        child_id: child.id,
        nom: child.nom,
        postnom: child.postnom,
        prenom: child.prenom,
        sexe: child.sexe,
        date_naissance: child.date_naissance,
        lieu_naissance: child.lieu_naissance,
        mode_naissance: modeNaissance,
        mode: modeLabel,
        type_naissance: modeLabel,
        avec_procuration: modeNaissance === "avec_procuration",
        hopital_naissance: hopitalResolved || null,
        geo_naissance: { label: lieu },
        commune_code: commune.code,
        mother_id: mother.id,
        mother_name: `${mother.nom} ${mother.prenom}`,
        mother_nic: mother.nic,
        mother_snapshot: link.mother_snapshot,
        father_id: father?.id ?? null,
        father_name: father ? `${father.nom} ${father.prenom}` : null,
        father_nic: father?.nic ?? null,
        father_snapshot: link.father_snapshot,
        inherited_from: link.source,
        inherited_geo: link.geo,
        province_origine: link.geo.province || null,
        ville_origine: link.geo.ville || null,
        territoire_origine: link.geo.territoire || null,
        secteur_chefferie_commune: link.geo.secteur || null,
        village_origine: link.geo.village || null,
        note: `Nouveau-né — ${modeLabel}`,
        latitude: gpsLat,
        longitude: gpsLng,
        gps_captured_at: gpsLat != null ? new Date().toISOString() : null,
      };
      const act = await addAct("BIRTH", payload, child.nic);
      const syncWarn = act.payload.sync_warning ? String(act.payload.sync_warning) : null;
      if (syncWarn) setWarning(syncWarn);
      setCreated(act);
      setNom("");
      setPostnom("");
      setPrenom("");
      setDateNaissance("");
      setLieuNaissance("");
      setModeNaissance("sans_procuration");
      setHopitalNaissance("");
      setHopitalAutre("");
      setMother(null);
      setFather(null);
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
    national_id: a.national_id,
    nom: String(a.payload.nom ?? ""),
    sexe: String(a.payload.sexe ?? ""),
    date_naissance: String(a.payload.date_naissance ?? ""),
    mode: String(a.payload.mode ?? a.payload.mode_naissance ?? ""),
  }));

  return (
    <div>
      <h2 className="page-title">Naissances</h2>
      <p className="page-lead">
        Enregistrement des nouveau-nés non enregistrés en structure sanitaire.
      </p>
      <GpsLocatePanel
        title="Localisation GPS du lieu"
        onResolved={(g) => {
          setGpsLat(g.latitude);
          setGpsLng(g.longitude);
          if (!lieuNaissance.trim() && g.display_name) {
            setLieuNaissance(g.display_name);
          }
        }}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          {warning ? (
            <div className="full muted small" style={{ color: "#b45309" }}>
              {warning}
            </div>
          ) : null}
          <div>
            <label className="form-label">Nom</label>
            <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Postnom</label>
            <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Prénom</label>
            <input className="form-control" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
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
              required
            />
          </div>
          <div>
            <label className="form-label">Mode de naissance</label>
            <select
              className="form-control"
              value={modeNaissance}
              onChange={(e) =>
                setModeNaissance(e.target.value as (typeof MODES_NAISSANCE)[number]["value"])
              }
            >
              {MODES_NAISSANCE.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <label className="form-label">Lieu de naissance</label>
            <input
              className="form-control"
              value={lieuNaissance}
              onChange={(e) => setLieuNaissance(e.target.value)}
              placeholder="Saisie manuelle"
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
          <div className="full">
            <PersonPicker label="Mère" value={mother} onChange={setMother} required sexFilter="F" />
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
          {inherited.source && inherited.parent ? (
            <div className="full success-banner" style={{ margin: 0 }}>
              Origine liée au {inherited.source === "father" ? "père" : "mère"}{" "}
              <strong>{inherited.parent.name}</strong>
              {inherited.parent.geo_label ? <> — {inherited.parent.geo_label}</> : " (province / ville non renseignées)"}
            </div>
          ) : mother || father ? (
            <div className="full muted small">
              Aucune province/ville trouvée chez les parents — enregistrez d&apos;abord leur recensement
              (origine / adresse).
            </div>
          ) : null}
          <div className="full">
            <button
              className="btn-primary"
              style={{ width: "auto", minWidth: 200 }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Enregistrement…" : "Enregistrer la naissance"}
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de naissance créé — NIC {created.national_id}</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">Actes de naissance</h3>
          <DataToolbar filename="naissances" rows={rows} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>N° acte</th>
              <th>NIC</th>
              <th>Nom</th>
              <th>Sexe</th>
              <th>Naissance</th>
              <th>Mode</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {acts.map((a) => (
              <tr key={a.id}>
                <td>{a.act_number}</td>
                <td>{a.national_id}</td>
                <td>
                  {String(a.payload.nom ?? "")} {String(a.payload.prenom ?? "")}
                </td>
                <td>{String(a.payload.sexe ?? "")}</td>
                <td>{String(a.payload.date_naissance ?? "")}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 640 }}>
            <h3>Acte {viewAct.act_number}</h3>
            <ActPrintCard act={viewAct} />
            <div className="modal-actions">
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
            <textarea className="form-control" rows={12} value={editJson} onChange={(e) => setEditJson(e.target.value)} />
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
    </div>
  );
}
