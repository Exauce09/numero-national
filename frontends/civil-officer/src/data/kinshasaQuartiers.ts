/**
 * Quartiers + avenues (réf. openalfa / OSM) pour communes Kinshasa ciblées.
 * Lemba : Salongo Nord/Sud séparés + camps demandés.
 */

export type QuartierVoies = {
  name: string;
  voies: Array<{ type: "AVENUE" | "RUE" | "BOULEVARD" | "PLACE"; name: string }>;
};

function av(names: string[]): QuartierVoies["voies"] {
  return names.map((name) => ({ type: "AVENUE" as const, name }));
}

function mix(
  avenues: string[],
  rues: string[] = [],
): QuartierVoies["voies"] {
  return [
    ...avenues.map((name) => ({ type: "AVENUE" as const, name })),
    ...rues.map((name) => ({ type: "RUE" as const, name })),
  ];
}

/** commune display name → quartiers */
export const KIN_COMMUNE_QUARTIERS: Record<string, QuartierVoies[]> = {
  Lemba: [
    { name: "Mbanza-Lemba", voies: mix(["Lukusa", "By-Pass", "Université", "Kianza", "Moviti", "Zaba"], ["École", "Marché"]) },
    { name: "Salongo Nord", voies: mix(["Salongo", "des Combattants", "Nyembo", "Righini"], ["Lokole"]) },
    { name: "Salongo Sud", voies: mix(["Salongo", "Kimpwanza", "Foire", "Commercial"], ["Échangeur"]) },
    { name: "Livulu", voies: mix(["Livulu", "Université", "Kimwenza", "By-Pass"], ["École"]) },
    { name: "Foire", voies: mix(["de la Foire", "Commercial", "Salongo"], ["Marché"]) },
    { name: "Gombele", voies: mix(["Gombele", "By-Pass", "Lukusa"], ["Gombele"]) },
    { name: "Righini", voies: mix(["Righini", "Salongo", "des Combattants"]) },
    { name: "Kimpwanza", voies: mix(["Kimpwanza", "du Camp", "Salongo"], ["Territoire"]) },
    { name: "Madrandele", voies: mix(["Madrandele", "Tourisme", "Université"], ["École"]) },
    { name: "École", voies: mix(["de l'École", "Livulu", "Université"], ["École"]) },
    { name: "Masano", voies: mix(["Masano", "Lukusa", "By-Pass"]) },
    { name: "Échangeur", voies: mix(["Échangeur", "By-Pass", "Lukusa", "Wamba"]) },
    { name: "Commercial", voies: mix(["du Commerce", "Commercial", "Foire", "Salongo"]) },
    { name: "Kemi", voies: mix(["Kemi", "Lukwila", "By-Pass"]) },
    { name: "Quartiers", voies: mix(["Principale", "du Marché", "de la Paix"], ["Quartiers"]) },
    { name: "Camp Kabila", voies: mix(["du Camp Kabila", "Kimpwanza", "Salongo"], ["du Camp"]) },
    { name: "Camp Osso", voies: mix(["du Camp Osso", "By-Pass", "Lukusa"], ["du Camp"]) },
  ],
  Barumbu: [
    { name: "Bitshaku Tshaku", voies: av(["Bitshaku", "Kasai", "Liberte"]) },
    { name: "Funa I", voies: av(["Funa", "Kasavubu", "Bokasa"]) },
    { name: "Funa II", voies: av(["Funa", "Ebeya", "Itaga"]) },
    { name: "Kapinga", voies: av(["Kapinga", "Wangata", "Bolenge"]) },
    { name: "Kasai", voies: av(["Kasai", "du Port", "Commerce"]) },
    { name: "Libulu", voies: av(["Libulu", "Abattoirs", "Ndolo"]) },
    { name: "Mozindo", voies: av(["Mozindo", "Air Congo", "Aviateurs"]) },
    { name: "Ndolo", voies: av(["Ndolo", "de l'Aéroport", "Aviateurs"]) },
    { name: "Tshimanga", voies: av(["Tshimanga", "Wangata", "Ebeya"]) },
  ],
  Lingwala: [
    { name: "30 Juin", voies: av(["du 30 Juin", "Colonnel Tshatshi", "du Commerce"]) },
    { name: "CNECI", voies: av(["CNECI", "Lukusa", "de la Justice"]) },
    { name: "La Voix du Peuple", voies: av(["de la Voix du Peuple", "Bolenge", "Wangata"]) },
    { name: "Lokole", voies: av(["Lokole", "des Cliniques", "Kasa-Vubu"]) },
    { name: "Ngunda Lokombe", voies: av(["Ngunda Lokombe", "Bolenge", "Itaga"]) },
    { name: "Pakadjuma", voies: av(["Pakadjuma", "du Commerce", "Ebeya"]) },
    { name: "Singa Mopepe", voies: av(["Singa Mopepe", "Wangata", "Kasai"]) },
    { name: "Wenze", voies: mix(["Wenze", "du Marché"], ["Wenze"]) },
  ],
  Gombe: [
    { name: "Batetela", voies: av(["Batetela", "Lukusa", "du Commerce"]) },
    { name: "Cliniques", voies: av(["des Cliniques", "de la Justice", "Wagenia"]) },
    { name: "Commerce", voies: av(["du Commerce", "du Port", "des Aviateurs"]) },
    { name: "Croix-Rouge", voies: av(["de la Croix-Rouge", "Lukusa", "Colonel Lukusa"]) },
    { name: "Gare", voies: av(["de la Gare", "du Commerce", "Kabambare"]) },
    { name: "Golf", voies: av(["du Golf", "Roi Baudouin", "des Aviateurs"]) },
    { name: "Haut Commandement", voies: av(["du Haut Commandement", "des Forces Armées", "Lukusa"]) },
    { name: "Lemera", voies: av(["Lemera", "Lukusa", "de la Justice"]) },
    { name: "Révolution", voies: av(["de la Révolution", "du 30 Juin", "du Commerce"]) },
  ],
  Kinshasa: [
    { name: "Centre-ville", voies: av(["du Commerce", "Kasavubu", "Kasa-Vubu", "Bolenge"]) },
    { name: "Cité", voies: av(["des Cités", "de la Paix", "Lokole"]) },
    { name: "Marché", voies: mix(["du Marché", "Commerce"], ["Marché"]) },
    { name: "Résidentiel", voies: av(["Principale", "des Jardins", "de l'Indépendance"]) },
  ],
};

export function quartiersForCommuneName(communeName?: string | null): QuartierVoies[] | null {
  if (!communeName) return null;
  const key = Object.keys(KIN_COMMUNE_QUARTIERS).find(
    (k) => k.toLowerCase() === communeName.trim().toLowerCase(),
  );
  return key ? KIN_COMMUNE_QUARTIERS[key] : null;
}
