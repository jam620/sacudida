import Dashboard from "@/components/Dashboard";
import FontSizeControl from "@/components/FontSizeControl";
import InstallButton from "@/components/InstallButton";
import NewsPanel from "@/components/NewsPanel";
import OfficialBalance from "@/components/OfficialBalance";
import ReliableSources from "@/components/ReliableSources";
import SafetyGuide from "@/components/SafetyGuide";
import {
  APP_NAME,
  APP_TAGLINE,
  EMERGENCY_PHONE,
  LEGAL_NOTICE,
  OFFICIAL_LINKS,
} from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sky-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido principal
      </a>

      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {APP_NAME}
          </h1>
          <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Informativo · No oficial
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a
              href={`tel:${EMERGENCY_PHONE}`}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              aria-label={`Llamar a emergencias al ${EMERGENCY_PHONE}`}
            >
              ☎ Llamar al {EMERGENCY_PHONE}
            </a>
            <InstallButton />
            <FontSizeControl />
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-400">
          {APP_TAGLINE}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {LEGAL_NOTICE}
        </p>
      </header>

      <main id="contenido" className="flex flex-col gap-6">
        <Dashboard />
        <OfficialBalance />
        <NewsPanel />
        <ReliableSources />
        <SafetyGuide />
      </main>

      <footer className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400 sm:p-6">
        <h2 className="text-base font-semibold text-slate-200">
          Fuentes oficiales
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-500 underline-offset-2 hover:text-slate-200"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Datos sísmicos: USGS (servicio público FDNWS). Mapa: colaboradores
          de OpenStreetMap. Noticias: Google Noticias (enlace al medio
          original). Las horas visibles están en hora de Panamá (UTC−5,
          día/mes/año); los datos se almacenan en UTC. {APP_NAME} es una
          aplicación informativa: no predice sismos ni emite alertas
          oficiales.
        </p>
      </footer>
    </div>
  );
}
