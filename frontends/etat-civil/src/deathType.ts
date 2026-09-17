/** Type de décès : décès (vivant puis décédé) vs mort-né (stillbirth). */

export type TypeDeces = "DECES" | "MORT_NE";

export const TYPE_DECES_OPTIONS: Array<{ value: TypeDeces; label: string }> = [
  { value: "DECES", label: "Décès" },
  { value: "MORT_NE", label: "Mort-né" },
];

export function isMortNe(payload: Record<string, unknown>): boolean {
  const t = String(payload.type_deces ?? "").toUpperCase().replace(/[-\s]/g, "_");
  if (t === "MORT_NE" || t === "MORTNE") return true;
  if (t === "DECES" || t === "DECES_NORMAL" || t === "NORMAL") return false;
  if (payload.mort_ne === true) return true;
  const blob =
    `${payload.cause_deces ?? ""} ${payload.note ?? ""} ${payload.type_deces_label ?? ""}`.toLowerCase();
  return blob.includes("mort-né") || blob.includes("mort ne") || blob.includes("mortné");
}

export function typeDecesLabel(typeOrPayload: TypeDeces | Record<string, unknown>): string {
  if (typeof typeOrPayload === "string") {
    return typeOrPayload === "MORT_NE" ? "Mort-né" : "Décès";
  }
  return isMortNe(typeOrPayload) ? "Mort-né" : "Décès";
}
