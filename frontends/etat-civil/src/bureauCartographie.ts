/** Cartographie des bureaux EC + structures sanitaires (coords, distances, compteurs). */

import { listAccountRequests } from "./accountRegistration";
import { listEcUsers } from "./ecUsers";
import { listFacilityAccounts } from "./healthAuth";
import { listActs } from "./registry";

export const BUREAU_TYPE_LABELS = [
  "Bureau principal de l'état-civil",
  "Bureau secondaire de l'état-civil",
  "Bureau d'appui",
] as const;

export const LIEU_ENREGISTREMENT_LABELS = [
  ...BUREAU_TYPE_LABELS,
  "Structure sanitaire",
] as const;

export type BureauKind =
  | "BUREAU_PRINCIPAL"
  | "BUREAU_SECONDAIRE"
  | "BUREAU_APPUI"
  | "STRUCTURE_SANITAIRE";

export type MapPoint = {
  id: string;
  name: string;
  kind: BureauKind;
  kindLabel: string;
  province: string;
  ville: string;
  commune: string;
  lat: number;
  lng: number;
  actCount: number;
};

const PROVINCE_COORDS: Record<string, [number, number]> = {
  kinshasa: [-4.3276, 15.3136],
  "kongo-central": [-5.8167, 13.45],
  "kwango": [-6.5, 17.0],
  kwilu: [-5.041, 18.816],
  "mai-ndombe": [-2.15, 16.2333],
  kasi: [-5.9, 22.4],
  "kasai": [-5.9, 22.4],
  "kasai-central": [-5.896, 22.417],
  "kasai-oriental": [-6.15, 23.6],
  lomami: [-6.13, 24.5],
  sankuru: [-3.5, 23.6],
  maniema: [-2.95, 25.95],
  "sud-kivu": [-2.5, 28.85],
  "nord-kivu": [-1.678, 29.222],
  ituri: [1.7, 30.0],
  "haut-uele": [2.8, 27.6],
  tshopo: [0.5, 25.2],
  "bas-uele": [3.25, 19.75],
  mongala: [2.15, 21.5],
  equateur: [0.05, 18.2667],
  "équateur": [0.05, 18.2667],
  "nord-ubangi": [4.35, 18.6],
  "sud-ubangi": [3.25, 19.75],
  tshuapa: [-0.7, 22.2],
  "haut-lomami": [-8.7, 25.0],
  lualaba: [-10.7, 25.5],
  "haut-katanga": [-11.66, 27.48],
  tanganyika: [-5.9, 29.2],
};

function coordsForProvince(name?: string | null): [number, number] {
  const key = (name || "").trim().toLowerCase();
  if (!key) return [-4.3276, 15.3136];
  if (PROVINCE_COORDS[key]) return PROVINCE_COORDS[key];
  for (const [k, v] of Object.entries(PROVINCE_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [-4.3276, 15.3136];
}

function jitter(lat: number, lng: number, salt: string): [number, number] {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  const dLat = ((h % 200) - 100) * 0.00035;
  const dLng = (((h >> 8) % 200) - 100) * 0.00035;
  return [lat + dLat, lng + dLng];
}

export function normalizeBureauKind(raw?: string | null): BureauKind | null {
  const s = (raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("sanitaire") || s.includes("hôpital") || s.includes("hopital") || s.includes("matern")) {
    return "STRUCTURE_SANITAIRE";
  }
  if (s.includes("appui")) return "BUREAU_APPUI";
  if (s.includes("second")) return "BUREAU_SECONDAIRE";
  if (s.includes("principal")) return "BUREAU_PRINCIPAL";
  return null;
}

export function kindLabel(kind: BureauKind): string {
  switch (kind) {
    case "BUREAU_PRINCIPAL":
      return "Bureau principal de l'état-civil";
    case "BUREAU_SECONDAIRE":
      return "Bureau secondaire de l'état-civil";
    case "BUREAU_APPUI":
      return "Bureau d'appui";
    case "STRUCTURE_SANITAIRE":
      return "Structure sanitaire";
  }
}

export function kindColor(kind: BureauKind): string {
  switch (kind) {
    case "BUREAU_PRINCIPAL":
      return "#0b3d91";
    case "BUREAU_SECONDAIRE":
      return "#1a7a4c";
    case "BUREAU_APPUI":
      return "#b45309";
    case "STRUCTURE_SANITAIRE":
      return "#b91c1c";
  }
}

/** Distance orthodromique en km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function actMatchesPoint(actPayload: Record<string, unknown>, point: MapPoint): boolean {
  const typeRaw = String(
    actPayload.type_lieu_enregistrement ||
      actPayload.service_bureau ||
      actPayload.bureau_type ||
      "",
  );
  const kind = normalizeBureauKind(typeRaw);
  if (kind && kind !== point.kind) return false;

  const prov = String(
    actPayload.province_naissance ||
      actPayload.province ||
      (actPayload.geo && typeof actPayload.geo === "object"
        ? (actPayload.geo as { province_name?: string }).province_name
        : "") ||
      "",
  )
    .trim()
    .toLowerCase();
  const commune = String(
    actPayload.commune_naissance ||
      actPayload.commune ||
      (actPayload.geo && typeof actPayload.geo === "object"
        ? (actPayload.geo as { commune_name?: string }).commune_name
        : "") ||
      "",
  )
    .trim()
    .toLowerCase();

  if (point.province && prov && !prov.includes(point.province.toLowerCase()) && !point.province.toLowerCase().includes(prov)) {
    return false;
  }
  if (point.commune && commune) {
    return commune.includes(point.commune.toLowerCase()) || point.commune.toLowerCase().includes(commune);
  }
  if (point.province && prov) return true;
  // Structure sanitaire : match par nom d'hôpital
  if (point.kind === "STRUCTURE_SANITAIRE") {
    const hop = String(actPayload.hopital_naissance || actPayload.facility_name || "").toLowerCase();
    return hop.includes(point.name.toLowerCase().slice(0, 12)) || point.name.toLowerCase().includes(hop.slice(0, 12));
  }
  return Boolean(point.province && !prov);
}

function countActsForPoint(point: MapPoint): number {
  const acts = listActs();
  return acts.filter((a) => actMatchesPoint(a.payload || {}, point)).length;
}

export function collectMapPoints(provinceFilter?: string): MapPoint[] {
  const byKey = new Map<string, MapPoint>();
  const provFilter = (provinceFilter || "").trim().toLowerCase();

  const upsert = (p: Omit<MapPoint, "actCount">) => {
    if (provFilter && p.province && !p.province.toLowerCase().includes(provFilter) && !provFilter.includes(p.province.toLowerCase())) {
      return;
    }
    const key = `${p.kind}|${p.name}|${p.commune}|${p.province}`.toLowerCase();
    if (byKey.has(key)) return;
    byKey.set(key, { ...p, actCount: 0 });
  };

  for (const u of listEcUsers().filter((x) => x.active)) {
    const kind = normalizeBureauKind(u.service_bureau) || "BUREAU_PRINCIPAL";
    if (kind === "STRUCTURE_SANITAIRE") continue;
    const name =
      u.institution?.trim() ||
      `Bureau — ${u.commune.name}` ||
      u.fullName;
    const [lat0, lng0] = coordsForProvince(u.commune.province);
    const [lat, lng] = jitter(lat0, lng0, u.id);
    upsert({
      id: `user-${u.id}`,
      name,
      kind,
      kindLabel: kindLabel(kind),
      province: u.commune.province || "",
      ville: u.commune.ville || "",
      commune: u.commune.name || "",
      lat,
      lng,
    });
  }

  for (const r of listAccountRequests().filter((x) => x.status === "ACTIVE" || x.status === "PENDING_VALIDATION")) {
    if (r.accountType === "HOPITAL_MATERNITE") continue;
    const kind = normalizeBureauKind(r.service_bureau);
    if (!kind || kind === "STRUCTURE_SANITAIRE") continue;
    const name = r.institution?.trim() || `Bureau — ${r.commune_secteur || ""}`;
    const [lat0, lng0] = coordsForProvince(r.province);
    const [lat, lng] = jitter(lat0, lng0, r.id);
    upsert({
      id: `req-${r.id}`,
      name,
      kind,
      kindLabel: kindLabel(kind),
      province: r.province || "",
      ville: r.ville_territoire || "",
      commune: r.commune_secteur || "",
      lat,
      lng,
    });
  }

  for (const f of listFacilityAccounts().filter((x) => x.active)) {
    const [lat0, lng0] = coordsForProvince(f.province);
    const [lat, lng] = jitter(lat0, lng0, f.id);
    upsert({
      id: `fac-${f.id}`,
      name: f.facilityName,
      kind: "STRUCTURE_SANITAIRE",
      kindLabel: kindLabel("STRUCTURE_SANITAIRE"),
      province: f.province || "",
      ville: f.ville || "",
      commune: f.commune_name || "",
      lat,
      lng,
    });
  }

  const points = [...byKey.values()].map((p) => ({
    ...p,
    actCount: countActsForPoint(p),
  }));
  return points.sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name));
}

export function distancesInProvince(points: MapPoint[], province: string): Array<{
  from: string;
  to: string;
  km: number;
}> {
  const inProv = points.filter(
    (p) =>
      p.kind !== "STRUCTURE_SANITAIRE" &&
      p.province.toLowerCase().includes(province.toLowerCase()),
  );
  const rows: Array<{ from: string; to: string; km: number }> = [];
  for (let i = 0; i < inProv.length; i++) {
    for (let j = i + 1; j < inProv.length; j++) {
      rows.push({
        from: inProv[i].name,
        to: inProv[j].name,
        km: Math.round(haversineKm(inProv[i], inProv[j]) * 10) / 10,
      });
    }
  }
  return rows.sort((a, b) => a.km - b.km);
}

export function zoneActCounts(points: MapPoint[]): Array<{ zone: string; count: number; kind: string }> {
  const map = new Map<string, { zone: string; count: number; kind: string }>();
  for (const p of points) {
    const zone = [p.commune, p.ville, p.province].filter(Boolean).join(" · ") || p.name;
    const key = `${p.kind}|${zone}`;
    const cur = map.get(key);
    if (cur) cur.count += p.actCount;
    else map.set(key, { zone, count: p.actCount, kind: p.kindLabel });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
