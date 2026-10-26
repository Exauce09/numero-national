/** Nationalités affichées en français — code ISO-3 pour l’API (COD = congolaise). */

export type NationaliteOption = { code: string; label: string };

export const NATIONALITES: NationaliteOption[] = [
  { code: "COD", label: "Congolaise (RDC)" },
  { code: "AGO", label: "Angolaise" },
  { code: "BDI", label: "Burundaise" },
  { code: "CAF", label: "Centrafricaine" },
  { code: "COG", label: "Congolaise (Congo-Brazzaville)" },
  { code: "RWA", label: "Rwandaise" },
  { code: "TZA", label: "Tanzanienne" },
  { code: "UGA", label: "Ougandaise" },
  { code: "ZMB", label: "Zambienne" },
  { code: "SSD", label: "Sud-soudanaise" },
  { code: "SDN", label: "Soudanaise" },
  { code: "CMR", label: "Camerounaise" },
  { code: "GAB", label: "Gabonaise" },
  { code: "NGA", label: "Nigériane" },
  { code: "GHA", label: "Ghanéenne" },
  { code: "SEN", label: "Sénégalaise" },
  { code: "CIV", label: "Ivoirienne" },
  { code: "MLI", label: "Malienne" },
  { code: "MAR", label: "Marocaine" },
  { code: "DZA", label: "Algérienne" },
  { code: "TUN", label: "Tunisienne" },
  { code: "EGY", label: "Égyptienne" },
  { code: "ZAF", label: "Sud-africaine" },
  { code: "FRA", label: "Française" },
  { code: "BEL", label: "Belge" },
  { code: "PRT", label: "Portugaise" },
  { code: "CHN", label: "Chinoise" },
  { code: "IND", label: "Indienne" },
  { code: "PAK", label: "Pakistanaise" },
  { code: "LBN", label: "Libanaise" },
  { code: "TUR", label: "Turque" },
  { code: "USA", label: "Américaine (États-Unis)" },
  { code: "GBR", label: "Britannique" },
  { code: "CAN", label: "Canadienne" },
  { code: "DEU", label: "Allemande" },
  { code: "ITA", label: "Italienne" },
  { code: "ESP", label: "Espagnole" },
  { code: "XXX", label: "Autre / apatride / non précisée" },
];

export function nationaliteLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const c = code.trim().toUpperCase();
  return NATIONALITES.find((n) => n.code === c)?.label ?? c;
}
