/** Un seul champ : tapez un lieu → province / ville / commune renseignés. */

import { useEffect, useMemo, useState } from "react";
import { searchPlaces, type PlaceHit } from "../geoFallback";
import type { GeoSelection } from "./GeoCascade";

type Props = {
  label?: string;
  value: GeoSelection;
  onChange: (v: GeoSelection) => void;
  required?: boolean;
  placeholder?: string;
};

function hitToGeo(hit: PlaceHit): GeoSelection {
  return {
    province_name: hit.province,
    ville_name: hit.ville,
    commune_name: hit.commune,
    label: hit.label,
  };
}

export default function GeoPlaceLookup({
  label = "Lieu",
  value,
  onChange,
  required,
  placeholder = "Ex. Tshilenge, Nsele, Kananga…",
}: Props) {
  const [query, setQuery] = useState(value.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value.label && value.label !== query) setQuery(value.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent selection only
  }, [value.label]);

  const hits = useMemo(() => searchPlaces(query), [query]);

  function pick(hit: PlaceHit) {
    const geo = hitToGeo(hit);
    setQuery(hit.label);
    onChange(geo);
    setOpen(false);
  }

  return (
    <div className="person-picker">
      <label className="form-label">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        className="form-control"
        value={query}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (!v.trim()) onChange({});
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
      />
      {value.province_name ? (
        <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
          {[value.commune_name, value.ville_name, value.province_name].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {open && query.trim().length >= 2 ? (
        <ul className="person-picker-list">
          {hits.length === 0 ? (
            <li className="muted">Aucun lieu trouvé dans le référentiel.</li>
          ) : (
            hits.map((h) => (
              <li key={`${h.kind}-${h.label}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                  <strong>{h.name}</strong>
                  <span className="muted small"> — {h.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
