import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize,
  Minus,
  Plus,
} from "lucide-react";

import { ReaderLoading } from "./ReaderLoading";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import {
  extractComicPages,
  type ArchivePage,
} from "../../services/archiveReaderService";

interface ComicReaderProps {
  fileType: string;
  file: Blob;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
}

interface DisplayPage extends ArchivePage {
  url: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ComicReader({
  fileType,
  file,
  initialProgress,
  onProgressChange,
}: ComicReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const [pages, setPages] = useState<DisplayPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Lendo o índice do arquivo…");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const pinchZoom = usePinchZoom(zoom, setZoom);

  const changePage = useCallback(
    (delta: number) => {
      const nextIndex = Math.min(
        pages.length - 1,
        Math.max(0, pageIndex + delta),
      );
      setPageIndex(nextIndex);
    },
    [pageIndex, pages.length],
  );

  useEffect(() => {
    let active = true;
    let objectUrls: string[] = [];

    async function loadPages() {
      try {
        const extractedPages = await extractComicPages(
          fileType,
          file,
          (completed, total) => {
            if (active && total > 0) {
              setLoadProgress(Math.round((completed / total) * 100));
              setLoadDetail(
                `Descompactando imagem ${completed} de ${total}…`,
              );
            }
          },
        );
        objectUrls = extractedPages.map(({ blob }) =>
          URL.createObjectURL(blob),
        );
        if (active) {
          const restoredPage =
            initialProgress > 0
              ? Math.min(
                  extractedPages.length - 1,
                  Math.max(
                    0,
                    Math.ceil(
                      (initialProgress / 100) * extractedPages.length,
                    ) - 1,
                  ),
                )
              : 0;
          setPages(
            extractedPages.map((page, index) => ({
              ...page,
              url: objectUrls[index],
            })),
          );
          setPageIndex(restoredPage);
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir este arquivo de quadrinhos.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPages();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file, fileType, initialProgress]);

  useEffect(() => {
    if (loading || !pages.length) return;
    let active = true;
    const requestId = ++saveRequestRef.current;
    const progress = Math.min(
      100,
      Math.max(1, Math.round(((pageIndex + 1) / pages.length) * 100)),
    );
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => {
        if (!active || requestId !== saveRequestRef.current) return;
        setSaveStatus("saving");
        setSaveError(null);
        return onProgressChange(progress);
      })
      .then(() => {
        if (active && requestId === saveRequestRef.current) {
          setSaveStatus("saved");
        }
      })
      .catch((caughtError: unknown) => {
        if (active && requestId === saveRequestRef.current) {
          setSaveError(
            caughtError instanceof Error
              ? caughtError.message
              : "Erro desconhecido ao sincronizar o progresso.",
          );
          setSaveStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [loading, onProgressChange, pageIndex, pages.length, saveAttempt]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") {
        changePage(-1);
      } else if (event.key === "ArrowRight") {
        changePage(1);
      } else if (event.key === "+" || event.key === "=") {
        setZoom((current) => Math.min(3, current + 0.1));
      } else if (event.key === "-") {
        setZoom((current) => Math.max(0.5, current - 0.1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changePage]);

  function navigateFromPageClick(event: MouseEvent<HTMLElement>) {
    if (pinchZoom.consumePinchClick()) return;
    if (event.button !== 0 || !(event.target instanceof HTMLImageElement)) {
      return;
    }

    const bounds = event.target.getBoundingClientRect();
    const clickedRightSide = event.clientX >= bounds.left + bounds.width / 2;
    changePage(clickedRightSide ? 1 : -1);
  }

  if (loading) {
    return (
      <ReaderLoading
        title={`Construindo páginas do ${fileType}`}
        detail={`${loadDetail} ${loadProgress}% concluído`}
        percent={loadProgress}
      />
    );
  }

  if (error || pages.length === 0) {
    return (
      <p role="alert" className="m-auto p-8 text-center text-rose-200">
        {error ?? "Este arquivo não contém páginas para exibir."}
      </p>
    );
  }

  const currentPage = pages[pageIndex];

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de quadrinhos"
      className="flex min-h-[72dvh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151827] shadow-2xl shadow-black/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#202435]/90 px-2 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={pageIndex === 0}
            aria-label="Página anterior"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <span
            aria-live="polite"
            className="min-w-20 text-center text-sm font-semibold tabular-nums text-slate-200"
          >
            {pageIndex + 1} <span className="text-slate-500">/</span>{" "}
            {pages.length}
          </span>
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={pageIndex === pages.length - 1}
            aria-label="Próxima página"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}
            disabled={zoom <= 0.5}
            aria-label="Diminuir zoom"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <Minus aria-hidden="true" size={17} />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(3, current + 0.1))}
            disabled={zoom >= 3}
            aria-label="Aumentar zoom"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <Plus aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen();
              } else {
                void readerRef.current?.requestFullscreen();
              }
            }}
            aria-label="Alternar tela cheia"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
          >
            <Maximize aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      <figure className="grid flex-1 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1 overflow-auto bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.07),transparent_65%)] p-2 sm:gap-3 sm:p-4">
        <button
          type="button"
          onClick={() => changePage(-1)}
          disabled={pageIndex === 0}
          aria-label="Página anterior"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div
          onClick={navigateFromPageClick}
          onPointerDown={pinchZoom.handlePointerDown}
          onPointerMove={pinchZoom.handlePointerMove}
          onPointerUp={pinchZoom.handlePointerUp}
          onPointerCancel={pinchZoom.handlePointerCancel}
          className={`h-full min-h-0 min-w-0 overflow-auto ${
            zoom > 1
              ? "flex items-start justify-start"
              : "flex items-center justify-center"
          }`}
          style={{ touchAction: "pan-x pan-y" }}
        >
          <img
            src={currentPage.url}
            alt={`Página ${pageIndex + 1} de ${pages.length}`}
            className="max-h-[calc(100dvh-180px)] max-w-full cursor-pointer object-contain shadow-2xl shadow-black/40"
            style={{
              zoom,
              transform: `scale(${pinchZoom.previewScale})`,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => changePage(1)}
          disabled={pageIndex === pages.length - 1}
          aria-label="Próxima página"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </figure>

      <footer className="flex min-h-9 items-center justify-end border-t border-white/[0.08] bg-[#202435]/70 px-4 text-xs text-slate-400">
        {saveStatus === "saving" && <span role="status">Sincronizando progresso…</span>}
        {saveStatus === "saved" && <span role="status">Progresso sincronizado</span>}
        {saveStatus === "error" && (
          <span className="flex min-w-0 items-center gap-2 text-rose-200">
            <span className="truncate" title={saveError ?? undefined}>
              {saveError ?? "Não foi possível sincronizar o progresso."}
            </span>
            <button
              type="button"
              onClick={() => setSaveAttempt((attempt) => attempt + 1)}
              className="shrink-0 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-200"
            >
              Tentar novamente
            </button>
          </span>
        )}
      </footer>
    </section>
  );
}
