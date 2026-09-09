export type EmploiExperience = {
  employeur: string;
  poste: string;
  secteur: string;
  ville: string;
  annee_debut: string;
  annee_fin: string;
  en_cours: boolean;
  description: string;
};

export type ExperienceData = {
  statut_actuel: string;
  employeur_actuel: string;
  poste_actuel: string;
  secteur_actuel: string;
  annees_experience: string;
  emplois: EmploiExperience[];
  remarques: string;
};

export const STATUTS_PRO = [
  { value: "", label: "—" },
  { value: "SALARIE", label: "Salarié(e)" },
  { value: "INDEPENDANT", label: "Indépendant(e) / informel" },
  { value: "FONCTIONNAIRE", label: "Fonctionnaire / agent public" },
  { value: "ETUDIANT", label: "Étudiant(e)" },
  { value: "CHOMEUR", label: "Sans emploi / en recherche" },
  { value: "RETRAITE", label: "Retraité(e)" },
  { value: "AUTRE", label: "Autre" },
] as const;

export const SECTEURS_PRO = [
  "",
  "Administration publique",
  "Agriculture / élevage",
  "Commerce",
  "Construction / BTP",
  "Éducation / enseignement",
  "Énergie / mines",
  "Finance / banque",
  "Santé",
  "Transport / logistique",
  "Télécoms / numérique",
  "Artisanat",
  "Services",
  "ONG / coopération",
  "Autre",
] as const;

export function emptyEmploi(): EmploiExperience {
  return {
    employeur: "",
    poste: "",
    secteur: "",
    ville: "",
    annee_debut: "",
    annee_fin: "",
    en_cours: false,
    description: "",
  };
}

export function emptyExperience(): ExperienceData {
  return {
    statut_actuel: "",
    employeur_actuel: "",
    poste_actuel: "",
    secteur_actuel: "",
    annees_experience: "",
    emplois: [],
    remarques: "",
  };
}

export function formatExperience(data: ExperienceData): string {
  const lines: string[] = [];
  const statut = STATUTS_PRO.find((s) => s.value === data.statut_actuel)?.label;
  if (statut && statut !== "—") lines.push(`Statut actuel : ${statut}`);
  if (data.poste_actuel.trim()) lines.push(`Poste actuel : ${data.poste_actuel.trim()}`);
  if (data.employeur_actuel.trim()) lines.push(`Employeur actuel : ${data.employeur_actuel.trim()}`);
  if (data.secteur_actuel.trim()) lines.push(`Secteur : ${data.secteur_actuel.trim()}`);
  if (data.annees_experience.trim()) {
    lines.push(`Années d'expérience : ${data.annees_experience.trim()}`);
  }
  if (data.emplois.length) {
    lines.push(`Parcours (${data.emplois.length}) :`);
    data.emplois.forEach((e, i) => {
      const periode = e.en_cours
        ? `${e.annee_debut || "?"}–en cours`
        : [e.annee_debut, e.annee_fin].filter(Boolean).join("–");
      const bits = [
        e.poste.trim() || "—",
        e.employeur.trim(),
        e.secteur.trim(),
        e.ville.trim(),
        periode,
        e.description.trim(),
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${bits.join(", ")}`);
    });
  }
  if (data.remarques.trim()) lines.push(`Remarques : ${data.remarques.trim()}`);
  return lines.join("\n");
}

export function parseExperience(raw: unknown): ExperienceData {
  const base = emptyExperience();
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return { ...base, remarques: raw.trim() };
    }
    return base;
  }
  const d = raw as Partial<ExperienceData>;
  return {
    statut_actuel: typeof d.statut_actuel === "string" ? d.statut_actuel : "",
    employeur_actuel: typeof d.employeur_actuel === "string" ? d.employeur_actuel : "",
    poste_actuel: typeof d.poste_actuel === "string" ? d.poste_actuel : "",
    secteur_actuel: typeof d.secteur_actuel === "string" ? d.secteur_actuel : "",
    annees_experience: typeof d.annees_experience === "string" ? d.annees_experience : "",
    emplois: Array.isArray(d.emplois) ? d.emplois.map((e) => ({ ...emptyEmploi(), ...e })) : [],
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
