/** Palette drapeau RDC — bleu ciel, jaune, rouge. */

export const RDC = {
  blue: "#007FFF",
  blueDeep: "#0056B3",
  blueMid: "#3399FF",
  blueSoft: "#66B2FF",
  yellow: "#F7D618",
  yellowDeep: "#D4B000",
  yellowSoft: "#FCE56A",
  red: "#CE1126",
  redDeep: "#A30E1E",
  redSoft: "#E85A6A",
} as const;

/** Série cyclique pour camemberts / barres (ordre drapeau). */
export const RDC_CHART_SERIES: string[] = [
  RDC.blue,
  RDC.yellow,
  RDC.red,
  RDC.blueDeep,
  RDC.yellowDeep,
  RDC.redDeep,
  RDC.blueMid,
  RDC.yellowSoft,
  RDC.redSoft,
  RDC.blueSoft,
];

export function rdcColor(i: number): string {
  return RDC_CHART_SERIES[i % RDC_CHART_SERIES.length];
}
