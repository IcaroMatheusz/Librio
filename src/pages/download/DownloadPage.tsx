import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Check,
  Cloud,
  Download,
  ExternalLink,
  FolderOpen,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import bleach from "../../assets/bleach.png";
import harryPotter from "../../assets/harrypotter.png";
import onePieceWallpaper from "../../assets/mobile/onepiece_wallpaper.jpg";
import spawn from "../../assets/spawn.webp";
import {
  MobileDownloadBanner,
  type AppReleaseState,
} from "../../components/download/MobileDownloadBanner";

const LATEST_RELEASE_API =
  "https://api.github.com/repos/IcaroMatheusz/Librio/releases/latest";
const RELEASES_URL = "https://github.com/IcaroMatheusz/Librio/releases/latest";
const ANDROID_APK_URL =
  "https://github.com/IcaroMatheusz/Librio/releases/latest/download/Librio-Android.apk";

const CHARACTERS = [
  {
    character: "Spawn",
    category: "HQs",
    readerMeta: "HQ · Edição #01 · CBR",
    progress: "72%",
    image: spawn,
    description: "Suas HQs reunidas em tela cheia, com zoom nítido página a página.",
    imageClass:
      "h-[90%] max-w-[92%] object-contain object-bottom brightness-105 contrast-105",
    accentClass: "text-rose-200",
    glowColor: "rgba(168, 85, 247, 0.34)",
  },
  {
    character: "Ichigo e Rukia",
    category: "Mangás",
    readerMeta: "Mangá · Vol. 14 · CBZ",
    progress: "85%",
    image: bleach,
    description: "Acompanhe sagas e volumes locais ou na nuvem, capítulo por capítulo.",
    imageClass: "h-[90%] max-w-[88%] object-contain object-bottom",
    accentClass: "text-violet-200",
    glowColor: "rgba(139, 92, 246, 0.36)",
  },
  {
    character: "Harry Potter",
    category: "Livros",
    readerMeta: "Livro · Cap. 09 · EPUB",
    progress: "64%",
    image: harryPotter,
    description: "Conforto de leitura personalizável para voltar exatamente onde parou.",
    imageClass: "h-[88%] max-w-[86%] object-contain object-bottom",
    accentClass: "text-amber-200",
    glowColor: "rgba(124, 58, 237, 0.34)",
  },
] as const;

const DESKTOP_HIGHLIGHTS = [
  {
    icon: FolderOpen,
    label: "Arquivos e pastas locais",
  },
  {
    icon: RefreshCw,
    label: "Atualizações automáticas",
  },
  {
    icon: BookOpenCheck,
    label: "PDF, EPUB, CBR e CBZ",
  },
  {
    icon: Cloud,
    label: "Nuvem sincronizada",
  },
] as const;

export default function DownloadPage() {
  const [activeCharacter, setActiveCharacter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [desktopRelease, setDesktopRelease] =
    useState<AppReleaseState>({ status: "loading" });
  const [mobileRelease, setMobileRelease] =
    useState<AppReleaseState>({ status: "loading" });
  const character = CHARACTERS[activeCharacter];

  useEffect(() => {
    if (paused) return;

    const intervalId = window.setInterval(() => {
      setActiveCharacter((index) => (index + 1) % CHARACTERS.length);
    }, 3600);

    return () => window.clearInterval(intervalId);
  }, [paused]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadLatestRelease() {
      try {
        const response = await fetch(LATEST_RELEASE_API, {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        });
        if (response.status === 404) {
          setDesktopRelease({ status: "unavailable" });
          setMobileRelease({ status: "unavailable" });
          return;
        }
        if (!response.ok) {
          throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
        }

        const release: unknown = await response.json();
        if (typeof release !== "object" || release === null) {
          throw new Error("A resposta do GitHub é inválida.");
        }
        const data = release as {
          tag_name?: unknown;
          assets?: unknown;
        };
        if (
          typeof data.tag_name !== "string" ||
          !Array.isArray(data.assets)
        ) {
          throw new Error("A release do GitHub não contém os dados esperados.");
        }
        const apk = data.assets.find(
          (asset): asset is { name: string; browser_download_url: string } =>
            typeof asset === "object" &&
            asset !== null &&
            "name" in asset &&
            typeof asset.name === "string" &&
            asset.name.toLowerCase() === "librio-android.apk" &&
            "browser_download_url" in asset &&
            typeof asset.browser_download_url === "string",
        );
        setMobileRelease(
          apk
            ? {
                status: "available",
                release: {
                  version: data.tag_name,
                  downloadUrl: apk.browser_download_url,
                },
              }
            : { status: "unavailable" },
        );

        const installer = data.assets.find(
          (asset): asset is { name: string; browser_download_url: string } =>
            typeof asset === "object" &&
            asset !== null &&
            "name" in asset &&
            typeof asset.name === "string" &&
            asset.name.toLowerCase().endsWith(".exe") &&
            asset.name.toLowerCase().includes("setup") &&
            "browser_download_url" in asset &&
            typeof asset.browser_download_url === "string",
        );
        if (!installer) {
          setDesktopRelease({ status: "unavailable" });
          return;
        }
        setDesktopRelease({
          status: "available",
          release: {
            version: data.tag_name,
            downloadUrl: installer.browser_download_url,
          },
        });
      } catch {
        if (!controller.signal.aborted) {
          setDesktopRelease({ status: "error" });
          setMobileRelease({ status: "error" });
        }
      }
    }

    void loadLatestRelease();
    return () => controller.abort();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-44 top-40 size-[32rem] rounded-full bg-violet-700/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-44 top-[34rem] size-[28rem] rounded-full bg-orange-600/10 blur-3xl"
      />

      <header className="relative border-b border-white/[0.07] bg-[#171A27]/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/dashboard"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Painel
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-base font-extrabold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <BookOpen
              aria-hidden="true"
              size={19}
              className="text-violet-300"
            />
            Librio<span className="text-violet-300">.</span>
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-8 sm:pb-16 sm:pt-10 lg:px-12">
        {/* Desktop Download Hero Card */}
        <section
          aria-labelledby="download-title"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/20 bg-[#201C35] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_26px_75px_-32px_rgba(124,58,237,0.65)]"
          style={{
            backgroundImage: `radial-gradient(ellipse 78% 82% at 80% 58%, ${character.glowColor}, transparent 72%), radial-gradient(ellipse 70% 65% at 10% 10%, rgba(109,40,217,0.22), transparent 68%)`,
          }}
        >
          {/* Halftone comic dot texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(221,214,254,0.45) 1px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
          />

          {/* Decorative corner stamp */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-5 top-5 z-30 hidden -rotate-3 rounded-md border border-violet-100/35 bg-violet-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#22183A] shadow-md lg:block"
          >
            Windows x64
          </span>

          <div className="relative z-10 grid grid-cols-1 lg:min-h-[480px] lg:grid-cols-[1.06fr_0.94fr]">
            {/* Left Column: Copy, Feature Chips & Actions */}
            <div className="relative z-20 flex flex-col items-start justify-center px-5 pb-4 pt-7 sm:px-10 sm:pt-10 lg:py-12 lg:pl-14 lg:pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-[#151225]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100 sm:text-xs sm:tracking-[0.18em]">
                  <Monitor aria-hidden="true" size={14} className="text-violet-300" />
                  Aplicativo para Windows
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/20 bg-violet-300/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-200">
                  <Sparkles aria-hidden="true" size={11} />
                  {desktopRelease.status === "available"
                    ? `Release ${desktopRelease.release.version}`
                    : "Auto-update integrado"}
                </span>
              </div>

              <h1
                id="download-title"
                className="mt-4 text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.35rem]"
              >
                Librio no PC<span className="text-violet-300">.</span>
                <br />
                <span className="text-violet-200">Sua estante</span> sem limites.
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-violet-100/85 sm:text-base sm:leading-7">
                Instale o Librio para Windows e leia tanto sua coleção salva no
                computador quanto sua biblioteca na nuvem, com atualizações
                baixadas automaticamente a cada nova versão.
              </p>

              {/* Feature Chips */}
              <ul
                aria-label="Recursos da versão desktop"
                className="mt-5 flex flex-wrap gap-2"
              >
                {DESKTOP_HIGHLIGHTS.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-violet-50/90"
                  >
                    <Icon
                      aria-hidden="true"
                      size={14}
                      className="shrink-0 text-violet-300"
                    />
                    {label}
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {desktopRelease.status === "available" ? (
                  <a
                    href={desktopRelease.release.downloadUrl}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-extrabold text-[#1E1733] shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Download aria-hidden="true" size={17} />
                    Baixar para Windows ({desktopRelease.release.version})
                  </a>
                ) : (
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-extrabold text-[#1E1733] shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Download aria-hidden="true" size={17} />
                    {desktopRelease.status === "loading"
                      ? "Verificando instalador..."
                      : "Baixar versão desktop"}
                  </a>
                )}

                <Link
                  to="/library"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:px-5"
                >
                  Acessar biblioteca web
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>

              <p className="mt-3 text-xs font-medium text-violet-100/65">
                {desktopRelease.status === "available"
                  ? `Instalador oficial (.exe) da versão ${desktopRelease.release.version} · compatível com Windows 10 e 11.`
                  : desktopRelease.status === "loading"
                    ? "Consultando o instalador mais recente publicado no GitHub..."
                    : "Você também pode continuar lendo suas obras da nuvem direto pelo navegador."}
              </p>
            </div>

            {/* Right Column: Desktop Reader Window Mockup + Character Spotlight */}
            <section
              aria-label={`Categoria em destaque: ${character.category}`}
              className="relative flex min-h-[340px] flex-col justify-end overflow-hidden sm:min-h-[390px] lg:min-h-[480px]"
            >
              {/* Soft ambient backdrop wash */}
              <img
                src={onePieceWallpaper}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.09] blur-sm"
              />

              {/* Seamless blend into card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#201C35] via-transparent to-[#201C35]/65 lg:bg-gradient-to-l lg:from-[#201C35]/20 lg:via-transparent lg:to-[#201C35]"
              />

              {/* Floating Desktop App Window Mockup */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-14 left-1/2 z-10 h-[210px] w-[280px] -translate-x-1/2 rotate-2 overflow-hidden rounded-2xl border border-violet-200/20 bg-[#141322]/95 shadow-[0_24px_55px_rgba(0,0,0,0.65)] sm:h-[235px] sm:w-[330px] lg:bottom-16 lg:left-6 lg:translate-x-0"
              >
                {/* Window Titlebar */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#1B192E] px-3.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-400/75" />
                    <span className="size-2 rounded-full bg-amber-300/75" />
                    <span className="size-2 rounded-full bg-emerald-400/75" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-violet-200/85">
                    Librio Desktop
                  </span>
                  <span className="rounded bg-violet-400/15 px-1.5 py-0.5 text-[8px] font-bold text-violet-200">
                    Offline
                  </span>
                </div>

                {/* Window Inner Reader Canvas */}
                <div className="relative h-full p-3">
                  <img
                    src={onePieceWallpaper}
                    alt=""
                    className="h-28 w-full rounded-lg object-cover opacity-45 sm:h-32"
                  />
                  <div className="absolute inset-x-3 top-3 h-28 rounded-lg bg-gradient-to-t from-[#141322] via-[#141322]/35 to-transparent sm:h-32" />

                  <div className="mt-2.5 rounded-xl border border-white/10 bg-[#1D1A30]/90 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-violet-200">
                      <span className="truncate">{character.readerMeta}</span>
                      <span>{character.progress}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-violet-300 transition-all duration-500"
                        style={{ width: character.progress }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Foreground Character Cutout */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-4 z-20 flex items-end justify-center sm:pl-16 lg:pl-20">
                <img
                  key={character.character}
                  src={character.image}
                  alt={`${character.character}, ilustração da categoria ${character.category}`}
                  className={`character-enter drop-shadow-[0_20px_42px_rgba(0,0,0,0.68)] ${character.imageClass}`}
                />
              </div>

              {/* Stage Footer Caption + Category Switcher */}
              <div className="relative z-30 mt-auto bg-gradient-to-t from-[#201C35] via-[#201C35]/92 to-transparent px-5 pb-4 pt-14 sm:px-8 sm:pb-6 lg:px-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.18em] sm:text-xs ${character.accentClass}`}
                    >
                      Continue explorando
                    </p>
                    <h2 className="mt-0.5 text-lg font-black text-white sm:text-xl">
                      {character.category}
                    </h2>
                    <p className="mt-0.5 max-w-xs text-[11px] text-slate-300 sm:text-xs">
                      {character.description}
                    </p>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Categorias em destaque no Librio Desktop"
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 backdrop-blur-xs"
                  >
                    {CHARACTERS.map((item, index) => {
                      const isActive = index === activeCharacter;
                      return (
                        <button
                          key={item.category}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`Destacar categoria ${item.category}`}
                          onClick={() => setActiveCharacter(index)}
                          className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 ${
                            isActive
                              ? "w-6 bg-violet-300"
                              : "w-2 bg-white/30 hover:bg-white/60"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <MobileDownloadBanner
          releaseState={mobileRelease}
          fallbackApkUrl={ANDROID_APK_URL}
          releasesUrl={RELEASES_URL}
        />

        <section aria-labelledby="platforms-title" className="mt-8 sm:mt-10">
          <header className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200 sm:text-sm">
              Uma experiência para cada tela
            </p>
            <h2
              id="platforms-title"
              className="mt-1.5 text-xl font-extrabold sm:text-2xl"
            >
              Aplicativos Librio
            </h2>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                  <Monitor aria-hidden="true" size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold">Desktop para Windows</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Instale o aplicativo para ler arquivos locais e acessar sua
                  biblioteca. As atualizações são baixadas automaticamente quando
                  uma nova release é publicada.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {desktopRelease.status === "available" ? (
                  <a
                    href={desktopRelease.release.downloadUrl}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-300 px-4 py-2 text-xs font-extrabold text-[#1E1733] transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Download aria-hidden="true" size={15} />
                    Baixar .exe ({desktopRelease.release.version})
                  </a>
                ) : (
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
                  >
                    Ver releases Windows
                    <ExternalLink aria-hidden="true" size={14} />
                  </a>
                )}
                <p className="inline-flex items-center gap-2 text-xs font-bold text-violet-200">
                  <Check aria-hidden="true" size={15} />
                  {desktopRelease.status === "available"
                    ? `Versão ${desktopRelease.release.version} disponível`
                    : desktopRelease.status === "error"
                      ? "Consulte as releases no GitHub"
                      : desktopRelease.status === "loading"
                        ? "Verificando versão disponível..."
                        : "Primeiro instalador ainda não publicado"}
                </p>
              </div>
            </article>

            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                  <Smartphone aria-hidden="true" size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold">Celular e tablet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Instale o APK para Android e leve suas obras na nuvem e no
                  aparelho para ler onde estiver.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {mobileRelease.status === "available" ? (
                  <a
                    href={mobileRelease.release.downloadUrl}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2 text-xs font-extrabold text-[#15271F] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Download aria-hidden="true" size={15} />
                    Baixar APK ({mobileRelease.release.version})
                  </a>
                ) : (
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2 text-xs font-extrabold text-[#15271F] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <Download aria-hidden="true" size={15} />
                    {mobileRelease.status === "loading"
                      ? "Verificando APK…"
                      : "Ver releases do Android"}
                  </a>
                )}
                <p className="inline-flex items-center gap-2 text-xs font-bold text-emerald-200">
                  <Check aria-hidden="true" size={15} />
                  {mobileRelease.status === "available"
                    ? `Versão ${mobileRelease.release.version} disponível`
                    : mobileRelease.status === "error"
                      ? "Consulte as releases no GitHub"
                      : mobileRelease.status === "loading"
                        ? "Verificando APK disponível..."
                        : "APK ainda não publicado"}
                </p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
