import {
  BookOpenCheck,
  Cloud,
  Download,
  ExternalLink,
  FolderOpen,
  Smartphone,
  Sparkles,
} from "lucide-react";

import absoluteFlash from "../../assets/mobile/absoluteflash.png";
import hellboyWallpaper from "../../assets/mobile/hellboy_wallpaper.jpg";

export interface AppRelease {
  version: string;
  downloadUrl: string;
}

export type AppReleaseState =
  | { status: "loading" }
  | { status: "available"; release: AppRelease }
  | { status: "unavailable" }
  | { status: "error" };

interface MobileDownloadBannerProps {
  releaseState: AppReleaseState;
  fallbackApkUrl: string;
  releasesUrl: string;
}

const MOBILE_HIGHLIGHTS = [
  {
    icon: BookOpenCheck,
    label: "PDF, EPUB, CBR e CBZ",
  },
  {
    icon: Cloud,
    label: "Nuvem sincronizada",
  },
  {
    icon: FolderOpen,
    label: "Leitura de pastas locais",
  },
] as const;

export function MobileDownloadBanner({
  releaseState,
  fallbackApkUrl,
  releasesUrl,
}: MobileDownloadBannerProps) {
  const directDownloadUrl =
    releaseState.status === "available"
      ? releaseState.release.downloadUrl
      : fallbackApkUrl;

  return (
    <section
      aria-labelledby="mobile-banner-title"
      className="relative isolate mt-6 overflow-hidden rounded-[2rem] border border-orange-200/20 bg-[#261B1E] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_70px_-32px_rgba(249,115,22,0.58)] sm:mt-8"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 75% 85% at 20% 58%, rgba(251, 146, 60, 0.34), transparent 72%), radial-gradient(ellipse 70% 75% at 92% 12%, rgba(194,65,12,0.2), transparent 68%)",
      }}
    >
      {/* Halftone comic dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(254,215,170,0.45) 1px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Decorative corner stamp */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-5 top-5 z-30 hidden rotate-3 rounded-md border border-amber-100/30 bg-amber-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#2D1B0E] shadow-md lg:block"
      >
        APK Android
      </span>

      <div className="relative z-10 grid grid-cols-1 lg:min-h-[430px] lg:grid-cols-[0.95fr_1.05fr]">
        {/* Visual Stage: Phone Frame + Single Representative Character */}
        <div className="relative order-2 flex min-h-[330px] flex-col justify-end overflow-hidden sm:min-h-[370px] lg:order-1 lg:min-h-[430px]">
          {/* Soft ambient wallpaper wash */}
          <img
            src={hellboyWallpaper}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.12] blur-sm"
          />

          {/* Blending gradients into the card background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#261B1E] via-transparent to-[#261B1E]/65 lg:bg-gradient-to-r lg:from-[#261B1E]/25 lg:via-transparent lg:to-[#261B1E]"
          />

          {/* Tilted Smartphone Reader Preview */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-10 left-1/2 z-10 h-[235px] w-[142px] -translate-x-[88%] -rotate-6 overflow-hidden rounded-[1.4rem] border-2 border-white/20 bg-[#151320] shadow-[0_20px_45px_rgba(0,0,0,0.65)] sm:h-[268px] sm:w-[162px] sm:-translate-x-[82%] lg:bottom-12 lg:left-10 lg:translate-x-0"
          >
            <img
              src={hellboyWallpaper}
              alt=""
              className="h-full w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12101B] via-[#12101B]/25 to-[#12101B]/70" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5 text-[8px] font-extrabold uppercase tracking-wider text-orange-100/90">
              <span>Librio</span>
              <span className="h-1.5 w-6 rounded-full bg-white/30" />
            </div>
            <div className="absolute inset-x-2.5 bottom-2.5 rounded-lg border border-white/10 bg-[#171426]/85 px-2.5 py-1.5 backdrop-blur-xs">
              <p className="truncate text-[8px] font-black uppercase tracking-wider text-amber-200">
                HQ · Edição #01
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-3/4 rounded-full bg-amber-300" />
              </div>
            </div>
          </div>

          {/* Foreground Character Cutout */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-3 z-20 flex items-end justify-center sm:pl-14 lg:pl-20">
            <img
              src={absoluteFlash}
              alt="Absolute Flash representando a leitura mobile no Librio"
              className="h-[92%] max-w-[86%] object-contain object-bottom drop-shadow-[0_18px_36px_rgba(0,0,0,0.65)]"
            />
          </div>

          {/* Static Stage Caption */}
          <div className="relative z-30 mt-auto bg-gradient-to-t from-[#261B1E] via-[#261B1E]/90 to-transparent px-5 pb-4 pt-14 sm:px-8 sm:pb-5 lg:px-10 lg:pb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 sm:text-xs">
              Quadrinhos, Mangás &amp; Livros
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-white sm:text-base">
              Leitura ágil na palma da mão
            </p>
            <p className="mt-0.5 max-w-xs text-[11px] text-orange-100/75 sm:text-xs">
              Zoom suave página por página e capítulos sincronizados com sua conta.
            </p>
          </div>
        </div>

        {/* Copy & Download CTA */}
        <div className="relative z-20 order-1 flex flex-col items-start justify-center px-5 pb-4 pt-7 sm:px-10 sm:pt-10 lg:order-2 lg:py-12 lg:pl-8 lg:pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/25 bg-[#191114]/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-100 sm:text-xs sm:tracking-[0.18em]">
              <Smartphone aria-hidden="true" size={14} className="text-amber-300" />
              Aplicativo para Android
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-200 lg:hidden">
              <Sparkles aria-hidden="true" size={11} />
              APK oficial
            </span>
          </div>

          <h2
            id="mobile-banner-title"
            className="mt-4 text-3xl font-black leading-[1.06] tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl"
          >
            Librio no bolso<span className="text-amber-300">.</span>
            <br />
            <span className="text-orange-200">Suas histórias</span> onde estiver.
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-6 text-orange-50/85 sm:text-base sm:leading-7">
            Leve livros, quadrinhos e mangás no celular. Sincronize sua
            biblioteca na nuvem para continuar da página exata onde parou ou
            abra pastas e arquivos salvos direto no aparelho.
          </p>

          {/* Feature chips */}
          <ul
            aria-label="Recursos da versão mobile"
            className="mt-5 flex flex-wrap gap-2"
          >
            {MOBILE_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-orange-50/90"
              >
                <Icon
                  aria-hidden="true"
                  size={14}
                  className="shrink-0 text-amber-300"
                />
                {label}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {releaseState.status === "available" ? (
              <a
                href={directDownloadUrl}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-extrabold text-[#2B190B] shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <Download aria-hidden="true" size={17} />
                Baixar APK ({releaseState.release.version})
              </a>
            ) : (
              <a
                href={releasesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-extrabold text-[#2B190B] shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <Download aria-hidden="true" size={17} />
                {releaseState.status === "loading"
                  ? "Verificando APK..."
                  : "Baixar versão para Android"}
              </a>
            )}

            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-orange-50 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            >
              Ver releases
              <ExternalLink aria-hidden="true" size={15} />
            </a>
          </div>

          <p className="mt-3 text-xs font-medium text-orange-100/65">
            {releaseState.status === "available"
              ? `Versão ${releaseState.release.version} pronta para Android · avisa sobre novas atualizações no próprio app.`
              : releaseState.status === "loading"
                ? "Consultando a versão mais recente publicada no GitHub..."
                : "Instalador Android (.apk) distribuído oficialmente pelas releases do GitHub."}
          </p>
        </div>
      </div>
    </section>
  );
}
