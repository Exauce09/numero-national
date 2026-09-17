/** Cimetières principaux RDC — sélection pour l'enregistrement de décès. */

export type CimetiereOption = {
  name: string;
  ville: string;
  province: string;
};

export const CIMETIERES_RDC: CimetiereOption[] = [
  // Kinshasa
  { name: "Cimetière de la Gombe", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kintambo", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kinsuka", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Ngaliema", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Lingwala", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Barumbu", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kinshasa (commune)", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kasa-Vubu", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kalamu", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Bandalungwa", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Bumbu", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Makala", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Selembao", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Ngiri-Ngiri", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Lemba", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Limete", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Matete", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Ngaba", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kisenso", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Mont-Ngafula", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Ndjili", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Kimbanseke", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Masina", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Nsele", ville: "Kinshasa", province: "Kinshasa" },
  { name: "Cimetière de Maluku", ville: "Kinshasa", province: "Kinshasa" },

  // Kongo Central
  { name: "Cimetière de Matadi", ville: "Matadi", province: "Kongo Central" },
  { name: "Cimetière de Mvuzi", ville: "Matadi", province: "Kongo Central" },
  { name: "Cimetière de Nzanza", ville: "Matadi", province: "Kongo Central" },
  { name: "Cimetière de Boma", ville: "Boma", province: "Kongo Central" },
  { name: "Cimetière de Muanda", ville: "Muanda", province: "Kongo Central" },
  { name: "Cimetière de Mbanza-Ngungu", ville: "Mbanza-Ngungu", province: "Kongo Central" },
  { name: "Cimetière de Kisantu", ville: "Kisantu", province: "Kongo Central" },

  // Kwango / Kwilu / Mai-Ndombe
  { name: "Cimetière de Kenge", ville: "Kenge", province: "Kwango" },
  { name: "Cimetière de Bandundu", ville: "Bandundu", province: "Kwilu" },
  { name: "Cimetière de Kikwit", ville: "Kikwit", province: "Kwilu" },
  { name: "Cimetière d'Inongo", ville: "Inongo", province: "Mai-Ndombe" },

  // Équateur / Mongala / Ubangi / Tshuapa
  { name: "Cimetière de Mbandaka", ville: "Mbandaka", province: "Équateur" },
  { name: "Cimetière de Lisala", ville: "Lisala", province: "Mongala" },
  { name: "Cimetière de Bumba", ville: "Bumba", province: "Mongala" },
  { name: "Cimetière de Gbadolite", ville: "Gbadolite", province: "Nord-Ubangi" },
  { name: "Cimetière de Gemena", ville: "Gemena", province: "Sud-Ubangi" },
  { name: "Cimetière de Zongo", ville: "Zongo", province: "Sud-Ubangi" },
  { name: "Cimetière de Boende", ville: "Boende", province: "Tshuapa" },

  // Tshopo / Uélé / Ituri
  { name: "Cimetière de Kisangani", ville: "Kisangani", province: "Tshopo" },
  { name: "Cimetière de Makiso", ville: "Kisangani", province: "Tshopo" },
  { name: "Cimetière de Kabondo (Kisangani)", ville: "Kisangani", province: "Tshopo" },
  { name: "Cimetière de Mangobo", ville: "Kisangani", province: "Tshopo" },
  { name: "Cimetière de Lubunga", ville: "Kisangani", province: "Tshopo" },
  { name: "Cimetière de Buta", ville: "Buta", province: "Bas-Uélé" },
  { name: "Cimetière d'Isiro", ville: "Isiro", province: "Haut-Uélé" },
  { name: "Cimetière de Bunia", ville: "Bunia", province: "Ituri" },

  // Kivu / Maniema
  { name: "Cimetière de Goma", ville: "Goma", province: "Nord-Kivu" },
  { name: "Cimetière de Mugunga", ville: "Goma", province: "Nord-Kivu" },
  { name: "Cimetière de Virunga", ville: "Goma", province: "Nord-Kivu" },
  { name: "Cimetière de Butembo", ville: "Butembo", province: "Nord-Kivu" },
  { name: "Cimetière de Beni", ville: "Beni", province: "Nord-Kivu" },
  { name: "Cimetière de Bukavu", ville: "Bukavu", province: "Sud-Kivu" },
  { name: "Cimetière de Kadutu", ville: "Bukavu", province: "Sud-Kivu" },
  { name: "Cimetière d'Ibanda", ville: "Bukavu", province: "Sud-Kivu" },
  { name: "Cimetière de Bagira", ville: "Bukavu", province: "Sud-Kivu" },
  { name: "Cimetière d'Uvira", ville: "Uvira", province: "Sud-Kivu" },
  { name: "Cimetière de Baraka", ville: "Baraka", province: "Sud-Kivu" },
  { name: "Cimetière de Kindu", ville: "Kindu", province: "Maniema" },
  { name: "Cimetière de Kasongo", ville: "Kasongo", province: "Maniema" },

  // Katanga / Lualaba / Tanganyika / Haut-Lomami
  { name: "Cimetière de Lubumbashi", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Kenya", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Kasapa", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Ruashi", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Kampemba", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Katuba", ville: "Lubumbashi", province: "Haut-Katanga" },
  { name: "Cimetière de Likasi", ville: "Likasi", province: "Haut-Katanga" },
  { name: "Cimetière de Kipushi", ville: "Kipushi", province: "Haut-Katanga" },
  { name: "Cimetière de Kolwezi", ville: "Kolwezi", province: "Lualaba" },
  { name: "Cimetière de Dilala", ville: "Kolwezi", province: "Lualaba" },
  { name: "Cimetière de Fungurume", ville: "Fungurume", province: "Lualaba" },
  { name: "Cimetière de Kamina", ville: "Kamina", province: "Haut-Lomami" },
  { name: "Cimetière de Kalemie", ville: "Kalemie", province: "Tanganyika" },
  { name: "Cimetière de Kongolo", ville: "Kongolo", province: "Tanganyika" },

  // Kasaï
  { name: "Cimetière de Tshikapa", ville: "Tshikapa", province: "Kasaï" },
  { name: "Cimetière d'Ilebo", ville: "Ilebo", province: "Kasaï" },
  { name: "Cimetière de Kananga", ville: "Kananga", province: "Kasaï Central" },
  { name: "Cimetière de Katoka", ville: "Kananga", province: "Kasaï Central" },
  { name: "Cimetière de Nganza", ville: "Kananga", province: "Kasaï Central" },
  { name: "Cimetière de Mbuji-Mayi", ville: "Mbuji-Mayi", province: "Kasaï Oriental" },
  { name: "Cimetière de Diulu", ville: "Mbuji-Mayi", province: "Kasaï Oriental" },
  { name: "Cimetière de Bipemba", ville: "Mbuji-Mayi", province: "Kasaï Oriental" },
  { name: "Cimetière de Kanshi", ville: "Mbuji-Mayi", province: "Kasaï Oriental" },
  { name: "Cimetière de Muya", ville: "Mbuji-Mayi", province: "Kasaï Oriental" },
  { name: "Cimetière de Tshilenge", ville: "Tshilenge", province: "Kasaï Oriental" },
  { name: "Cimetière de Kabinda", ville: "Kabinda", province: "Lomami" },
  { name: "Cimetière de Mwene-Ditu", ville: "Mwene-Ditu", province: "Lomami" },
  { name: "Cimetière de Lusambo", ville: "Lusambo", province: "Sankuru" },
  { name: "Cimetière de Lodja", ville: "Lodja", province: "Sankuru" },
];

export function cimetiereLabel(c: CimetiereOption): string {
  return `${c.name} — ${c.ville} (${c.province})`;
}
