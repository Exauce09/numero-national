/** Un seul champ : tapez un lieu → suggestions référentiel + saisie libre. */

import { useEffect, useMemo, useState } from "react";
import { searchPlaces, type PlaceHit } from "../geoFallback";
import type { GeoSelection } from "./GeoCascade";

type Props = {
  label?: string;
  value: GeoSelection;
  onChange: (v: GeoSelection) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

function hitToGeo(hit: PlaceHit): GeoSelection {
  return {
    province_name: hit.province,
    ville_name: hit.ville,
    commune_name: hit.commune,
    label: hit.label,
  };
}

function geoLabel(g: GeoSelection): string {
  return (
    g.label ||
    [g.commune_name, g.ville_name, g.province_name].filter(Boolean).join(" · ") ||
    ""
  );
}

export default function GeoPlaceLookup({
  label = "Lieu",
  value,
  onChange,
  required,
  placeholder = "Tapez un lieu — ex. Tshilenge, Nsele, Kananga…",
  className,
  id,
}: Props) {
  const [query, setQuery] = useState(geoLabel(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const next = geoLabel(value);
    if (next && next !== query) setQuery(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent selection only
  }, [value.label, value.commune_name, value.ville_name, value.province_name]);

  const hits = useMemo(() => searchPlaces(query), [query]);

  function pick(hit: PlaceHit) {
    const geo = hitToGeo(hit);
    setQuery(hit.label);
    onChange(geo);
    setOpen(false);
  }

  function commitFreeText(raw: string) {
    const t = raw.trim();
    if (!t) {
      onChange({});
      return;
    }
    // Conserve la structure si le libellé n'a pas changé (sélection précédente).
    if (t === geoLabel(value) && (value.province_name || value.commune_name)) {
      onChange({ ...value, label: t });
      return;
    }
    onChange({ label: t });
  }

  return (
    <div className={`person-picker${className ? ` ${className}` : ""}`}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        className="form-control"
        value={query}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          commitFreeText(v);
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
            <li className="muted">Aucun lieu trouvé — la saisie libre reste acceptée.</li>
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

/** Variante texte pour Person.lieu_naissance / fiches sans GeoSelection. */
export function LieuNaissanceField({
  value,
  onChange,
  label = "Lieu de naissance",
  required,
  placeholder,
  className,
  id,
}: {
  value: string;
  onChange: (text: string, geo: GeoSelection) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const geo: GeoSelection = useMemo(
    () => (value.trim() ? { label: value.trim() } : {}),
    [value],
  );
  return (
    <GeoPlaceLookup
      id={id}
      className={className}
      label={label}
      value={geo}
      required={required}
      placeholder={placeholder}
      onChange={(g) => {
        const text = geoLabel(g);
        onChange(text, g);
      }}
    />
  );
}
