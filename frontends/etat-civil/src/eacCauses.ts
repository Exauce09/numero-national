/** Causes de décès — groupes GBD / MCCOD pour indicateurs EAC. */

export type CauseGbdGroup =
  | "MALADIES_TRANSMISSIBLES"
  | "MALADIES_NON_TRANSMISSIBLES"
  | "TRAUMATISMES"
  | "MATERNEL_PERINATAL_NUTRITION"
  | "INDETERMINE";

export type CauseOption = {
  code: string;
  label: string;
  gbd: CauseGbdGroup;
  /** Cause typique nouveau-né / infantile. */
  neonatal?: boolean;
  infant?: boolean;
};

export const CAUSE_GBD_LABELS: Record<CauseGbdGroup, string> = {
  MALADIES_TRANSMISSIBLES: "Maladies transmissibles",
  MALADIES_NON_TRANSMISSIBLES: "Maladies non transmissibles",
  TRAUMATISMES: "Traumatismes",
  MATERNEL_PERINATAL_NUTRITION: "Maternel / périnatal / nutrition",
  INDETERMINE: "Indéterminée / non classée",
};

/** Liste opérationnelle (sous-ensemble CIM / GBD) pour saisie et tableaux EAC. */
export const CAUSE_DECES_OPTIONS: CauseOption[] = [
  { code: "A00-B99", label: "Maladies infectieuses et parasitaires", gbd: "MALADIES_TRANSMISSIBLES" },
  { code: "B50", label: "Paludisme", gbd: "MALADIES_TRANSMISSIBLES", infant: true },
  { code: "A15", label: "Tuberculose", gbd: "MALADIES_TRANSMISSIBLES" },
  { code: "B20", label: "VIH / sida", gbd: "MALADIES_TRANSMISSIBLES" },
  { code: "J00-J99", label: "Maladies de l'appareil respiratoire", gbd: "MALADIES_TRANSMISSIBLES", infant: true },
  { code: "A09", label: "Diarrhée / gastro-entérite", gbd: "MALADIES_TRANSMISSIBLES", infant: true },
  { code: "I00-I99", label: "Maladies de l'appareil circulatoire", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "C00-D48", label: "Tumeurs / cancers", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "E10-E14", label: "Diabète", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "N00-N99", label: "Maladies de l'appareil génito-urinaire", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "K00-K93", label: "Maladies de l'appareil digestif", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "G00-G99", label: "Maladies du système nerveux", gbd: "MALADIES_NON_TRANSMISSIBLES" },
  { code: "V01-Y98", label: "Causes externes (accidents, violences)", gbd: "TRAUMATISMES" },
  { code: "W00-X59", label: "Accidents", gbd: "TRAUMATISMES" },
  { code: "X60-Y09", label: "Lésions auto-infligées / agressions", gbd: "TRAUMATISMES" },
  {
    code: "P00-P96",
    label: "Affections origine périnatale",
    gbd: "MATERNEL_PERINATAL_NUTRITION",
    neonatal: true,
    infant: true,
  },
  {
    code: "O00-O99",
    label: "Grossesse, accouchement et puerpéralité",
    gbd: "MATERNEL_PERINATAL_NUTRITION",
  },
  {
    code: "E40-E46",
    label: "Malnutrition",
    gbd: "MATERNEL_PERINATAL_NUTRITION",
    infant: true,
  },
  { code: "R95", label: "Mort subite du nourrisson", gbd: "MATERNEL_PERINATAL_NUTRITION", infant: true },
  { code: "R99", label: "Cause indéterminée", gbd: "INDETERMINE" },
  { code: "OTHER", label: "Autre (préciser en texte)", gbd: "INDETERMINE" },
];

export function causeByCode(code?: string | null): CauseOption | undefined {
  if (!code) return undefined;
  return CAUSE_DECES_OPTIONS.find((c) => c.code === code);
}

export function gbdFromCauseCode(code?: string | null): CauseGbdGroup {
  return causeByCode(code)?.gbd ?? "INDETERMINE";
}

export function causeLabel(code?: string | null, fallback?: string): string {
  return causeByCode(code)?.label || fallback?.trim() || "Non renseignée";
}
