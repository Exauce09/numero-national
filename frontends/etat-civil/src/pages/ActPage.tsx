import { FormEvent, useEffect, useState } from "react";
import {
  api,
  demoCreateAct,
  demoListActs,
  type CivilAct,
} from "../api";
import { getSession } from "../auth";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";

type Props = { kind: string; title: string };

const FIELDS: Record<string, { key: string; label: string }[]> = {
  births: [
    { key: "child_family_name", label: "Nom de l'enfant" },
    { key: "child_given_names", label: "Prénoms" },
    { key: "sex", label: "Sexe (M/F)" },
    { key: "date_of_birth", label: "Date de naissance" },
    { key: "mother_name", label: "Nom de la mère" },
    { key: "father_name", label: "Nom du père" },
  ],
  marriages: [
    { key: "spouse1_name", label: "Conjoint 1" },
    { key: "spouse2_name", label: "Conjoint 2" },
    { key: "marriage_date", label: "Date du mariage" },
  ],
  divorces: [
    { key: "spouse1_name", label: "Conjoint 1" },
    { key: "spouse2_name", label: "Conjoint 2" },
    { key: "divorce_date", label: "Date du divorce" },
    { key: "judgment_ref", label: "Référence jugement" },
  ],
  deaths: [
    { key: "deceased_name", label: "Nom du défunt" },
    { key: "date_of_death", label: "Date de décès" },
    { key: "cause", label: "Cause (optionnel)" },
  ],
  recognitions: [
    { key: "child_name", label: "Nom de l'enfant" },
    { key: "parent_name", label: "Parent déclarant" },
    { key: "recognition_date", label: "Date" },
  ],
  rectifications: [
    { key: "original_act_number", label: "N° acte original" },
    { key: "field_name", label: "Champ à corriger" },
    { key: "new_value", label: "Nouvelle valeur" },
    { key: "reason", label: "Motif" },
  ],
};

export default function ActPage({ kind, title }: Props) {
  const fields = FIELDS[kind] ?? [{ key: "notes", label: "Notes" }];
  const session = getSession();
  const [commune, setCommune] = useState("KIN-GOMBE");
  const [geo, setGeo] = useState<GeoSelection>({});
  const [actNumber, setActNumber] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<CivilAct[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"api" | "demo">("demo");

  async function refresh() {
    if (session?.accessToken) {
      try {
        const data = await api.listActs(kind, commune || undefined);
        setRows(data);
        setSource("api");
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chargement API impossible");
      }
    }
    setRows(demoListActs(kind));
    setSource("demo");
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, commune, session?.accessToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const placeLabel = geo.label || "";
    const payload = {
      ...values,
      ...(kind === "births" ? { place_of_birth: placeLabel } : {}),
      ...(kind === "marriages" ? { marriage_place: placeLabel } : {}),
      ...(kind === "deaths" ? { place_of_death: placeLabel } : {}),
      geo,
    };
    const body = {
      commune_code: geo.commune_code || commune,
      act_number: actNumber || undefined,
      payload,
      status: "DRAFT",
    };
    if (session?.accessToken) {
      try {
        await api.createAct(kind, body);
        setMessage("Acte enregistré via l'API nationale.");
        setSource("api");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Échec API — enregistrement non effectué.");
        setBusy(false);
        return;
      }
    } else {
      demoCreateAct(kind, payload, geo.commune_code || commune);
      setMessage("Acte enregistré en mode démo local (pas de jeton API).");
      setSource("demo");
    }
    setValues({});
    setActNumber("");
    await refresh();
    setBusy(false);
  }

  return (
    <div>
      <h2 className="page-title">{title}</h2>
      <p className="page-lead">
        Saisie et consultation des actes — Officier de l&apos;état civil
        {source === "api" ? " · source API" : " · mode démo"}.
      </p>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Nouvel acte</h3>
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="login-error">{error}</div> : null}
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="full">
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geo}
              onChange={(g) => {
                setGeo(g);
                if (g.commune_code) setCommune(g.commune_code);
              }}
              label="Lieu / commune (base géographie)"
            />
          </div>
          <div>
            <label className="form-label">
              N° d&apos;acte (optionnel — sinon séquence commune/année/seq)
            </label>
            <input
              className="form-control"
              value={actNumber}
              onChange={(e) => setActNumber(e.target.value)}
            />
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-control"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer l'acte"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="toolbar">
          <button type="button" className="btn-secondary" onClick={() => void refresh()}>
            Actualiser
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Type</th>
              <th>Commune</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.act_number}</td>
                <td>{r.act_type}</td>
                <td>{r.commune_code}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
