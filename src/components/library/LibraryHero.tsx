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
      className="relative isolate mb-9 overflow-hidden rounded-[1.75rem] border border-orange-200/10 bg-[#29243b] shadow-2xl shadow-black/20 sm:mb-12 sm:rounded-[2rem]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-1/2 z-0 size-64 -translate-y-1/2 rounded-full bg-orange-500/15 blur-[90px] sm:size-96"
      />
      <div className="relative min-h-[245px] px-5 py-7 sm:min-h-[300px] sm:px-8 sm:py-9 lg:min-h-[350px] lg:px-12 lg:py-12">
        <div className="relative z-10 max-w-[66%] sm:max-w-[58%] lg:max-w-[54%]">
          <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/15 bg-orange-200/[0.07] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.17em] text-orange-100 sm:text-xs">
            <Sparkles aria-hidden="true" size={14} />
            Seu universo de histórias
          </p>
          <h1
            id="library-title"
            className="mt-4 text-3xl font-black leading-[1.08] tracking-tight sm:mt-5 sm:text-4xl lg:text-5xl"
          >
            Minha
            <br />
            biblioteca
          </h1>
          <p className="mt-3 max-w-md text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6 lg:text-base">
            Todas as suas aventuras reunidas. Escolha uma história e continue
            de onde parou.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-slate-200 sm:mt-7 sm:px-4 sm:text-sm">
            <LibraryBig
              aria-hidden="true"
              size={16}
              className="text-orange-200"
            />
            {loading
              ? "Carregando coleção..."
              : `${bookCount} ${bookCount === 1 ? "obra" : "obras"} na coleção`}
          </div>
        </div>
        <img
          src={spawnReading}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 right-0 z-0 h-[96%] w-[66%] object-contain object-right-bottom brightness-125 contrast-110 saturate-125 drop-shadow-[0_0_22px_rgba(255,132,46,0.58)] drop-shadow-[0_18px_42px_rgba(255,76,23,0.32)] sm:-bottom-5 sm:right-0 sm:h-[102%] sm:w-[49%] sm:object-bottom lg:-bottom-7 lg:right-[1%] lg:h-[112%] lg:w-[45%]"
        />
      </div>
    </section>
  );
}
