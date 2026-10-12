/**
 * Guía de protección civil: antes, durante y después.
 * Contenido orientativo de preparación general; los avisos reales de
 * emergencia provienen siempre de los organismos oficiales.
 */

import { OFFICIAL_LINKS } from "@/lib/constants";

type GuideSection = {
  id: string;
  title: string;
  items: string[];
};

const SECTIONS: GuideSection[] = [
  {
    id: "antes",
    title: "Antes: preparación",
    items: [
      "Acuerda con tu familia o compañeros un punto de encuentro y un contacto de emergencia fuera de la zona.",
      "Prepara un kit de emergencia: agua potable, alimentos no perecederos, linterna, radio a baterías, botiquín y copias de documentos importantes.",
      "Identifica las zonas seguras de tu vivienda o lugar de trabajo (muros estructurales, bajo marcos de puertas reforzados) y las salidas despejadas.",
      "Asegura a la pared muebles altos, estanterías, calentadores y objetos pesados que puedan caer.",
      "Si vives o trabajas cerca de la costa, conoce de antemano las rutas de evacuación hacia zonas altas interiores.",
    ],
  },
  {
    id: "durante",
    title: "Durante un sismo",
    items: [
      "Mantén la calma: agáchate, cúbrete la cabeza y el cuello, y sostente de un elemento firme (agacharse, cubrirse, sostenerse).",
      "Aléjate de ventanas, vidrios, espejos, muebles altos y objetos que puedan caer.",
      "No uses ascensores y no corras hacia la salida mientras el suelo se mueve.",
      "Si estás conduciendo, detente con precaución lejos de puentes, postes y cables, y permanece dentro del vehículo.",
      "En zonas costeras, si el sismo es fuerte y prolongado, evacúa de inmediato hacia terreno alto sin esperar avisos: un tsunami puede llegar en minutos. A pie, si es posible.",
    ],
  },
  {
    id: "despues",
    title: "Después del sismo",
    items: [
      "Verifica si tú y quienes te acompañan están ilesos; atiende primero heridas leves antes de moverte.",
      "Revisa fugas de gas, daños eléctricos y estructurales evidentes; corta los suministros si detectas riesgo.",
      "Usa linternas, no velas ni fósforos, hasta descartar fugas de gas.",
      "Mantente informado por radio o canales oficiales (SINAPROC) y sigue solo instrucciones de las autoridades.",
      "Espera las réplicas con precaución y no difundas información no verificada.",
      "En la costa, alejate de la playa hasta que las autoridades indiquen que no hay riesgo de tsunami.",
    ],
  },
];

export default function SafetyGuide() {
  return (
    <section
      id="guia"
      aria-labelledby="guia-seguridad-titulo"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 scroll-mt-4 sm:p-6"
    >
      <h2
        id="guia-seguridad-titulo"
        className="text-xl font-bold text-slate-100"
      >
        Guía de protección civil
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Recomendaciones generales de preparación ante sismos. Ante una
        emergencia real, sigue siempre las indicaciones de los organismos
        oficiales.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {SECTIONS.map((section) => (
          <details
            key={section.id}
            className="rounded-lg border border-slate-800 bg-slate-900/80"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold text-slate-100">
              {section.title}
            </summary>
            <ul className="list-disc space-y-2 px-8 pb-4 pt-1 text-sm leading-relaxed text-slate-300">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-sky-800/60 bg-sky-950/30 p-4">
        <h3 className="text-sm font-semibold text-sky-200">
          Canales oficiales de emergencia
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline decoration-sky-700 underline-offset-2 hover:text-sky-200"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
