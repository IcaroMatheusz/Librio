import { BookOpen, Sparkles } from "lucide-react";

import dragonReader from "../../assets/dragon-reader.png";

export function DashboardBanner() {
  return (
    <section
      aria-labelledby="librio-banner-title"
      className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/20 bg-[#211d36] shadow-[0_24px_70px_-30px_rgba(124,58,237,0.6)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(221,214,254,.48) 1px, transparent 1.5px)",
          backgroundSize: "18px 18px",
          maskImage:
            "linear-gradient(90deg, black, transparent 75%), linear-gradient(0deg, transparent, black)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-32 -z-10 size-96 rounded-full bg-violet-500/25 blur-3xl"
      />

      <div className="relative grid min-h-64 items-center overflow-hidden px-6 py-9 sm:min-h-72 sm:px-10 lg:grid-cols-[1fr_0.8fr] lg:px-14">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-[#171426]/65 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
            <Sparkles aria-hidden="true" size={14} />
            Seu universo de leitura
          </span>

          <h1
            id="librio-banner-title"
            className="mt-4 text-5xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl"
          >
            Librio<span className="text-violet-300">.</span>
          </h1>
          <p className="mt-2 max-w-md text-base leading-7 text-violet-100/85 sm:text-lg">
            Um cantinho só seu para guardar histórias e voltar sempre à página
            onde parou.
          </p>

          <div className="mt-6 inline-flex -rotate-2 items-center gap-2 border-2 border-amber-200/80 bg-amber-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-[#302347] shadow-[3px_4px_0_rgba(15,10,30,0.5)] sm:text-sm">
            <BookOpen aria-hidden="true" size={17} />
            Vire a página
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-8 w-56 rotate-6 sm:-bottom-24 sm:right-6 sm:w-72 lg:relative lg:-bottom-16 lg:right-auto lg:ml-auto lg:w-80"
        >
          <div className="absolute inset-3 rounded-full bg-violet-400/30 blur-2xl" />
          <img
            src={dragonReader}
            alt=""
            className="relative h-auto w-full drop-shadow-[0_18px_25px_rgba(8,5,30,0.55)]"
          />
        </div>
      </div>

      <span
        aria-hidden="true"
        className="absolute right-4 top-4 rotate-6 rounded-md border border-white/20 bg-fuchsia-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#271b3d] shadow-md sm:right-8 sm:top-7 sm:text-xs"
      >
        Leitura em boa companhia
      </span>
    </section>
  );
}
