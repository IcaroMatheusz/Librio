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
  ReaderModeToggle,
  type ReadingMode,
} from "./ReaderModeToggle";
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
  const verticalViewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const previousReadingModeRef = useRef<ReadingMode>("page");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const [pages, setPages] = useState<DisplayPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [readingMode, setReadingMode] = useState<ReadingMode>("page");
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadDetail, setLoadDetail] = useState("Lendo o índice do arquivo…");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const pinchZoom = usePinchZoom(zoom, setZoom);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const viewport = verticalViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [loading, readingMode]);

  useEffect(() => {
    if (!pages.length) return;
    for (const index of [pageIndex - 1, pageIndex + 1, pageIndex + 2]) {
      const page = pages[index];
      if (page) {
        const preloadedImage = new Image();
        preloadedImage.src = page.url;
      }
    }
  }, [pageIndex, pages]);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return;
    function exitImmersiveMode(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", exitImmersiveMode);
    return () => window.removeEventListener("keydown", exitImmersiveMode);
  }, [isFullscreen]);

  const changePage = useCallback(
    (delta: number) => {
      const nextIndex = Math.min(
        pages.length - 1,
        Math.max(0, pageIndex + delta),
      );
      setPageIndex(nextIndex);
      if (readingMode === "vertical") {
        window.requestAnimationFrame(() => {
          verticalViewportRef.current
            ?.querySelector<HTMLElement>(`[data-page-index="${nextIndex}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [pageIndex, pages.length, readingMode],
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
    const viewport = verticalViewportRef.current;
    if (readingMode !== "vertical" || !viewport) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePages = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio);
        const page = visiblePages[0]?.target.getAttribute("data-page-index");
        if (page !== null && page !== undefined) {
          setPageIndex(Number(page));
        }
      },
      { root: viewport, threshold: [0.25, 0.5, 0.75] },
    );
    viewport
      .querySelectorAll("[data-page-index]")
      .forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [pages, readingMode]);

  useEffect(() => {
    const modeChanged = previousReadingModeRef.current !== readingMode;
    previousReadingModeRef.current = readingMode;
    if (readingMode !== "vertical" || !modeChanged) return;
    window.requestAnimationFrame(() => {
      verticalViewportRef.current
        ?.querySelector<HTMLElement>(`[data-page-index="${pageIndex}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  }, [pageIndex, readingMode]);

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
    if (readingMode !== "page") return;
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
      className={`flex min-h-[72dvh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151827] shadow-2xl shadow-black/25 ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] min-h-0 w-screen rounded-none border-0"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#202435]/90 px-2 py-2 backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReaderModeToggle mode={readingMode} onChange={setReadingMode} />
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
              } else if (isFullscreen) {
                setIsFullscreen(false);
              } else {
                const reader = readerRef.current;
                if (!reader?.requestFullscreen) {
                  setIsFullscreen(true);
                } else {
                  void reader.requestFullscreen().catch(() => {
                    setIsFullscreen(true);
                  });
                }
              }
            }}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Alternar tela cheia"}
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
          >
            <Maximize aria-hidden="true" size={17} />
          </button>
          </div>
        </div>
      </div>

      <figure className="grid min-h-0 flex-1 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.07),transparent_65%)] p-2 sm:gap-3 sm:p-4">
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(-1)}
          disabled={pageIndex === 0}
          aria-label="Página anterior"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        )}
        <div
          ref={verticalViewportRef}
          onClick={navigateFromPageClick}
          onPointerDown={pinchZoom.handlePointerDown}
          onPointerMove={pinchZoom.handlePointerMove}
          onPointerUp={pinchZoom.handlePointerUp}
          onPointerCancel={pinchZoom.handlePointerCancel}
          className={`min-h-0 min-w-0 overflow-auto ${
            readingMode === "vertical"
              ? `col-span-3 h-full space-y-0 overflow-y-auto ${
                  isFullscreen ? "overscroll-contain" : ""
                }`
              : `flex h-full ${zoom > 1 ? "items-start justify-start" : "items-center justify-center"}`
          }`}
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
        >
          {readingMode === "vertical" ? (
            pages.map((page, index) => (
              <div
                key={`${page.name}-${index}`}
                data-page-index={index}
                className="flex w-full justify-center"
              >
                <img
                  src={page.url}
                  alt={`Página ${index + 1} de ${pages.length}`}
                  loading={Math.abs(index - pageIndex) <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="block h-auto max-w-full object-contain"
                  style={{
                    zoom,
                    transform: `scale(${pinchZoom.previewScale})`,
                  }}
                />
              </div>
            ))
          ) : (
            <img
              src={currentPage.url}
              alt={`Página ${pageIndex + 1} de ${pages.length}`}
              decoding="async"
              className={`max-w-full cursor-pointer object-contain shadow-2xl shadow-black/40 ${
                isFullscreen
                  ? "max-h-[calc(100dvh-100px)]"
                  : "max-h-[calc(100dvh-180px)]"
              }`}
              style={{
                zoom,
                transform: `scale(${pinchZoom.previewScale})`,
                maxHeight:
                  viewportSize.height > 0
                    ? `${viewportSize.height}px`
                    : undefined,
                maxWidth:
                  viewportSize.width > 0
                    ? `${viewportSize.width}px`
                    : undefined,
              }}
            />
          )}
        </div>
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(1)}
          disabled={pageIndex === pages.length - 1}
          aria-label="Próxima página"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
        )}
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
