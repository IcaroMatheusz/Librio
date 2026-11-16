import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import harryPotter from "../../assets/harrypotter.png";
import spawn from "../../assets/spawn.webp";
import bleach from "../../assets/bleach.png";

const LATEST_RELEASE_API =
  "https://api.github.com/repos/IcaroMatheusz/Librio/releases/latest";
const RELEASES_URL = "https://github.com/IcaroMatheusz/Librio/releases/latest";
const ANDROID_APK_URL =
  "https://github.com/IcaroMatheusz/Librio/releases/latest/download/Librio-Android.apk";

interface DesktopRelease {
  version: string;
  downloadUrl: string;
}

type DesktopReleaseState =
  | { status: "loading" }
  | { status: "available"; release: DesktopRelease }
  | { status: "unavailable" }
  | { status: "error" };

const CHARACTERS = [
  {
    character: "Spawn",
    category: "HQs",
    image: spawn,
    description: "Suas HQs reunidas em um só lugar.",
    imageClass:
      "w-auto max-w-[96%] object-contain object-bottom brightness-110 contrast-110",
    accentClass: "text-rose-200",
  },
  {
    character: "Ichigo e Rukia",
    category: "Mangás",
    image: bleach,
    description: "Acompanhe suas histórias favoritas, capítulo por capítulo.",
    imageClass:
      "w-auto max-w-[90%] object-contain object-bottom",
    accentClass: "text-orange-200",
  },
  {
    character: "Harry Potter",
    category: "Livros",
    image: harryPotter,
    description: "Volte aos livros e continue de onde parou.",
    imageClass:
      "w-auto max-w-[94%] object-contain object-bottom",
    accentClass: "text-amber-200",
  },
];

export default function DownloadPage() {
  const [activeCharacter, setActiveCharacter] = useState(0);
  const [desktopRelease, setDesktopRelease] =
    useState<DesktopReleaseState>({ status: "loading" });
  const [mobileRelease, setMobileRelease] =
    useState<DesktopReleaseState>({ status: "loading" });
  const character = CHARACTERS[activeCharacter];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveCharacter((index) => (index + 1) % CHARACTERS.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, []);

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
            ? { status: "available", release: { version: data.tag_name, downloadUrl: apk.browser_download_url } }
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
        className="pointer-events-none absolute -left-44 top-52 size-[30rem] rounded-full bg-violet-700/10 blur-3xl"
      />
      <header className="relative border-b border-white/[0.07] bg-[#171A27]/85">
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
            className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <BookOpen
              aria-hidden="true"
              size={19}
              className="text-violet-300"
            />
            Librio
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-8 sm:pb-16 sm:pt-10 lg:px-12">
        <section
          aria-labelledby="download-title"
          className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/20 bg-[#211d36] shadow-[0_24px_70px_-30px_rgba(124,58,237,0.6)]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 90% 70% at 78% 68%, rgba(91,61,153,.24), transparent 76%), radial-gradient(ellipse 80% 65% at 12% 8%, rgba(124,45,18,.18), transparent 72%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(221,214,254,.48) 1px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="relative z-10 grid grid-cols-1 lg:min-h-[520px] lg:grid-cols-[1fr_0.9fr]">
            <div className="relative z-20 row-start-1 flex flex-col items-start px-5 pb-[320px] pt-8 sm:px-10 sm:pt-10 lg:col-start-1 lg:justify-center lg:px-14 lg:py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-[#171426]/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100 sm:text-xs sm:tracking-[0.18em]">
                <Sparkles aria-hidden="true" size={14} />
                Aplicativo para desktop
              </span>
              <h1
                id="download-title"
                className="mt-5 text-4xl font-black leading-[1.05] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl"
              >
                Librio
                <span className="text-violet-300">.</span>
                <br />
                Onde você estiver.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-violet-100/85 sm:text-base sm:leading-7">
                Baixe o Librio para Windows e leia sua biblioteca local ou na
                nuvem. O aplicativo verifica e instala atualizações publicadas
                no GitHub automaticamente.
              </p>
              <p className="mt-3 max-w-lg text-xs leading-5 text-slate-400 sm:text-sm">
                Enquanto isso, continue usando o Librio pela web. A leitura no
                navegador funciona com as obras da sua biblioteca na nuvem.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {desktopRelease.status === "available" ? (
                  <a
                    href={desktopRelease.release.downloadUrl}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-extrabold text-[#211a34] transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-5"
                  >
                    <Download aria-hidden="true" size={17} />
                    Baixar para Windows ({desktopRelease.release.version})
                  </a>
                ) : (
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-extrabold text-[#211a34] transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-5"
                  >
                    <Download aria-hidden="true" size={17} />
                    Baixar versão desktop
                  </a>
                )}
                <Link
                  to="/library"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:px-5"
                >
                  Acessar biblioteca
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </div>

            <section
              aria-label={`Categoria em destaque: ${character.category}`}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[300px] overflow-hidden sm:h-[360px] lg:relative lg:col-start-2 lg:row-start-1 lg:h-auto lg:min-h-[520px]"
            >
              <img
                key={character.character}
                src={character.image}
                alt={`${character.character}, ilustração da categoria ${character.category}`}
                className={`character-enter absolute inset-x-0 bottom-0 z-10 mx-auto h-[94%] max-h-full drop-shadow-[0_16px_38px_rgba(0,0,0,0.55)] ${character.imageClass}`}
              />
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#211d36]/95 via-[#211d36]/65 to-transparent px-5 pb-4 pt-12 sm:px-8 sm:pb-6 sm:pt-16">
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.18em] ${character.accentClass}`}
                  >
                    Continue explorando
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                    {character.category}
                  </h2>
                  <p className="mt-1 max-w-xs text-xs text-slate-300 sm:text-sm">
                    {character.description}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>

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
            <article className="rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                <Monitor aria-hidden="true" size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold">Desktop para Windows</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Instale o aplicativo para ler arquivos locais e acessar sua
                biblioteca. As atualizações são baixadas automaticamente quando
                uma nova release é publicada.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-violet-200">
                <Check aria-hidden="true" size={15} />
                {desktopRelease.status === "available"
                  ? `Versão ${desktopRelease.release.version} disponível`
                  : desktopRelease.status === "error"
                    ? "Consulte as releases no GitHub"
                    : desktopRelease.status === "loading"
                      ? "Verificando versão disponível..."
                      : "Primeiro instalador ainda não publicado"}
              </p>
            </article>
            <article className="rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                <Smartphone aria-hidden="true" size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold">Celular e tablet</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Instale o APK para Android e leve suas obras na nuvem e no
                aparelho para ler onde estiver.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {mobileRelease.status === "available" ? (
                  <a href={ANDROID_APK_URL} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2 text-xs font-extrabold text-[#15271F] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                    <Download aria-hidden="true" size={15} />
                    Baixar APK ({mobileRelease.release.version})
                  </a>
                ) : (
                  <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2 text-xs font-extrabold text-[#15271F] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                    <Download aria-hidden="true" size={15} />
                    {mobileRelease.status === "loading" ? "Verificando APK…" : "Ver releases do Android"}
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
