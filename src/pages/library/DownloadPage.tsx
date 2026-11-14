import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileArchive,
  FileText,
  FolderOpen,
  Monitor,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import roronoaZoro from "../../assets/roronoazoro-download.png";
import spawn from "../../assets/spawn.webp";
import { ComicReader } from "../../components/reader/ComicReader";

type LocalBook = {
  file: File;
  type: "PDF" | "CBR" | "CBZ";
  pdfUrl: string | null;
};

const FORMAT_BY_EXTENSION: Record<string, LocalBook["type"]> = {
  pdf: "PDF",
  cbr: "CBR",
  cbz: "CBZ",
};

export default function DownloadPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [localBook, setLocalBook] = useState<LocalBook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = localBook?.pdfUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [localBook]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(null);
    setLocalBook(null);
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = FORMAT_BY_EXTENSION[extension];
    if (!type) {
      setError("Escolha um arquivo PDF, CBR ou CBZ.");
      return;
    }
    if (file.size === 0) {
      setError("Este arquivo está vazio. Escolha outro para continuar.");
      return;
    }

    setLocalBook({
      file,
      type,
      pdfUrl: type === "PDF" ? URL.createObjectURL(file) : null,
    });
  }

  function closeReader() {
    setLocalBook(null);
    setError(null);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-44 top-52 size-[30rem] rounded-full bg-violet-700/10 blur-3xl"
      />
      <header className="relative border-b border-white/[0.07] bg-[#171A27]/85">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Minha biblioteca
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <BookOpen aria-hidden="true" size={19} className="text-violet-300" />
            Librio
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-8 sm:pb-16 sm:pt-10 lg:px-12">
        <section className="relative isolate mb-8 overflow-hidden rounded-[1.75rem] border border-violet-200/10 bg-gradient-to-br from-[#32274f] via-[#28243f] to-[#202238] shadow-2xl shadow-black/25 sm:mb-10 sm:rounded-[2rem]">
          <div className="relative min-h-[310px] px-5 py-7 sm:min-h-[350px] sm:px-8 sm:py-9 lg:min-h-[390px] lg:px-12 lg:py-11">
            <div className="relative z-10 max-w-[74%] sm:max-w-[58%] lg:max-w-[52%]">
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-200/15 bg-violet-200/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100 sm:text-xs">
                <Sparkles aria-hidden="true" size={14} />
                Librio no seu ritmo
              </p>
              <h1 className="mt-4 text-3xl font-black leading-[1.08] tracking-tight sm:mt-5 sm:text-4xl lg:text-5xl">
                Suas histórias,
                <br />
                em qualquer tela.
              </h1>
              <p className="mt-3 max-w-lg text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6 lg:text-base">
                Abra um arquivo do seu computador ou celular e leia direto no
                navegador. Nada é enviado para sua conta.
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-extrabold text-[#211a34] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-7 sm:min-h-12 sm:px-5"
              >
                <FolderOpen aria-hidden="true" size={18} />
                Abrir arquivo para ler
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.cbr,.cbz,application/pdf,application/vnd.comicbook-rar,application/vnd.comicbook+zip"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Escolher arquivo PDF, CBR ou CBZ do dispositivo"
              />
              {error && (
                <p role="alert" className="mt-3 text-xs font-medium text-rose-200">
                  {error}
                </p>
              )}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-3/4 bg-gradient-to-l from-transparent via-[#28243f]/20 to-[#28243f]/75"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 right-[10%] z-0 size-64 rounded-full bg-violet-400/20 blur-[80px] sm:size-80"
            />
            <img
              src={spawn}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-10 z-0 h-[78%] w-[50%] object-contain object-bottom brightness-125 contrast-110 saturate-125 drop-shadow-[0_0_24px_rgba(255,73,92,0.42)] sm:-bottom-8 sm:right-[1%] sm:h-[95%] sm:w-[42%] lg:-bottom-10 lg:right-[3%] lg:h-[105%] lg:w-[37%]"
            />
            <img
              src={roronoaZoro}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-8 -left-8 z-0 h-[55%] w-[38%] object-contain object-bottom opacity-20 drop-shadow-[0_0_20px_rgba(144,204,120,0.4)] sm:-bottom-10 sm:left-[38%] sm:h-[75%] sm:w-[30%] sm:opacity-35 lg:left-[42%] lg:h-[82%] lg:w-[25%]"
            />
          </div>
        </section>

        {localBook ? (
          <section
            aria-labelledby="local-reader-title"
            className="overflow-hidden rounded-3xl border border-white/10 bg-[#202435]"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                  {localBook.type === "PDF" ? (
                    <FileText aria-hidden="true" size={19} />
                  ) : (
                    <FileArchive aria-hidden="true" size={19} />
                  )}
                </span>
                <div className="min-w-0">
                  <h2
                    id="local-reader-title"
                    className="truncate text-sm font-bold text-white sm:text-base"
                  >
                    {localBook.file.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {localBook.type} · arquivo local
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReader}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 sm:text-sm"
              >
                <X aria-hidden="true" size={16} />
                Fechar leitura
              </button>
            </header>
            <div className="min-h-[65dvh] p-2 sm:p-4">
              {localBook.type === "PDF" ? (
                localBook.pdfUrl ? (
                  <iframe
                    title={`Leitor de ${localBook.file.name}`}
                    src={localBook.pdfUrl}
                    className="h-[75dvh] min-h-[520px] w-full rounded-xl border border-white/10 bg-white"
                  />
                ) : (
                  <p role="status" className="p-8 text-center text-slate-300">
                    Preparando seu PDF...
                  </p>
                )
              ) : (
                <ComicReader fileType={localBook.type} file={localBook.file} />
              )}
            </div>
          </section>
        ) : (
          <section aria-labelledby="devices-title">
            <header className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-violet-200 sm:text-sm">
                Uma versão web, duas formas de ler
              </p>
              <h2
                id="devices-title"
                className="mt-1.5 text-xl font-extrabold sm:text-2xl"
              >
                Feito para suas telas
              </h2>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <article className="rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                  <Monitor aria-hidden="true" size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold">No computador</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Escolha o arquivo no seu computador e aproveite a leitura na
                  tela grande.
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Check aria-hidden="true" size={15} className="text-emerald-200" />
                  PDF, CBR e CBZ
                </p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-[#202435]/90 p-5 sm:p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                  <Smartphone aria-hidden="true" size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold">No celular ou tablet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Abra esta página no navegador móvel e selecione uma obra nos
                  arquivos do dispositivo.
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Check aria-hidden="true" size={15} className="text-emerald-200" />
                  Leitura direto no navegador
                </p>
              </article>
            </div>
            <p className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-slate-400 sm:text-sm">
              A versão web abre os arquivos localmente no navegador e não cria
              instaladores nativos para desktop ou celular. Seus arquivos
              permanecem no dispositivo e não são enviados para o Librio.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
