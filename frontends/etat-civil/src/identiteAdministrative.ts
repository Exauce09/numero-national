export type DocumentAdmin = {
  type: string;
  type_autre: string;
  numero: string;
  autorite: string;
  date_emission: string;
  date_expiration: string;
  lieu_emission: string;
};

export type IdentiteAdminData = {
  documents: DocumentAdmin[];
  numero_dossier: string;
  bureau_reference: string;
  date_ouverture_dossier: string;
  agent_reference: string;
  remarques: string;
};

export const TYPES_DOCUMENT = [
  { value: "", label: "—" },
  { value: "CARTE_ELECTEUR", label: "Carte d'électeur" },
  { value: "PASSEPORT", label: "Passeport" },
  { value: "PERMIS_CONDUIRE", label: "Permis de conduire" },
  { value: "CARTE_SERVICE", label: "Carte de service / professionnelle" },
  { value: "ACTE_NAISSANCE", label: "Acte de naissance" },
  { value: "CARTE_SEJOUR", label: "Carte de séjour" },
  { value: "AUTRE", label: "Autre" },
] as const;

export function emptyDocument(): DocumentAdmin {
  return {
    type: "",
    type_autre: "",
    numero: "",
    autorite: "",
    date_emission: "",
    date_expiration: "",
    lieu_emission: "",
  };
}

export function emptyIdentiteAdmin(): IdentiteAdminData {
  return {
    documents: [],
    numero_dossier: "",
    bureau_reference: "",
    date_ouverture_dossier: "",
    agent_reference: "",
    remarques: "",
  };
}

function docLabel(d: DocumentAdmin): string {
  const type =
    d.type === "AUTRE"
      ? d.type_autre.trim() || "Autre"
      : TYPES_DOCUMENT.find((t) => t.value === d.type)?.label || d.type || "Document";
  const bits = [type];
  if (d.numero.trim()) bits.push(`n° ${d.numero.trim()}`);
  if (d.autorite.trim()) bits.push(d.autorite.trim());
  if (d.date_emission) bits.push(`émis ${d.date_emission}`);
  if (d.date_expiration) bits.push(`exp. ${d.date_expiration}`);
  if (d.lieu_emission.trim()) bits.push(d.lieu_emission.trim());
  return bits.join(", ");
}

export function formatIdentiteAdmin(data: IdentiteAdminData): string {
  const lines: string[] = [];
  if (data.numero_dossier.trim()) lines.push(`N° dossier : ${data.numero_dossier.trim()}`);
  if (data.bureau_reference.trim()) lines.push(`Bureau : ${data.bureau_reference.trim()}`);
  if (data.date_ouverture_dossier) lines.push(`Ouverture : ${data.date_ouverture_dossier}`);
  if (data.agent_reference.trim()) lines.push(`Réf. agent : ${data.agent_reference.trim()}`);
  if (data.documents.length) {
    lines.push(`Pièces (${data.documents.length}) :`);
    data.documents.forEach((d, i) => lines.push(`  ${i + 1}. ${docLabel(d)}`));
  }
  if (data.remarques.trim()) lines.push(`Remarques : ${data.remarques.trim()}`);
  return lines.join("\n");
}

export function parseIdentiteAdmin(raw: unknown): IdentiteAdminData {
  const base = emptyIdentiteAdmin();
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return { ...base, numero_dossier: raw.trim() };
    }
    return base;
  }
  const d = raw as Partial<IdentiteAdminData>;
  return {
    documents: Array.isArray(d.documents) ? d.documents.map((x) => ({ ...emptyDocument(), ...x })) : [],
    numero_dossier: typeof d.numero_dossier === "string" ? d.numero_dossier : "",
    bureau_reference: typeof d.bureau_reference === "string" ? d.bureau_reference : "",
    date_ouverture_dossier:
      typeof d.date_ouverture_dossier === "string" ? d.date_ouverture_dossier : "",
    agent_reference: typeof d.agent_reference === "string" ? d.agent_reference : "",
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
