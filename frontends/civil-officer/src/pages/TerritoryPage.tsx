import { useState } from "react";
import GeoCascade, { type GeoSelection } from "../components/GeoCascade";

export default function TerritoryPage() {
  const [geo, setGeo] = useState<GeoSelection>({});

  return (
    <div>
      <h2 className="page-title">Référentiel territorial RDC</h2>
      <p className="page-lead">
        Sélectionnez province → ville → district → commune → localité → quartier → avenue / rue. Les 26 provinces
        sont préchargées ; Kinshasa inclut les 4 districts et 24 communes.
      </p>
      <GeoCascade value={geo} onChange={setGeo} />
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
