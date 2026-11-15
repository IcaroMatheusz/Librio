import { Download, MonitorSmartphone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import naruto from "../../assets/naruto.webp";

export function LocalReadingBanner() {
  return (
    <section
      aria-labelledby="download-banner-title"
      className="relative isolate overflow-hidden rounded-2xl border border-orange-200/15 bg-[#30231e] shadow-[0_12px_35px_-24px_rgba(249,115,22,0.55)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(254,215,170,.5) 1px, transparent 1.5px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 -top-24 -z-10 size-56 rounded-full bg-orange-500/15 blur-3xl"
      />

      <div className="relative grid min-h-[170px] grid-cols-[minmax(6rem,0.72fr)_minmax(0,1.28fr)] sm:min-h-[175px] md:grid-cols-[minmax(11rem,0.8fr)_minmax(0,1.2fr)] lg:min-h-[185px]">
        <div className="relative flex min-w-0 items-end justify-center overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-transparent via-[#30231e]/10 to-[#30231e]"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-24 w-32 -translate-x-1/2 rounded-full bg-orange-400/20 blur-3xl"
          />
          <img
            src={naruto}
            alt=""
            aria-hidden="true"
            className="relative z-0 h-[160px] w-full scale-110 object-contain object-bottom drop-shadow-[0_0_18px_rgba(255,154,66,0.35)] sm:h-[185px] md:h-[195px] lg:h-[250px] lg:origin-bottom lg:scale-[1.55] lg:translate-y-18"
          />
          <span className="absolute bottom-2 left-2 z-10 -rotate-6 border border-amber-200/70 bg-amber-200 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#302347] shadow-md sm:bottom-3 sm:left-4 sm:text-[9px]">
            Em breve
          </span>
        </div>

        <div className="relative z-10 flex min-w-0 flex-col items-start justify-center py-3 pl-0 pr-3 sm:py-4 sm:pr-6 lg:pr-9">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-orange-200/20 bg-[#211913]/70 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-orange-100 sm:gap-1.5 sm:text-[9px]">
            <Sparkles aria-hidden="true" size={11} className="shrink-0" />
            <span className="truncate">Para desktop e celular</span>
          </span>

          <h2
            id="download-banner-title"
            className="mt-1.5 text-lg font-black leading-tight tracking-tight text-white sm:mt-2 sm:text-2xl lg:text-3xl"
          >
            Librio<span className="text-orange-300">.</span> em qualquer tela
          </h2>

          <p className="mt-1 max-w-md text-[11px] leading-4 text-orange-50/80 sm:mt-1.5 sm:text-xs sm:leading-5 lg:text-[13px]">
            O aplicativo para computador e celular está em preparação. Enquanto
            isso, aproveite sua biblioteca pelo navegador.
          </p>

          <Link
            to="/download"
            className="mt-2 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-orange-300 px-3 py-1.5 text-[10px] font-extrabold text-[#321d12] shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:bg-orange-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-2.5 sm:min-h-10 sm:gap-2 sm:px-4 sm:text-xs"
          >
            <Download aria-hidden="true" size={14} />
            Baixar aplicativo
            <MonitorSmartphone aria-hidden="true" size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
