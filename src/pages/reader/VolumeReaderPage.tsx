import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Layers3 } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PdfReader } from "../../components/reader/PdfReader";
import { ReaderLoading } from "../../components/reader/ReaderLoading";
import {
  getBookFile,
  type BookDownloadProgress,
} from "../../services/booksService";
import {
  getVolumeById,
  getVolumeProgress,
  saveVolumeProgress,
  type BookVolume,
  type VolumeProgress,
} from "../../services/volumesService";

const EMPTY_PROGRESS: VolumeProgress = { chapterNumber: 1, progress: 0 };

export default function VolumeReaderPage() {
  const { volumeId } = useParams();
  const location = useLocation();
  const locationState: unknown = location.state;
  const returnTo =
    typeof locationState === "object" &&
    locationState !== null &&
    "returnTo" in locationState &&
    (locationState.returnTo === "/dashboard" ||
      locationState.returnTo === "/library")
      ? locationState.returnTo
      : "/library";
  const returnLabel = returnTo === "/dashboard" ? "Painel" : "Biblioteca";
  const [volume, setVolume] = useState<BookVolume | null>(null);
  const [savedProgress, setSavedProgress] =
    useState<VolumeProgress>(EMPTY_PROGRESS);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [file, setFile] = useState<Blob | null>(null);
  const [loadingVolume, setLoadingVolume] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Carregando os dados do volume...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadVolume() {
      setLoadingVolume(true);
      setError(null);
      try {
        if (!volumeId) throw new Error("O endereço deste volume é inválido.");
        const [loadedVolume, progress] = await Promise.all([
          getVolumeById(volumeId),
          getVolumeProgress(volumeId),
        ]);
        if (!active) return;
        const restoredIndex = Math.min(
          loadedVolume.chapters.length - 1,
          Math.max(0, progress.chapterNumber - 1),
        );
        setVolume(loadedVolume);
        setSavedProgress(progress);
        setChapterIndex(restoredIndex);
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir este volume.",
          );
        }
      } finally {
        if (active) setLoadingVolume(false);
      }
    }

    void loadVolume();
    return () => {
      active = false;
    };
  }, [volumeId]);

  const activeChapter = volume?.chapters[chapterIndex] ?? null;

  useEffect(() => {
    let active = true;
    async function loadChapter() {
      if (!activeChapter) return;
      setLoadingChapter(true);
      setFile(null);
      setLoadProgress(0);
      setLoadDetail(`Baixando capítulo ${chapterIndex + 1} de ${volume?.chapters.length}…`);
      setError(null);
      try {
        const chapterFile = await getBookFile(
          activeChapter.book.file_path,
          activeChapter.book.file_size,
          (progress: BookDownloadProgress) => {
            if (!active) return;
            setLoadProgress(progress.percent);
            setLoadDetail(
              `Baixando capítulo: ${progress.percent}%`,
            );
          },
        );
        if (active) setFile(chapterFile);
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar este capítulo.",
          );
        }
      } finally {
        if (active) setLoadingChapter(false);
      }
    }

    void loadChapter();
    return () => {
      active = false;
    };
  }, [activeChapter, chapterIndex, volume?.chapters.length]);

  const saveProgress = useCallback(
    async (progress: number) => {
      if (!volume) return;
      const chapterNumber = chapterIndex + 1;
      await saveVolumeProgress(volume.id, chapterNumber, progress);
    },
    [chapterIndex, volume],
  );

  function selectChapter(nextIndex: number) {
    if (!volume) return;
    const boundedIndex = Math.max(
      0,
      Math.min(volume.chapters.length - 1, nextIndex),
    );
    if (boundedIndex === chapterIndex) return;
    setSavedProgress({ chapterNumber: boundedIndex + 1, progress: 0 });
    setChapterIndex(boundedIndex);
  }

  function changeChapter(direction: -1 | 1) {
    selectChapter(chapterIndex + direction);
  }

  const loading = loadingVolume || loadingChapter;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#111421] text-white">
      <header className="relative z-10 border-b border-white/[0.07] bg-[#171A27]/80 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-3 px-3 py-3 sm:gap-4 sm:px-8 lg:px-12">
          <Link
            to={returnTo}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">{returnLabel}</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-white/10" />
          <Layers3 aria-hidden="true" size={19} className="shrink-0 text-violet-200" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">
              {volume?.title ?? "Leitor de volume"}
            </h1>
            <p className="truncate text-xs text-slate-400">
              {volume?.author ?? "PDFs organizados por capítulos"}
            </p>
          </div>
          {volume && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => changeChapter(-1)}
                disabled={chapterIndex === 0 || loading}
                aria-label="Capítulo anterior"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
              >
                <ArrowLeft aria-hidden="true" size={17} />
              </button>
              <label className="sr-only" htmlFor="volume-chapter">
                Escolher capítulo
              </label>
              <select
                id="volume-chapter"
                value={chapterIndex}
                disabled={loading}
                onChange={(event) => selectChapter(Number(event.target.value))}
                className="max-w-40 rounded-lg border border-white/10 bg-[#171A27] px-2 py-2 text-xs text-slate-200 focus-visible:outline-2 focus-visible:outline-violet-200 sm:max-w-64 sm:text-sm"
              >
                {volume.chapters.map((chapter, index) => (
                  <option key={chapter.bookId} value={index}>
                    {index + 1}. {chapter.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => changeChapter(1)}
                disabled={chapterIndex >= volume.chapters.length - 1 || loading}
                aria-label="Próximo capítulo"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
              >
                <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          )}
        </nav>
      </header>

      <section
        aria-label="Conteúdo do volume"
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-2 py-3 sm:px-6 sm:py-5 lg:px-8"
      >
        {loading ? (
          <ReaderLoading
            title={loadingVolume ? "Abrindo seu volume" : "Abrindo capítulo"}
            detail={loadDetail}
            percent={loadingVolume ? null : loadProgress}
          />
        ) : error ? (
          <article className="m-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7 text-center">
            <p role="alert" className="text-sm leading-6 text-rose-200">
              {error}
            </p>
            <Link
              to={returnTo}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Voltar para {returnLabel.toLowerCase()}
            </Link>
          </article>
        ) : file && activeChapter ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 flex items-center justify-center gap-2 truncate text-xs font-semibold text-violet-100 sm:text-sm">
              <BookOpen aria-hidden="true" size={15} />
              Capítulo {chapterIndex + 1}: {activeChapter.title}
            </p>
            <PdfReader
              key={activeChapter.bookId}
              file={file}
              initialProgress={
                savedProgress.chapterNumber === chapterIndex + 1
                  ? savedProgress.progress
                  : 0
              }
              onProgressChange={saveProgress}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
