import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

interface PdfContinuousPageProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  width: number;
  theme: ReaderTheme;
  onVisible: (pageNumber: number) => void;
}

const MAX_CANVAS_PIXELS = 8_000_000;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

export function PdfContinuousPage({
  document,
  pageNumber,
  zoom,
  width,
  theme,
  onVisible,
}: PdfContinuousPageProps) {
  const pageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("0.7");
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;

    const root = element.closest("[data-pdf-scroll-viewport]");
    const renderObserver = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry?.isIntersecting ?? false;
        if (isIntersecting) setRenderError(null);
        setIsNearViewport(isIntersecting);
      },
      { root: root instanceof HTMLElement ? root : null, rootMargin: "300% 0px" },
    );
    const visibleObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.1) {
          onVisible(pageNumber);
        }
      },
      { root: root instanceof HTMLElement ? root : null, threshold: 0.1 },
    );
    renderObserver.observe(element);
    visibleObserver.observe(element);
    return () => {
      renderObserver.disconnect();
      visibleObserver.disconnect();
    };
  }, [onVisible, pageNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isNearViewport) return;
    const activeCanvas = canvas;

    let cancelled = false;
    let renderTask: import("pdfjs-dist").RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    const renderCanvas = window.document.createElement("canvas");

    async function renderPage() {
      try {
        page = await document.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        setAspectRatio(`${baseViewport.width} / ${baseViewport.height}`);
        const viewport = page.getViewport({
          scale: (Math.max(240, width - 32) / baseViewport.width) * zoom,
        });
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          MAX_DEVICE_PIXEL_RATIO,
          Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)),
        );
        renderCanvas.width = Math.ceil(viewport.width * pixelRatio);
        renderCanvas.height = Math.ceil(viewport.height * pixelRatio);
        const context = renderCanvas.getContext("2d");
        if (!context) throw new Error("Não foi possível desenhar a página.");

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
      } finally {
        page?.cleanup();
        renderCanvas.width = 0;
        renderCanvas.height = 0;
      }
    }

    void renderPage().catch((error: unknown) => {
      if (!cancelled) {
        setRenderError(
          error instanceof Error
            ? error.message
            : `Não foi possível renderizar a página ${pageNumber}.`,
        );
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      activeCanvas.width = 0;
      activeCanvas.height = 0;
    };
  }, [document, isNearViewport, pageNumber, width, zoom]);

  return (
    <article
      ref={pageRef}
      data-pdf-page={pageNumber}
      aria-label={`Página ${pageNumber}`}
      className="flex w-full justify-center"
      style={{ minHeight: 0 }}
    >
      {renderError ? (
        <p role="alert" className="m-4 text-center text-sm text-rose-200">
          {renderError}
        </p>
      ) : (
        <div
          className="flex w-full items-center justify-center"
          style={{ aspectRatio, maxWidth: Math.max(240, width - 32) * zoom }}
        >
          <canvas
            ref={canvasRef}
            aria-label={`Página ${pageNumber}`}
            className="block max-w-full object-contain"
            style={{
              filter:
                theme === "night" ? "invert(0.9) hue-rotate(180deg)" : undefined,
            }}
          />
        </div>
      )}
    </article>
  );
}
