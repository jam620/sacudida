/**
 * Strip de seguridad rápida "Si vuelve a temblar" (inspirado en Tiembla).
 * Acciones inmediatas visibles sin hacer scroll hasta la guía completa.
 */

export default function QuickSafetyStrip() {
  return (
    <section
      aria-label="Si vuelve a temblar"
      className="rounded-xl border border-red-800/70 bg-red-950/40 p-4"
    >
      <p className="text-sm leading-relaxed text-red-100">
        <strong className="font-bold">Si vuelve a temblar:</strong>{" "}
        agáchate, cúbrete la cabeza y el cuello, y sostente de algo firme.
        Al parar el temblor, sal sin usar el ascensor. Si huele a gas, no
        enciendas luces ni fuego.{" "}
        <a
          href="#guia"
          className="font-semibold underline underline-offset-2 hover:text-white"
        >
          Guía completa
        </a>
        .
      </p>
      <p className="mt-1.5 text-xs text-red-200/80">
        En zonas costeras, si el temblor es fuerte y prolongado, evacúa de
        inmediato hacia terreno alto: un tsunami puede llegar en minutos.
      </p>
    </section>
  );
}
