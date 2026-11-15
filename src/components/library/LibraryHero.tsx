import { LibraryBig, Sparkles } from "lucide-react";

import spawnReading from "../../assets/spawnreading-library.png";

interface LibraryHeroProps {
  bookCount: number;
  loading: boolean;
}

export function LibraryHero({ bookCount, loading }: LibraryHeroProps) {
  return (
    <section
      aria-labelledby="library-title"
      className="relative isolate mb-8 overflow-hidden rounded-[1.75rem] border border-orange-200/15 bg-[#211d30] shadow-[0_24px_65px_-38px_rgba(249,115,22,0.55)] sm:mb-10 sm:rounded-[2rem]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_82%_62%,rgba(194,65,12,0.2),transparent_48%),radial-gradient(ellipse_at_12%_0%,rgba(124,58,237,0.16),transparent_58%)]"
      />

      <div className="relative flex min-h-[300px] items-center px-5 py-7 sm:min-h-[320px] sm:px-8 sm:py-9 lg:min-h-[360px] lg:px-12 lg:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #211d30 0%, rgba(33,29,48,.94) 35%, rgba(33,29,48,.55) 59%, transparent 100%)",
          }}
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[90%] items-end justify-end sm:w-[72%] lg:w-[62%]">
          <div className="absolute bottom-4 right-[12%] h-48 w-48 rounded-full bg-orange-500/20 blur-[70px] sm:h-64 sm:w-64" />
          <img
            src={spawnReading}
            alt=""
            aria-hidden="true"
            className="relative h-full w-full object-contain object-right-bottom brightness-110 contrast-110 saturate-110 drop-shadow-[0_8px_34px_rgba(255,112,40,0.28)] sm:scale-105 lg:scale-110 translate-y-8 sm:translate-y-0 lg:translate-x-[-24px] lg:translate-y-4"
          />
        </div>

        <div className="relative z-10 w-full max-w-[82%] sm:max-w-[62%] lg:max-w-[56%]">
          <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-[#171426]/75 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.17em] text-orange-100 shadow-lg shadow-black/10 sm:text-xs">
            <Sparkles aria-hidden="true" size={14} className="shrink-0" />
            Seu universo de histórias
          </p>

          <h1
            id="library-title"
            className="mt-4 text-3xl font-black leading-[1.05] tracking-tight text-white sm:mt-5 sm:text-4xl lg:text-5xl"
          >
            Minha biblioteca
          </h1>

          <p className="mt-3 max-w-md text-xs leading-5 text-slate-200/85 sm:text-sm sm:leading-6 lg:text-base">
            Todas as suas aventuras reunidas. Escolha uma história e continue
            de onde parou.
          </p>

          <div className="mt-5 inline-flex min-h-10 items-center gap-2.5 rounded-xl border border-white/10 bg-[#171426]/70 px-3 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/10 backdrop-blur-sm sm:mt-6 sm:px-4 sm:text-sm">
            <LibraryBig
              aria-hidden="true"
              size={17}
              className="shrink-0 text-orange-200"
            />
            <span aria-live="polite">
              {loading
                ? "Carregando coleção..."
                : `${bookCount} ${bookCount === 1 ? "obra" : "obras"} na coleção`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
