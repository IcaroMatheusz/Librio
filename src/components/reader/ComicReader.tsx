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
  BookOpen,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Maximize,
} from "lucide-react";

import { ReaderLoading } from "./ReaderLoading";
import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useReaderTheme } from "../../hooks/useReaderTheme";
import {
  ReaderModeToggle,
  type ReadingMode,
} from "./ReaderModeToggle";
import { ReaderThemeToggle } from "./ReaderThemeToggle";
import { ReaderZoomControls } from "./ReaderZoomControls";
import { getReaderScrollBehavior } from "./readerAccessibility";
import {
  extractComicPages,
  type ArchivePage,
} from "../../services/archiveReaderService";

interface ComicReaderProps {
  fileType: string;
  file: Blob;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
  onEnd?: () => void;
}

interface DisplayPage extends ArchivePage {
  url: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function getDisplayDimensions(
  dimensions: ImageDimensions | undefined,
  viewport: ImageDimensions,
  zoom: number,
  fitHeight: boolean,
) {
  if (!dimensions || viewport.width <= 0 || viewport.height <= 0) return null;

  const fitScale = Math.min(
    viewport.width / dimensions.width,
    fitHeight ? viewport.height / dimensions.height : 1,
  );
  return {
    width: Math.round(dimensions.width * fitScale * zoom),
    height: Math.round(dimensions.height * fitScale * zoom),
  };
}

export function ComicReader({
  fileType,
  file,
  initialProgress,
  onProgressChange,
  onEnd,
}: ComicReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const verticalViewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const previousReadingModeRef = useRef<ReadingMode>("page");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const [pages, setPages] = useState<DisplayPage[]>([]);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, ImageDimensions>
  >({});
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
  const { theme, setTheme } = useReaderTheme();

  function recordImageDimensions(url: string, image: HTMLImageElement) {
    if (!image.naturalWidth || !image.naturalHeight) return;
    setImageDimensions((current) => ({
      ...current,
      [url]: { width: image.naturalWidth, height: image.naturalHeight },
    }));
  }

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
    const viewport = verticalViewportRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(
        0,
        (viewport.scrollWidth - viewport.clientWidth) / 2,
      );
      if (readingMode === "page") viewport.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [imageDimensions, pageIndex, readingMode, viewportSize, zoom]);

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
      if (delta > 0 && pageIndex >= pages.length - 1) {
        onEnd?.();
        return;
      }
      const nextIndex = Math.min(
        pages.length - 1,
        Math.max(0, pageIndex + delta),
      );
      setPageIndex(nextIndex);
      if (readingMode === "vertical") {
        window.requestAnimationFrame(() => {
          verticalViewportRef.current
            ?.querySelector<HTMLElement>(`[data-page-index="${nextIndex}"]`)
            ?.scrollIntoView({
              behavior: getReaderScrollBehavior(),
              block: "start",
            });
        });
      }
    },
    [onEnd, pageIndex, pages.length, readingMode],
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
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, select, textarea, a, [contenteditable='true']")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        changePage(-1);
      } else if (event.key === "ArrowRight") {
        changePage(1);
      } else if (event.key === "+" || event.key === "=") {
        setZoom((current) =>
          Math.min(3, Math.round((current + 0.1) * 10) / 10),
        );
      } else if (event.key === "-") {
        setZoom((current) =>
          Math.max(0.5, Math.round((current - 0.1) * 10) / 10),
        );
      } else if (event.key === "0") {
        setZoom(1);
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
        theme={theme}
      />
    );
  }

  if (error || pages.length === 0) {
    return (
      <p
        role="alert"
        className={`m-auto p-8 text-center ${
          theme === "night" ? "text-rose-200" : "text-rose-800"
        }`}
      >
        {error ?? "Este arquivo não contém páginas para exibir."}
      </p>
    );
  }

  const currentPage = pages[pageIndex];

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de quadrinhos"
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-2xl shadow-black/25 sm:rounded-2xl ${
        theme === "night"
          ? "border-white/10 bg-[#151827]"
          : "border-stone-300 bg-[#fffaf0]"
      } ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] min-h-0 w-screen rounded-none border-0"
          : ""
      }`}
    >
      <div
        className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-2 py-2 backdrop-blur sm:px-4 ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/90"
            : "border-stone-300 bg-[#f2eadc]/95"
        }`}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReaderModeToggle
            mode={readingMode}
            onChange={setReadingMode}
            theme={theme}
          />
          <ReaderThemeToggle theme={theme} onChange={setTheme} />
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={pageIndex === 0}
            aria-label="Página anterior"
            className={`inline-flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${
              theme === "night"
                ? "text-slate-200 hover:bg-white/10"
                : "text-stone-700 hover:bg-stone-200"
            }`}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <span
            aria-live="polite"
            className={`min-w-20 text-center text-sm font-semibold tabular-nums ${
              theme === "night" ? "text-slate-200" : "text-stone-800"
            }`}
          >
            {pageIndex + 1}{" "}
            <span
              className={
                theme === "night" ? "text-slate-500" : "text-stone-400"
              }
            >
              /
            </span>{" "}
            {pages.length}
          </span>
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={pageIndex === pages.length - 1 && !onEnd}
            aria-label="Próxima página"
            className={`inline-flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${
              theme === "night"
                ? "text-slate-200 hover:bg-white/10"
                : "text-stone-700 hover:bg-stone-200"
            }`}
          >
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <ReaderZoomControls zoom={zoom} theme={theme} onChange={setZoom} />
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
            className={`inline-flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-violet-500 ${
              theme === "night"
                ? "text-slate-200 hover:bg-white/10"
                : "text-stone-700 hover:bg-stone-200"
            }`}
          >
            <Maximize aria-hidden="true" size={17} />
          </button>
          </div>
        </div>
      </div>

      <figure
        aria-label={`Página ${pageIndex + 1} de ${pages.length}`}
        className={`relative grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] items-stretch gap-1 overflow-hidden p-2 sm:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] sm:gap-3 sm:p-4 ${
          theme === "night"
            ? "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.07),transparent_65%)]"
            : "bg-stone-200"
        }`}
      >
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(-1)}
          disabled={pageIndex === 0}
          aria-label="Página anterior"
          className={`absolute left-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-30 sm:relative sm:left-auto sm:top-auto sm:size-10 sm:translate-y-0 sm:justify-self-center ${
            theme === "night"
              ? "border-white/10 bg-[#202435]/90 text-slate-200 hover:border-violet-200/30 hover:bg-violet-300/15"
              : "border-stone-300 bg-white/90 text-stone-700 hover:border-violet-300 hover:bg-violet-100"
          }`}
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
              ? `col-span-1 h-full space-y-0 overflow-y-auto sm:col-span-3 ${
                  isFullscreen ? "overscroll-contain" : ""
                }`
              : "flex h-full items-stretch"
          }`}
          style={{ touchAction: "pan-x pan-y" }}
        >
          {readingMode === "vertical" ? (
            pages.map((page, index) => (
              <div
                key={`${page.name}-${index}`}
                data-page-index={index}
                className="block w-full"
              >
                <img
                  src={page.url}
                  alt={`Página ${index + 1} de ${pages.length}`}
                  loading={Math.abs(index - pageIndex) <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={(event) =>
                    recordImageDimensions(page.url, event.currentTarget)
                  }
                  className="mx-auto block max-w-none object-contain"
                  style={{
                    transform: `scale(${pinchZoom.previewScale})`,
                    transformOrigin: "center",
                    ...(getDisplayDimensions(
                      imageDimensions[page.url],
                      viewportSize,
                      zoom,
                      false,
                    ) ?? { maxWidth: "100%" }),
                  }}
                />
              </div>
            ))
          ) : (
            <img
              src={currentPage.url}
              alt={`Página ${pageIndex + 1} de ${pages.length}`}
              decoding="async"
              onLoad={(event) =>
                recordImageDimensions(currentPage.url, event.currentTarget)
              }
              className="mx-auto my-0 block max-h-none max-w-none cursor-pointer object-contain shadow-2xl shadow-black/40"
              style={{
                transform: `scale(${pinchZoom.previewScale})`,
                transformOrigin: "center",
                ...(getDisplayDimensions(
                  imageDimensions[currentPage.url],
                  viewportSize,
                  zoom,
                  true,
                ) ?? { maxWidth: "100%", maxHeight: "100%" }),
              }}
            />
          )}
        </div>
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(1)}
          disabled={pageIndex === pages.length - 1 && !onEnd}
          aria-label="Próxima página"
          className={`absolute right-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-30 sm:relative sm:right-auto sm:top-auto sm:size-10 sm:translate-y-0 sm:justify-self-center ${
            theme === "night"
              ? "border-white/10 bg-[#202435]/90 text-slate-200 hover:border-violet-200/30 hover:bg-violet-300/15"
              : "border-stone-300 bg-white/90 text-stone-700 hover:border-violet-300 hover:bg-violet-100"
          }`}
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
        )}
      </figure>

      <footer
        className={`flex min-h-9 shrink-0 items-center justify-between gap-3 border-t px-4 text-xs ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/70 text-slate-400"
            : "border-stone-300 bg-[#f2eadc] text-stone-600"
        }`}
      >
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 font-semibold ${
            theme === "night" ? "text-violet-100" : "text-violet-800"
          }`}
          aria-label={`${Math.max(1, Math.round(((pageIndex + 1) / Math.max(1, pages.length)) * 100))}% dos quadrinhos concluído`}
        >
          <BookOpen
            aria-hidden="true"
            size={15}
            className={theme === "night" ? "text-violet-200" : "text-violet-700"}
          />
          {Math.max(1, Math.round(((pageIndex + 1) / Math.max(1, pages.length)) * 100))}%
          <span className="hidden sm:inline">concluído</span>
        </span>
        {saveStatus === "saving" && (
          <span role="status" className="inline-flex min-w-0 items-center gap-1.5">
            <LoaderCircle aria-hidden="true" size={14} className="shrink-0 animate-spin text-violet-300" />
            <span className="truncate">Sincronizando progresso…</span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span role="status" className="inline-flex items-center gap-1.5">
            <CircleCheck aria-hidden="true" size={14} className="text-emerald-300" />
            Progresso sincronizado
          </span>
        )}
        {saveStatus === "error" && (
          <span
            className={`flex min-w-0 items-center gap-2 ${
              theme === "night" ? "text-rose-200" : "text-rose-800"
            }`}
          >
            <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
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
