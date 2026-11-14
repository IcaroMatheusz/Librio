import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Maximize,
  Minus,
  Plus,
} from "lucide-react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { usePinchZoom } from "../../hooks/usePinchZoom";
import { useReaderTheme } from "../../hooks/useReaderTheme";
import {
  ReaderModeToggle,
  type ReadingMode,
} from "./ReaderModeToggle";
import { PdfContinuousPage } from "./PdfContinuousPage";
import { ReaderThemeToggle } from "./ReaderThemeToggle";
import { ReaderLoading } from "./ReaderLoading";

interface PdfReaderProps {
  file: Blob;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
const PDF_CANVAS_MAX_AREA_IN_BYTES = 16 * 1024 * 1024;
const MAX_CANVAS_PIXELS = 8_000_000;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

export function PdfReader({
  file,
  initialProgress,
  onProgressChange,
}: PdfReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const continuousViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousReadingModeRef = useRef<ReadingMode>("page");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [readingMode, setReadingMode] = useState<ReadingMode>("page");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const pinchZoom = usePinchZoom(zoom, setZoom);
  const { theme, setTheme } = useReaderTheme();

  useEffect(() => {
    let active = true;
    let loadingTask: import("pdfjs-dist").PDFDocumentLoadingTask | null = null;

    async function openPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument({
          data: await file.arrayBuffer(),
          wasmUrl: `${import.meta.env.BASE_URL}pdfjs/`,
          canvasMaxAreaInBytes: PDF_CANVAS_MAX_AREA_IN_BYTES,
        });
        const loadedDocument = await loadingTask.promise;
        if (!active) return;

        const restoredPage =
          initialProgress > 0
            ? Math.min(
                loadedDocument.numPages,
                Math.max(
                  1,
                  Math.ceil((initialProgress / 100) * loadedDocument.numPages),
                ),
              )
            : 1;
        setPdfDocument(loadedDocument);
        setPageNumber(restoredPage);
        setPageInput(String(restoredPage));
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível abrir este PDF.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void openPdf();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [file, initialProgress]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(document.visibilityState === "visible");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      readingMode !== "page" ||
      !pdfDocument ||
      !canvas ||
      !isDocumentVisible
    ) {
      return;
    }
    const activeDocument = pdfDocument;
    const activeCanvas = canvas;

    let cancelled = false;
    let renderTask: import("pdfjs-dist").RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    const renderCanvas = window.document.createElement("canvas");

    async function renderPage() {
      try {
        page = await activeDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(160, (containerWidth || window.innerWidth) - 32);
        const availableHeight = Math.max(
          160,
          (containerHeight || window.innerHeight) - (isFullscreen ? 16 : 32),
        );
        const fitScale = Math.min(
          availableWidth / baseViewport.width,
          availableHeight / baseViewport.height,
        );
        const viewport = page.getViewport({ scale: fitScale * zoom });
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          MAX_DEVICE_PIXEL_RATIO,
          Math.sqrt(
            MAX_CANVAS_PIXELS / (viewport.width * viewport.height),
          ),
        );
        const context = renderCanvas.getContext("2d");
        if (!context) throw new Error("Não foi possível desenhar a página.");

        renderCanvas.width = Math.ceil(viewport.width * pixelRatio);
        renderCanvas.height = Math.ceil(viewport.height * pixelRatio);
        setRenderError(null);
        renderTask = page.render({
          canvas: renderCanvas,
          canvasContext: context,
          viewport,
          transform:
            pixelRatio === 1
              ? undefined
              : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;

        activeCanvas.width = renderCanvas.width;
        activeCanvas.height = renderCanvas.height;
        activeCanvas.style.width = `${viewport.width}px`;
        activeCanvas.style.height = `${viewport.height}px`;
        const displayContext = activeCanvas.getContext("2d");
        if (!displayContext) {
          throw new Error("Não foi possível exibir a página renderizada.");
        }
        displayContext.drawImage(renderCanvas, 0, 0);
      } catch (caughtError) {
        if (!cancelled) {
          setRenderError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível renderizar esta página.",
          );
        }
      } finally {
        page?.cleanup();
        renderCanvas.width = 0;
        renderCanvas.height = 0;
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [
    containerWidth,
    containerHeight,
    isFullscreen,
    isDocumentVisible,
    pageNumber,
    pdfDocument,
    readingMode,
    zoom,
  ]);

  useEffect(() => {
    if (!pdfDocument) return;
    let active = true;
    const requestId = ++saveRequestRef.current;
    const progress = Math.min(
      100,
      Math.max(1, Math.round((pageNumber / pdfDocument.numPages) * 100)),
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
              : "Erro desconhecido ao salvar o progresso.",
          );
          setSaveStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [onProgressChange, pageNumber, pdfDocument, saveAttempt]);

  const navigateToPageNumber = useCallback(
    (nextPage: number) => {
      const boundedPage = Math.min(
        pdfDocument?.numPages ?? pageNumber,
        Math.max(1, nextPage),
      );
      setPageNumber(boundedPage);
      setPageInput(String(boundedPage));
      if (readingMode === "vertical") {
        window.requestAnimationFrame(() => {
          continuousViewportRef.current
            ?.querySelector<HTMLElement>(
              `[data-pdf-page="${boundedPage}"]`,
            )
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [pageNumber, pdfDocument, readingMode],
  );

  const changePage = useCallback(
    (delta: number) => navigateToPageNumber(pageNumber + delta),
    [navigateToPageNumber, pageNumber],
  );

  const handleContinuousPageVisible = useCallback((visiblePage: number) => {
    setPageNumber(visiblePage);
    setPageInput(String(visiblePage));
  }, []);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return;
    function exitImmersiveMode(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", exitImmersiveMode);
    return () => window.removeEventListener("keydown", exitImmersiveMode);
  }, [isFullscreen]);

  useEffect(() => {
    const modeChanged = previousReadingModeRef.current !== readingMode;
    previousReadingModeRef.current = readingMode;
    if (readingMode !== "vertical" || !modeChanged) return;
    window.requestAnimationFrame(() => {
      continuousViewportRef.current
        ?.querySelector<HTMLElement>(`[data-pdf-page="${pageNumber}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  }, [pageNumber, readingMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
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
  }, [changePage, pdfDocument]);

  useEffect(() => {
    const reader =
      readingMode === "page"
        ? pageViewportRef.current
        : continuousViewportRef.current;
    if (!reader) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(reader);
    return () => observer.disconnect();
  }, [readingMode]);

  function navigateToPage(value: string) {
    const page = Number.parseInt(value, 10);
    if (!pdfDocument || !Number.isFinite(page)) {
      setPageInput(String(pageNumber));
      return;
    }
    navigateToPageNumber(page);
  }

  function navigateFromPageClick(event: MouseEvent<HTMLDivElement>) {
    if (pinchZoom.consumePinchClick()) return;
    if (readingMode !== "page") return;
    if (event.button !== 0 || !(event.target instanceof HTMLCanvasElement)) {
      return;
    }

    const bounds = event.target.getBoundingClientRect();
    const clickedRightSide = event.clientX >= bounds.left + bounds.width / 2;
    changePage(clickedRightSide ? 1 : -1);
  }

  if (loading) {
    return (
      <ReaderLoading
        title="Preparando seu PDF"
        detail="Interpretando a estrutura do arquivo e preparando a primeira página…"
        percent={null}
        progressText="Download concluído · construindo o leitor"
      />
    );
  }

  if (error || !pdfDocument) {
    return (
      <p role="alert" className="m-auto max-w-lg p-8 text-center text-rose-200">
        {error ?? "Não foi possível abrir este PDF."}
      </p>
    );
  }

  const readingProgress = Math.round(
    (pageNumber / pdfDocument.numPages) * 100,
  );

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de PDF"
      className={`flex min-h-[72dvh] flex-1 flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-black/25 ${
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
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-2 py-2 backdrop-blur sm:px-4 ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/90"
            : "border-stone-300 bg-[#f2eadc]/95"
        }`}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReaderModeToggle mode={readingMode} onChange={setReadingMode} />
          <ReaderThemeToggle theme={theme} onChange={setTheme} />
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            aria-label="Página anterior"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span className="sr-only">Ir para a página</span>
            <input
              type="number"
              min={1}
              max={pdfDocument.numPages}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => navigateToPage(pageInput)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigateToPage(pageInput);
              }}
              className="h-9 w-14 rounded-lg border border-white/10 bg-[#171A27] text-center text-sm text-white focus-visible:outline-2 focus-visible:outline-violet-200"
            />
            <span aria-live="polite" className="text-slate-500">
              / {pdfDocument.numPages}
            </span>
          </label>
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={pageNumber >= pdfDocument.numPages}
            aria-label="Próxima página"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
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
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <Minus aria-hidden="true" size={18} />
          </button>
          <span className="w-12 text-center text-xs text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(3, current + 0.1))}
            disabled={zoom >= 3}
            aria-label="Aumentar zoom"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-40"
          >
            <Plus aria-hidden="true" size={18} />
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
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
          >
            <Maximize aria-hidden="true" size={17} />
          </button>
          </div>
        </div>
      </div>

      <div
        className={`grid min-h-0 flex-1 overflow-auto p-2 sm:gap-3 sm:p-4 ${
          theme === "night"
            ? "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.07),transparent_65%)]"
            : "bg-stone-200"
        } ${
          readingMode === "page"
            ? "grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1"
            : "grid-cols-1"
        }`}
      >
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          aria-label="Página anterior"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        )}
        {readingMode === "vertical" ? (
          <div
            ref={continuousViewportRef}
            onPointerDown={pinchZoom.handlePointerDown}
            onPointerMove={pinchZoom.handlePointerMove}
            onPointerUp={pinchZoom.handlePointerUp}
            onPointerCancel={pinchZoom.handlePointerCancel}
            className={`h-full min-h-0 overflow-y-auto ${
              isFullscreen ? "overscroll-contain" : ""
            }`}
            data-pdf-scroll-viewport
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          >
            <div
              className={`mx-auto flex w-full flex-col items-center gap-0 ${
                isFullscreen ? "max-w-none" : "max-w-4xl"
              }`}
            >
              {Array.from({ length: pdfDocument.numPages }, (_, index) => (
                <PdfContinuousPage
                  key={index + 1}
                  document={pdfDocument}
                  pageNumber={index + 1}
                  zoom={zoom}
                  width={containerWidth || window.innerWidth}
                  theme={theme}
                  onVisible={handleContinuousPageVisible}
                />
              ))}
            </div>
          </div>
        ) : renderError ? (
          <p role="alert" className="text-center text-sm text-rose-200">
            {renderError}
          </p>
        ) : (
          <div
            ref={pageViewportRef}
            onClick={navigateFromPageClick}
            onPointerDown={pinchZoom.handlePointerDown}
            onPointerMove={pinchZoom.handlePointerMove}
            onPointerUp={pinchZoom.handlePointerUp}
            onPointerCancel={pinchZoom.handlePointerCancel}
            className={`flex min-h-0 min-w-0 overflow-auto ${
              zoom > 1
                ? "items-start justify-start"
                : "items-center justify-center"
            }`}
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          >
            <canvas
              ref={canvasRef}
              aria-label={`Página ${pageNumber} de ${pdfDocument.numPages}`}
              className="cursor-pointer object-contain shadow-2xl shadow-black/30"
              style={{
                transform: `scale(${pinchZoom.previewScale})`,
                filter:
                  theme === "night" ? "invert(0.9) hue-rotate(180deg)" : undefined,
              }}
            />
          </div>
        )}
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() => changePage(1)}
          disabled={pageNumber >= pdfDocument.numPages}
          aria-label="Próxima página"
          className="z-10 inline-flex size-10 items-center justify-center justify-self-center rounded-full border border-white/10 bg-[#202435]/90 text-slate-200 shadow-lg transition hover:border-violet-200/30 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-violet-200 disabled:opacity-30"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
        )}
      </div>

      <footer
        className={`flex min-h-11 items-center justify-between gap-3 border-t px-3 text-xs sm:px-4 ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/70 text-slate-400"
            : "border-stone-300 bg-[#f2eadc] text-stone-600"
        }`}
      >
        <span
          className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-violet-100"
          aria-label={`${readingProgress}% do PDF lido`}
        >
          <BookOpen aria-hidden="true" size={15} className="text-violet-200" />
          {readingProgress}% <span className="hidden sm:inline">lido</span>
        </span>
        {saveStatus === "saving" && (
          <span role="status" className="inline-flex min-w-0 items-center gap-1.5">
            <LoaderCircle
              aria-hidden="true"
              size={14}
              className="shrink-0 animate-spin text-violet-200"
            />
            <span className="truncate">Salvando progresso…</span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span role="status" className="inline-flex items-center gap-1.5">
            <CircleCheck
              aria-hidden="true"
              size={14}
              className="text-emerald-300"
            />
            Progresso salvo
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex min-w-0 items-center gap-1.5 text-rose-200">
            <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
            <span className="truncate" title={saveError ?? undefined}>
              {saveError ?? "Não foi possível salvar o progresso."}
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
