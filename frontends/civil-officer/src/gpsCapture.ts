/** Capture GPS + reverse géocode (Nominatim) pour remplir l’adresse. */

export type GpsCoords = { latitude: number; longitude: number };

export type ReverseGeo = GpsCoords & {
  display_name?: string;
  province?: string;
  ville?: string;
  commune?: string;
  quartier?: string;
  avenue?: string;
  raw?: Record<string, string>;
};

export function captureGpsOnSave(timeoutMs = 15000): Promise<GpsCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/** Reverse géocode via OSM Nominatim (nécessite connexion). */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeo | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&addressdetails=1&accept-language=fr`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "NumeroNational-ONIP/1.0" },
    });
    if (!res.ok) return { latitude: lat, longitude: lng };
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    return {
      latitude: lat,
      longitude: lng,
      display_name: data.display_name,
      province: a.state || a.region || a.province,
      ville: a.city || a.town || a.municipality || a.county,
      commune: a.suburb || a.city_district || a.municipality || a.village,
      quartier: a.neighbourhood || a.quarter || a.suburb,
      avenue: a.road || a.pedestrian || a.footway,
      raw: a,
    };
  } catch {
    return { latitude: lat, longitude: lng };
  }
}

export async function captureGpsWithAddress(timeoutMs = 15000): Promise<ReverseGeo | null> {
  const gps = await captureGpsOnSave(timeoutMs);
  if (!gps) return null;
  return reverseGeocode(gps.latitude, gps.longitude);
}
