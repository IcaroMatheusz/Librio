import {
  ArrowRight,
  Download,
  FolderOpen,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import naruto from "../../assets/naruto.webp";

const HIGHLIGHTS = [
  { icon: Monitor, label: "Windows Desktop" },
  { icon: Smartphone, label: "Android APK" },
  { icon: FolderOpen, label: "Pastas locais & nuvem" },
] as const;

export function LocalReadingBanner() {
  return (
    <section
      aria-labelledby="download-banner-title"
      className="group relative isolate overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-[#2B1F24] via-[#231D2D] to-[#1D1C2E] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_22px_55px_-30px_rgba(249,115,22,0.5)]"
    >
      {/* Halftone comic texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(254,215,170,0.45) 1px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-20 -z-10 size-72 rounded-full bg-orange-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-10 -z-10 size-72 rounded-full bg-violet-500/15 blur-3xl"
      />

      <div className="relative grid grid-cols-1 items-center md:grid-cols-[235px_minmax(0,1fr)] lg:grid-cols-[275px_minmax(0,1fr)_auto]">
        {/* Character Spotlight Stage */}
        <div className="relative order-2 flex h-52 items-end justify-center overflow-hidden px-4 pt-4 md:order-1 md:h-full md:min-h-[220px] md:px-3 lg:min-h-[235px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 left-1/2 h-36 w-44 -translate-x-1/2 rounded-full bg-amber-400/20 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#231D2D]/80 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#231D2D]/65"
          />

          <img
            src={naruto}
            alt=""
            aria-hidden="true"
            className="relative z-10 h-[195px] w-auto max-w-full object-contain object-bottom drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:scale-[1.04] md:h-[205px] lg:h-[222px]"
          />

          <span
            aria-hidden="true"
            className="absolute bottom-3 left-4 z-20 -rotate-3 rounded-md border border-amber-100/40 bg-amber-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#2B180A] shadow-[2px_3px_0_rgba(15,10,25,0.45)]"
          >
            PC &amp; Celular
          </span>
        </div>

        {/* Main Copy & Capability Chips */}
        <div className="relative z-10 order-1 flex min-w-0 flex-col items-start px-6 pt-6 pb-2 sm:px-8 sm:pt-7 md:order-2 md:py-7 md:pl-4 md:pr-8 lg:py-8 lg:pl-5 lg:pr-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-[#18131E]/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100">
            <Sparkles aria-hidden="true" size={13} className="shrink-0 text-amber-300" />
            Leitura local e na nuvem
          </span>

          <h2
            id="download-banner-title"
            className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl"
          >
            Librio<span className="text-amber-300">.</span> em qualquer tela
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200/85">
            Instale o aplicativo no computador ou no Android para abrir pastas
            do dispositivo, ler offline e manter seu progresso sincronizado.
          </p>

          <ul
            aria-label="Plataformas e recursos"
            className="mt-4 flex flex-wrap gap-2"
          >
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-orange-50/90"
              >
                <Icon
                  aria-hidden="true"
                  size={13}
                  className="shrink-0 text-amber-300"
                />
                {label}
              </li>
            ))}
          </ul>

          {/* CTA visible inside text column below lg */}
          <div className="mt-5 lg:hidden">
            <Link
              to="/download"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-extrabold text-[#28160B] shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <Download aria-hidden="true" size={16} />
              Baixar aplicativos
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>

        {/* Dedicated CTA Column on Desktop (lg+) */}
        <div className="relative z-10 hidden pr-9 lg:order-3 lg:flex lg:items-center">
          <Link
            to="/download"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-[#28160B] shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Download aria-hidden="true" size={17} />
            Baixar aplicativos
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
