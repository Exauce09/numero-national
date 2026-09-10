import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  addPerson,
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

export default function BirthsPage() {
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [geoNaissance, setGeoNaissance] = useState<GeoSelection>({});
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [, bump] = useState(0);

  const acts = listActs("BIRTH");
  const inherited = inheritParentOrigin(father, mother);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mother) {
      setError("La mère est obligatoire.");
      return;
    }
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
      return;
    }
    try {
      const lieuNaissance = geoNaissance.label || "";
      const link = inheritParentOrigin(father, mother);
      const child = addPerson({
        nom: nom.trim(),
        postnom: postnom.trim() || mother.postnom || father?.postnom || "",
        prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieuNaissance,
        etat_civil: "CELIBATAIRE",
        mother_id: mother.id,
        father_id: father?.id,
        nationalite: personNationalite(father ?? mother),
      });
      const commune = getOfficerCommune();
      const payload = {
        child_id: child.id,
        nom: child.nom,
        postnom: child.postnom,
        prenom: child.prenom,
        sexe: child.sexe,
        date_naissance: child.date_naissance,
        lieu_naissance: child.lieu_naissance,
        geo_naissance: geoNaissance,
        commune_code: geoNaissance.commune_code || commune.code,
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
        note: "Nouveau-né lié aux informations du père/mère",
        latitude: gpsLat,
        longitude: gpsLng,
        gps_captured_at: gpsLat != null ? new Date().toISOString() : null,
      };
      const act = addAct("BIRTH", payload, child.nic);
      setCreated(act);
      setNom("");
      setPostnom("");
      setPrenom("");
      setDateNaissance("");
      setGeoNaissance({});
      setMother(null);
      setFather(null);
      setGpsLat(null);
      setGpsLng(null);
      bump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
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
          setGeoNaissance((prev) => ({
            ...prev,
            province_name: g.province || prev.province_name,
            ville_name: g.ville || prev.ville_name,
            commune_name: g.commune || prev.commune_name,
            label:
              g.display_name ||
              [g.province, g.ville, g.commune].filter(Boolean).join(" · ") ||
              prev.label,
          }));
        }}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
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
          <div className="full">
            <label className="form-label">Lieu de naissance</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoNaissance}
              onChange={setGeoNaissance}
              label="Lieu de naissance"
            />
          </div>
          <div className="full">
            <PersonPicker label="Mère" value={mother} onChange={setMother} required />
          </div>
          <div className="full">
            <PersonPicker label="Père (optionnel)" value={father} onChange={setFather} />
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
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} type="submit">
              Enregistrer la naissance
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
