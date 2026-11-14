import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize,
  Minus,
  Plus,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { ReaderLoading } from "./ReaderLoading";

interface PdfReaderProps {
  file: Blob;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PdfReader({
  file,
  initialProgress,
  onProgressChange,
}: PdfReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas) return;
    const activeDocument = pdfDocument;
    const activeCanvas = canvas;

    let cancelled = false;
    let renderTask: import("pdfjs-dist").RenderTask | null = null;

    async function renderPage() {
      try {
        const page = await activeDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(
          240,
          (containerSize.width || window.innerWidth) - 32,
        );
        const availableHeight = Math.max(
          320,
          (containerSize.height || window.innerHeight) - 32,
        );
        const fitScale = Math.min(
          availableWidth / baseViewport.width,
          availableHeight / baseViewport.height,
        );
        const viewport = page.getViewport({ scale: fitScale * zoom });
        const pixelRatio = window.devicePixelRatio || 1;
        const context = activeCanvas.getContext("2d");
        if (!context) throw new Error("Não foi possível desenhar a página.");

        activeCanvas.width = Math.ceil(viewport.width * pixelRatio);
        activeCanvas.height = Math.ceil(viewport.height * pixelRatio);
        activeCanvas.style.width = `${viewport.width}px`;
        activeCanvas.style.height = `${viewport.height}px`;
        setRenderError(null);
        renderTask = page.render({
          canvas: activeCanvas,
          canvasContext: context,
          viewport,
          transform:
            pixelRatio === 1
              ? undefined
              : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
      } catch (caughtError) {
        if (!cancelled) {
          setRenderError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível renderizar esta página.",
          );
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [
    containerSize.height,
    containerSize.width,
    pageNumber,
    pdfDocument,
    zoom,
  ]);

  useEffect(() => {
    if (!pdfDocument) return;
    let active = true;
    const progress = Math.min(
      100,
      Math.max(1, Math.round((pageNumber / pdfDocument.numPages) * 100)),
    );

    const timeoutId = window.setTimeout(() => {
      setSaveStatus("saving");
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => onProgressChange(progress))
        .then(() => {
          if (active) setSaveStatus("saved");
        })
        .catch(() => {
          if (active) setSaveStatus("error");
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [onProgressChange, pageNumber, pdfDocument, saveAttempt]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft") {
        setPageNumber((current) => Math.max(1, current - 1));
      } else if (event.key === "ArrowRight") {
        setPageNumber((current) =>
          Math.min(pdfDocument?.numPages ?? current, current + 1),
        );
      } else if (event.key === "+" || event.key === "=") {
        setZoom((current) => Math.min(2, current + 0.1));
      } else if (event.key === "-") {
        setZoom((current) => Math.max(0.5, current - 0.1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pdfDocument]);

  useEffect(() => {
    const reader = pageViewportRef.current;
    if (!reader) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(reader);
    return () => observer.disconnect();
  }, []);

  function navigateToPage(value: string) {
    const page = Number.parseInt(value, 10);
    if (!pdfDocument || !Number.isFinite(page)) {
      setPageInput(String(pageNumber));
      return;
    }
    const nextPage = Math.min(pdfDocument.numPages, Math.max(1, page));
    setPageNumber(nextPage);
    setPageInput(String(nextPage));
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

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de PDF"
      className="flex min-h-[72dvh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151827] shadow-2xl shadow-black/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#202435]/90 px-2 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
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
            onClick={() =>
              setPageNumber((page) =>
                Math.min(pdfDocument.numPages, page + 1),
              )
            }
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
            onClick={() => setZoom((current) => Math.min(2, current + 0.1))}
            disabled={zoom >= 2}
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
              } else {
                void readerRef.current?.requestFullscreen();
              }
            }}
            aria-label="Alternar tela cheia"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
          >
            <Maximize aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      <div
        ref={pageViewportRef}
        className="flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.07),transparent_65%)] p-4"
      >
        {renderError ? (
          <p role="alert" className="text-center text-sm text-rose-200">
            {renderError}
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`Página ${pageNumber} de ${pdfDocument.numPages}`}
            className="max-w-full object-contain shadow-2xl shadow-black/30"
          />
        )}
      </div>

      <footer className="flex min-h-9 items-center justify-end border-t border-white/[0.08] bg-[#202435]/70 px-4 text-xs text-slate-400">
        {saveStatus === "saving" && <span role="status">Salvando progresso…</span>}
        {saveStatus === "saved" && <span role="status">Progresso salvo</span>}
        {saveStatus === "error" && (
          <span className="flex items-center gap-2 text-rose-200">
            Não foi possível salvar o progresso.
            <button
              type="button"
              onClick={() => setSaveAttempt((attempt) => attempt + 1)}
              className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-200"
            >
              Tentar novamente
            </button>
          </span>
        )}
      </footer>
    </section>
  );
}
