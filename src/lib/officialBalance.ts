/**
 * Balance oficial de la emergencia (cifras de SINAPROC y ministerios).
 *
 * ⚠️ Estos datos NO provienen de USGS ni de ningún feed automático: son
 * cifras oficiales difundidas en los informes de situación y se actualizan
 * MANUALMENTE editando este archivo (SINAPROC no publica API). Cada cifra
 * conserva su fuente y la fecha de corte; la UI debe mostrar siempre ese
 * contexto.
 */

export type OfficialFigure = {
  id: string;
  label: string;
  value: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type OfficialBalance = {
  /** Fecha de corte del balance, en UTC ISO 8601. */
  updatedAtUtc: string;
  /** Entidades que firmaron/difundieron el balance. */
  reportedBy: string;
  figures: OfficialFigure[];
  /** Canal oficial para verificar novedades. */
  verificationUrl: string;
  verificationLabel: string;
};

/** Informe de Situación N.º 05 (OCHA/SINAPROC), corte 16-oct-2026 12:30. */
const SITREP_05_URL =
  "https://reliefweb.int/report/panama/panama-terremoto-en-azuero-y-veraguas-informe-de-situacion-no-05-al-16-de-octubre-2026-1230";

/** Informe de Situación 1 de OPS/OMS con el balance de víctimas. */
const PAHO_SITREP_1_URL =
  "https://www.paho.org/es/documentos/informe-situacion-1-terremoto-panama-octubre-2026";

export const OFFICIAL_BALANCE: OfficialBalance = {
  // 16 de octubre de 2026, 12:30 p. m. hora de Panamá (UTC−5).
  updatedAtUtc: "2026-10-16T17:30:00.000Z",
  reportedBy: "SINAPROC, MIDES, MEDUCA y OCHA (informe de situación N.º 05)",
  figures: [
    {
      id: "fallecidos",
      label: "fallecidos",
      value: "0",
      sourceLabel: "SINAPROC vía OPS (sin cambios al 16-oct)",
      sourceUrl: PAHO_SITREP_1_URL,
    },
    {
      id: "heridos",
      label: "heridos",
      value: "27",
      sourceLabel: "SINAPROC vía OPS (sin cambios al 16-oct)",
      sourceUrl: PAHO_SITREP_1_URL,
    },
    {
      id: "desaparecidos",
      label: "desaparecidos",
      value: "0",
      sourceLabel: "SINAPROC vía OPS (sin cambios al 16-oct)",
      sourceUrl: PAHO_SITREP_1_URL,
    },
    {
      id: "viviendas",
      label: "viviendas evaluadas",
      value: "5.807",
      sourceLabel: "SINAPROC (20.581 personas residen en ellas)",
      sourceUrl: SITREP_05_URL,
    },
    {
      id: "albergues",
      label: "personas en albergues",
      value: "3.696",
      sourceLabel: "SINAPROC (46 albergues; mayoría en Mariato)",
      sourceUrl: SITREP_05_URL,
    },
    {
      id: "asistidas",
      label: "personas asistidas",
      value: "15.139",
      sourceLabel: "Gobierno (4.485 familias)",
      sourceUrl: SITREP_05_URL,
    },
    {
      id: "escuelas",
      label: "centros educativos en inspección",
      value: "619",
      sourceLabel: "MEDUCA (35 colapsados; 3.031 estudiantes)",
      sourceUrl: SITREP_05_URL,
    },
  ],
  verificationUrl: "https://www.sinaproc.gob.pa/",
  verificationLabel: "SINAPROC (verificación oficial)",
};
