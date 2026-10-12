/**
 * Balance oficial de la emergencia (cifras de SINAPROC y ministerios).
 *
 * ⚠️ Estos datos NO provienen de USGS ni de ningún feed automático: son
 * cifras oficiales difundidas el 10 de octubre de 2026 y se actualizan
 * MANUALMENTE editando este archivo. Cada cifra conserva su fuente y la
 * fecha de corte; la UI debe mostrar siempre ese contexto.
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

export const OFFICIAL_BALANCE: OfficialBalance = {
  // 10 de octubre de 2026, 5:07 p. m. hora de Panamá (UTC−5).
  updatedAtUtc: "2026-10-10T22:07:00.000Z",
  reportedBy: "SINAPROC, MIVIOT, MEDUCA, MOP y MIDES",
  figures: [
    {
      id: "fallecidos",
      label: "fallecidos",
      value: "0",
      sourceLabel: "SINAPROC",
      sourceUrl:
        "https://www.telemetro.com/nacionales/sismo-panama-gobierno-declara-estado-emergencia-terremoto-75-n6094734",
    },
    {
      id: "heridos",
      label: "heridos",
      value: "27",
      sourceLabel: "SINAPROC",
      sourceUrl:
        "https://www.telemetro.com/nacionales/sismo-panama-gobierno-declara-estado-emergencia-terremoto-75-n6094734",
    },
    {
      id: "desaparecidos",
      label: "desaparecidos",
      value: "0",
      sourceLabel: "SINAPROC",
      sourceUrl:
        "https://www.telemetro.com/nacionales/sismo-panama-no-se-reportan-victimas-fatales-y-sinaproc-atiende-damnificados-n6094686",
    },
    {
      id: "viviendas",
      label: "viviendas dañadas",
      value: "426",
      sourceLabel: "MIVIOT",
      sourceUrl:
        "https://www.infobae.com/panama/2026/10/10/terremoto-en-panama-deja-unos-2130-damnificados-426-viviendas-afectadas-y-nueve-puentes-con-danos/",
    },
    {
      id: "afectados",
      label: "personas afectadas",
      value: "2,130",
      sourceLabel: "MIVIOT",
      sourceUrl:
        "https://www.infobae.com/panama/2026/10/10/terremoto-en-panama-deja-unos-2130-damnificados-426-viviendas-afectadas-y-nueve-puentes-con-danos/",
    },
    {
      id: "escuelas",
      label: "escuelas afectadas",
      value: "419",
      sourceLabel: "MEDUCA",
      sourceUrl:
        "https://www.infobae.com/panama/2026/10/10/terremoto-en-panama-deja-unos-2130-damnificados-426-viviendas-afectadas-y-nueve-puentes-con-danos/",
    },
  ],
  verificationUrl: "https://www.sinaproc.gob.pa/",
  verificationLabel: "SINAPROC (verificación oficial)",
};
