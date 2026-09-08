import { useEffect, useState } from "react";
import GeoCascade, { type GeoSelection } from "../components/GeoCascade";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

type TreeVoie = { id: string; code: string; name: string; voie_type: string };
type TreeQuartier = { id: string; code: string; name: string; voies: TreeVoie[] };
type TreeLocalite = { id: string; code: string; name: string };
type TreeCommune = {
  id: string;
  code: string;
  name: string;
  quartiers: TreeQuartier[];
  localites: TreeLocalite[];
};
type TreeDistrict = {
  id: string;
  code: string;
  name: string;
  communes: TreeCommune[];
  localites: TreeLocalite[];
};
type TreeVille = {
  id: string;
  code: string;
  name: string;
  is_chef_lieu: boolean;
  communes: TreeCommune[];
};
type ProvinceTree = {
  id: string;
  code: string;
  name: string;
  chef_lieu: string;
  districts: TreeDistrict[];
  villes: TreeVille[];
  counts: Record<string, number>;
};

export default function TerritoryPage() {
  const [geo, setGeo] = useState<GeoSelection>({});
  const [tree, setTree] = useState<ProvinceTree | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  useEffect(() => {
    if (!geo.province_id) {
      setTree(null);
      setTreeError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingTree(true);
      setTreeError(null);
      try {
        const res = await fetch(`${BASE}/geo/provinces/${geo.province_id}/tree`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProvinceTree;
        if (!cancelled) setTree(data);
      } catch {
        if (!cancelled) {
          setTree(null);
          setTreeError("Impossible de charger l’arbre territorial — vérifiez que l’API et Postgres sont démarrés.");
        }
      } finally {
        if (!cancelled) setLoadingTree(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo.province_id]);

  const filteredVilles = tree?.villes.filter((v) => !geo.ville_id || v.id === geo.ville_id) ?? [];
  const filteredDistricts = tree?.districts.filter((d) => !geo.district_id || d.id === geo.district_id) ?? [];

  return (
    <div>
      <h2 className="page-title">Référentiel territorial RDC</h2>
      <p className="page-lead">
        Données en base PostgreSQL (schéma <code>geography</code>). Sélectionnez une province pour afficher toutes
        les villes, districts, communes, quartiers et voies liées — puis affinez ville → commune → quartier.
      </p>
      <GeoCascade value={geo} onChange={setGeo} />

      {geo.province_id ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title" style={{ marginTop: 0 }}>
            Infos liées — {geo.province_name ?? "Province"}
          </h3>
          {loadingTree ? <p className="muted">Chargement…</p> : null}
          {treeError ? <p className="login-error">{treeError}</p> : null}
          {tree ? (
            <>
              <p>
                Chef-lieu : <strong>{tree.chef_lieu}</strong> · code <code>{tree.code}</code>
              </p>
              <p className="muted" style={{ marginBottom: "1rem" }}>
                {tree.counts.villes} ville(s) · {tree.counts.districts} district(s) · {tree.counts.communes}{" "}
                commune(s) · {tree.counts.quartiers} quartier(s) · {tree.counts.localites} localité(s) ·{" "}
                {tree.counts.voies} voie(s)
              </p>

              {filteredVilles.length > 0 ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem" }}>Villes</h4>
                  {filteredVilles.map((v) => {
                    const communes = v.communes.filter((c) => !geo.commune_id || c.id === geo.commune_id);
                    return (
                      <details key={v.id} open={Boolean(geo.ville_id)} style={{ marginBottom: "0.5rem" }}>
                        <summary>
                          <strong>{v.name}</strong>
                          {v.is_chef_lieu ? " (chef-lieu)" : ""} · {v.communes.length} commune(s)
                        </summary>
                        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                          {communes.map((c) => {
                            const quartiers = c.quartiers.filter((q) => !geo.quartier_id || q.id === geo.quartier_id);
                            return (
                              <li key={c.id} style={{ marginBottom: "0.35rem" }}>
                                <strong>{c.name}</strong> <code>{c.code}</code>
                                {c.localites.length ? (
                                  <div className="muted">
                                    Localités : {c.localites.map((l) => l.name).join(", ")}
                                  </div>
                                ) : null}
                                {quartiers.length ? (
                                  <ul style={{ marginTop: "0.25rem" }}>
                                    {quartiers.map((q) => (
                                      <li key={q.id}>
                                        Quartier {q.name}
                                        {q.voies.length ? (
                                          <span className="muted">
                                            {" "}
                                            —{" "}
                                            {q.voies
                                              .map((voie) =>
                                                voie.voie_type === "AVENUE"
                                                  ? `Av. ${voie.name}`
                                                  : `Rue ${voie.name}`,
                                              )
                                              .join(", ")}
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="muted">Aucun quartier détaillé en base pour cette commune.</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              ) : null}

              {filteredDistricts.length > 0 ? (
                <div>
                  <h4 style={{ margin: "0 0 0.5rem" }}>Districts</h4>
                  {filteredDistricts.map((d) => (
                    <details key={d.id} open={Boolean(geo.district_id)} style={{ marginBottom: "0.5rem" }}>
                      <summary>
                        <strong>{d.name}</strong> · {d.communes.length} commune(s)
                      </summary>
                      {d.localites.length ? (
                        <p className="muted">Localités : {d.localites.map((l) => l.name).join(", ")}</p>
                      ) : null}
                      <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                        {d.communes.map((c) => (
                          <li key={c.id}>
                            {c.name} <code>{c.code}</code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {geo.commune_code ? (
        <div className="panel">
          <p>
            Code commune à utiliser dans les actes : <strong>{geo.commune_code}</strong>
          </p>
          <p className="muted">{geo.label}</p>
        </div>
      ) : null}
    </div>
  );
}
